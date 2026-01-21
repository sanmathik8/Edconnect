from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import UserProfile
from .utils.avatar_utils import generate_default_avatar_url
import logging

logger = logging.getLogger(__name__)
User = get_user_model()


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Auto-create UserProfile with default avatar when User is created"""
    if created:
        try:
            # Generate default avatar URL
            default_avatar = generate_default_avatar_url(instance.username)
            
            profile = UserProfile.objects.create(
                user=instance,
                default_avatar_url=default_avatar,
                notification_preferences={},
                interests=[],
                is_flagged=False
            )
            logger.info(f"Created profile for {instance.username} with avatar: {default_avatar[:50]}...")
        except Exception as e:
            logger.error(f"Failed to create profile for {instance.username}: {e}")


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    """Ensure profile exists with avatar when user is saved"""
    if not hasattr(instance, 'userprofile'):
        try:
            # Generate default avatar URL
            default_avatar = generate_default_avatar_url(instance.username)
            
            UserProfile.objects.create(
                user=instance,
                default_avatar_url=default_avatar,
                notification_preferences={},
                interests=[],
                is_flagged=False
            )
            logger.warning(f"Created missing profile for {instance.username} with avatar")
        except Exception as e:
            logger.error(f"Error creating profile for {instance.username}: {e}")
    else:
        # Ensure existing profiles have an avatar
        profile = instance.userprofile
        if not profile.avatar and not profile.default_avatar_url:
            try:
                profile.default_avatar_url = generate_default_avatar_url(instance.username)
                profile.save(update_fields=['default_avatar_url'])
                logger.info(f"Assigned default avatar to existing user {instance.username}")
            except Exception as e:
                logger.error(f"Error assigning avatar to {instance.username}: {e}")