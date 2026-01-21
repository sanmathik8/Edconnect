from django.db import models
from django.conf import settings
from core.models import UserProfile, Post

class ChatThread(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('archived', 'Archived'),
        ('blocked', 'Blocked'),
        ('pending', 'Pending Message Request'),
        ('rejected', 'Request Rejected'),
    ]
    
    REQUEST_STATUS_CHOICES = [
        ('accepted', 'Accepted'),
        ('pending', 'Pending'),
        ('none', 'None'),
    ]
    
    participants = models.ManyToManyField(UserProfile, related_name='chat_threads')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Message Request Status (Instagram-style)
    request_status = models.CharField(max_length=20, choices=REQUEST_STATUS_CHOICES, default='none')
    
    # Group Chat
    is_group = models.BooleanField(default=False)
    group_name = models.CharField(max_length=255, blank=True, null=True)
    group_image = models.ImageField(upload_to='group_avatars/', blank=True, null=True)
    admin = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='administered_groups_legacy')
    admins = models.ManyToManyField(UserProfile, blank=True, related_name='administered_groups')
    
    # Group Permissions
    group_members_can_invite = models.BooleanField(default=True)
    group_members_can_send = models.BooleanField(default=True)
    
    # Encryption
    encryption_key = models.TextField(blank=True)
    is_encrypted = models.BooleanField(default=True)
    
    # Message Request System
    initiator = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='initiated_threads')
    
    # Instagram-like features
    muted_by = models.ManyToManyField(UserProfile, blank=True, related_name='muted_threads')
    pinned_by = models.ManyToManyField(UserProfile, blank=True, related_name='pinned_threads')
    hidden_by = models.ManyToManyField(UserProfile, blank=True, related_name='hidden_threads')
    deleted_by = models.ManyToManyField(UserProfile, blank=True, related_name='deleted_threads')
    disappearing_messages_duration = models.IntegerField(null=True, blank=True, help_text='Duration in seconds before messages disappear')

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['-updated_at']),
            models.Index(fields=['status']),
            models.Index(fields=['request_status']),
        ]
        
        constraints = [
            models.UniqueConstraint(
                fields=['group_name'], 
                condition=models.Q(is_group=True), 
                name='unique_group_name'
            )
        ]

    def __str__(self):
        participant_names = ', '.join([p.user.username for p in self.participants.all()[:2]])
        return f"Chat: {participant_names}"


class ChatMessage(models.Model):
    thread = models.ForeignKey(ChatThread, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField(blank=True, null=True)
    encrypted_content = models.BinaryField(blank=True, null=True)
    key_version = models.IntegerField(default=1) # For key rotation
    
    # Client-side encryption fields (for end-to-end encryption)
    client_encrypted_content = models.TextField(blank=True, null=True, help_text='Client-side encrypted content (base64)')
    client_iv = models.TextField(blank=True, null=True, help_text='Initialization vector for client encryption (base64)')
    client_encryption_version = models.IntegerField(default=0, help_text='Client encryption version (0=unencrypted, 1=AES-GCM)')
    
    created_at = models.DateTimeField(auto_now_add=True)
    read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    is_deleted_for_everyone = models.BooleanField(default=False)
    deleted_by = models.ManyToManyField(UserProfile, blank=True, related_name='deleted_messages')
    
    # Instagram-like features
    reply_to = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies')
    forwarded_from = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='forwards')
    is_pinned = models.BooleanField(default=False)
    is_system = models.BooleanField(default=False)  # System-generated messages (e.g., block notifications)
    expires_at = models.DateTimeField(null=True, blank=True, help_text='When this message should disappear')
    edited_at = models.DateTimeField(null=True, blank=True)
    is_voice_message = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at', 'id']
        indexes = [
            models.Index(fields=['thread', 'created_at']),
            models.Index(fields=['thread', 'read']),
            models.Index(fields=['expires_at']),
        ]

    def save(self, *args, **kwargs):
        from core.security.encryption import encrypt_text
        if self.content is not None:
            ciphertext, version = encrypt_text(self.content)
            if ciphertext:
                self.encrypted_content = ciphertext
                self.key_version = version
            self.content = None # Never store plaintext in the database
        super().save(*args, **kwargs)
    @property
    def is_edited(self):
        """Check if message has been edited"""
        return self.edited_at is not None
    def __str__(self):
        return f"Message from {self.sender.user.username} in thread {self.thread.id}"


