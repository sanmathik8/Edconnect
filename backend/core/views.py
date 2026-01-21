
# core/views.py
import logging
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.urls import reverse
from django.http import HttpResponseRedirect, JsonResponse, HttpResponseBadRequest
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from django.contrib.auth import login as auth_login, logout as auth_logout
from django.contrib.auth import get_user_model
from django.db.models import Q, Count, Prefetch
from django.views.decorators.csrf import csrf_exempt
from rest_framework import generics, views, response, permissions, status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework import serializers  # Needed for SharedPostSerializer
from django.contrib.auth.models import User  
from .models import (
    UserProfile, Post, UserEvent, Comment,
    Follow, Notification, SharedPost
)
from .serializers import (
    UserProfileSerializer, PostSerializer,
    UserEventSerializer,
    NotificationSerializer, CommentSerializer
)
from .security.encryption import decrypt_text
from .services.post_service import PostService

import logging
from django.shortcuts import render
from django.urls import reverse
from django.http import JsonResponse
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from django.contrib.auth import login as auth_login, logout as auth_logout
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from .models import UserProfile

logger = logging.getLogger(__name__)
User = get_user_model()
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
import json
import logging
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

@ensure_csrf_cookie
@require_http_methods(["GET"])
def get_csrf_token(request):
    """Get CSRF token for frontend"""
    return JsonResponse({'csrfToken': request.META.get('CSRF_COOKIE')})


# -------------------------
# Utilities
# -------------------------
def _get_blocked_profile_ids(profile):
    """
    Get IDs of all user profiles that have a block relationship with the given profile.
    This includes people the user blocked and people who blocked the user.
    """
    if not profile:
        return set()
    from chat.models import UserRestriction
    from django.db.models import Q
    
    # Get blocks in both directions
    blocked_relations = UserRestriction.objects.filter(
        (Q(user=profile) | Q(restricted_user=profile)),
        restriction_type='block'
    ).values_list('user_id', 'restricted_user_id')
    
    blocked_ids = set()
    for u1, u2 in blocked_relations:
        if u1 != profile.id:
            blocked_ids.add(u1)
        if u2 != profile.id:
            blocked_ids.add(u2)
    return blocked_ids

def _is_json_request(request):
    accept = request.headers.get("Accept", "")
    if "application/json" in accept:
        return True
    if request.headers.get("X-Requested-With", "") == "XMLHttpRequest":
        return True
    return False


def _get_profile(request):
    """
    Helper to get the UserProfile for the current authenticated user.
    Includes self-healing logic to create a profile if it's missing.
    """
    user = getattr(request, "user", None)
    if user and getattr(user, "is_authenticated", False):
        try:
            # get_or_create is more robust for self-healing
            profile, created = UserProfile.objects.get_or_create(
                user=user,
                defaults={
                    'notification_preferences': {},
                    'interests': [],
                    'is_flagged': False
                }
            )
            if created:
                logger.info(f"Auto-created missing profile for user {user.username}")
            return profile
        except Exception as e:
            logger.error(f"Failed to get/create profile for {user.username}: {e}")
            return None
    return None

def _get_profile_by_id_or_uuid(pk_or_uuid):
    """Robust lookup for UserProfile by either integer PK or UUID string"""
    try:
        if isinstance(pk_or_uuid, int) or (isinstance(pk_or_uuid, str) and pk_or_uuid.isdigit()):
            return UserProfile.objects.get(pk=pk_or_uuid)
        else:
            return UserProfile.objects.get(uuid=pk_or_uuid)
    except (UserProfile.DoesNotExist, ValueError, ValidationError):
        return None


# -------------------------
# Auth / registration
# -------------------------

 # ============================================================================

# -------------------------
# Auth / registration
# -------------------------
@ensure_csrf_cookie
@csrf_protect
def login_view(request):
    """
    Secure login using Django's built-in AuthenticationForm with CSRF protection.
    Returns JSON response for AJAX requests.
    """
    if request.method == "POST":
        data = request.POST
        
        # Handle JSON requests
        if 'application/json' in request.content_type:
            import json
            try:
                # Try to parse the body
                body_data = json.loads(request.body or '{}')
                
                # If body_data is a string, it might be double-encoded JSON
                if isinstance(body_data, str):
                    try:
                        body_data = json.loads(body_data)
                    except json.JSONDecodeError:
                        pass
                
                # Update data only if body_data is a dictionary
                if isinstance(body_data, dict):
                    data = body_data
                else:
                    logger.error(f"Login failed: Expected JSON object but got {type(body_data).__name__}")
                    return JsonResponse({
                        "ok": False,
                        "error": "Invalid request format. Expected a JSON object."
                    }, status=400)
                    
            except json.JSONDecodeError as e:
                logger.error(f"Login failed: Invalid JSON: {e}")
                return JsonResponse({
                    "ok": False, 
                    "error": "Invalid JSON"
                }, status=400)
        
        # Use Django's built-in AuthenticationForm for validation
        form = AuthenticationForm(request, data=data)
        
        if form.is_valid():
            user = form.get_user()
            auth_login(request, user)
            logger.info(f"User {user.username} logged in successfully")
            
            # Ensure profile exists (Self-healing for legacy users)
            # This covers cases where signals didn't run or user existed before profiles
            try:
                UserProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        'notification_preferences': {},
                        'interests': [],
                        'is_flagged': False
                    }
                )
            except Exception as e:
                logger.error(f"Failed to ensure profile on login for {user.username}: {e}")
            
            # Get avatar URL for the response
            avatar_url = None
            try:
                profile = user.userprofile
                if profile.avatar:
                    avatar_url = request.build_absolute_uri(profile.avatar.url)
                else:
                    avatar_url = profile.default_avatar_url
            except Exception:
                pass

            return JsonResponse({
                "ok": True, 
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "profile_id": user.userprofile.id,
                    "avatar": avatar_url
                },
                "redirect": "/feed"
            })
        
        # Return form errors
        errors = form.errors.as_data()
        error_messages = []
        
        for field, error_list in errors.items():
            for error in error_list:
                error_messages.extend(error.messages)
        
        logger.warning(f"Login failed for user {data.get('username')}: {form.errors.as_json()}")
        
        return JsonResponse({
            "ok": False, 
            "error": "Invalid username or password",
            "form_errors": dict(form.errors)
        }, status=401)
    
    return JsonResponse({
        "ok": False, 
        "error": "Method not allowed"
    }, status=405)


@csrf_protect
def logout_view(request):
    """
    Secure logout with CSRF protection.
    """
    if request.method == "POST":
        username = request.user.username if request.user.is_authenticated else "Anonymous"
        auth_logout(request)
        logger.info(f"User {username} logged out")
        
        return JsonResponse({
            "ok": True,
            "message": "Logged out successfully"
        })
    
    return JsonResponse({
        "ok": False, 
        "error": "Method not allowed"
    }, status=405)


@ensure_csrf_cookie
@csrf_protect
@require_http_methods(["POST"])
def register(request):
    """
    Secure registration using AuthService.
    """
    if request.method == "POST":
        data = request.POST
        
        # Handle JSON requests
        if 'application/json' in request.content_type:
            import json
            try:
                data = json.loads(request.body or '{}')
                if isinstance(data, str):
                    try:
                        data = json.loads(data)
                    except json.JSONDecodeError:
                        pass
            except json.JSONDecodeError:
                return JsonResponse({
                    "ok": False,
                    "error": "Invalid JSON"
                }, status=400)
        
        from .services.auth_service import AuthService
        
        try:
            # Clue is now mandatory in AuthService.register_user
            user = AuthService.register_user(request, data)
            
            return JsonResponse({
                "ok": True,
                "message": "User registered successfully",
                "data": {
                    "id": user.id,
                    "email": user.email,
                    "username": user.username
                }
            }, status=201)
            
        except ValidationError as e:
            # Handle standard Django validation errors
            errors = {}
            if hasattr(e, 'message_dict'):
                errors = e.message_dict
            elif hasattr(e, 'messages'):
                errors = {'general': e.messages}
            else:
                errors = {'general': [str(e)]}
            
            # Create a user-friendly main error message
            main_error = "Registration failed"
            if 'password' in errors or 'password1' in errors:
                main_error = "Password does not meet requirements"
            elif 'username' in errors:
                main_error = "Username issue"
            elif 'email' in errors:
                main_error = "Email issue"
                
            return JsonResponse({
                "ok": False, 
                "error": main_error,
                "form_errors": errors
            }, status=400)
            
        except Exception as e:
            logger.error(f"Unexpected registration error: {e}")
            return JsonResponse({
                "ok": False,
                "error": "An unexpected error occurred. Please try again later."
            }, status=500)
            
    return JsonResponse({
        "ok": False, 
        "error": "Method not allowed"
    }, status=405)


