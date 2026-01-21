# core/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    UserProfile, Post, UserEvent,
    Follow, Notification, Comment,
    Collection, CollectionItem
) # Removed chat models
from .security.encryption import encrypt_text, decrypt_text

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "first_name", "last_name")

class UserProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    avatar = serializers.SerializerMethodField()
    followers_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    is_blocked = serializers.SerializerMethodField()
    is_blocked_by_me = serializers.SerializerMethodField()
    is_blocking_me = serializers.SerializerMethodField()
    
    # Standardize: id is integer PK, uuid is the UUID
    uuid = serializers.UUIDField(read_only=True)

    class Meta:
        model = UserProfile
        fields = ("id", "uuid", "user", "bio", "is_private", "interests", "avatar", "default_avatar_url", "nickname", "followers_count", "following_count", "is_following", "is_blocked", "is_blocked_by_me", "is_blocking_me")

    def get_avatar(self, obj):
        """Get avatar URL using the model's get_avatar_url method for consistency"""
        request = self.context.get('request')
        return obj.get_avatar_url(request)
    
    def get_followers_count(self, obj):
        return obj.followers.count()

    def get_following_count(self, obj):
        return obj.following.count()

    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            try:
                profile = request.user.userprofile
                return Follow.objects.filter(follower=profile, followee=obj).exists()
            except UserProfile.DoesNotExist:
                return False
        return False

    def get_is_blocked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            try:
                profile = request.user.userprofile
                from chat.models import UserRestriction
                from django.db.models import Q
                return UserRestriction.objects.filter(
                    (Q(user=profile, restricted_user=obj) | Q(user=obj, restricted_user=profile)),
                    restriction_type='block'
                ).exists()
            except Exception:
                return False
        return False

    def get_is_blocked_by_me(self, obj):
        """Check if the current user has blocked this profile"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            try:
                profile = request.user.userprofile
                from chat.models import UserRestriction
                return UserRestriction.objects.filter(
                    user=profile,
                    restricted_user=obj,
                    restriction_type='block'
                ).exists()
            except Exception:
                return False
        return False

    def get_is_blocking_me(self, obj):
        """Check if this profile has blocked the current user"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            try:
                profile = request.user.userprofile
                from chat.models import UserRestriction
                return UserRestriction.objects.filter(
                    user=obj,
                    restricted_user=profile,
                    restriction_type='block'
                ).exists()
            except Exception:
                return False
        return False

    def update(self, instance, validated_data):
        # Handle username update if provided in initial_data
        username = self.initial_data.get('username')
        if username and username != instance.user.username:
            if User.objects.filter(username=username).exclude(id=instance.user.id).exists():
                raise serializers.ValidationError({"username": "Username already exists."})
            instance.user.username = username
            instance.user.save()
            
        return super().update(instance, validated_data)

class CommentSerializer(serializers.ModelSerializer):
    author = UserProfileSerializer(read_only=True)
    post = serializers.PrimaryKeyRelatedField(read_only=True)
    
    class Meta:
        model = Comment
        fields = ("id", "post", "author", "content", "created_at")
        read_only_fields = ("created_at",)

class PostSerializer(serializers.ModelSerializer):
    author = UserProfileSerializer(read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    image = serializers.ImageField(required=False, allow_null=True)
    likes_count = serializers.SerializerMethodField()
    comments_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()
    
    class Meta:
        model = Post
        fields = (
            "id", "author", "content", "caption", "image", 
            "tags", "is_public", "created_at", "comments",
            "likes_count", "comments_count", "is_liked", "is_saved"
        )
        read_only_fields = ("created_at",)

    def get_likes_count(self, obj):
        return UserEvent.objects.filter(post=obj, event_type="like").count()

    def get_comments_count(self, obj):
        return obj.comments.count()

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            try:
                profile = request.user.userprofile
                return UserEvent.objects.filter(user=profile, post=obj, event_type="like").exists()
            except UserProfile.DoesNotExist:
                return False
        return False

    def get_is_saved(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            try:
                profile = request.user.userprofile
                return UserEvent.objects.filter(user=profile, post=obj, event_type="save").exists()
            except UserProfile.DoesNotExist:
                return False
        return False

    def validate_tags(self, value):
        return value or []

class SimpleAuthorSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username')
    
    class Meta:
        model = UserProfile
        fields = ("id", "username", "nickname")

class SimplePostSerializer(serializers.ModelSerializer):
    author = SimpleAuthorSerializer(read_only=True)
    
    class Meta:
        model = Post
        fields = ("id", "content", "image", "author")

class NotificationSerializer(serializers.ModelSerializer):
    user = UserProfileSerializer(read_only=True)
    actor = UserProfileSerializer(read_only=True, allow_null=True)
    post = SimplePostSerializer(read_only=True, allow_null=True)
    
    class Meta:
        model = Notification
        fields = ("id", "user", "actor", "notification_type", "post", "message", "read", "created_at")
        read_only_fields = ("created_at",)

class UserEventSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    post = serializers.PrimaryKeyRelatedField(queryset=Post.objects.all(), allow_null=True, required=False)
    
    class Meta:
        model = UserEvent
        fields = ("id", "user", "post", "event_type", "created_at")
        read_only_fields = ("created_at",)


class FollowSerializer(serializers.ModelSerializer):
    follower = UserProfileSerializer(read_only=True)
    followee = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = Follow
        fields = ("id", "follower", "followee", "created_at")
        read_only_fields = ("created_at",)

class CollectionItemSerializer(serializers.ModelSerializer):
    post = PostSerializer(read_only=True)
    
    class Meta:
        model = CollectionItem
        fields = ('id', 'post', 'added_at')
        read_only_fields = ('added_at',)

class CollectionSerializer(serializers.ModelSerializer):
    items_count = serializers.SerializerMethodField()
    first_item = serializers.SerializerMethodField()
    
    class Meta:
        model = Collection
        fields = ('id', 'name', 'cover_image', 'created_at', 'updated_at', 'items_count', 'first_item')
        read_only_fields = ('created_at', 'updated_at')

    def get_items_count(self, obj):
        if hasattr(obj, 'items_count_annotated'):
            return obj.items_count_annotated
        return obj.items.count()

    def get_first_item(self, obj):
        first_item = obj.items.select_related('post').first()
        if first_item and first_item.post.image:
             request = self.context.get('request')
             if request:
                 return request.build_absolute_uri(first_item.post.image.url)
             return first_item.post.image.url
        return None