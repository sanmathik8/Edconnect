from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bio = models.TextField(blank=True)
    is_private = models.BooleanField(default=False)
    interests = models.JSONField(default=list, blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    default_avatar_url = models.URLField(max_length=500, null=True, blank=True)
    nickname = models.CharField(max_length=50, blank=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    
    # Content Moderation
    is_flagged = models.BooleanField(default=False)
    moderation_notes = models.TextField(blank=True)
    
    # Privacy & Blocking
    blocked_users = models.ManyToManyField('self', symmetrical=False, related_name='blocked_by', blank=True)
    
    # Notification Preferences
    notification_preferences = models.JSONField(default=dict, blank=True)
    
    # E2E Encryption
    public_key = models.TextField(blank=True, null=True, help_text="User's public key for E2EE")
    
    # Password Recovery
    security_clue = models.CharField(max_length=255, blank=True, null=True, help_text="Hashed security clue for password recovery")

    class Meta:
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['is_flagged']),
        ]

    def __str__(self):
        return self.user.username

    @property
    def followers(self):
        return Follow.objects.filter(followee=self)

    @property
    def following(self):
        return Follow.objects.filter(follower=self)
    
    def get_avatar_url(self, request=None):
        """
        Get the avatar URL with proper fallback hierarchy
        
        Priority:
        1. Custom uploaded avatar (if exists)
        2. default_avatar_url (if set)
        3. Generated dicebear avatar
        
        Args:
            request: Optional Django request object for building absolute URIs
        
        Returns:
            str: Avatar URL
        """
        from .utils.avatar_utils import get_avatar_url_from_profile
        return get_avatar_url_from_profile(self, request)


class Post(models.Model):
    author = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='posts')
    content = models.TextField(blank=True)
    caption = models.TextField(blank=True)
    image = models.ImageField(upload_to='posts/', null=True, blank=True)
    tags = models.JSONField(default=list, blank=True)
    is_public = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Content Moderation
    is_flagged = models.BooleanField(default=False)
    moderation_reason = models.TextField(blank=True)
    safety_score = models.IntegerField(default=100)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['author']),
            models.Index(fields=['is_public']),
            models.Index(fields=['is_flagged']),
        ]

    def __str__(self):
        return f"Post by {self.author.user.username} at {self.created_at}"

    @property
    def likes_count(self):
        return UserEvent.objects.filter(post=self, event_type='like').count()

    @property
    def comments_count(self):
        return self.comments.count()

# In models.py, update the SharedPost model:
class SharedPost(models.Model):
    """Track shared posts between users"""
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='shares')
    shared_by = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='posts_shared')
    shared_with = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='posts_received')
    # Use string reference to avoid circular import if ChatMessage is moved, but here we keep it simple or update reference
    # Ideally should point to chat.ChatMessage now.
    # We will use string reference 'chat.ChatMessage'
    chat_message = models.ForeignKey('chat.ChatMessage', on_delete=models.CASCADE, null=True, blank=True, related_name='shared_posts')
    # chat_message = models.IntegerField(null=True, blank=True) # ID of chat.ChatMessage
    message = models.TextField(blank=True, null=True, help_text="Optional message with share")
    created_at = models.DateTimeField(auto_now_add=True)
    read = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['shared_with', '-created_at']),
            models.Index(fields=['shared_by', '-created_at']),
        ]
        
class UserEvent(models.Model):
    EVENT_TYPES = [
        ('like', 'Like'),
        ('save', 'Save'),
        ('share', 'Share'),
        ('view', 'View'),
    ]
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='events')
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='events')
    event_type = models.CharField(max_length=10, choices=EVENT_TYPES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'post', 'event_type')
        indexes = [
            models.Index(fields=['user', 'event_type']),
            models.Index(fields=['post', 'event_type']),
        ]

    def __str__(self):
        return f"{self.user.user.username} {self.event_type}d post {self.post.id}"


class Follow(models.Model):
    follower = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='following_set')
    followee = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='followers_set')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('follower', 'followee')
        indexes = [
            models.Index(fields=['follower']),
            models.Index(fields=['followee']),
        ]

    def __str__(self):
        return f"{self.follower.user.username} follows {self.followee.user.username}"


class Comment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='comments')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Content Moderation
    is_flagged = models.BooleanField(default=False)
    moderation_reason = models.TextField(blank=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['post', 'created_at']),
            models.Index(fields=['author']),
            models.Index(fields=['is_flagged']),
        ]

    def __str__(self):
        return f"Comment by {self.author.user.username} on post {self.post.id}"


class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ('like', 'Like'),
        ('comment', 'Comment'),
        ('follow', 'Follow'),
        ('message', 'Message'),
        ('message_request', 'Message Request'),
        ('group_join', 'Group Join'),
        ('group_leave', 'Group Leave'),
    ]
    
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='notifications')
    actor = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='actions', null=True, blank=True)
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, null=True, blank=True)
    message = models.TextField()
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['user', 'read']),
        ]

    def __str__(self):
        return f"Notification for {self.user.user.username}: {self.notification_type}"



class Collection(models.Model):
    """
    A collection of saved posts (like Instagram collections).
    """
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name='collections')
    name = models.CharField(max_length=255)
    cover_image = models.ImageField(upload_to='collection_covers/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        unique_together = ('user', 'name')

    def __str__(self):
        return f"{self.name} ({self.user.user.username})"

class CollectionItem(models.Model):
    """
    Link between a collection and a post.
    """
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE, related_name='items')
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='collection_instances')
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('collection', 'post')
        ordering = ['-added_at']

    def __str__(self):
        return f"Post {self.post.id} in {self.collection.name}"
