from django.db.models import Q
from rest_framework import serializers
from chat.models import (
    ChatThread, ChatMessage, MessageAttachment, MessageReaction, TypingIndicator
)
from core.models import SharedPost, Post, UserProfile, UserEvent
from core.serializers import UserProfileSerializer

class MessageAttachmentSerializer(serializers.ModelSerializer):
    """Serializer for message attachments (images, videos, audio, documents)"""
    file_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    
    class Meta:
        model = MessageAttachment
        fields = ('id', 'file_url', 'file_type', 'file_size', 'file_name', 
                  'thumbnail_url', 'duration', 'created_at')
        read_only_fields = ('created_at',)
    
    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None
    
    def get_thumbnail_url(self, obj):
        request = self.context.get('request')
        if obj.thumbnail and request:
            return request.build_absolute_uri(obj.thumbnail.url)
        return None


class MessageReactionSerializer(serializers.ModelSerializer):
    """Serializer for message reactions"""
    user = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = MessageReaction
        fields = ('id', 'user', 'emoji', 'created_at')
        read_only_fields = ('created_at',)

class ChatMessageSerializer(serializers.ModelSerializer):
    sender = UserProfileSerializer(read_only=True)
    reply_to = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()
    reactions = serializers.SerializerMethodField()
    reaction_counts = serializers.SerializerMethodField()
    user_reaction = serializers.SerializerMethodField()
    shared_post = serializers.SerializerMethodField()
    is_edited = serializers.SerializerMethodField()
    is_voice_message = serializers.BooleanField(read_only=True)
    read = serializers.BooleanField(read_only=True)
    read_at = serializers.DateTimeField(read_only=True)
    is_pinned = serializers.BooleanField(read_only=True)
    
    # Client-side encryption support
    client_encrypted_content = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    client_iv = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    client_encryption_version = serializers.IntegerField(required=False, default=0)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get('request')
        
        # Server-side decryption for display
        if instance.encrypted_content:
            from core.security.encryption import decrypt_text
            try:
                # Assuming key_version is stored or default
                version = instance.key_version
                decrypted = decrypt_text(instance.encrypted_content, version)
                # If decryption fails (returns error string), usually we want to hide it or show appropriate msg
                # But here we replace content
                if decrypted and not decrypted.startswith('[Decryption Error'):
                     ret['content'] = decrypted
                elif decrypted:
                     ret['content'] = decrypted # Show error if debug, or handle gracefully
            except Exception:
                pass
        
        return ret

    class Meta:
        model = ChatMessage
        fields = [
            'id', 'thread', 'sender', 'content', 'created_at', 'read', 'read_at',
            'reply_to', 'attachments', 'reactions', 'reaction_counts', 'user_reaction',
            'is_pinned', 'is_edited', 'edited_at', 'is_voice_message', 
            'client_encrypted_content', 'client_iv', 'client_encryption_version',
            'shared_post', 'is_system'
        ]
        read_only_fields = ['created_at', 'read_at', 'edited_at', 'sender', 'thread']

    def get_reply_to(self, obj):
        if obj.reply_to:
            return {
                'id': obj.reply_to.id,
                'content': obj.reply_to.content[:100] if obj.reply_to.content else '',
                'sender': obj.reply_to.sender.user.username if obj.reply_to.sender else 'Unknown'
            }
        return None

    def get_attachments(self, obj):
        # MessageAttachment is imported at top
        attachments = MessageAttachment.objects.filter(message=obj)
        request = self.context.get('request')
        
        attachments_data = []
        for att in attachments:
            data = {
                'id': att.id,
                'file_type': att.file_type,
                'file_size': att.file_size,
                'file_name': att.file_name,
                'duration': att.duration
            }
            if att.file and request:
                data['file_url'] = request.build_absolute_uri(att.file.url)
            if att.thumbnail and request:
                data['thumbnail_url'] = request.build_absolute_uri(att.thumbnail.url)
            attachments_data.append(data)
        return attachments_data

    def get_reactions(self, obj):
        # MessageReaction is imported at top
        reactions = MessageReaction.objects.filter(message=obj).select_related('user__user')
        return [{
            'id': r.id,
            'user': {
                'id': r.user.id, 
                'username': r.user.user.username,
                'avatar': self._get_avatar_url(r.user, self.context.get('request'))
            },
            'emoji': r.emoji
        } for r in reactions]

    def get_reaction_counts(self, obj):
        from collections import Counter
        reactions = MessageReaction.objects.filter(message=obj).values_list('emoji', flat=True)
        return dict(Counter(reactions))

    def get_is_edited(self, obj):
        return obj.edited_at is not None

    def get_user_reaction(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            try:
                profile = request.user.userprofile
                reaction = MessageReaction.objects.filter(message=obj, user=profile).first()
                return reaction.emoji if reaction else None
            except:
                return None
        return None

    def get_shared_post(self, obj):
        try:
            # Check for pre-fetched shared_posts
            if hasattr(obj, 'shared_posts') and hasattr(obj.shared_posts, 'all'):
                 # Use the first one from the prefetched list (should be length 0 or 1)
                 # We need to filter in python to avoid hitting DB if it's a Prefetch object
                 shared_list = list(obj.shared_posts.all())
                 shared = shared_list[0] if shared_list else None
            else:
                # Fallback to DB query
                shared = SharedPost.objects.select_related(
                    'post__author__user'
                ).filter(chat_message=obj).first()
            
            if not shared:
                return None
            
            request = self.context.get('request')
            post = shared.post
            
            # Get post image URL
            post_image = None
            if post.image and request:
                post_image = request.build_absolute_uri(post.image.url)
            elif post.image:
                post_image = post.image.url
            
            # Get author avatar
            author_avatar = self._get_avatar_url(post.author, request)
            
            result = {
                'id': post.id,
                'content': post.content or post.caption or '',
                'caption': post.caption or post.content or '',
                'image': post_image,
                'author': {
                    'id': post.author.id,
                    'username': post.author.user.username,
                    'nickname': post.author.nickname,
                    'avatar': author_avatar
                },
                'created_at': post.created_at.isoformat(),
                'tags': post.tags or []
            }
            return result
        except SharedPost.DoesNotExist:
            return None
        except Exception:
            return None

    def _get_avatar_url(self, profile, request):
        if profile.avatar:
            if request:
                return request.build_absolute_uri(profile.avatar.url)
            return profile.avatar.url
        elif profile.default_avatar_url:
            return profile.default_avatar_url
        else:
            return f"https://api.dicebear.com/7.x/avataaars/svg?seed={profile.user.username}"


class TypingIndicatorSerializer(serializers.ModelSerializer):
    user = UserProfileSerializer(read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    class Meta:
        model = TypingIndicator
        fields = ('id', 'user', 'last_typed_at', 'is_active')
        read_only_fields = ('last_typed_at',)

class ChatThreadSerializer(serializers.ModelSerializer):
    participants = UserProfileSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    is_group = serializers.BooleanField(read_only=True)
    group_name = serializers.CharField(read_only=True)
    status = serializers.SerializerMethodField()
    blocked_by_id = serializers.SerializerMethodField()
    
    admin = UserProfileSerializer(read_only=True)
    admins = UserProfileSerializer(many=True, read_only=True)
    initiator = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = ChatThread
        fields = ['id', 'participants', 'last_message', 'unread_count', 'updated_at', 'is_group', 'group_name', 'status', 'blocked_by_id', 'admin', 'admins', 'initiator']

    def get_status(self, obj):
        if obj.is_group:
            return obj.status
            
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return obj.status
            
        # For 1:1 threads, check if anyone is blocked
        try:
            profile = request.user.userprofile
            other_participant = obj.participants.exclude(id=profile.id).first()
            if other_participant:
                from chat.models import UserRestriction
                # Check if I blocked them or they blocked me
                block = UserRestriction.objects.filter(
                    (Q(user=profile, restricted_user=other_participant) | 
                     Q(user=other_participant, restricted_user=profile)),
                    restriction_type='block'
                ).first()
                
                if block:
                    return 'blocked'
        except:
            pass
            
        return obj.status

    def get_blocked_by_id(self, obj):
        if obj.is_group:
            return None
            
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
            
        try:
            profile = request.user.userprofile
            other_participant = obj.participants.exclude(id=profile.id).first()
            if other_participant:
                from chat.models import UserRestriction
                # Check who blocked whom
                block = UserRestriction.objects.filter(
                    (Q(user=profile, restricted_user=other_participant) | 
                     Q(user=other_participant, restricted_user=profile)),
                    restriction_type='block'
                ).first()
                
                if block:
                    # Return the ID of the user who initiated the block
                    return block.user.id
        except:
            pass
            
        return None

    def get_last_message(self, obj):
        # Optimized: Use annotated last_message_id if available
        if hasattr(obj, 'last_message_id') and obj.last_message_id:
            try:
                msg = ChatMessage.objects.get(id=obj.last_message_id)
                return ChatMessageSerializer(msg, context=self.context).data
            except ChatMessage.DoesNotExist:
                return None
        
        # Fallback for single object retrieval
        request = self.context.get('request')
        messages = obj.messages.filter(is_deleted_for_everyone=False)
        
        if request and request.user.is_authenticated:
            try:
                messages = messages.exclude(deleted_by=request.user.userprofile)
            except: pass
            
        last_msg = messages.order_by('-created_at').first()
        if last_msg:
            return ChatMessageSerializer(last_msg, context=self.context).data
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            try:
                profile = request.user.userprofile
                return obj.messages.filter(read=False).exclude(
                    Q(sender=profile) | Q(deleted_by=profile)
                ).count()
            except:
                pass
        return 0
