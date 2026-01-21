"""
Group Management Views
Handles group-specific operations like removing members, promoting admins, etc.
"""
from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from chat.models import ChatThread
from core.views import _get_profile
import logging

logger = logging.getLogger(__name__)


class ChatThreadRemoveParticipant(APIView):
    """Remove a participant from a group (admin only)"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            thread = ChatThread.objects.get(pk=pk, participants=profile)
        except ChatThread.DoesNotExist:
            return Response({'detail': 'Thread not found'}, status=status.HTTP_404_NOT_FOUND)
        
        if not thread.is_group:
            return Response({'detail': 'Not a group chat'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user is admin
        is_admin = thread.admin == profile or thread.admins.filter(id=profile.id).exists() or thread.initiator == profile
        if not is_admin:
            logger.warning(f"[GROUP forbidden] Profile {profile.id} attempted remove on thread {pk}. "
                          f"Initiator: {thread.initiator_id}, Admin: {thread.admin_id}")
            return Response({'detail': 'Only admins can remove members'}, status=status.HTTP_403_FORBIDDEN)
        
        participant_id = request.data.get('participant_id')
        if not participant_id:
            return Response({'detail': 'participant_id required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            from core.models import UserProfile
            participant = UserProfile.objects.get(id=participant_id)
            
            # Can't remove yourself (use leave instead)
            if participant == profile:
                return Response({'detail': 'Use leave endpoint to remove yourself'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Remove participant
            thread.participants.remove(participant)
            
            # Also remove from admins if they were admin
            if thread.admins.filter(id=participant.id).exists():
                thread.admins.remove(participant)
            
            # Send notification to removed user
            from core.models import Notification
            Notification.objects.create(
                user=participant,
                actor=profile,
                notification_type='group_removed',
                message=f"You were removed from {thread.group_name or 'the group'} by {profile.user.username}"
            )
            
            logger.info(f"[GROUP] {profile.user.username} removed {participant.user.username} from group {pk}")
            return Response({
                'status': 'Member removed',
                'message': f'{participant.user.username} has been removed from the group'
            }, status=status.HTTP_200_OK)
            
        except UserProfile.DoesNotExist:
            return Response({'detail': 'Participant not found'}, status=status.HTTP_404_NOT_FOUND)


class ChatThreadPromoteAdmin(APIView):
    """Promote a member to admin (admin only)"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            thread = ChatThread.objects.get(pk=pk, participants=profile)
        except ChatThread.DoesNotExist:
            return Response({'detail': 'Thread not found'}, status=status.HTTP_404_NOT_FOUND)
        
        if not thread.is_group:
            return Response({'detail': 'Not a group chat'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user is admin
        is_admin = thread.admin == profile or thread.admins.filter(id=profile.id).exists() or thread.initiator == profile
        if not is_admin:
            logger.warning(f"[GROUP forbidden] Profile {profile.id} attempted promote on thread {pk}. "
                          f"Initiator: {thread.initiator_id}, Admin: {thread.admin_id}")
            return Response({'detail': 'Only admins can promote members'}, status=status.HTTP_403_FORBIDDEN)
        
        participant_id = request.data.get('participant_id')
        if not participant_id:
            return Response({'detail': 'participant_id required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            from core.models import UserProfile
            participant = UserProfile.objects.get(id=participant_id)
            
            # Check if participant is in group
            if not thread.participants.filter(id=participant.id).exists():
                return Response({'detail': 'User is not a member of this group'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if already admin
            if thread.admins.filter(id=participant.id).exists():
                return Response({'detail': 'User is already an admin'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Promote to admin
            thread.admins.add(participant)
            
            # Send notification to promoted user
            from core.models import Notification
            Notification.objects.create(
                user=participant,
                actor=profile,
                notification_type='group_admin',
                message=f"You were promoted to admin in {thread.group_name or 'the group'} by {profile.user.username}"
            )
            
            logger.info(f"[GROUP] {profile.user.username} promoted {participant.user.username} to admin in group {pk}")
            return Response({
                'status': 'Member promoted to admin',
                'message': f'{participant.user.username} is now an admin'
            }, status=status.HTTP_200_OK)
            
        except UserProfile.DoesNotExist:
            return Response({'detail': 'Participant not found'}, status=status.HTTP_404_NOT_FOUND)


class ChatThreadDemoteAdmin(APIView):
    """Demote an admin to regular member (admin only)"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            thread = ChatThread.objects.get(pk=pk, participants=profile)
        except ChatThread.DoesNotExist:
            return Response({'detail': 'Thread not found'}, status=status.HTTP_404_NOT_FOUND)
        
        if not thread.is_group:
            return Response({'detail': 'Not a group chat'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user is admin
        is_admin = thread.admin == profile or thread.admins.filter(id=profile.id).exists() or thread.initiator == profile
        if not is_admin:
            logger.warning(f"[GROUP forbidden] Profile {profile.id} attempted admin action on thread {pk}. "
                           f"Thread initiator: {thread.initiator_id}, admin: {thread.admin_id}")
            return Response({'detail': 'Only admins can demote admins'}, status=status.HTTP_403_FORBIDDEN)
        
        participant_id = request.data.get('participant_id')
        if not participant_id:
            return Response({'detail': 'participant_id required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            from core.models import UserProfile
            participant = UserProfile.objects.get(id=participant_id)
            
            # Can't demote the primary admin (legacy admin field)
            if thread.admin == participant:
                return Response({'detail': 'Cannot demote primary admin. Transfer ownership first.'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if actually an admin
            if not thread.admins.filter(id=participant.id).exists():
                return Response({'detail': 'User is not an admin'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Demote from admin
            thread.admins.remove(participant)
            
            # Send notification to demoted user
            from core.models import Notification
            Notification.objects.create(
                user=participant,
                actor=profile,
                notification_type='group_demoted',
                message=f"You were demoted from admin in {thread.group_name or 'the group'} by {profile.user.username}"
            )
            
            logger.info(f"[GROUP] {profile.user.username} demoted {participant.user.username} from admin in group {pk}")
            return Response({
                'status': 'Admin demoted to member',
                'message': f'{participant.user.username} is no longer an admin'
            }, status=status.HTTP_200_OK)
            
        except UserProfile.DoesNotExist:
            return Response({'detail': 'Participant not found'}, status=status.HTTP_404_NOT_FOUND)


class ChatThreadTransferOwnership(APIView):
    """Transfer group ownership to another admin (primary admin only)"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            thread = ChatThread.objects.get(pk=pk, participants=profile)
        except ChatThread.DoesNotExist:
            return Response({'detail': 'Thread not found'}, status=status.HTTP_404_NOT_FOUND)
        
        if not thread.is_group:
            return Response({'detail': 'Not a group chat'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Only primary admin can transfer ownership
        if thread.admin != profile:
            return Response({'detail': 'Only the group owner can transfer ownership'}, status=status.HTTP_403_FORBIDDEN)
        
        participant_id = request.data.get('participant_id')
        if not participant_id:
            return Response({'detail': 'participant_id required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            from core.models import UserProfile
            new_admin = UserProfile.objects.get(id=participant_id)
            
            # Check if participant is in group
            if not thread.participants.filter(id=new_admin.id).exists():
                return Response({'detail': 'User is not a member of this group'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Transfer ownership
            old_admin = thread.admin
            thread.admin = new_admin
            
            # Make sure new admin is in admins list
            if not thread.admins.filter(id=new_admin.id).exists():
                thread.admins.add(new_admin)
            
            # Keep old admin as regular admin (or remove if you want)
            # thread.admins.remove(old_admin)  # Uncomment to demote old owner
            
            thread.save()
            
            logger.info(f"[GROUP] Ownership of group {pk} transferred from {old_admin.user.username} to {new_admin.user.username}")
            return Response({'status': 'Ownership transferred', 'new_admin': new_admin.user.username}, status=status.HTTP_200_OK)
            
        except UserProfile.DoesNotExist:
            return Response({'detail': 'Participant not found'}, status=status.HTTP_404_NOT_FOUND)


class ChatThreadLeave(APIView):
    """Leave a group chat"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            thread = ChatThread.objects.get(pk=pk, participants=profile)
        except ChatThread.DoesNotExist:
            return Response({'detail': 'Thread not found'}, status=status.HTTP_404_NOT_FOUND)
        
        if not thread.is_group:
            return Response({'detail': 'Not a group chat'}, status=status.HTTP_400_BAD_REQUEST)
        
        # If you're the primary admin, you need to transfer ownership first
        if thread.admin == profile:
            # Check if there are other admins
            other_admins = thread.admins.exclude(id=profile.id)
            if other_admins.exists():
                # Auto-transfer to first other admin
                new_admin = other_admins.first()
                thread.admin = new_admin
                thread.save()
                logger.info(f"[GROUP] Auto-transferred ownership to {new_admin.user.username} as {profile.user.username} left")
            elif thread.participants.exclude(id=profile.id).exists():
                # Promote first remaining member to admin
                new_admin = thread.participants.exclude(id=profile.id).first()
                thread.admin = new_admin
                thread.admins.add(new_admin)
                thread.save()
                logger.info(f"[GROUP] Auto-promoted {new_admin.user.username} to admin as {profile.user.username} left")

        
        # Clear message history for this user
        # This ensures that if they rejoin, they don't see old messages
        from chat.models import ChatMessage
        messages = thread.messages.all()
        Membership = ChatMessage.deleted_by.through
        new_relations = [Membership(chatmessage_id=m.id, userprofile_id=profile.id) for m in messages]
        Membership.objects.bulk_create(new_relations, ignore_conflicts=True)

        # Remove from participants and admins
        thread.participants.remove(profile)
        if thread.admins.filter(id=profile.id).exists():
            thread.admins.remove(profile)
        
        # If no participants left, archive the group instead of deleting
        # This allows users to search for it and rejoin later
        if thread.participants.count() == 0:
            thread.status = 'archived'
            thread.save()
            logger.info(f"[GROUP] Group {pk} archived as last member left (can be rejoined)")
            return Response({'status': 'Group archived (can be rejoined via search)'}, status=status.HTTP_200_OK)
        
        # Notify admin(s) about the departure
        from core.models import Notification
        admins = set()
        if thread.admin:
            admins.add(thread.admin)
        for a in thread.admins.all():
            admins.add(a)
            
        for admin_profile in admins:
            if admin_profile != profile: # Don't notify the person who left
                Notification.objects.create(
                    user=admin_profile,
                    actor=profile,
                    notification_type='group_leave',
                    message=f"{profile.user.username} left the group: {thread.group_name or 'Untitled Group'}"
                )
        
        logger.info(f"[GROUP] {profile.user.username} left group {pk}")
        return Response({'status': 'Left group'}, status=status.HTTP_200_OK)


class GroupSearch(APIView):
    """Search for groups by name (includes archived groups)"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({'detail': 'Search query required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Search for groups by name (including archived ones)
        # Only show groups where user is NOT currently a participant
        from django.db.models import Q
        from chat.serializers import ChatThreadSerializer
        
        groups = ChatThread.objects.filter(
            is_group=True,
            group_name__icontains=query
        ).filter(
            # Show if user is NOT a participant OR if user hid the group (soft deleted)
            ~Q(participants=profile) | Q(hidden_by=profile)
        ).distinct().prefetch_related('participants__user')[:20]
        
        serializer = ChatThreadSerializer(groups, many=True, context={'request': request})
        logger.info(f"[GROUP_SEARCH] User {profile.user.username} searched for '{query}', found {groups.count()} groups")
        
        return Response(serializer.data)


class GroupRejoin(APIView):
    """Rejoin a group (reactivates archived groups)"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        profile = _get_profile(request)
        if not profile:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            thread = ChatThread.objects.get(pk=pk, is_group=True)
        except ChatThread.DoesNotExist:
            return Response({'detail': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if user is already a participant
        is_participant = thread.participants.filter(id=profile.id).exists()
        
        if is_participant:
            # If participant BUT hidden/deleted, UNHIDE (Rejoin)
            if thread.hidden_by.filter(id=profile.id).exists() or thread.deleted_by.filter(id=profile.id).exists():
                thread.hidden_by.remove(profile)
                thread.deleted_by.remove(profile)
                logger.info(f"[GROUP] {profile.user.username} un-hid/rejoined group {pk}")
            else:
                return Response({'detail': 'Already a member of this group'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Not a participant - Add user to group
            thread.participants.add(profile)
            logger.info(f"[GROUP] {profile.user.username} joined group {pk}")
        
        # If group was archived, reactivate it
        if thread.status == 'archived':
            thread.status = 'active'
            # If no admin exists, make the rejoining user the admin
            if not thread.admin:
                thread.admin = profile
                thread.admins.add(profile)
            thread.save()
            logger.info(f"[GROUP] Group {pk} reactivated by {profile.user.username}")
        
        # Notify admin(s) about the new/rejoined member
        from core.models import Notification
        admins = set()
        if thread.admin:
            admins.add(thread.admin)
        for a in thread.admins.all():
            admins.add(a)
            
        for admin_profile in admins:
            if admin_profile != profile: # Don't notify the person who joined if they are now admin
                Notification.objects.create(
                    user=admin_profile,
                    actor=profile,
                    notification_type='group_join',
                    message=f"{profile.user.username} rejoined the group: {thread.group_name or 'Untitled Group'}"
                )

        from chat.serializers import ChatThreadSerializer
        return Response(ChatThreadSerializer(thread, context={'request': request}).data, status=status.HTTP_200_OK)
