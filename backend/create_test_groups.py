import os
import django
import random

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project.settings')
django.setup()

from chat.models import ChatThread, UserProfile

def create_test_groups():
    users = list(UserProfile.objects.all()[:10])
    if len(users) < 3:
        print("Not enough users to create groups")
        return

    for i in range(1, 6):
        group_name = f"Test Group {i}"
        # Pick 3 to 5 random members
        member_count = random.randint(3, 5)
        members = random.sample(users, member_count)
        
        thread = ChatThread.objects.create(
            group_name=group_name,
            is_group=True,
            initiator=members[0],
            admin=members[0],
            status='active'
        )
        thread.participants.add(*members)
        thread.admins.add(members[0])
        
        print(f"Created group: {group_name} with {len(members)} members. Owner: {members[0].user.username}")

if __name__ == "__main__":
    create_test_groups()
