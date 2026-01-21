import random
import uuid
import time
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from core.models import UserProfile, Post, Follow, Comment, UserEvent, Notification, SharedPost
from chat.models import ChatThread, ChatMessage, UserRestriction, BlockedUser
from django.utils import timezone

class Command(BaseCommand):
    help = 'Delete all users and create 10 users one by one with comprehensive relationships'

    def handle(self, *args, **options):
        self.stdout.write('Clearing existing data...')
        
        # Clear ManyToMany relations first
        for t in ChatThread.objects.all():
            t.participants.clear()
            t.admins.clear()
            t.muted_by.clear()
            t.pinned_by.clear()
            t.hidden_by.clear()
            t.deleted_by.clear()
        
        for m in ChatMessage.objects.all():
            m.deleted_by.clear()
        
        for p in UserProfile.objects.all():
            p.blocked_users.clear()

        # Delete in order to respect FK constraints
        Notification.objects.all().delete()
        Follow.objects.all().delete()
        Comment.objects.all().delete()
        UserEvent.objects.all().delete()
        UserRestriction.objects.all().delete()
        BlockedUser.objects.all().delete()
        SharedPost.objects.all().delete()
        ChatMessage.objects.all().delete()
        ChatThread.objects.all().delete()
        Post.objects.all().delete()
        
        # Delete non-superuser users
        deleted_users = User.objects.filter(is_superuser=False).delete()
        self.stdout.write(f'Deleted {deleted_users[0]} users.')

        self.stdout.write('Creating 10 users one by one...')
        profiles = []
        for i in range(10):
            username = f'user_{i+1}'
            password = 'password123'
            
            user = User.objects.create_user(
                username=username,
                password=password,
                email=f'{username}@example.com'
            )
            
            profile = UserProfile.objects.get(user=user)
            profile.bio = f'Bio for {username}.'
            profile.nickname = f'Nick {i+1}'
            profile.save()
            profiles.append(profile)
            
            # Create 10 posts for each user
            for j in range(10):
                Post.objects.create(
                    author=profile,
                    content=f'Post {j+1} from {username}. Topics: #recom #testing_{j}',
                    caption=f'Check out my post {j+1}!',
                    tags=['recom', f'testing_{j}'],
                    is_public=True
                )
            
            self.stdout.write(f'User {username} created with 10 posts.')
            time.sleep(0.3)

        self.stdout.write('Creating relationships (Follows, Likes, Comments)...')
        for i, profile in enumerate(profiles):
            # Follow some other users
            others = [p for p in profiles if p != profile]
            follow_targets = random.sample(others, 3)
            for target in follow_targets:
                Follow.objects.create(follower=profile, followee=target)
                Notification.objects.create(
                    user=target,
                    actor=profile,
                    notification_type='follow',
                    message=f'{profile.user.username} started following you.'
                )

            # Like and comment on random posts
            all_posts = list(Post.objects.all())
            like_targets = random.sample(all_posts, 5)
            for post in like_targets:
                UserEvent.objects.create(user=profile, post=post, event_type='like')
                if post.author != profile:
                    Notification.objects.create(
                        user=post.author,
                        actor=profile,
                        notification_type='like',
                        post=post,
                        message=f'{profile.user.username} liked your post.'
                    )
                
                # Add a comment
                comment = Comment.objects.create(
                    post=post,
                    author=profile,
                    content=f'Great post! from {profile.user.username}'
                )
                if post.author != profile:
                    Notification.objects.create(
                        user=post.author,
                        actor=profile,
                        notification_type='comment',
                        post=post,
                        message=f'{profile.user.username} commented on your post.'
                    )

        self.stdout.write('Creating Chats and Messages...')
        # Create 5 1:1 chats
        for _ in range(5):
            u1, u2 = random.sample(profiles, 2)
            thread = ChatThread.objects.create(status='active', is_group=False)
            thread.participants.add(u1, u2)
            
            # Send few messages
            for k in range(3):
                sender = u1 if k % 2 == 0 else u2
                ChatMessage.objects.create(
                    thread=thread,
                    sender=sender,
                    content=f'Hello from {sender.user.username}! Message {k+1}'
                )

        self.stdout.write('Testing Blocking System...')
        # User 1 blocks User 10
        u1 = profiles[0]
        u10 = profiles[9]
        
        # Action like the actual BlockView
        u1.blocked_users.add(u10)
        UserRestriction.objects.create(user=u1, restricted_user=u10, restriction_type='block')
        BlockedUser.objects.create(blocker=u1, blocked=u10)
        
        # Remove follows
        Follow.objects.filter(follower=u1, followee=u10).delete()
        Follow.objects.filter(follower=u10, followee=u1).delete()

        self.stdout.write('Successfully created 10 users with posts, follows, chats, and blocks.')
        self.stdout.write('Seeding complete.')
