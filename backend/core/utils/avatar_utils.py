# core/utils/avatar_utils.py
"""
Avatar utility functions for consistent avatar handling across the application
"""
import hashlib


def generate_default_avatar_url(username, seed=None):
    """
    Generate a consistent default avatar URL using dicebear API
    
    Args:
        username: User's username
        seed: Optional seed for consistent avatar generation (defaults to username)
    
    Returns:
        str: Full URL to dicebear avatar
    """
    if not seed:
        seed = username
    
    # Use a variety of dicebear styles and options for diverse avatars
    styles = [
        'avataaars',
        'big-smile',
        'bottts',
        'fun-emoji',
        'pixel-art',
        'thumbs'
    ]
    
    # Hash username to consistently select a style
    username_hash = int(hashlib.md5(username.encode()).hexdigest(), 16)
    style = styles[username_hash % len(styles)]
    
    # Additional styling options for avataaars style
    if style == 'avataaars':
        return f"https://api.dicebear.com/7.x/{style}/svg?seed={seed}&mouth=smile&eyes=happy&backgroundColor=b6e3f4,c0aede,d1d4f9"
    
    # For other styles, use basic config
    return f"https://api.dicebear.com/7.x/{style}/svg?seed={seed}&backgroundColor=b6e3f4,c0aede,d1d4f9"


def get_avatar_url_from_profile(profile, request=None):
    """
    Get the avatar URL for a UserProfile with proper fallback hierarchy
    
    Priority:
    1. Custom uploaded avatar (if exists)
    2. default_avatar_url (if set)
    3. Generated dicebear avatar
    
    Args:
        profile: UserProfile instance
        request: Optional Django request object for building absolute URIs
    
    Returns:
        str: Avatar URL
    """
    # Priority 1: Custom uploaded avatar
    if profile.avatar:
        try:
            if request:
                return request.build_absolute_uri(profile.avatar.url)
            return profile.avatar.url
        except (ValueError, AttributeError):
            # File might be missing, continue to fallback
            pass
    
    # Priority 2: User-selected default avatar URL
    if profile.default_avatar_url:
        return profile.default_avatar_url
    
    # Priority 3: Generate default avatar
    return generate_default_avatar_url(profile.user.username)


def ensure_avatar_for_profile(profile, save=True):
    """
    Ensure a profile has an avatar URL set
    If no avatar exists, generates and sets a default one
    
    Args:
        profile: UserProfile instance
        save: Whether to save the profile after setting avatar
    
    Returns:
        str: The avatar URL that was set
    """
    # If profile already has an avatar, return it
    if profile.avatar or profile.default_avatar_url:
        return get_avatar_url_from_profile(profile)
    
    # Generate and set default avatar
    default_url = generate_default_avatar_url(profile.user.username)
    profile.default_avatar_url = default_url
    
    if save:
        profile.save(update_fields=['default_avatar_url'])
    
    return default_url
