import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project.settings')
django.setup()

from django.contrib.auth.models import User
from core.models import UserProfile

print("User ID | Username | Profile ID")
print("-" * 30)
for user in User.objects.all().order_by('id'):
    try:
        profile = user.userprofile
        print(f"{user.id:<7} | {user.username:<8} | {profile.id}")
    except UserProfile.DoesNotExist:
        print(f"{user.id:<7} | {user.username:<8} | NO PROFILE")
