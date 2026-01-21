import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project.settings')
django.setup()

from django.contrib.auth.models import User
from core.models import UserProfile
from chat.models import BlockedUser, ChatThread

def block_user(blocker_name, blocked_name):
    try:
        blocker_user = User.objects.get(username=blocker_name)
        blocked_user = User.objects.get(username=blocked_name)
        
        blocker_profile = UserProfile.objects.get(user=blocker_user)
        blocked_profile = UserProfile.objects.get(user=blocked_user)
        
        # 1. Create BlockedUser record
        obj, created = BlockedUser.objects.get_or_create(
            blocker=blocker_profile, 
            blocked=blocked_profile
        )
        if created:
            print(f"Successfully created block: {blocker_name} -> {blocked_name}")
        else:
            print(f"Block already exists: {blocker_name} -> {blocked_name}")
            
        # 2. Update status of any 1:1 threads between them
        threads = ChatThread.objects.filter(is_group=False, participants=blocker_profile).filter(participants=blocked_profile)
        for thread in threads:
            thread.status = 'blocked'
            thread.save()
            print(f"Updated thread {thread.id} status to 'blocked'")
            
    except User.DoesNotExist:
        print(f"Error: One of the users ({blocker_name} or {blocked_name}) does not exist.")
    except UserProfile.DoesNotExist:
        print(f"Error: Profile not found for {blocker_name} or {blocked_name}.")

if __name__ == "__main__":
    block_user('user_5', 'user_1')
    block_user('user_8', 'user_1')
