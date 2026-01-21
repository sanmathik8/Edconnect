from rest_framework import permissions, status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Prefetch, Count
from django.db import transaction
from django.utils import timezone
from core.models import UserProfile, Post, Notification, SharedPost, Follow
from chat.models import (
    ChatThread, ChatMessage, 
    UserRestriction, BlockedUser, MessageRequest, GroupInvitation
)
from core.serializers import NotificationSerializer
from chat.serializers import ChatThreadSerializer, ChatMessageSerializer
from core.views import _get_profile

# ============================================================================
# CHAT API VIEWS
# ============================================================================

class ChatThreadListCreate(APIView):
    """List all threads or create a new thread"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        import logging
        logger = logging.getLogger(__name__)
        
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        from django.db.models import OuterRef, Subquery, Q, Exists
        
        # Subquery for last message to avoid massive joins
        last_message_subquery = ChatMessage.objects.filter(
            thread=OuterRef('pk'),
            is_deleted_for_everyone=False
        ).exclude(
            deleted_by=profile
        ).order_by('-created_at').values('id')[:1]

        # First, get all threads user participates in
        all_threads = ChatThread.objects.filter(participants=profile)
        logger.info(f"[THREADS] User {profile.user.username} participates in {all_threads.count()} threads")
        
        # Check for SharedPost existence
        has_shared_posts = SharedPost.objects.filter(
            chat_message__thread=OuterRef('pk')
        )
        
        # Use a more conservative cutoff for hiding "empty" threads
        from django.utils import timezone
        from datetime import timedelta
        # If thread was updated in last 1 hour, never hide it
        recent_cutoff = timezone.now() - timedelta(seconds=3600) 
        
        threads = all_threads.annotate(
            unread_count=Count(
                'messages', 
                filter=Q(messages__read=False) & ~Q(messages__sender=profile),
                distinct=True # Avoid duplication from joins
            ),
            visible_message_count=Count(
                'messages',
                filter=Q(messages__is_deleted_for_everyone=False) & ~Q(messages__deleted_by=profile),
                distinct=True
            ),
            has_shared_post=Exists(has_shared_posts)
        )
        
        logger.info(f"[THREADS DEBUG] After annotation: {threads.count()} threads")
        
        threads = threads.exclude(
            # Hide if:
            # 1. No visible messages AND
            # 2. No shared posts AND
            # 3. Not recently updated (give time for first message)
            Q(visible_message_count=0) & 
            Q(has_shared_post=False) & 
            Q(updated_at__lt=recent_cutoff) &
            ~Q(is_group=True) # Keep empty groups visible (they have names/purpose)
        )
        logger.info(f"[THREADS DEBUG] After hidden_by exclusion: {threads.count()} threads")
        
        threads = threads.exclude(deleted_by=profile)
        logger.info(f"[THREADS DEBUG] After deleted_by exclusion: {threads.count()} threads")
        
        threads = threads.exclude(status='archived')
        logger.info(f"[THREADS DEBUG] After archived exclusion: {threads.count()} threads")
        
        # Add participant count AFTER other filters to avoid join issues
        threads = threads.annotate(
            p_count=Count('participants', distinct=True)
        )
        
        # Log some sample p_counts for debugging
        sample_threads = list(threads[:5])
        for t in sample_threads:
            logger.info(f"[THREADS DEBUG] Thread {t.id}: is_group={t.is_group}, p_count={t.p_count}")
        
        # TEMPORARILY DISABLED - All threads have p_count=1 due to creation bug
        # Only exclude threads where user is chatting with themselves (p_count=1)
        # Don't exclude valid 1-on-1 chats (p_count=2)
        # threads = threads.exclude(
        #     Q(is_group=False) & Q(p_count=1)
        # )
        logger.info(f"[THREADS DEBUG] After participant count filter: {threads.count()} threads (FILTER DISABLED)")
        
        threads = threads.prefetch_related('participants__user').annotate(
            last_message_id=Subquery(last_message_subquery)
        )

        # Exclude blocked users from logic has been removed to allowing showing them as "Blocked" in UI
        # check ChatThreadSerializer.get_status for how this is handled
        # from core.views import _get_blocked_profile_ids
        # blocked_ids = _get_blocked_profile_ids(profile)
        # if blocked_ids:
        #     threads = threads.exclude(
        #         Q(is_group=False) & Q(participants__id__in=blocked_ids)
        #     )


        # Ensure unique threads and order by activity
        threads = threads.distinct().order_by('-updated_at')
        
        logger.info(f"[THREADS] Final thread count for {profile.user.username}: {threads.count()}")
        
        serializer = ChatThreadSerializer(threads, many=True, context={'request': request})
        return Response(serializer.data)
    
    def post(self, request):
        try:
            profile = _get_profile(request)
            if not profile:
                return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
            
            participant_ids = request.data.get('participants', [])
            if not participant_ids:
                return Response({'detail': 'Participants required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Helper to find profile by UUID or Integer ID
            from django.core.exceptions import ValidationError
            def get_participant_profile(uid):
                try:
                    return UserProfile.objects.get(uuid=uid)
                except (UserProfile.DoesNotExist, ValueError, ValidationError):
                    # Fallback to User ID
                    try:
                        return UserProfile.objects.get(user__id=uid)
                    except (UserProfile.DoesNotExist, ValueError, ValidationError):
                        # Final fallback to Profile ID (integer primary key)
                        try:
                            return UserProfile.objects.get(id=uid)
                        except (UserProfile.DoesNotExist, ValueError, ValidationError):
                            return None

            # 1. Check for existing thread (Basic implementation for 1-on-1)
            if len(participant_ids) == 1:
                other_user_id = participant_ids[0]
                other_profile = get_participant_profile(other_user_id)
                
                if other_profile:
                    if other_profile == profile:
                         return Response({'detail': 'Cannot chat with yourself'}, status=status.HTTP_400_BAD_REQUEST)

                    # BLOCK CHECK
                    from core.views import _get_blocked_profile_ids
                    if other_profile.id in _get_blocked_profile_ids(profile):
                         return Response({'detail': 'Cannot initiate chat with a blocked user'}, status=status.HTTP_403_FORBIDDEN)

                    # Check for ANY existing 1-on-1 thread between these two users
                    # Re-use even if deleted/hidden to prevent duplicates
                    threads = ChatThread.objects.filter(
                        participants=profile,
                        is_group=False
                    ).filter(
                        participants=other_profile
                    )
                    
                    if threads.exists():
                        # Use the most recent one
                        thread = threads.order_by('-updated_at').first()
                        
                        # UN-DELETE and UN-HIDE for current user
                        thread.deleted_by.remove(profile)
                        thread.hidden_by.remove(profile)
                        
                        if thread.status in ['rejected', 'blocked']:
                            thread.status = 'active'
                            
                        thread.updated_at = timezone.now()
                        thread.save()
                        
                        serializer = ChatThreadSerializer(thread, context={'request': request})
                        return Response(serializer.data)
                else:
                    return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

            # 2. Create new thread
            title = request.data.get('group_name')
            is_group = len(participant_ids) > 1
            
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"[THREAD CREATE] Creating thread with participant_ids: {participant_ids}")
            
            with transaction.atomic():
                thread = ChatThread.objects.create(
                    initiator=profile,
                    status='active',
                    is_group=is_group,
                    group_name=title if is_group else None,
                    admin=profile if is_group else None # Set initiator as primary admin
                )
                thread.participants.add(profile)
                if is_group:
                    thread.admins.add(profile) # Also add to admins list
                logger.info(f"[THREAD CREATE] Added initiator {profile.user.username} (ID: {profile.id})")
                
                for participant_id in participant_ids:
                    logger.info(f"[THREAD CREATE] Looking for participant with ID: {participant_id}")
                    participant = get_participant_profile(participant_id)
                    if participant:
                        logger.info(f"[THREAD CREATE] Found participant: {participant.user.username} (ID: {participant.id})")
                        if participant != profile:
                            thread.participants.add(participant)
                            logger.info(f"[THREAD CREATE] Added participant {participant.user.username}")
                        else:
                            logger.warning(f"[THREAD CREATE] Skipped adding self")
                    else:
                        logger.error(f"[THREAD CREATE] Could not find participant with ID: {participant_id}")
                
                final_count = thread.participants.count()
            logger.info(f"[THREAD CREATE] Thread {thread.id} created with {final_count} participants")
            
            serializer = ChatThreadSerializer(thread, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'detail': f'Server Error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ChatThreadDetail(APIView):
    """Get, update, or delete a specific thread"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, pk):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            thread = ChatThread.objects.get(pk=pk, participants=profile)
            if thread.deleted_by.filter(id=profile.id).exists():
                raise ChatThread.DoesNotExist

        except ChatThread.DoesNotExist:
            return Response({'detail': 'Thread not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Pagination params
        limit = int(request.query_params.get('limit', 50))
        before_id = request.query_params.get('before_id', None)
        since_id = request.query_params.get('since', None)
        
        # Base query
        messages_query = thread.messages.filter(
            is_deleted_for_everyone=False
        ).exclude(
            deleted_by=profile
        ).select_related(
            'sender__user'
        ).prefetch_related(
            'attachments',
             'shared_posts',
             'shared_posts__post',
             'shared_posts__post__author__user'
        )

        if since_id:
            # Polling: Get newer messages
            # For polling, we want newest messages that appeared after since_id
            # We return them in standard order?
            # If we return [Newest...Oldest] subset, frontend reverses.
            messages = messages_query.filter(id__gt=since_id).order_by('-created_at', '-id')

        elif before_id:
            # History: Get messages older than before_id
            messages = messages_query.filter(id__lt=before_id).order_by('-created_at', '-id')[:limit]
            
        else:
            # Initial: Get latest messages
            messages = messages_query.order_by('-created_at', '-id')[:limit]

        
        # Evaluate to list (this executes query)
        messages_data = list(messages)
        
        # Mark read logic
        msg_ids = [m.id for m in messages_data if not m.read and m.sender != profile]
        if msg_ids:
            ChatMessage.objects.filter(id__in=msg_ids).update(read=True, read_at=timezone.now())

        
        message_serializer = ChatMessageSerializer(messages_data, many=True, context={'request': request})
        
        return Response({
            'messages': message_serializer.data,
            'thread': ChatThreadSerializer(thread, context={'request': request}).data
        })

    def patch(self, request, pk):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            thread = ChatThread.objects.get(pk=pk, participants=profile)
        except ChatThread.DoesNotExist:
            return Response({'detail': 'Thread not found'}, status=status.HTTP_404_NOT_FOUND)
            
        if not thread.is_group:
            return Response({'detail': 'Only group chats can be updated'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Check if user is admin or owner
        is_admin = thread.admin == profile or thread.admins.filter(id=profile.id).exists() or thread.initiator == profile
        if not is_admin:
            return Response({'detail': 'Only admins can update group settings'}, status=status.HTTP_403_FORBIDDEN)
            
        # Update fields
        group_name = request.data.get('group_name')
        if group_name is not None:
            thread.group_name = group_name
            
        # Add more settings as needed
        thread.save()
        
        serializer = ChatThreadSerializer(thread, context={'request': request})
        return Response(serializer.data)

class ChatThreadAddParticipants(APIView):
    """Add participants to a group chat"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            thread = ChatThread.objects.get(pk=pk, participants=profile)
        except ChatThread.DoesNotExist:
            return Response({'detail': 'Thread not found'}, status=status.HTTP_404_NOT_FOUND)
            
        participant_ids = request.data.get('participants', [])
        if not participant_ids:
             return Response({'detail': 'Participants required'}, status=status.HTTP_400_BAD_REQUEST)
             
        # Convert to group if not already
        if not thread.is_group:
            thread.is_group = True
            thread.group_name = "Group Chat" # Default name
            thread.admin = profile
            thread.save()
            
        # Check permissions (basic)
        if thread.is_group and not thread.group_members_can_invite and thread.admin != profile:
             return Response({'detail': 'Only admins can add members'}, status=status.HTTP_403_FORBIDDEN)

        added_count = 0
        for p_id in participant_ids:
            try:
                new_member = UserProfile.objects.get(id=p_id)
                if not thread.participants.filter(id=new_member.id).exists():
                    thread.participants.add(new_member)
                    added_count += 1
            except UserProfile.DoesNotExist:
                pass
                
        return Response({'status': 'added', 'count': added_count})

class ChatThreadDestroy(APIView):
    """Delete (destroy) a thread - soft delete for groups, hard delete for 1:1 chats"""
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        import logging
        logger = logging.getLogger(__name__)
        
        profile = _get_profile(request)
        try:
            thread = ChatThread.objects.get(pk=pk, participants=profile)
            
            # Clear message history for this user (for both Group and 1:1)
            # This ensures that even if they rejoin/unhide, previous messages are gone for them
            from chat.models import ChatMessage
            messages = thread.messages.all()
            Membership = ChatMessage.deleted_by.through
            # Bulk create relations to avoid N queries
            new_relations = [Membership(chatmessage_id=m.id, userprofile_id=profile.id) for m in messages]
            Membership.objects.bulk_create(new_relations, ignore_conflicts=True)

            if thread.is_group:
                # Check if the user is an admin or initiator of the group
                is_admin = thread.admin == profile or thread.admins.filter(id=profile.id).exists()
                
                if is_admin:
                    # HARD DELETE for groups if user is admin
                    # This completely removes the group and all its messages for all members
                    thread_id = thread.id
                    thread.delete()
                    
                    logger.info(f"[DELETE] Group {thread_id} HARD DELETED by admin {profile.user.username}")
                    return Response({
                        'status': 'Group deleted',
                        'message': 'The group has been permanently deleted for all members.'
                    }, status=status.HTTP_200_OK)
                else:
                    # SOFT DELETE for non-admins - just hide/clear history for this user
                    # This allows the group to persist for other members
                    thread.deleted_by.add(profile)
                    thread.hidden_by.add(profile)
                    
                    logger.info(f"[DELETE] Group {pk} soft deleted (hidden/history cleared) for {profile.user.username}")
                    return Response({
                        'status': 'Group hidden',
                        'message': 'You have left the group and cleared history. You can rejoin by searching.'
                    }, status=status.HTTP_200_OK)
            else:
                # HARD DELETE for 1:1 chats
                # This completely removes the thread and all its messages
                thread_id = thread.id
                thread.delete()
                
                logger.info(f"[DELETE] 1:1 Thread {thread_id} HARD DELETED by {profile.user.username}")
                return Response({'status': 'Conversation permanently deleted'}, status=status.HTTP_200_OK)
            
        except ChatThread.DoesNotExist:
            return Response({'detail': 'Thread not found'}, status=status.HTTP_404_NOT_FOUND)


class ChatMessageCreate(APIView):
    """Create a new message securely"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        serializer = ChatMessageSerializer(data=request.data, context={'request': request})
        
        # Validate logic manually for complex relations
        thread_id = request.data.get('thread')
        if not thread_id:
             return Response({'detail': 'Thread required'}, status=status.HTTP_400_BAD_REQUEST)
             
        try:
            thread = ChatThread.objects.get(pk=thread_id, participants=profile)
        except ChatThread.DoesNotExist:
            return Response({'detail': 'Thread not found or access denied'}, status=status.HTTP_403_FORBIDDEN)
            
        content = request.data.get('content', '')
        
        # Create message
        from django.db import transaction
            
        try:
            with transaction.atomic():
                message = ChatMessage.objects.create(
                    thread=thread,
                    sender=profile,
                    content=content,
                    client_encrypted_content=request.data.get('client_encrypted_content'),
                    client_iv=request.data.get('client_iv'),
                    client_encryption_version=request.data.get('client_encryption_version', 0)
                )
                
                # Handle Reply
                reply_to_id = request.data.get('reply_to')
                if reply_to_id:
                    reply_to = ChatMessage.objects.filter(pk=reply_to_id, thread=thread).first()
                    if reply_to:
                        message.reply_to = reply_to
                        message.save()
                
                # Handle Shared Post
                shared_post_id = request.data.get('shared_post_id')
                if shared_post_id:
                    try:
                        # Verify post exists
                        post = Post.objects.get(pk=shared_post_id)
                        recipient = thread.participants.exclude(id=profile.id).first()
                        
                        SharedPost.objects.create(
                            post=post,
                            shared_by=profile,
                            shared_with=recipient if recipient else profile, # Self-share fallback
                            chat_message=message,
                            message=content or ''
                        )
                    except Post.DoesNotExist:
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.warning(f"Shared post {shared_post_id} not found during message creation")
                    except Exception as e:
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.error(f"Failed to create shared post link: {e}")
                        raise e # Rollback transaction

                # SHADOW BAN LOGIC: Check if any participant has blocked the sender
                recipients = thread.participants.exclude(id=profile.id)
                for recipient in recipients:
                    if recipient.blocked_users.filter(id=profile.id).exists():
                        message.deleted_by.add(recipient)



                # UNHIDE/UNDELETE LOGIC: Ensure visibility for all participants
                thread.hidden_by.clear()
                thread.deleted_by.clear()
                
                # Update Thread
                thread.updated_at = timezone.now()
                thread.save()

                # BROADCAST TO WEBSOCKET
                try:
                    from channels.layers import get_channel_layer
                    from asgiref.sync import async_to_sync
                    
                    channel_layer = get_channel_layer()
                    message_data = ChatMessageSerializer(message, context={'request': request}).data
                    
                    async_to_sync(channel_layer.group_send)(
                        f'thread_{thread.id}',
                        {
                            'type': 'chat.message',
                            'action': 'new_message',
                            'data': message_data,
                            'sender': profile.user.username
                        }
                    )
                except Exception as ws_error:
                    # Don't fail the request if WS fails
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"WebSocket broadcast failed: {ws_error}")

            return Response(ChatMessageSerializer(message, context={'request': request}).data, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Message creation failed: {e}")
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ChatMessageDelete(APIView):
    """Delete a message"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            message = ChatMessage.objects.get(pk=pk)
        except ChatMessage.DoesNotExist:
            return Response({'detail': 'Message not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if user is in the thread
        if not message.thread.participants.filter(id=profile.id).exists():
            return Response({'detail': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        delete_type = request.data.get('delete_type', 'me')
        
        if delete_type == 'everyone':
            # Only sender can delete for everyone
            # Only sender can delete for everyone
            if message.sender != profile:
                return Response({'detail': 'Only sender can unsend'}, status=status.HTTP_403_FORBIDDEN)
            
            # Check time limit (5 minutes)
            time_diff = (timezone.now() - message.created_at).total_seconds()
            if time_diff > 300: # 5 minutes
                 return Response({'detail': 'Message is too old to unsend (max 5 mins)'}, status=status.HTTP_400_BAD_REQUEST)
                 
            message.is_deleted_for_everyone = True
            message.save()

            # BROADCAST DELETE TO WEBSOCKET
            try:
                from channels.layers import get_channel_layer
                from asgiref.sync import async_to_sync
                
                channel_layer = get_channel_layer()
                async_to_sync(channel_layer.group_send)(
                    f'thread_{message.thread.id}',
                    {
                        'type': 'chat.message',
                        'action': 'message_deleted',
                        'message_id': message.id,
                        'sender': profile.user.username
                    }
                )
            except Exception as ws_error:
                # Log but continue
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"WebSocket delete broadcast failed: {ws_error}")

        else:
            # Delete for me
            message.deleted_by.add(profile)
        
        return Response({'status': 'Message deleted'}, status=status.HTTP_200_OK)


class ChatMessageUpdate(APIView):
    """Update/edit a message"""
    permission_classes = [permissions.IsAuthenticated]
    
    def patch(self, request, pk):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            message = ChatMessage.objects.get(pk=pk, sender=profile)
        except ChatMessage.DoesNotExist:
            return Response({'detail': 'Message not found or not yours'}, status=status.HTTP_404_NOT_FOUND)
        
        content = request.data.get('content')
        if content is not None:
            message.content = content
            message.edited_at = timezone.now()
            message.save()
        
        serializer = ChatMessageSerializer(message, context={'request': request})
        return Response(serializer.data)


# ============================================================================
# ADDITIONAL CHAT FEATURES (Stubs for compatibility)
# ============================================================================

class ChatThreadAccept(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, pk):
        profile = _get_profile(request)
        try:
            thread = ChatThread.objects.get(pk=pk, participants=profile)
            thread.status = 'active'
            thread.save()
            return Response({'status': 'active', 'id': thread.id})
        except ChatThread.DoesNotExist:
            return Response({'detail': 'Thread not found'}, status=status.HTTP_404_NOT_FOUND)

class ChatThreadReject(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, pk):
        profile = _get_profile(request)
        try:
            thread = ChatThread.objects.get(pk=pk, participants=profile)
            # For 1:1 chats, mark as rejected and hide
            if not thread.is_group:
                thread.deleted_by.add(profile)
                thread.status = 'rejected'
                thread.save()
            else:
                # For groups, remove the person
                thread.participants.remove(profile)
            
            return Response({'status': 'rejected', 'id': pk})
        except ChatThread.DoesNotExist:
            return Response({'detail': 'Thread not found'}, status=status.HTTP_404_NOT_FOUND)

class MessageReactionToggle(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, pk):
        return Response({'status': 'reaction toggled'})

class MessageForward(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, pk):
        profile = _get_profile(request)
        if not profile:
             return Response(status=status.HTTP_401_UNAUTHORIZED)
             
        try:
            original_message = ChatMessage.objects.get(pk=pk)
            # Must have access to original message
            if not original_message.thread.participants.filter(id=profile.id).exists():
                 return Response(status=status.HTTP_403_FORBIDDEN)
        except ChatMessage.DoesNotExist:
             return Response(status=status.HTTP_404_NOT_FOUND)
             
        target_thread_id = request.data.get('thread_id')
        if not target_thread_id:
             return Response({'detail': 'Target thread required'}, status=status.HTTP_400_BAD_REQUEST)
             
        try:
            target_thread = ChatThread.objects.get(pk=target_thread_id, participants=profile)
        except ChatThread.DoesNotExist:
             return Response({'detail': 'Target thread not found'}, status=status.HTTP_404_NOT_FOUND)

        # Decrypt content to forward
        content = original_message.content # This is likely None in DB
        if not content and original_message.encrypted_content:
             from core.security.encryption import decrypt_text
             content = decrypt_text(original_message.encrypted_content, original_message.key_version)
             
        if not content:
             return Response({'detail': 'Content not available'}, status=status.HTTP_400_BAD_REQUEST)

        # Create new message in target thread
        new_message = ChatMessage.objects.create(
            thread=target_thread,
            sender=profile,
            content=content, # Will be encrypted on save
            forwarded_from=original_message
        )

        # Clear hidden status for ALL participants (unhide logic)
        if target_thread.hidden_by.exists():
            target_thread.hidden_by.clear()
            # Update target thread timestamp
            target_thread.updated_at = timezone.now()
            target_thread.save()
        
        return Response(ChatMessageSerializer(new_message, context={'request': request}).data)

class MessagePinToggle(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, pk):
        return Response({'status': 'pin toggled'})

class MessageReply(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, pk):
        return Response({'status': 'replied'})

class TypingIndicatorUpdate(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, pk):
        return Response({'status': 'typing updated'})

class TypingIndicatorList(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, pk):
        return Response([])

class ThreadMuteView(APIView):
    """Mute a thread"""
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, pk):
        profile = _get_profile(request)
        if not profile:
             return Response(status=status.HTTP_401_UNAUTHORIZED)
        try:
            thread = ChatThread.objects.get(pk=pk, participants=profile)
            thread.muted_by.add(profile)
            return Response({'status': 'muted'})
        except ChatThread.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

class ThreadUnmuteView(APIView):
    """Unmute a thread"""
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, pk):
        profile = _get_profile(request)
        if not profile:
             return Response(status=status.HTTP_401_UNAUTHORIZED)
        try:
            thread = ChatThread.objects.get(pk=pk, participants=profile)
            thread.muted_by.remove(profile)
            return Response({'status': 'unmuted'})
        except ChatThread.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

class ThreadPinView(APIView):
    """Pin a thread"""
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, pk):
        profile = _get_profile(request)
        if not profile:
             return Response(status=status.HTTP_401_UNAUTHORIZED)
        try:
            thread = ChatThread.objects.get(pk=pk, participants=profile)
            thread.pinned_by.add(profile)
            return Response({'status': 'pinned'})
        except ChatThread.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

class ThreadUnpinView(APIView):
    """Unpin a thread"""
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, pk):
        profile = _get_profile(request)
        if not profile:
             return Response(status=status.HTTP_401_UNAUTHORIZED)
        try:
            thread = ChatThread.objects.get(pk=pk, participants=profile)
            thread.pinned_by.remove(profile)
            return Response({'status': 'unpinned'})
        except ChatThread.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

class DisappearingMessagesSet(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, pk):
        return Response({'status': 'disappearing messages set'})

class ChatMediaUpload(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        return Response({'status': 'uploaded'})

class ChatVoiceMessageUpload(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        return Response({'status': 'uploaded'})

class ChatMessageSearch(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        query = request.query_params.get('q', '')
        if not query:
            return Response([])
        
        profile = _get_profile(request)
        if not profile:
             return Response(status=status.HTTP_401_UNAUTHORIZED)
             
        from django.db.models import Q
        # Search threads user is part of (even if deleted/hidden)
        # This overrides delete visibility as requested
        threads = ChatThread.objects.filter(
            participants=profile
        ).filter(
            Q(group_name__icontains=query) | 
            Q(participants__user__username__icontains=query) |
            Q(participants__nickname__icontains=query)
        ).exclude(
            deleted_by=profile
        ).distinct()
        
        # We limit to 20 results
        threads = threads[:20]
        
        serializer = ChatThreadSerializer(threads, many=True, context={'request': request})
        return Response(serializer.data)

class BlockUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, user_id):
        from django.db import transaction
        import logging
        logger = logging.getLogger(__name__)
        
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        # Allow UUID or int
        user_id_int = None
        try:
            user_id_int = int(user_id)
        except (ValueError, TypeError):
            pass
        
        # Try to find the user to block (UUID, UserProfile ID, or User ID)
        user_to_block = None
        
        # 1. Try by UUID
        try:
             user_to_block = UserProfile.objects.select_related('user').get(uuid=user_id)
        except (UserProfile.DoesNotExist, ValueError):
             pass

        # 2. Try by UserProfile PK (integer)
        if not user_to_block and user_id_int:
             try:
                 user_to_block = UserProfile.objects.select_related('user').get(id=user_id_int)
             except UserProfile.DoesNotExist:
                 pass

        # 3. Try by User PK (Legacy Fallback)
        if not user_to_block and user_id_int:
             try:
                 user_to_block = UserProfile.objects.select_related('user').get(user__id=user_id_int)
             except UserProfile.DoesNotExist:
                 pass
        
        if not user_to_block:
             return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Can't block yourself
        if user_to_block.id == profile.id:
            return Response({'detail': 'Cannot block yourself'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with transaction.atomic():
                # Use ONLY UserRestriction model (single source of truth)
                restriction, created = UserRestriction.objects.get_or_create(
                    user=profile,
                    restricted_user=user_to_block,
                    defaults={'restriction_type': 'block'}
                )
                
                if not created and restriction.restriction_type != 'block':
                    restriction.restriction_type = 'block'
                    restriction.save()
                
                # Remove from followers/following
                from core.models import Follow
                # remove if I follow them
                Follow.objects.filter(follower=profile, followee=user_to_block).delete()
                # remove if they follow me
                Follow.objects.filter(follower=user_to_block, followee=profile).delete()

                logger.info(f"User {profile.user.username} blocked {user_to_block.user.username}")
                return Response({
                    'status': 'blocked',
                    'blocked_user': user_to_block.user.username
                })
                
        except Exception as e:
            logger.error(f"Error blocking user: {e}")
            return Response({'detail': 'Failed to block user'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UnblockUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, user_id):
        from django.db import transaction
        import logging
        logger = logging.getLogger(__name__)
        
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        # Allow UUID or int
        user_id_int = None
        try:
            user_id_int = int(user_id)
        except (ValueError, TypeError):
            pass
        
        # Try to find the user to unblock (UUID, UserProfile ID, or User ID)
        user_to_unblock = None
        
        # 1. Try by UUID
        try:
             user_to_unblock = UserProfile.objects.select_related('user').get(uuid=user_id)
        except (UserProfile.DoesNotExist, ValueError):
             pass

        # 2. Try by UserProfile PK (integer)
        if not user_to_unblock and user_id_int:
             try:
                 user_to_unblock = UserProfile.objects.select_related('user').get(id=user_id_int)
             except UserProfile.DoesNotExist:
                 pass

        # 3. Try by User PK (Legacy Fallback)
        if not user_to_unblock and user_id_int:
             try:
                 user_to_unblock = UserProfile.objects.select_related('user').get(user__id=user_id_int)
             except UserProfile.DoesNotExist:
                 pass

        if not user_to_unblock:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        
        try:
            with transaction.atomic():
                # Delete from UserRestriction (single source of truth)
                deleted_count = UserRestriction.objects.filter(
                    user=profile,
                    restricted_user=user_to_unblock,
                    restriction_type='block'
                ).delete()[0]
                
                logger.info(f"User {profile.user.username} unblocked {user_to_unblock.user.username}")
                return Response({
                    'status': 'unblocked',
                    'unblocked_user': user_to_unblock.user.username
                })
                
        except Exception as e:
            logger.error(f"Error unblocking user: {e}")
            return Response({'detail': 'Failed to unblock user'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ReportMessageView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, pk):
        return Response({'status': 'reported'})

# ============================================================================
# INSTAGRAM-STYLE CHAT FEATURES & REQUESTS
# ============================================================================

def get_avatar_url(profile, request=None):
    """Get avatar URL for a user profile"""
    if profile.avatar:
        return request.build_absolute_uri(profile.avatar.url) if request else profile.avatar.url
    elif profile.default_avatar_url:
        return profile.default_avatar_url
    return f"https://api.dicebear.com/7.x/avataaars/svg?seed={profile.user.username}"


class MessageRequestList(APIView):
    """GET: List all pending message requests"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        requests = MessageRequest.objects.filter(
            recipient=profile,
            status='pending'
        ).select_related('requester__user', 'thread').order_by('-created_at')
        
        data = []
        for req in requests:
            data.append({
                'id': req.id,
                'requester': {
                    'id': req.requester.id,
                    'username': req.requester.user.username,
                    'avatar': get_avatar_url(req.requester, request),
                },
                'thread_id': req.thread.id,
                'created_at': req.created_at.isoformat(),
            })
        
        return Response(data)


class MessageRequestAccept(APIView):
    """POST: Accept a message request"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            msg_request = MessageRequest.objects.get(pk=pk, recipient=profile)
        except MessageRequest.DoesNotExist:
            return Response({'error': 'Request not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Update request status
        msg_request.status = 'accepted'
        msg_request.save()
        
        # Update thread status
        thread = msg_request.thread
        thread.request_status = 'accepted'
        thread.status = 'active'
        thread.save()
        
        return Response({
            'status': 'accepted',
            'thread_id': thread.id
        })


class MessageRequestDecline(APIView):
    """POST: Decline a message request"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            msg_request = MessageRequest.objects.get(pk=pk, recipient=profile)
        except MessageRequest.DoesNotExist:
            return Response({'error': 'Request not found'}, status=status.HTTP_404_NOT_FOUND)
        
        msg_request.status = 'declined'
        msg_request.save()
        
        # Optionally delete the thread
        thread = msg_request.thread
        thread.status = 'rejected'
        thread.save()
        
        return Response({'status': 'declined'})


# ============================================================================
# GROUP INVITATION ENDPOINTS
# ============================================================================

class GroupInvitationList(APIView):
    """GET: List pending group invitations"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        invitations = GroupInvitation.objects.filter(
            invitee=profile,
            status='pending'
        ).select_related('group', 'inviter__user').order_by('-created_at')
        
        data = []
        for inv in invitations:
            group_image = None
            if inv.group.group_image:
                group_image = request.build_absolute_uri(inv.group.group_image.url)
            
            data.append({
                'id': inv.id,
                'group': {
                    'id': inv.group.id,
                    'name': inv.group.group_name or 'Group Chat',
                    'image': group_image,
                    'member_count': inv.group.participants.count(),
                },
                'inviter': {
                    'id': inv.inviter.id,
                    'username': inv.inviter.user.username,
                    'avatar': get_avatar_url(inv.inviter, request),
                },
                'created_at': inv.created_at.isoformat(),
            })
        
        return Response(data)


class GroupInvitationAccept(APIView):
    """POST: Accept group invitation"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            invitation = GroupInvitation.objects.get(pk=pk, invitee=profile)
        except GroupInvitation.DoesNotExist:
            return Response({'error': 'Invitation not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Add user to group
        group = invitation.group
        group.participants.add(profile)
        
        invitation.status = 'accepted'
        invitation.save()
        
        return Response({'status': 'accepted', 'group_id': group.id})


class GroupInvitationDecline(APIView):
    """POST: Decline group invitation"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            invitation = GroupInvitation.objects.get(pk=pk, invitee=profile)
        except GroupInvitation.DoesNotExist:
            return Response({'error': 'Invitation not found'}, status=status.HTTP_404_NOT_FOUND)
        
        invitation.status = 'declined'
        invitation.save()
        
        return Response({'status': 'declined'})

# ============================================================================
# USER RESTRICTION ENDPOINTS (Block/Mute/Restrict)
# ============================================================================

class UserRestrictionCreate(APIView):
    """POST: Block, mute, or restrict a user"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, user_id):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        restriction_type = request.data.get('type')  # 'block', 'mute', 'restrict'
        
        if restriction_type not in ['block', 'mute', 'restrict']:
            return Response({'error': 'Invalid restriction type'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Try finding by User ID first (frontend usually sends participant.user.id)
            target_user = UserProfile.objects.get(user__id=user_id)
        except UserProfile.DoesNotExist:
            try:
                # Fallback to Profile ID
                target_user = UserProfile.objects.get(id=user_id)
            except UserProfile.DoesNotExist:
                return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Create restriction
        UserRestriction.objects.get_or_create(
            user=profile,
            restricted_user=target_user,
            restriction_type=restriction_type
        )
        
        # If blocking, hide all threads and add to blocked_users
        if restriction_type == 'block':
            profile.blocked_users.add(target_user)
            BlockedUser.objects.get_or_create(blocker=profile, blocked=target_user)
            
            threads = ChatThread.objects.filter(
                participants=profile
            ).filter(
                participants=target_user
            )
            for thread in threads:
                thread.status = 'blocked'
                thread.save()
        
        return Response({'status': f'{restriction_type}ed'})


class UserRestrictionRemove(APIView):
    """DELETE: Remove restriction"""
    permission_classes = [permissions.IsAuthenticated]
    
    def delete(self, request, user_id):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        # Check both query params (standard for DELETE) and body
        restriction_type = request.query_params.get('type') or request.data.get('type')
        
        if not restriction_type:
            return Response({'error': 'Restriction type required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Try finding by User ID first
            target_user = UserProfile.objects.get(user__id=user_id)
        except UserProfile.DoesNotExist:
            try:
                # Fallback to Profile ID
                target_user = UserProfile.objects.get(id=user_id)
            except UserProfile.DoesNotExist:
                return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        
        UserRestriction.objects.filter(
            user=profile,
            restricted_user=target_user,
            restriction_type=restriction_type
        ).delete()
        
        # If unblocking, remove from blocked_users and reactivate threads
        if restriction_type == 'block':
            profile.blocked_users.remove(target_user)
            BlockedUser.objects.filter(blocker=profile, blocked=target_user).delete()
            
            # REACTIVATE THREADS
            threads = ChatThread.objects.filter(
                participants=profile
            ).filter(
                participants=target_user
            )
            for thread in threads:
                if thread.status == 'blocked':
                    thread.status = 'active'
                    thread.save()
        
        return Response({'status': 'removed'})


class UserRestrictionList(APIView):
    """GET: List user's restrictions"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        restriction_type = request.query_params.get('type')  # Optional filter
        
        restrictions = UserRestriction.objects.filter(user=profile).select_related('restricted_user__user')
        
        if restriction_type:
            restrictions = restrictions.filter(restriction_type=restriction_type)
        
        data = []
        for restriction in restrictions:
            # Safely build avatar URL
            avatar_url = None
            if restriction.restricted_user.avatar:
                avatar_url = request.build_absolute_uri(restriction.restricted_user.avatar.url)
            elif restriction.restricted_user.default_avatar_url:
                avatar_url = restriction.restricted_user.default_avatar_url
            else:
                avatar_url = f"https://api.dicebear.com/7.x/avataaars/svg?seed={restriction.restricted_user.user.username}"

            data.append({
                'id': restriction.id,
                'user': {
                    'id': restriction.restricted_user.id,
                    'username': restriction.restricted_user.user.username,
                    'nickname': restriction.restricted_user.nickname,
                    'bio': restriction.restricted_user.bio,
                    'avatar': avatar_url,
                },
                'type': restriction.restriction_type,
                'created_at': restriction.created_at.isoformat(),
            })
        
        return Response(data)

# ============================================================================
# NOTIFICATION VIEWS - MOVED FROM CHAT_VIEWS BUT KEPT HERE
# ============================================================================

class NotificationList(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = _get_profile(request)
        if not user:
            return Response([])
            
        notifications = Notification.objects.filter(user=user).select_related('actor__user', 'post').order_by('-created_at')[:100]
        
        serializer = NotificationSerializer(notifications, many=True, context={'request': request})
        return Response(serializer.data)

class NotificationUnreadCountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = _get_profile(request)
        if not user:
            return Response({'unread_count': 0})
        count = Notification.objects.filter(user=user, read=False).count()
        return Response({'unread_count': count})

class NotificationRead(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        user = _get_profile(request)
        if not user:
             return Response(status=status.HTTP_401_UNAUTHORIZED)
        try:
            notification = Notification.objects.get(pk=pk, user=user)
            notification.read = True
            notification.save()
            return Response({'status': 'marked read'})
        except Notification.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

class NotificationDelete(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        user = _get_profile(request)
        if not user:
             return Response(status=status.HTTP_401_UNAUTHORIZED)
        try:
            notification = Notification.objects.get(pk=pk, user=user)
            notification.delete()
            return Response({'status': 'deleted'})
        except Notification.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)


class BlockUserView(APIView):
    """POST: Block a user"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, user_id):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            target_user = UserProfile.objects.get(user__id=user_id)
        except UserProfile.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        if profile.id == target_user.id:
             return Response({'error': 'Cannot block yourself'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Create UserRestriction
        UserRestriction.objects.get_or_create(
            user=profile,
            restricted_user=target_user,
            restriction_type='block'
        )

        # 2. Add to blocked_users (legacy/redundant but kept for safety)
        profile.blocked_users.add(target_user)
        BlockedUser.objects.get_or_create(blocker=profile, blocked=target_user)

        # 3. Unfollow both directions
        Follow.objects.filter(follower=profile, followee=target_user).delete()
        Follow.objects.filter(follower=target_user, followee=profile).delete()

        # 4. Hide/Block threads
        threads = ChatThread.objects.filter(participants=profile).filter(participants=target_user)
        for thread in threads:
            if thread.status != 'blocked':
                thread.status = 'blocked'
                thread.save()

        return Response({'status': 'blocked', 'user_id': user_id})


class UnblockUserView(APIView):
    """POST: Unblock a user"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, user_id):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
            
        try:
             target_user = UserProfile.objects.get(user__id=user_id)
        except UserProfile.DoesNotExist:
             return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        # 1. Remove UserRestriction
        UserRestriction.objects.filter(
            user=profile,
            restricted_user=target_user,
            restriction_type='block'
        ).delete()

        # 2. Remove from blocked_users
        profile.blocked_users.remove(target_user)
        BlockedUser.objects.filter(blocker=profile, blocked=target_user).delete()

        # 3. Reactivate threads
        threads = ChatThread.objects.filter(participants=profile).filter(participants=target_user)
        for thread in threads:
            if thread.status == 'blocked':
                thread.status = 'active'
                thread.save()

        return Response({'status': 'unblocked', 'user_id': user_id})