class MessageAttachment(models.Model):
    """Store media attachments for chat messages (images, videos, audio, documents)"""
    FILE_TYPE_CHOICES = [
        ('image', 'Image'),
        ('video', 'Video'),
        ('audio', 'Audio'),
        ('document', 'Document'),
        ('voice', 'Voice Message'),
    ]
    
    message = models.ForeignKey(ChatMessage, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='chat_attachments/%Y/%m/%d/')
    file_type = models.CharField(max_length=20, choices=FILE_TYPE_CHOICES)
    file_size = models.IntegerField(help_text='File size in bytes')
    file_name = models.CharField(max_length=255)
    thumbnail = models.ImageField(upload_to='chat_thumbnails/%Y/%m/%d/', null=True, blank=True)
    duration = models.IntegerField(null=True, blank=True, help_text='Duration in seconds for audio/video')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['message']),
            models.Index(fields=['file_type']),
        ]
    
    def __str__(self):
        return f"{self.file_type} attachment for message {self.message.id}"


class MessageReaction(models.Model):
    """Store emoji reactions to messages"""
    message = models.ForeignKey(ChatMessage, on_delete=models.CASCADE, related_name='reactions')
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='message_reactions')
    emoji = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('message', 'user', 'emoji')
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['message']),
            models.Index(fields=['user']),
        ]
    
    def __str__(self):
        return f"{self.user.user.username} reacted {self.emoji} to message {self.message.id}"


class TypingIndicator(models.Model):
    """Track who is currently typing in a thread"""
    thread = models.ForeignKey(ChatThread, on_delete=models.CASCADE, related_name='typing_indicators')
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='typing_in')
    last_typed_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('thread', 'user')
        ordering = ['-last_typed_at']
        indexes = [
            models.Index(fields=['thread', '-last_typed_at']),
        ]
    
    def __str__(self):
        return f"{self.user.user.username} typing in thread {self.thread.id}"
    
    @property
    def is_active(self):
        """Check if typing indicator is still active (within last 5 seconds)"""
        from django.utils import timezone
        from datetime import timedelta
        return timezone.now() - self.last_typed_at < timedelta(seconds=5)


class BlockedUser(models.Model):
    """Track blocked users for enhanced privacy"""
    blocker = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='blocking')
    blocked = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='blocked_by_users')
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('blocker', 'blocked')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['blocker']),
            models.Index(fields=['blocked']),
        ]
    
    def __str__(self):
        return f"{self.blocker.user.username} blocked {self.blocked.user.username}"


class MessageRequest(models.Model):
    """Tracks pending message requests (Instagram-style)"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
    ]
    
    thread = models.OneToOneField(ChatThread, on_delete=models.CASCADE, related_name='request')
    requester = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='sent_requests')
    recipient = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='received_requests')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('requester', 'recipient')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'status']),
            models.Index(fields=['requester', 'status']),
        ]
    
    def __str__(self):
        return f"Request from {self.requester.user.username} to {self.recipient.user.username}"


class GroupInvitation(models.Model):
    """Tracks group invitations"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
    ]
    
    group = models.ForeignKey(ChatThread, on_delete=models.CASCADE, related_name='invitations')
    inviter = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='sent_invitations')
    invitee = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='received_invitations')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('group', 'invitee')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['invitee', 'status']),
        ]
    
    def __str__(self):
        return f"{self.inviter.user.username} invited {self.invitee.user.username} to {self.group.group_name or 'group'}"


class UserRestriction(models.Model):
    """Tracks user restrictions (block/mute/restrict)"""
    RESTRICTION_TYPES = [
        ('block', 'Block'),
        ('mute', 'Mute'),
        ('restrict', 'Restrict'),
    ]
    
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='restrictions_set')
    restricted_user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='restricted_by')
    restriction_type = models.CharField(max_length=20, choices=RESTRICTION_TYPES)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('user', 'restricted_user', 'restriction_type')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'restriction_type']),
        ]
    
    def __str__(self):
        return f"{self.user.user.username} {self.restriction_type}ed {self.restricted_user.user.username}"
