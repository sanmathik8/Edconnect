import logging
import re
from django.core.exceptions import ValidationError, PermissionDenied
from django.shortcuts import get_object_or_404
from django.db.models import Count
from django.utils import timezone
from ..models import Post, UserProfile, UserEvent, Notification, SharedPost, Follow
from chat.models import ChatThread, ChatMessage

logger = logging.getLogger(__name__)

class PostService:
    @staticmethod
    def create_post(user_profile, data, image=None):
        """
        Create a new post with tags parsing.
        """
        if not user_profile:
            raise PermissionDenied("User profile required to create post")

        content = data.get('content', '')
        caption = data.get('caption', '')
        text = caption or content
        
        # Parse tags
        tags = []
        if 'tags' in data:
            try:
                tags_data = data.get('tags')
                if isinstance(tags_data, str):
                    import json
                    tags = json.loads(tags_data)
                elif isinstance(tags_data, list):
                    tags = tags_data
            except Exception as e:
                logger.warning(f"Error parsing tags: {e}")

        # Extract tags from text if not provided
        if text:
            regex_tags = re.findall(r"#(\w+)", text)
            tags.extend(regex_tags)

        # Clean tags
        tags = [tag.lstrip('#').lower().strip() for tag in tags if tag and tag.strip()]
        tags = list(set(tags))[:15]

        post = Post.objects.create(
            author=user_profile,
            content=content,
            caption=caption,
            image=image,
            tags=tags,
            is_public=data.get('is_public', True)
        )
        return post

    @staticmethod
    def share_post_with_users(user_profile, post_id, user_ids, message=''):
        """
        Share a post with multiple users, creating chat messages.
        """
        post = get_object_or_404(Post, pk=post_id)
        
        if not user_ids:
            raise ValidationError("No users selected")

        shared_count = 0
        errors = []
        
        logger.info(f"SHARE: Starting to share post {post_id} with {len(user_ids)} users")
        logger.info(f"   User IDs: {user_ids}")

        for user_id in user_ids:
            try:
                logger.info(f"   Processing user_id: {user_id}")
                recipient = UserProfile.objects.get(pk=user_id)
                logger.info(f"   Found recipient: {recipient.user.username}")
                
                from chat.models import UserRestriction
                
                # Only prevent sharing if YOU blocked THEM (not if they blocked you)
                # If they blocked you, they can choose to ignore the shared post
                if UserRestriction.objects.filter(
                    user=user_profile,
                    restricted_user=recipient,
                    restriction_type='block'
                ).exists():
                    error_msg = f"Cannot share with {recipient.user.username} - you have blocked this user"
                    logger.warning(f"   {error_msg}")
                    errors.append(error_msg)
                    continue


                # Optional: Check following status (commented out to allow sharing with anyone)
                # if not Follow.objects.filter(follower=user_profile, followee=recipient).exists():
                #     errors.append(f"You don't follow {recipient.user.username}")
                #     continue
                
                # Check duplicate share (optional - maybe we want to allow re-sharing?)
                # Relaxed this check to allow re-sharing in chat
                # if SharedPost.objects.filter(post=post, shared_by=user_profile, shared_with=recipient).exists():
                #     errors.append(f"Already shared with {recipient.user.username}")
                #     continue
                
                # 1. Find or Create Chat Thread (1-on-1)
                thread = None
                # Relaxed query to ensure we find the thread
                threads = ChatThread.objects.filter(
                    participants=user_profile,
                    is_group=False
                ).filter(
                    participants=recipient
                )
                
                if threads.exists():
                    thread = threads.order_by('-updated_at').first()
                    logger.info(f"   Found existing thread {thread.id}")
                else:
                    # Create new thread
                    thread = ChatThread.objects.create(
                        initiator=user_profile,
                        is_group=False,
                        status='active'
                    )
                    thread.participants.add(user_profile, recipient)
                    logger.info(f"   Created new thread {thread.id}")

                # 2. Create Chat Message
                chat_msg = ChatMessage.objects.create(
                    thread=thread,
                    sender=user_profile,
                    content=message or '',  # Main content is the optional message
                    # We can also rely on shared_post relation for display
                )
                logger.info(f"   Created chat message {chat_msg.id} for share")

                # 3. Create SharedPost record linked to the message
                shared_post = SharedPost.objects.create(
                    post=post,
                    shared_by=user_profile,
                    shared_with=recipient,
                    message=message,
                    chat_message=chat_msg
                )
                logger.info(f"   SHARE: Created SharedPost {shared_post.id} linked to ChatMessage {chat_msg.id}")
                logger.info(f"      Post ID: {post.id}, Shared by: {user_profile.user.username}, Shared with: {recipient.user.username}")
                
                # Clear hidden status for ALL participants (unhide logic)
                if thread.hidden_by.exists():
                    thread.hidden_by.clear()
                    logger.info(f"   UNHIDE: Thread {thread.id} unhidden for all participants")

                # Clear deleted status for ALL participants (undelete logic)
                if thread.deleted_by.exists():
                    thread.deleted_by.clear()
                    logger.info(f"   UNDELETE: Thread {thread.id} restored for all participants")

                # Update Thread Timestamp
                thread.updated_at = timezone.now()
                thread.save()

                # Notification (keep existing notification logic?)
                # Maybe unnecessary if chat already notifies, but let's keep it for "Activity" tab
                Notification.objects.create(
                    user=recipient,
                    actor=user_profile,
                    notification_type='share',
                    post=post,
                    message=f"{user_profile.user.username} shared a post with you"
                )
                shared_count += 1
                logger.info(f"   Successfully shared with {recipient.user.username} (total: {shared_count})")
                
            except UserProfile.DoesNotExist:
                error_msg = f"User {user_id} not found"
                logger.error(f"   {error_msg}")
                errors.append(error_msg)
                continue
            except Exception as e:
                error_msg = f"Failed to share with user {user_id}: {str(e)}"
                logger.error(f"   {error_msg}", exc_info=True)
                errors.append(error_msg)
                continue
        
        logger.info(f"SHARE COMPLETE: Shared with {shared_count}/{len(user_ids)} users")
        if errors:
            logger.warning(f"   Errors: {errors}")
                
        return {
            'status': 'success',
            'shared_count': shared_count,
            'errors': errors if errors else None
        }

    @staticmethod
    def toggle_like(user_profile, post_id):
        post = get_object_or_404(Post, pk=post_id)
        
        from chat.models import UserRestriction
        from django.db.models import Q
        
        # Check for blocks
        if UserRestriction.objects.filter(
            (Q(user=user_profile, restricted_user=post.author) | Q(user=post.author, restricted_user=user_profile)),
            restriction_type='block'
        ).exists():
            raise PermissionDenied("Cannot interact with this post due to restrictions")

        existing = UserEvent.objects.filter(user=user_profile, post=post, event_type="like")
        
        if existing.exists():
            existing.delete()
            liked = False
        else:
            UserEvent.objects.create(user=user_profile, post=post, event_type="like")
            liked = True
            if post.author != user_profile:
                Notification.objects.create(
                    user=post.author,
                    actor=user_profile,
                    notification_type='like',
                    post=post,
                    message=f"{user_profile.user.username} liked your post"
                )
        
        likes_count = UserEvent.objects.filter(post=post, event_type="like").count()
        return {"liked": liked, "likes_count": likes_count}

    @staticmethod
    def toggle_save(user_profile, post_id):
        post = get_object_or_404(Post, pk=post_id)

        from chat.models import UserRestriction
        from django.db.models import Q
        
        # Check for blocks
        if UserRestriction.objects.filter(
            (Q(user=user_profile, restricted_user=post.author) | Q(user=post.author, restricted_user=user_profile)),
            restriction_type='block'
        ).exists():
            raise PermissionDenied("Cannot interact with this post due to restrictions")

        existing = UserEvent.objects.filter(user=user_profile, post=post, event_type="save")
        
        if existing.exists():
            existing.delete()
            saved = False
        else:
            UserEvent.objects.create(user=user_profile, post=post, event_type="save")
            saved = True
            
        saves_count = UserEvent.objects.filter(post=post, event_type="save").count()
        return {"saved": saved, "saves_count": saves_count}