@ensure_csrf_cookie
@csrf_protect
@require_http_methods(["POST"])
def reset_password(request):
    """
    Secure password reset using security clue.
    """
    data = {}
    if 'application/json' in request.content_type:
        try:
            data = json.loads(request.body or '{}')
            if isinstance(data, str):
                try:
                    data = json.loads(data)
                except json.JSONDecodeError:
                    pass
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)
    else:
        data = request.POST

    username = data.get('username')
    clue = data.get('clue')
    new_password = data.get('new_password')

    from .services.auth_service import AuthService
    
    try:
        AuthService.reset_password_with_clue(username, clue, new_password)
        return JsonResponse({
            "ok": True,
            "message": "Password reset successfully. You can now log in with your new password."
        })
    except ValidationError as e:
        # Standardize error response
        message = str(e.messages[0]) if hasattr(e, 'messages') else str(e)
        return JsonResponse({
            "ok": False,
            "error": message
        }, status=400)
    except Exception as e:
        logger.error(f"Reset password view error: {e}")
        return JsonResponse({
            "ok": False,
            "error": "An unexpected error occurred."
        }, status=500)


# -------------------------
# Profiles
# -------------------------
class ProfileList(generics.ListAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = UserProfile.objects.all().select_related("user")
        
        # Filter blocked users if authenticated
        profile = _get_profile(self.request)
        if profile:
            blocked_ids = _get_blocked_profile_ids(profile)
            if blocked_ids:
                queryset = queryset.exclude(id__in=blocked_ids)
                
        return queryset


class ProfileDetail(generics.RetrieveUpdateAPIView):
    queryset = UserProfile.objects.all().select_related("user")
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class ProfileByUsername(views.APIView):
    """Retrieve profile by username"""
    permission_classes = [permissions.AllowAny]

    def get(self, request, username, format=None):
        try:
            profile = UserProfile.objects.select_related('user').get(user__username=username)
            serializer = UserProfileSerializer(profile, context={'request': request})
            return response.Response(serializer.data)
        except UserProfile.DoesNotExist:
            return response.Response({"detail": "Profile not found"}, status=status.HTTP_404_NOT_FOUND)


class MeProfileView(views.APIView):
    """Get or Update current authenticated user's profile"""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get(self, request, format=None):
        profile = _get_profile(request)
        if profile is None:
            return response.Response({"detail": "User profile not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = UserProfileSerializer(profile, context={'request': request})
        return response.Response(serializer.data)

    def put(self, request, format=None):
        profile = _get_profile(request)
        if not profile:
             return response.Response(status=status.HTTP_401_UNAUTHORIZED)
             
        # Support both multipart (file upload) and JSON (fields update)
        if 'avatar' in request.FILES:
            profile.avatar = request.FILES['avatar']
            profile.default_avatar_url = None # Clear default if custom uploaded
            
        data = request.data
        
        # Username Update
        if 'username' in data:
            new_username = data.get('username', '').strip()
            if new_username and new_username != request.user.username:
                if User.objects.filter(username=new_username).exists():
                    return response.Response(
                        {"detail": "Username already taken", "error": "Username already taken"}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                request.user.username = new_username
                request.user.save()

        if 'bio' in data: profile.bio = data['bio']
        if 'nickname' in data: profile.nickname = data['nickname']
        if 'is_private' in data: profile.is_private = str(data['is_private']).lower() == 'true'
        if 'interests' in data:
            try:
                profile.interests = data['interests'] if isinstance(data['interests'], list) else []
            except: pass
            
        if 'default_avatar_url' in data:
            profile.default_avatar_url = data['default_avatar_url']
            # If they choose a default, they might want to clear their custom one
            # or we just keep it and let the serializer/frontend handle priorities.
            # Usually setting default_avatar_url means "use this instead of my photo"
            if data['default_avatar_url']:
                profile.avatar = None
            
        profile.save()
        serializer = UserProfileSerializer(profile, context={'request': request})
        return response.Response(serializer.data)



# -------------------------
# Posts
# -------------------------
# In core/views.py

# Update the _get_profile function to auto-create profiles:
# Helper _get_profile moved to the utilities section above


class PostDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Post.objects.all().select_related("author__user")
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_destroy(self, instance):
        profile = _get_profile(self.request)
        if instance.author != profile:
            raise permissions.PermissionDenied("You can only delete your own posts.")
        instance.delete()

    def perform_update(self, serializer):
        profile = _get_profile(self.request)
        if serializer.instance.author != profile:
            raise permissions.PermissionDenied("You can only edit your own posts.")
        serializer.save()
class PostList(generics.ListCreateAPIView):
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    parser_classes = (MultiPartParser, FormParser)

    def get_queryset(self):
        # Base QuerySet
        queryset = Post.objects.all().select_related("author__user").order_by("-created_at")
        
        # Filter blocked users if authenticated
        profile = _get_profile(self.request)
        if profile:
            try:
                from chat.models import UserRestriction
                from django.db.models import Q
                
                # Get all blocking relationships involving this user (both directions)
                blocked_relations = UserRestriction.objects.filter(
                    (Q(user=profile) | Q(restricted_user=profile)),
                    restriction_type='block'
                ).values_list('user_id', 'restricted_user_id')
                
                # Collect all user IDs involved in blocking (except the current user)
                blocked_ids = set()
                for u1, u2 in blocked_relations:
                    if u1 != profile.id: blocked_ids.add(u1)
                    if u2 != profile.id: blocked_ids.add(u2)
                
                if blocked_ids:
                    queryset = queryset.exclude(author__id__in=blocked_ids)
            except Exception as e:
                logger.error(f"Error filtering blocked users in PostList: {e}")
                
        return queryset

    def perform_create(self, serializer):
        profile = _get_profile(self.request)
        
        # Raise error if authenticated but no profile
        if not profile:
            if self.request.user.is_authenticated:
                raise permissions.PermissionDenied("User profile not found. Please contact support.")
            else:
                raise permissions.PermissionDenied("Authentication required to create posts.")
        
        # Extract tags
        tags = []
        if 'tags' in self.request.data:
            try:
                tags_data = self.request.data.get('tags')
                if isinstance(tags_data, str):
                    import json
                    tags = json.loads(tags_data)
                elif isinstance(tags_data, list):
                    tags = tags_data
            except Exception as e:
                logger.warning(f"Error parsing tags: {e}")
        
        # Extract from content if empty
        content = serializer.validated_data.get('content', '')
        caption = serializer.validated_data.get('caption', '')
        text = caption or content
        
        if not tags and text:
            import re
            regex_tags = re.findall(r"#(\w+)", text)
            tags.extend(regex_tags)
        
        # Clean tags: remove #, convert to lowercase, strip whitespace, remove empty
        tags = [
            tag.lstrip('#').lower().strip().replace(' ', '').replace('\t', '').replace('\n', '')
            for tag in tags 
            if tag and tag.strip()
        ]
        # Remove duplicates and limit to 15 tags
        tags = list(dict.fromkeys(tags))[:15]  # dict.fromkeys preserves order while removing duplicates
        # Filter out any empty strings that might have resulted from cleaning
        tags = [t for t in tags if t]
        
        # Save with author and tags
        serializer.save(author=profile, tags=tags)

class GetFollowingUsersView(views.APIView):
    """Get list of users that current user follows (for sharing)"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, format=None):
        profile = _get_profile(request)
        if not profile:
            return response.Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Get all users the current user follows
        following_qs = Follow.objects.filter(follower=profile).select_related('followee__user')
        
        # Filter out blocked users
        blocked_ids = _get_blocked_profile_ids(profile)
        if blocked_ids:
            following_qs = following_qs.exclude(followee_id__in=blocked_ids)
        
        users = []
        for follow in following_qs:
            followee = follow.followee
            users.append({
                'id': followee.id,
                'user_id': followee.user.id,
                'username': followee.user.username,
                'avatar': followee.get_avatar_url(request),
                'bio': followee.bio or '',
                'nickname': followee.nickname or ''
            })
        
        return response.Response({'following': users})


class MeFollowersView(views.APIView):
    """Get list of users that follow the current user"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, format=None):
        profile = _get_profile(request)
        if not profile:
            return response.Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Get users who follow the current user
        followers_qs = Follow.objects.filter(followee=profile).select_related('follower__user')
        
        # Filter out blocked users
        blocked_ids = _get_blocked_profile_ids(profile)
        if blocked_ids:
            followers_qs = followers_qs.exclude(follower_id__in=blocked_ids)
            
        users = []
        for follow in followers_qs:
            follower = follow.follower
            users.append({
                'id': follower.id,
                'user_id': follower.user.id,
                'username': follower.user.username,
                'avatar': follower.get_avatar_url(request),
                'bio': follower.bio or '',
                'nickname': follower.nickname or ''
            })
        
        return response.Response({'followers': users})
class SharedPostSerializer(serializers.ModelSerializer):
    """Serializer for shared posts"""
    post = PostSerializer(read_only=True)
    shared_by = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = SharedPost
        fields = ['id', 'post', 'shared_by', 'shared_with', 'message', 'created_at', 'read']



class SharePostWithUsersView(views.APIView):
    """Share a post with specific users"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk, format=None):
        profile = _get_profile(request)
        if not profile:
            return response.Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Get the post
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            return response.Response(
                {"detail": "Post not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get list of user IDs to share with
        user_ids = request.data.get('user_ids', [])
        message = request.data.get('message', '')
        
        try:
            result = PostService.share_post_with_users(profile, pk, user_ids, message)
            return response.Response(result)
        except ValidationError as e:
            return response.Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return response.Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class SharedWithMeView(views.APIView):
    """Get posts that have been shared with me"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, format=None):
        from .models import SharedPost
        
        profile = _get_profile(request)
        if not profile:
            return response.Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Get posts shared with this user
        shared_posts = SharedPost.objects.filter(
            shared_with=profile
        ).select_related(
            'post__author__user',
            'shared_by__user'
        ).order_by('-created_at')[:50]
        
        serializer = SharedPostSerializer(shared_posts, many=True)
        return response.Response(serializer.data)


class MarkSharedPostReadView(views.APIView):
    """Mark a shared post as read"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk, format=None):
        from .models import SharedPost
        
        profile = _get_profile(request)
        if not profile:
            return response.Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            shared_post = SharedPost.objects.get(pk=pk, shared_with=profile)
            shared_post.read = True
            shared_post.save()
            return response.Response({'status': 'marked_read'})
        except SharedPost.DoesNotExist:
            return response.Response(
                {"detail": "Shared post not found"},
                status=status.HTTP_404_NOT_FOUND
            )

class PostLikeView(views.APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def post(self, request, pk, format=None):
        profile = _get_profile(request)
        if profile is None:
            return response.Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        post = get_object_or_404(Post, pk=pk)
        result = PostService.toggle_like(profile, pk)
        return response.Response(result)


class PostSaveView(views.APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def post(self, request, pk, format=None):
        profile = _get_profile(request)
        if profile is None:
            return response.Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        post = get_object_or_404(Post, pk=pk)
        result = PostService.toggle_save(profile, pk)
        return response.Response(result)


class SavedPostsView(views.APIView):
    """Retrieve all posts saved by the current user"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, format=None):
        profile = _get_profile(request)
        if not profile:
            return response.Response({"detail": "User profile not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Get posts that have a 'save' event from this user, ordered by most recent save
        saved_posts = Post.objects.filter(
            userevent__user=profile, 
            userevent__event_type="save"
        ).order_by('-userevent__created_at').select_related('author__user').prefetch_related('comments').distinct()
        
        from .serializers import PostSerializer
        serializer = PostSerializer(saved_posts, many=True, context={'request': request})
        return response.Response(serializer.data)


# -------------------------
# Comments
# -------------------------
class PostCommentsView(views.APIView):
    """
    Retrieve all comments for a specific post
    """
    permission_classes = [permissions.AllowAny]
    
    def get(self, request, pk, format=None):
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            return response.Response(
                {"detail": "Post not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        comments = post.comments.all().select_related("author__user").order_by("-created_at")
        serializer = CommentSerializer(comments, many=True)
        return response.Response(serializer.data)


class CommentCreate(generics.CreateAPIView):
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        profile = _get_profile(self.request)
        if not profile:
            raise permissions.PermissionDenied("Authentication required")
            
        # Check for blocks between commenter and author (from POST data)
        # We need the post instance to check the author
        post_id = self.request.data.get('post')
        if post_id:
            try:
                post = Post.objects.get(pk=post_id)
                from chat.models import UserRestriction
                from django.db.models import Q
                
                # Check if I blocked them OR they blocked me
                if UserRestriction.objects.filter(
                    (Q(user=profile, restricted_user=post.author) | Q(user=post.author, restricted_user=profile)),
                    restriction_type='block'
                ).exists():
                    raise permissions.PermissionDenied("Cannot comment on this post due to restrictions")
            except Post.DoesNotExist:
                pass # Serializer will handle this validation

        comment = serializer.save(author=profile) # save returns the instance
        
        # Create notification if not self-comment
        if comment.post.author != profile:
            Notification.objects.create(
                user=comment.post.author,
                actor=profile,
                notification_type='comment',
                post=comment.post,
                message=f"{profile.user.username} commented: {comment.content[:30]}..."
            )


class CommentDetail(views.APIView):
    """
    Update or Delete a comment
    Delete: Allow comment author OR post author to delete
    Update: Allow ONLY comment author to update
    """
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request, pk, post_id=None, format=None):
        profile = _get_profile(request)
        if not profile:
            return response.Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            comment = Comment.objects.get(pk=pk)
        except Comment.DoesNotExist:
            return response.Response(
                {"detail": "Comment not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        if comment.author != profile:
            return response.Response(
                {"detail": "You don't have permission to edit this comment"},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = CommentSerializer(comment, data=request.data, partial=True)
        if serializer.is_valid():
            updated_comment = serializer.save()
            return response.Response(serializer.data)
        
        return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk, post_id=None, format=None):
        profile = _get_profile(request)
        if not profile:
            return response.Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            comment = Comment.objects.get(pk=pk)
        except Comment.DoesNotExist:
            return response.Response(
                {"detail": "Comment not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check permissions: comment author OR post author can delete
        is_comment_author = comment.author == profile
        is_post_author = comment.post.author == profile
        
        if not (is_comment_author or is_post_author):
            return response.Response(
                {"detail": "You don't have permission to delete this comment"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        comment_id = comment.id
        comment.delete()
        
        return response.Response(
            {"status": "Comment deleted successfully", "comment_id": comment_id},
            status=status.HTTP_200_OK
        )


class MyCommentsView(generics.ListAPIView):
    """
    Get all comments made by the current authenticated user
    """
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        profile = _get_profile(self.request)
        if profile:
            return Comment.objects.filter(author=profile).select_related(
                "post__author__user", 
                "author__user"
            ).order_by("-created_at")
        return Comment.objects.none()


# In core/views.py, replace the PostExploreView class:
class PostExploreView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, format=None):
        tag = request.GET.get("tag", "").strip()
        profile = _get_profile(request)
        
        # Base queryset: Include all posts as per user clarification
        # Annotate with counts to avoid N+1 queries
        from django.db.models import Count, Q
        qs = Post.objects.all().select_related("author__user").annotate(
            annotated_likes_count=Count('events', filter=Q(events__event_type='like'), distinct=True),
            annotated_comments_count=Count('comments', distinct=True)
        )
        
        # Exclude current user's posts if logged in 
        # (Though Following shows them, Explore usually doesn't, but we keep this standard for discovery)
        if profile:
            qs = qs.exclude(author=profile)
            
            # Exclude posts from blocked users
            blocked_ids = _get_blocked_profile_ids(profile)
            if blocked_ids:
                qs = qs.exclude(author_id__in=blocked_ids)
        
        # Tag filtering
        if tag:
            normalized_tag = tag.lstrip('#').lower()
            qs = qs.order_by("-created_at")
            posts_pool = qs[:1000]
        else:
            # No tag: Get a pool of recent posts to rank
            qs = qs.order_by("-created_at")
            posts_pool = qs[:500]
        
        # Convert to list to avoid repeated queries and allow manual ranking
        candidate_posts = list(posts_pool)
        
        # For authenticated users, identify liked/saved posts in the batch
        liked_post_ids = set()
        saved_post_ids = set()
        if profile and candidate_posts:
            liked_post_ids = set(UserEvent.objects.filter(
                user=profile, 
                post__in=candidate_posts, 
                event_type="like"
            ).values_list('post_id', flat=True))
            
            saved_post_ids = set(UserEvent.objects.filter(
                user=profile, 
                post__in=candidate_posts, 
                event_type="save"
            ).values_list('post_id', flat=True))

        # Ranking Algorithm
        ranked_results = []
        for p in candidate_posts:
            # Tag Filter (if requested)
            if tag:
                normalized_tag = tag.lstrip('#').lower()
                post_tags = [t.lower() for t in (p.tags or [])]
                if normalized_tag not in post_tags:
                    continue
            
            # Calculate Relevance Score
            score = 0
            
            # 1. Interest Match Boost (Lowered slightly to favor recency)
            if profile and profile.interests and p.tags:
                my_interests = [i.strip().lower() for i in profile.interests if i.strip()]
                post_tags = [t.lower() for t in p.tags]
                shared = set(my_interests) & set(post_tags)
                score += len(shared) * 10 
            
            # 2. Popularity Boost (Lowered to ensure new posts win)
            score += (p.annotated_likes_count * 2)
            score += (p.annotated_comments_count * 5)
            
            # 3. Recency Weight (CRITICAL BOOST)
            # Freshness is now the dominant factor
            hours_since = (timezone.now() - p.created_at).total_seconds() / 3600
            if hours_since < 24:
                # 0-24 point boost based on age
                score += (24 - hours_since) * 5 # Increased from 2 to 5 multiplier
            elif hours_since < 168: # 7 days
                score += (168 - hours_since) / 10
            
            ranked_results.append({
                'post': p,
                'score': score
            })

        # Sort by score descending, then by date
        ranked_results.sort(key=lambda x: (x['score'], x['post'].created_at), reverse=True)
        
        # Final formatting
        out = []
        for item in ranked_results:
            p = item['post']

            
            author_avatar = None
            if p.author.avatar:
                author_avatar = request.build_absolute_uri(p.author.avatar.url)
            else:
                author_avatar = p.author.default_avatar_url or f"https://api.dicebear.com/7.x/avataaars/svg?seed={p.author.user.username}"

            is_following = False
            if profile:
                is_following = Follow.objects.filter(follower=profile, followee=p.author).exists()

            out.append({
                "id": p.id,
                "author": {
                    "id": p.author.id, 
                    "user": {
                        "id": p.author.user.id, 
                        "username": p.author.user.username,
                        "first_name": p.author.user.first_name or "",
                        "last_name": p.author.user.last_name or ""
                    },
                    "avatar": author_avatar,
                    "bio": p.author.bio or "",
                    "nickname": p.author.nickname or "",
                    "is_following": is_following,
                    "is_blocked": False
                },
                "content": p.content or p.caption or "",
                "caption": p.caption or p.content or "",
                "image": request.build_absolute_uri(p.image.url) if p.image else None,
                "tags": p.tags or [],
                "is_public": p.is_public,
                "created_at": p.created_at.isoformat(),
                "is_liked": p.id in liked_post_ids,
                "is_saved": p.id in saved_post_ids,
                "likes_count": p.annotated_likes_count,
                "comments_count": p.annotated_comments_count,
                "comments": [],
                "explore_score": item['score'] # Debug/info field
            })
            
        return response.Response(out)



class DeleteAllThreadsView(views.APIView):
    """Delete all chat threads for the current user"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, format=None):
        profile = _get_profile(request)
        if not profile:
            return response.Response(status=status.HTTP_401_UNAUTHORIZED)
        
        # In this logic, we mark messages as deleted for the user
        threads = ChatThread.objects.filter(participants=profile)
        for thread in threads:
            messages = thread.messages.all()
            for msg in messages:
                msg.deleted_by.add(profile)
        
        return response.Response({"detail": "All conversations cleared from your list."}, status=status.HTTP_200_OK)
# Add this view for creating comments on specific posts
class CommentOnPostView(views.APIView):
    """Create a comment on a specific post"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, post_id, format=None):
        profile = _get_profile(request)
        if not profile:
            return response.Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            post = Post.objects.get(id=post_id)
        except Post.DoesNotExist:
            return response.Response(
                {"detail": "Post not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        from chat.models import UserRestriction
        from django.db.models import Q
        
        # Check for blocks between commenter and author
        if UserRestriction.objects.filter(
            (Q(user=profile, restricted_user=post.author) | Q(user=post.author, restricted_user=profile)),
            restriction_type='block'
        ).exists():
            return response.Response(
                {"detail": "Cannot comment on this post due to restrictions"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        content = request.data.get('content', '').strip()
        if not content:
            return response.Response(
                {"detail": "Comment content cannot be empty"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create the comment
        comment = Comment.objects.create(
            post=post,
            author=profile,
            content=content
        )
        
        # Create notification for post author
        if post.author != profile:
            Notification.objects.create(
                user=post.author,
                actor=profile,
                notification_type='comment',
                post=post,
                message=f"{profile.user.username} commented: {content[:30]}..."
            )
        
        # Return the created comment
        serializer = CommentSerializer(comment)
        return response.Response(serializer.data, status=status.HTTP_201_CREATED)
# Add these to your core/views.py file in the appropriate sections
class SharePostView(views.APIView):
    """Share a post with multiple users via chat"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk, format=None):
        profile = _get_profile(request)
        if profile is None:
            return response.Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        post = get_object_or_404(Post, pk=pk)
        user_ids = request.data.get('user_ids', [])
        share_message = request.data.get('message', '')

        if not user_ids:
            return response.Response(
                {"detail": "At least one user_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.db import transaction
        
        shared_count = 0
        try:
            with transaction.atomic():
                for target_profile_id in user_ids:
                    try:
                        target_profile = UserProfile.objects.get(pk=target_profile_id)
                        if target_profile == profile:
                            continue

                        # BLOCK CHECK
                        if target_profile.id in _get_blocked_profile_ids(profile):
                            continue

                        # Find or create a 1-on-1 thread
                        from django.db.models import Count
                        thread = ChatThread.objects.filter(
                            participants=profile
                        ).filter(
                            participants=target_profile
                        ).annotate(
                            num_participants=Count('participants')
                        ).filter(
                            num_participants=2
                        ).first()
                        
                        if not thread:
                            thread = ChatThread.objects.create(status='active', initiator=profile)
                            thread.participants.add(profile, target_profile)

                        # Create the chat message
                        msg_content = share_message if share_message else ""
                        
                        msg = ChatMessage.objects.create(
                            thread=thread,
                            sender=profile,
                            content=msg_content
                        )
                        
                        # Create shared post linked to the message
                        shared_post = SharedPost.objects.create(
                            post=post,
                            shared_by=profile,
                            shared_with=target_profile,
                            chat_message=msg,
                            message=share_message
                        )
                        
                        # Create notification
                        Notification.objects.create(
                            user=target_profile,
                            actor=profile,
                            notification_type='message',
                            message=f"{profile.user.username} shared a post with you"
                        )
                        shared_count += 1
                        
                    except UserProfile.DoesNotExist:
                        continue
                    except Exception as e:
                        logger.error(f"Error sharing post: {e}")
                        continue

                # Track share event (use get_or_create to avoid duplicates)
                UserEvent.objects.get_or_create(
                    user=profile,
                    post=post,
                    event_type="share"
                )
                
                # If we shared with exactly one user, return the thread id for redirection
                last_thread_id = None
                if len(user_ids) == 1:
                    try:
                        target_profile = UserProfile.objects.get(pk=user_ids[0])
                        thread = ChatThread.objects.filter(
                            participants=profile
                        ).filter(
                            participants=target_profile
                        ).annotate(
                            num_participants=Count('participants')
                        ).filter(
                            num_participants=2
                        ).first()
                        if thread:
                            last_thread_id = thread.id
                    except:
                        pass

                return response.Response({
                    "status": "success",
                    "shared_count": shared_count,
                    "thread_id": last_thread_id,
                    "message": f"Post shared with {shared_count} users"
                })
        except Exception as e:
             logger.error(f"Transaction failed: {e}")
             return response.Response(
                {"detail": "Failed to share post"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
             )

class PostDetailWithComments(views.APIView):
    """Get post details with all comments"""
    permission_classes = [permissions.AllowAny]
    
    def get(self, request, pk, format=None):
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            return response.Response(
                {"detail": "Post not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        profile = _get_profile(request)
        
        # Get all comments
        comments = post.comments.all().select_related("author__user").order_by("-created_at")
        comments_serializer = CommentSerializer(comments, many=True)
        
        # Get like/save status for current user
        is_liked = False
        is_saved = False
        if profile:
            is_liked = UserEvent.objects.filter(
                user=profile, 
                post=post, 
                event_type="like"
            ).exists()
            is_saved = UserEvent.objects.filter(
                user=profile, 
                post=post, 
                event_type="save"
            ).exists()
        
        likes_count = UserEvent.objects.filter(post=post, event_type="like").count()
        saves_count = UserEvent.objects.filter(post=post, event_type="save").count()
        
        response_data = {
            "post": {
                "id": post.id,
                "author": {
                    "id": post.author.id,
                    "user": {
                        "id": post.author.user.id,
                        "username": post.author.user.username,
                        "first_name": post.author.user.first_name,
                        "last_name": post.author.user.last_name
                    },
                    "avatar": request.build_absolute_uri(post.author.avatar.url) if post.author.avatar else None,
                    "bio": post.author.bio
                },
                "content": post.content,
                "caption": post.caption,
                "image": request.build_absolute_uri(post.image.url) if post.image else None,
                "tags": post.tags or [],
                "is_public": post.is_public,
                "created_at": post.created_at.isoformat(),
                "is_liked": is_liked,
                "is_saved": is_saved,
                "likes_count": likes_count,
                "saves_count": saves_count,
                "comments_count": post.comments.count()
            },
            "comments": comments_serializer.data
        }
        
        return response.Response(response_data)
class PostsFeedView(views.APIView):
    """Get personalized feed for authenticated user (all posts for now)"""
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get(self, request, format=None):
        profile = _get_profile(request)
        
        # Filter posts logic:
        # 1. My posts (public or private)
        # 2. Public posts from anyone
        # 3. Private posts from people I follow
        
        if profile:
            # Q(author=profile) -> My posts
            # Q(is_public=True) -> All public posts
            # Q(author__followers__follower=profile) -> Posts by authors I follow
            qs = Post.objects.filter(
                Q(author=profile) | 
                Q(is_public=True) | 
                Q(author__followers__follower=profile)
            ).distinct()
            
            # EXCLUDE posts from blocked users
            blocked_ids = _get_blocked_profile_ids(profile)
            if blocked_ids:
                qs = qs.exclude(author_id__in=blocked_ids)
        else:
            # Unauthenticated: only public posts
            qs = Post.objects.filter(is_public=True)

        posts = qs.select_related("author__user").order_by("-created_at")[:1000]
        
        serializer = PostSerializer(posts, many=True, context={'request': request})
        return response.Response(serializer.data)


class PostsFromUserView(views.APIView):
    """Get posts from a specific user"""
    permission_classes = [permissions.AllowAny]

    def get(self, request, format=None):
        user_id = request.GET.get("user_id")
        profile = _get_profile(request)
        
        if user_id:
            try:
                author = UserProfile.objects.get(pk=int(user_id))
            except UserProfile.DoesNotExist:
                return response.Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        else:
            author = profile
            if author is None:
                return response.Response({"detail": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
        
        posts = Post.objects.filter(author=author).select_related("author__user").order_by("-created_at")
        
        # BLOCK CHECK - Removed to allow blurred teaser content in frontend
        # if profile and author != profile:
        #     if author.id in _get_blocked_profile_ids(profile):
        #         return response.Response({"detail": "Cannot view posts from this user"}, status=status.HTTP_403_FORBIDDEN)
        
        posts = posts[:1000]
        
        # Use the serializer to ensure all fields are included
        serializer = PostSerializer(posts, many=True, context={'request': request})
        return response.Response(serializer.data)


class FollowingPostsView(views.APIView):
    """Get posts ONLY from people the user follows"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, format=None):
        profile = _get_profile(request)
        if not profile:
            return response.Response({"detail": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
            
        # Get IDs of people the user follows
        followed_user_ids = Follow.objects.filter(follower=profile).values_list('followee_id', flat=True)
        
        # EXCLUDE blocked users
        blocked_ids = _get_blocked_profile_ids(profile)
        if blocked_ids:
            followed_user_ids = [uid for uid in followed_user_ids if uid not in blocked_ids]
            
        # Filter posts by those authors
        qs = Post.objects.filter(author_id__in=followed_user_ids).select_related("author__user").order_by("-created_at")[:1000]
        
        serializer = PostSerializer(qs, many=True, context={'request': request})
        return response.Response(serializer.data)

# -------------------------
# Events
# -------------------------
class EventCreate(generics.CreateAPIView):
    queryset = UserEvent.objects.all()
    serializer_class = UserEventSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        profile = _get_profile(self.request)
        if profile is None:
            raise permissions.PermissionDenied("Authenticated user with profile required")
        serializer.save(user=profile)


# -------------------------
# Recommendations
# -------------------------
class RecommendationView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, format=None):
        text = (request.data.get("text") or "").lower()
        suggestions = set()
        keyword_map = {
            "photo": "photography",
            "travel": "travel",
            "food": "cooking",
            "recipe": "cooking",
            "k-pop": "k-pop",
            "drama": "drama",
            "gay": "gay-drama",
            "manga": "manga",
            "game": "gaming",
            "football": "football",
            "workout": "fitness",
            "education": "education",
            "study": "education",
            "learning": "education",
            "coding": "technology",
            "programming": "technology",
            "math": "stem",
            "science": "stem",
        }
        for kw, tag in keyword_map.items():
            if kw in text:
                suggestions.add(tag)
        for token in text.split():
            if token.startswith("#") and len(token) > 1:
                suggestions.add(token.lstrip("#"))
        return response.Response({"recommendations": list(suggestions)[:8]})

# Replace your existing DiscoverView in core/views.py with this enhanced version
# Add this import at the top of core/views.py
from django.utils import timezone
from datetime import timedelta

class DiscoverView(views.APIView):
    """
    Hashtag-based user matching with time filters.
    Matches users based on shared hashtags in their posts.
    Supports filters: 'all_time', 'last_post', 'week', 'month'
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, format=None):
        try:
            # Parse request parameters
            limit = int(request.GET.get("limit", 50))
            filter_type = request.GET.get('filter', 'all_time')
            search_query = request.GET.get('q', '').strip().lower()
            profile = _get_profile(request)
            
            logger.info(f"[DiscoverView] Request - User: {profile.user.username if profile else 'Guest'}, Filter: {filter_type}, Search: '{search_query}', Limit: {limit}")

            # Validate filter type
            valid_filters = ['all_time', 'last_post', 'week', 'month']
            if filter_type not in valid_filters:
                logger.warning(f"[DiscoverView] Invalid filter type: {filter_type}, defaulting to 'all_time'")
                filter_type = 'all_time'

            # Base queryset for people to discover
            others_qs = UserProfile.objects.filter(
                user__is_active=True  # Filter out deactivated accounts
            ).select_related("user")
            
            if profile:
                others_qs = others_qs.exclude(id=profile.id)
                logger.info(f"[DiscoverView] Excluding current user from results")
                
                # Filter out blocked users (both directions)
                blocked_ids = _get_blocked_profile_ids(profile)
                if blocked_ids:
                    others_qs = others_qs.exclude(id__in=blocked_ids)
                    logger.info(f"[DiscoverView] Excluded {len(blocked_ids)} blocked users")
                
            # Apply search filter if provided
            if search_query:
                others_qs = others_qs.filter(
                    Q(user__username__icontains=search_query) |
                    Q(bio__icontains=search_query) |
                    Q(nickname__icontains=search_query) |
                    Q(user__first_name__icontains=search_query) |
                    Q(user__last_name__icontains=search_query)
                )
                logger.info(f"[DiscoverView] Applied search filter, {others_qs.count()} users match search")
                
            # Handle guest users (no authentication)
            if not profile:
                logger.info(f"[DiscoverView] Guest user requesting discover")
                if search_query:
                    # For guests with search query, show matching users
                    active_users = others_qs[:limit]
                    results = []
                    for up in active_users:
                        results.append(self._build_user_dict(request, up, None, "Matches your search", []))
                    logger.info(f"[DiscoverView] Returning {len(results)} search results for guest")
                    return response.Response({"results": results})
                else:
                    # NO FALLBACK - guests without search get empty results
                    logger.info(f"[DiscoverView] Guest without search query, returning empty results")
                    return response.Response({
                        "results": [],
                        "message": "Please log in to discover people based on your interests!"
                    })

            # Get current user's hashtags based on filter
            my_tags = set()
            # Include ALL user's posts (public + private) to build their interest profile
            # We only filter other users' posts by is_public for privacy
            my_posts_qs = Post.objects.filter(author=profile).order_by('-created_at', '-id')
            
            # Apply ASYMMETRIC time-based filtering
            # My posts: shorter window (what I'm interested in NOW)
            # Their posts: longer window (their recent activity)
            now = timezone.now()
            my_time_filter = None
            their_time_filter = None
            
            if filter_type == 'last_post':
                # Special handling: Use ONLY the most recent post's hashtags
                # Match with users who posted about those hashtags in the last 1 month
                my_time_filter = None  # Don't filter by time, just get the latest post
                their_time_filter = now - timedelta(days=30)  # Their posts from last month
                logger.info(f"[DiscoverView] Filter: last_post - using ONLY my most recent post's hashtags, matching with their posts from last 30 days")
            elif filter_type == 'week':
                # My last 7 days → their last 30 days
                my_time_filter = now - timedelta(days=7)
                their_time_filter = now - timedelta(days=30)
                logger.info(f"[DiscoverView] Filter: week - my posts from last 7 days, their posts from last 30 days")
            elif filter_type == 'month':
                # My last 3 months → their last 3 months
                my_time_filter = now - timedelta(days=90)
                their_time_filter = now - timedelta(days=90)
                logger.info(f"[DiscoverView] Filter: month - my posts from last 90 days, their posts from last 90 days")
            elif filter_type == 'all_time':
                # My all posts → their all posts
                my_time_filter = None
                their_time_filter = None
                logger.info(f"[DiscoverView] Filter: all_time - all posts from both users")
            
            # Apply MY time filter
            if my_time_filter:
                my_posts_qs = my_posts_qs.filter(created_at__gte=my_time_filter)
            
            # Collect hashtags from filtered posts
            # For 'last_post' filter, only take the FIRST (most recent) post
            if filter_type == 'last_post':
                my_posts = list(my_posts_qs[:1])  # Only the most recent post
            else:
                my_posts = list(my_posts_qs)
            logger.info(f"[DiscoverView] Found {len(my_posts)} posts matching filter '{filter_type}'")
            
            for post in my_posts:
                if post.tags:
                    normalized_tags = [t.lower().strip() for t in post.tags if t and t.strip()]
                    my_tags.update(normalized_tags)
                    logger.info(f"[DiscoverView] Post {post.id} has tags: {post.tags} -> normalized: {normalized_tags}")
                else:
                    logger.info(f"[DiscoverView] Post {post.id} has NO tags")
            
            logger.info(f"[DiscoverView] User's FINAL TAGS: {sorted(list(my_tags))}")

            # NO FALLBACK - if no tags and no search, return empty results
            if not my_tags and not search_query:
                logger.info(f"[DiscoverView] User has no hashtags and no search query, returning empty results")
                return response.Response({
                    "results": [],
                    "message": "Start posting with #hashtags to discover people with similar interests!"
                })
            
            # Find matches based on shared hashtags
            matches = []
            other_profiles = list(others_qs[:500])  # Check up to 500 users for matches
            logger.info(f"[DiscoverView] Checking {len(other_profiles)} other profiles for matches")
            
            for other_profile in other_profiles:
                try:
                    # Apply search filter first if provided (optimization)
                    is_search_match = False
                    if search_query:
                        username_match = search_query in other_profile.user.username.lower()
                        bio_match = search_query in (other_profile.bio or '').lower()
                        nickname_match = search_query in (other_profile.nickname or '').lower()
                        is_search_match = username_match or bio_match or nickname_match
                        
                        if not is_search_match and not my_tags:
                            continue # No search match and no tags to check

                    # Collect tags and check for overlap
                    # Apply the same time filter to other users' posts
                    other_posts_qs = Post.objects.filter(
                        author=other_profile, 
                        is_public=True
                    ).order_by('-created_at', '-id')
                    
                    # Apply THEIR time filter (longer window)
                    if their_time_filter:
                        other_posts_qs = other_posts_qs.filter(created_at__gte=their_time_filter)
                    
                    other_posts = list(other_posts_qs[:100])
                    
                    # Skip users with no posts in the filtered time range
                    if not other_posts and filter_type != 'all_time':
                        continue
                    
                    other_tags = set()
                    for post in other_posts:
                        if post.tags:
                            normalized_tags = [t.lower().strip() for t in post.tags if t and t.strip()]
                            other_tags.update(normalized_tags)
                    
                    common_tags = my_tags & other_tags
                    
                    # Include if search matches OR has common tags
                    if is_search_match or common_tags:
                        shared_tags_list = sorted(list(common_tags))
                        
                        if common_tags:
                            reason = f"You both post about #{shared_tags_list[0]}"
                            if len(shared_tags_list) > 1:
                                reason += f" and #{shared_tags_list[1]}"
                        else:
                            reason = "Matched your search"

                        matches.append({
                            "data": other_profile,
                            "reason": reason,
                            "shared_count": len(common_tags),
                            "tags": list(other_tags)[:5],
                            "is_match": True,
                            "shared_tags": shared_tags_list[:3],
                            "is_search_match": is_search_match
                        })
                except Exception as e:
                    logger.error(f"[DiscoverView] Error processing profile {other_profile.id}: {e}")
                    continue
            
            logger.info(f"[DiscoverView] Found {len(matches)} total matches")

            # Sort by search match priority then number of shared hashtags (descending)
            matches.sort(key=lambda x: (x.get('is_search_match', False), x['shared_count']), reverse=True)
            
            # Build response
            results = []
            for match in matches[:limit]:
                results.append(self._build_user_dict(
                    request, 
                    match['data'], 
                    profile, 
                    match['reason'], 
                    match['tags'],
                    match.get('shared_tags', [])
                ))
            
            logger.info(f"[DiscoverView] Returning {len(results)} results (limited to {limit})")
            
            return response.Response({
                "results": results,
                "matched_by_tags": sorted(list(my_tags)) if my_tags else [],
                "total_matches": len(matches),
                "filter_applied": filter_type
            })
            
        except ValueError as e:
            logger.error(f"[DiscoverView] ValueError: {e}")
            return response.Response(
                {"error": "Invalid parameter value", "detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"[DiscoverView] Unexpected error: {e}", exc_info=True)
            return response.Response(
                {"error": "Internal server error", "detail": "An unexpected error occurred"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _build_user_dict(self, request, user_profile, me, reason, tags=None, shared_tags=None):
        """Build user dictionary for response"""
        try:
            is_following = False
            is_blocked = False
            if me:
                is_following = Follow.objects.filter(follower=me, followee=user_profile).exists()
                from chat.models import UserRestriction
                is_blocked = UserRestriction.objects.filter(
                    user=me,
                    restricted_user=user_profile,
                    restriction_type='block'
                ).exists()
            
            # Build avatar URL
            avatar_url = None
            if user_profile.avatar:
                avatar_url = request.build_absolute_uri(user_profile.avatar.url)
            elif user_profile.default_avatar_url:
                avatar_url = user_profile.default_avatar_url
            else:
                avatar_url = f"https://api.dicebear.com/7.x/avataaars/svg?seed={user_profile.user.username}"
                
            return {
                "id": user_profile.id,
                "user_id": user_profile.user.id,
                "username": user_profile.user.username,
                "avatar": avatar_url,
                "bio": user_profile.bio or "",
                "nickname": user_profile.nickname or "",
                "is_following": is_following,
                "is_blocked": is_blocked,
                "reason": reason,
                "tags": tags or [],
                "shared_tags": shared_tags or []
            }
        except Exception as e:
            logger.error(f"[DiscoverView] Error building user dict for {user_profile.id}: {e}")
            # Return minimal data if error
            return {
                "id": user_profile.id,
                "user_id": user_profile.user.id,
                "username": user_profile.user.username,
                "avatar": f"https://api.dicebear.com/7.x/avataaars/svg?seed={user_profile.user.username}",
                "bio": "",
                "nickname": "",
                "is_following": False,
                "reason": reason,
                "tags": [],
                "shared_tags": []
            }


class TrendingTagsView(views.APIView):
    """
    Get trending hashtags without exposing full post data.
    Returns only tag names and their frequency counts.
    """
    permission_classes = [permissions.AllowAny]
    
    def get(self, request, format=None):
        try:
            limit = int(request.GET.get('limit', 15))
            days = int(request.GET.get('days', 30))
            
            # Get posts from the last N days
            cutoff = timezone.now() - timedelta(days=days)
            posts = Post.objects.filter(
                created_at__gte=cutoff,
                is_public=True
            ).values_list('tags', flat=True)
            
            # Count tag frequency
            tag_frequency = {}
            for tags_list in posts:
                if tags_list:
                    for tag in tags_list:
                        clean_tag = tag.lower().strip()
                        if clean_tag:
                            tag_frequency[clean_tag] = tag_frequency.get(clean_tag, 0) + 1
            
            # Sort by frequency and return top N
            trending = sorted(
                tag_frequency.items(),
                key=lambda x: x[1],
                reverse=True
            )[:limit]
            
            # Return only tag names (not counts for privacy)
            result = [tag for tag, count in trending]
            
            logger.info(f"[TrendingTags] Returning {len(result)} trending tags")
            
            return response.Response({
                "tags": result,
                "period_days": days
            })
            
        except Exception as e:
            logger.error(f"[TrendingTags] Error: {e}", exc_info=True)
            return response.Response(
                {"error": "Failed to fetch trending tags"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )





class DebugMyPostsView(views.APIView):
    """Debug endpoint to check current user's posts and tags"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, format=None):
        profile = _get_profile(request)
        if not profile:
            return response.Response({"error": "Not authenticated"}, status=status.HTTP_401_UNAUTHORIZED)
        
        posts = Post.objects.filter(author=profile).order_by('-created_at')
        
        result = {
            "user": {
                "id": profile.id,
                "username": profile.user.username,
            },
            "total_posts": posts.count(),
            "posts": []
        }
        
        for post in posts:
            result["posts"].append({
                "id": post.id,
                "content_preview": post.content[:50] if post.content else "",
                "tags": post.tags,
                "is_public": post.is_public,
                "created_at": post.created_at.isoformat()
            })
        
        return response.Response(result)


# -------------------------
# Duplicate class removed. Use the one starting at line 1184 instead.







# Chat views moved to chat/views.py

class FollowUser(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, format=None):
        follower = _get_profile(request)
        followee = _get_profile_by_id_or_uuid(pk)
        
        if not followee:
            return response.Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)
            
        if follower == followee:
             return response.Response({"detail": "Cannot follow self"}, status=status.HTTP_400_BAD_REQUEST)
             
        from chat.models import UserRestriction
        from django.db.models import Q
        
        # Check for blocks
        if UserRestriction.objects.filter(
            (Q(user=follower, restricted_user=followee) | Q(user=followee, restricted_user=follower)),
            restriction_type='block'
        ).exists():
            return response.Response(
                {"detail": "Cannot follow this user due to restrictions"},
                status=status.HTTP_403_FORBIDDEN
            )

        obj, created = Follow.objects.get_or_create(follower=follower, followee=followee)
        if created:
             Notification.objects.create(
                user=followee,
                actor=follower,
                notification_type='follow',
                message=f"{follower.user.username} started following you"
             )
        
        return response.Response({"status": "ok", "followers_count": followee.followers.count(), "is_following": True})


class UnfollowUser(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, format=None):
        follower = _get_profile(request)
        followee = _get_profile_by_id_or_uuid(pk)
        
        if followee:
            Follow.objects.filter(follower=follower, followee=followee).delete()
            return response.Response({"status": "ok", "followers_count": followee.followers.count(), "is_following": False})
            
        return response.Response({"status": "ok"})


# -------------------------
# Notifications
# -------------------------
class NotificationList(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, format=None):
        profile = _get_profile(request)
        if not profile:
            logger.warning("NotificationList: No profile found for user")
            return response.Response([])
            
        # Debug unread count vs total count
        total_count = Notification.objects.filter(user=profile).count()
        unread_count = Notification.objects.filter(user=profile, read=False).count()
        logger.info(f"NotificationList: Fetching for {profile.user.username}. Total: {total_count}, Unread: {unread_count}")
        
        # Get notifications without select_related first to ensure data comes through
        # Filter out blocked users
        qs = Notification.objects.filter(user=profile)
        
        blocked_ids = _get_blocked_profile_ids(profile)
        if blocked_ids:
            qs = qs.exclude(actor_id__in=blocked_ids)

        notifications = qs.order_by('-created_at')[0:100]
        
        serializer = NotificationSerializer(notifications, many=True, context={'request': request})
        return response.Response(serializer.data)


class NotificationRead(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, format=None):
        profile = _get_profile(request)
        if not profile:
            return response.Response(status=status.HTTP_401_UNAUTHORIZED)
        
        notification = get_object_or_404(Notification, pk=pk, user=profile)
        notification.read = True
        notification.save()
        return response.Response({"status": "ok"})

class NotificationDelete(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk, format=None):
        profile = _get_profile(request)
        if not profile:
            return response.Response(status=status.HTTP_401_UNAUTHORIZED)
        
        notification = get_object_or_404(Notification, pk=pk, user=profile)
        notification.delete()
        return response.Response(status=status.HTTP_204_NO_CONTENT)
class PostUpdateView(views.APIView):
    """Update a post"""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    
    def put(self, request, pk, format=None):
        profile = _get_profile(request)
        if not profile:
            return response.Response({'detail': 'Authentication required'}, 
                                   status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            return response.Response({'detail': 'Post not found'}, 
                                   status=status.HTTP_404_NOT_FOUND)
        
        if post.author != profile:
            return response.Response({'detail': 'Not your post'}, 
                                   status=status.HTTP_403_FORBIDDEN)
        
        serializer = PostSerializer(post, data=request.data, partial=True)
        if serializer.is_valid():
            # Extract hashtags from updated content
            content = serializer.validated_data.get('content', '') or serializer.validated_data.get('caption', '')
            tags = []
            if content:
                import re
                tags = re.findall(r"#(\w+)", content)
                serializer.validated_data['tags'] = tags
            
            serializer.save()
            return response.Response(serializer.data)
        return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PostDeleteView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def delete(self, request, pk, format=None):
        profile = _get_profile(request)  # Fixed: changed get_profile to _get_profile
        if not profile:
            return response.Response({'detail': 'Authentication required'}, 
                                   status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            post = get_object_or_404(Post, pk=pk)
            if post.author != profile:
                return response.Response({'detail': 'Not your post'}, 
                                       status=status.HTTP_403_FORBIDDEN)
            post.delete()
            return response.Response({'message': 'Post deleted ✅'}, 
                                   status=status.HTTP_200_OK)
        except Post.DoesNotExist:
            return response.Response({'detail': 'Post not found'}, 
                                   status=status.HTTP_404_NOT_FOUND)
# UI Pages render
# -------------------------
def feed_page(request):
    return render(request, "core/feed.html")


def explore_page(request):
    return render(request, "core/explore.html")


def discover_page(request):
    return render(request, "core/discover.html")


def chat_page(request, thread_id=None):
    return render(request, "core/chat.html", {"thread_id": thread_id})


def notifications_page(request):
    return render(request, "core/notifications.html")


def profile_page(request):
    return render(request, "core/profile.html")


def my_comments_page(request):
    """Render the 'My Comments' page"""
    return render(request, "core/my_comments.html")

class LikedPostsView(generics.ListAPIView):
    """Get posts liked by the current user"""
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        profile = _get_profile(self.request)
        if profile:
            post_ids = UserEvent.objects.filter(
                user=profile, 
                event_type="like"
            ).values_list('post_id', flat=True)
            return Post.objects.filter(id__in=post_ids).select_related("author__user").order_by("-created_at")
        return Post.objects.none()

class CommentedPostsView(generics.ListAPIView):
    """Get posts where the current user has left comments"""
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        profile = _get_profile(self.request)
        if profile:
            post_ids = Comment.objects.filter(
                author=profile
            ).values_list('post_id', flat=True).distinct()
            return Post.objects.filter(id__in=post_ids).select_related("author__user").order_by("-created_at")
        return Post.objects.none()

class SavedPostsView(generics.ListAPIView):
    """Get posts saved by the current user"""
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        profile = _get_profile(self.request)
        if profile:
            post_ids = UserEvent.objects.filter(
                user=profile, 
                event_type="save"
            ).values_list('post_id', flat=True)
            return Post.objects.filter(id__in=post_ids).select_related("author__user").order_by("-created_at")
        return Post.objects.none()


class NotificationUnreadCountView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, format=None):
        profile = _get_profile(request)
        if not profile:
            return response.Response({"unread_count": 0}, status=status.HTTP_401_UNAUTHORIZED)
        
        qs = Notification.objects.filter(user=profile, read=False)
        
        # Exclude blocked users to match list view
        blocked_ids = _get_blocked_profile_ids(profile)
        if blocked_ids:
            qs = qs.exclude(actor_id__in=blocked_ids)
            
        unread_count = qs.count()
        return response.Response({"unread_count": unread_count})

class DefaultAvatarListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, format=None):
        # Different styles for more variety
        styles = ['avataaars', 'thumbs', 'shapes', 'fun-emoji', 'bottts-neutral']
        seeds = [
            'Felix', 'Aneka', 'Mason', 'Jocelyn', 'Ginger', 
            'Sunny', 'Joy', 'Bibi', 'Bella', 'Sam',
            'Leo', 'Ruby', 'Oliver', 'Lucy', 'Milo',
            'Sasha', 'Bear', 'Roxy', 'Nala', 'Rocky'
        ]
        
        avatars = []
        for style in styles:
            for seed in seeds:
                # Add specific parameters for each style to make them look premium
                params = ""
                if style == 'avataaars':
                    params = "&mouth=smile&eyes=happy"
                elif style == 'fun-emoji':
                    params = "&rotate=10"
                
                avatars.append(f"https://api.dicebear.com/7.x/{style}/svg?seed={seed}{params}")
                
        # Shuffle for variety
        import random
        random.shuffle(avatars)
        
        return response.Response({"avatars": avatars[:100]}) # Return a good variety
class PasswordResetRequestView(views.APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request, *args, **kwargs):
        username = request.data.get('username')
        email = request.data.get('email')
        
        if not username and not email:
            return response.Response(
                {"error": "Please provide username or email."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            if username:
                user = User.objects.get(username=username)
            else:
                user = User.objects.get(email=email)
                
            logger.info(f"Password reset requested for user: {user.username}")
            return response.Response({
                "message": "If an account exists with this information, you can now reset your password.",
                "ok": True,
                "user_found": True
            })
        except User.DoesNotExist:
            return response.Response({
                "message": "If an account exists with this information, a password reset link has been sent.",
                "ok": True,
                "user_found": False
            })

class PasswordResetConfirmView(views.APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request, *args, **kwargs):
        username = request.data.get('username')
        email = request.data.get('email')
        new_password = request.data.get('new_password')
        
        if not all([username, email, new_password]):
            return response.Response(
                {"error": "Missing required fields."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            user = User.objects.get(username=username, email=email)
            user.set_password(new_password)
            user.save()
            return response.Response({
                "message": "Password updated successfully.",
                "ok": True
            })
        except User.DoesNotExist:
            return response.Response(
                {"error": "Invalid username or email combination."},
                status=status.HTTP_400_BAD_REQUEST
            )
# Add these views after the FollowUser and UnfollowUser classes (around line 1500)

class CheckFollowingStatusView(views.APIView):
    """Check if current user follows another user"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, user_id, format=None):
        profile = _get_profile(request)
        if not profile:
            return response.Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            # Try to get user by user_id (which might be UserProfile id or User id)
            try:
                target_profile = UserProfile.objects.get(pk=user_id)
            except UserProfile.DoesNotExist:
                # Try to get by user_id as user id
                try:
                    target_profile = UserProfile.objects.get(user_id=user_id)
                except UserProfile.DoesNotExist:
                    return response.Response(
                        {"detail": "User not found"},
                        status=status.HTTP_404_NOT_FOUND
                    )
            
            is_following = Follow.objects.filter(
                follower=profile,
                followee=target_profile
            ).exists()
            
            return response.Response({
                "is_following": is_following,
                "user_id": target_profile.user.id,
                "profile_id": target_profile.id
            })
            
        except Exception as e:
            logger.error(f"Error checking follow status: {e}")
            return response.Response(
                {"detail": "Failed to check follow status"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserProfileByIdView(views.APIView):
    """Get user profile by profile ID (not user ID)"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, profile_id, format=None):
        try:
            profile = UserProfile.objects.get(pk=profile_id)
            serializer = UserProfileSerializer(profile, context={'request': request})
            return response.Response(serializer.data)
        except UserProfile.DoesNotExist:
            return response.Response(
                {"detail": "User profile not found"},
                status=status.HTTP_404_NOT_FOUND
            )





class GetUserPostsView(views.APIView):
    """Get posts from a specific user by profile ID"""
    permission_classes = [permissions.AllowAny]
    
    def get(self, request, format=None):
        user_id = request.GET.get("user_id")
        profile_id = request.GET.get("profile_id")
        
        if not user_id and not profile_id:
            return response.Response(
                {"detail": "user_id or profile_id parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            if profile_id:
                author = UserProfile.objects.get(pk=profile_id)
            else:
                author = UserProfile.objects.get(pk=int(user_id))
        except UserProfile.DoesNotExist:
            return response.Response(
                {"detail": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get all posts by this user
        posts = Post.objects.filter(author=author).select_related("author__user").order_by("-created_at")
        
        # Serialize the posts
        serializer = PostSerializer(posts, many=True, context={'request': request})
        
        return response.Response(serializer.data)


class FollowingPostsListView(views.APIView):
    """Get posts from users the current user follows"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, format=None):
        profile = _get_profile(request)
        if not profile:
            return response.Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Get IDs of people the user follows
        followed_user_ids = list(Follow.objects.filter(follower=profile).values_list('followee_id', flat=True))
        
        # Exclude blocked users
        from chat.models import UserRestriction
        from django.db.models import Q
        
        blocked_relations = UserRestriction.objects.filter(
            (Q(user=profile) | Q(restricted_user=profile)),
            restriction_type='block'
        ).values_list('user_id', 'restricted_user_id')
        
        blocked_ids = set()
        for u1, u2 in blocked_relations:
            if u1 != profile.id:
                blocked_ids.add(u1)
            if u2 != profile.id:
                blocked_ids.add(u2)
        
        # Remove blocked users from followed list
        if blocked_ids:
            followed_user_ids = [uid for uid in followed_user_ids if uid not in blocked_ids]
        
        # Filter posts by those authors (excluding blocked)
        qs = Post.objects.filter(author_id__in=followed_user_ids).select_related("author__user").order_by("-created_at")[:1000]
        
        # Build response in explore format
        out = []
        for p in qs:
            is_liked = UserEvent.objects.filter(user=profile, post=p, event_type="like").exists()
            is_saved = UserEvent.objects.filter(user=profile, post=p, event_type="save").exists()
            
            likes_count = UserEvent.objects.filter(post=p, event_type="like").count()
            comments_count = p.comments.count()
            
            author_avatar = None
            if p.author.default_avatar_url:
                author_avatar = p.author.default_avatar_url
            elif p.author.avatar:
                author_avatar = request.build_absolute_uri(p.author.avatar.url)
            else:
                author_avatar = f"https://api.dicebear.com/7.x/avataaars/svg?seed={p.author.user.username}&mouth=smile&eyes=happy"

            # Check if following and blocked
            is_following = Follow.objects.filter(follower=profile, followee=p.author).exists()
            is_blocked = False
            from chat.models import UserRestriction
            from django.db.models import Q
            is_blocked = UserRestriction.objects.filter(
                (Q(user=profile, restricted_user=p.author) | Q(user=p.author, restricted_user=profile)),
                restriction_type='block'
            ).exists()
            
            out.append({
                "id": p.id,
                "author": {
                    "id": p.author.id, 
                    "user": {
                        "id": p.author.user.id, 
                        "username": p.author.user.username,
                        "first_name": p.author.user.first_name or "",
                        "last_name": p.author.user.last_name or ""
                    },
                    "avatar": author_avatar,
                    "bio": p.author.bio or "",
                    "nickname": p.author.nickname or "",
                    "is_following": is_following,
                    "is_blocked": is_blocked
                },
                "content": p.content or p.caption or "",
                "caption": p.caption or p.content or "",
                "image": request.build_absolute_uri(p.image.url) if p.image else None,
                "tags": p.tags or [],
                "is_public": p.is_public,
                "created_at": p.created_at.isoformat(),
                "is_liked": is_liked,
                "is_saved": is_saved,
                "likes_count": likes_count,
                "comments_count": comments_count,
                "comments": []
            })
        
        return response.Response(out)


class DefaultAvatarListView(views.APIView):
    """
    Returns a list of predefined default avatar samples.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, format=None):
        from .utils.avatar_utils import generate_default_avatar_url
        
        avatars = []
        styles = ['avataaars', 'big-smile', 'bottts', 'fun-emoji', 'pixel-art', 'thumbs']
        
        # Generate 20 diverse samples
        for i in range(20):
            style = styles[i % len(styles)]
            seed = f"seed_{i+100}"
            url = f"https://api.dicebear.com/7.x/{style}/svg?seed={seed}&backgroundColor=b6e3f4,c0aede,d1d4f9"
            avatars.append({
                'id': f"avatar_{i}",
                'url': url
            })
            
        return response.Response({'avatars': avatars})

