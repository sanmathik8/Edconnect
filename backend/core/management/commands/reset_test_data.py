"""
Management command to reset test data:
- Keep only 'rama' user
- Create 100 new test users
- Create 500 posts distributed among them
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from core.models import UserProfile, Post, UserEvent, Follow, Notification, Comment
from chat.models import ChatThread, ChatMessage, UserRestriction
import random

User = get_user_model()

class Command(BaseCommand):
    help = 'Reset database: keep rama, delete others, create 100 users with 500 posts'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Starting database reset...'))
        
        with transaction.atomic():
            # 1. Find rama user
            try:
                rama_user = User.objects.get(username='rama')
                rama_profile = rama_user.userprofile
                self.stdout.write(self.style.SUCCESS(f'Found rama (ID: {rama_user.id})'))
            except User.DoesNotExist:
                self.stdout.write(self.style.ERROR('rama user not found! Aborting.'))
                return
            
            # 2. Delete all other users (cascade will handle related objects)
            deleted_count = User.objects.exclude(username='rama').delete()
            self.stdout.write(self.style.SUCCESS(f'Deleted {deleted_count[0]} users and related data'))
            
            # 3. Create 100 new users
            self.stdout.write(self.style.WARNING('Creating 100 new users...'))
            new_users = []
            for i in range(1, 101):
                username = f'user{i:03d}'
                user = User.objects.create_user(
                    username=username,
                    email=f'{username}@test.com',
                    password='testpass123'
                )
                profile = UserProfile.objects.create(
                    user=user,
                    bio=f'Test user {i}',
                    nickname=f'User {i}'
                )
                new_users.append(profile)
                
                if i % 10 == 0:
                    self.stdout.write(f'Created {i} users...')
            
            self.stdout.write(self.style.SUCCESS(f'Created {len(new_users)} users'))
            
            # 4. Create 500 posts distributed among users
            self.stdout.write(self.style.WARNING('Creating 500 posts...'))
            all_profiles = [rama_profile] + new_users
            
            post_templates = [
                "Just had an amazing day! #happy #life",
                "Working on something exciting! #coding #tech",
                "Beautiful sunset today 🌅 #nature #photography",
                "Coffee and code ☕ #developer #morning",
                "Learning something new every day #growth #education",
                "Weekend vibes! #weekend #relax",
                "Feeling grateful today #blessed #thankful",
                "New project launching soon! #startup #entrepreneur",
                "Great workout session 💪 #fitness #health",
                "Book recommendations anyone? #reading #books"
            ]
            
            for i in range(500):
                author = random.choice(all_profiles)
                template = random.choice(post_templates)
                
                # Extract tags from template
                tags = [word.replace('#', '') for word in template.split() if word.startswith('#')]
                
                Post.objects.create(
                    author=author,
                    content=f"{template} - Post #{i+1}",
                    caption=template,
                    tags=tags,
                    is_public=True
                )
                
                if (i + 1) % 50 == 0:
                    self.stdout.write(f'Created {i+1} posts...')
            
            self.stdout.write(self.style.SUCCESS('Created 500 posts'))
            
            # 5. Create some follow relationships (make it realistic)
            self.stdout.write(self.style.WARNING('Creating follow relationships...'))
            follow_count = 0
            for profile in new_users[:50]:  # First 50 users follow rama
                Follow.objects.get_or_create(follower=profile, followee=rama_profile)
                follow_count += 1
            
            # rama follows some users back
            for profile in random.sample(new_users, 30):
                Follow.objects.get_or_create(follower=rama_profile, followee=profile)
                follow_count += 1
            
            # Users follow each other randomly
            for _ in range(200):
                follower = random.choice(new_users)
                followee = random.choice(new_users)
                if follower != followee:
                    Follow.objects.get_or_create(follower=follower, followee=followee)
                    follow_count += 1
            
            self.stdout.write(self.style.SUCCESS(f'Created {follow_count} follow relationships'))
            
            self.stdout.write(self.style.SUCCESS('✅ Database reset complete!'))
            self.stdout.write(self.style.SUCCESS(f'   - Kept: rama'))
            self.stdout.write(self.style.SUCCESS(f'   - Created: 100 new users (user001-user100)'))
            self.stdout.write(self.style.SUCCESS(f'   - Created: 500 posts'))
            self.stdout.write(self.style.SUCCESS(f'   - Created: {follow_count} follow relationships'))
