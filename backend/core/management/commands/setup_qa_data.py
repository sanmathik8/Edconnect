from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from core.models import UserProfile
from chat.models import ChatThread, ChatMessage, BlockedUser
from django.utils import timezone

User = get_user_model()

class Command(BaseCommand):
    help = 'Setup QA Test Data (Users, Blocks, Chats)'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING('⚠️  Resetting QA Data...'))

        # 1. Ensure Users user_1 to user_10 exist
        users = {}
        for i in range(1, 11):
            username = f'user_{i}'
            email = f'user_{i}@example.com'
            password = 'password123'
            
            user, created = User.objects.get_or_create(username=username, defaults={'email': email})
            user.set_password(password)
            user.save()
            
            # Ensure Profile exists
            profile, _ = UserProfile.objects.get_or_create(user=user)
            
            users[i] = profile
            action = "Created" if created else "Updated"
            self.stdout.write(f"   👤 {action} {username} (Pass: {password})")

        # 2. Clear Existing QA Blocks/Chats for cleanup (Optional - preventing duplicates)
        # self.stdout.write("   🧹 Clearing old blocks/threads for QA users...")
        # (Skipping destructive wipe to avoid deleting manual work, will just ensure states)

        # 3. SETUP SCENARIOS
        
        # SCENARIO A: user_1 blocks user_2 (1:1 Block)
        # ---------------------------------------------
        blocker = users[1]
        blocked = users[2]
        
        # Create Block in Chat System (BlockedUser model)
        b1, _ = BlockedUser.objects.get_or_create(blocker=blocker, blocked=blocked)
        
        # Also update UserProfile.blocked_users (M2M) to be safe/sync
        blocker.blocked_users.add(blocked)
        
        self.stdout.write(self.style.SUCCESS(f"   🚫 SCENARIO A: {blocker.user.username} blocked {blocked.user.username}"))

        # Create 1:1 Thread (frozen)
        # Find existing thread between these two
        thread_a = ChatThread.objects.filter(
            is_group=False, 
            participants=blocker
        ).filter(
            participants=blocked
        ).first()

        if not thread_a:
            thread_a = ChatThread.objects.create(is_group=False, initiator=blocker, status='active')
            thread_a.participants.set([blocker, blocked])
            self.stdout.write(f"      ↳ 1:1 Chat Thread created (ID: {thread_a.id})")
        else:
            self.stdout.write(f"      ↳ 1:1 Chat Thread found (ID: {thread_a.id})")


        # SCENARIO B: Mutual Block (user_3 <-> user_4)
        # --------------------------------------------
        u3 = users[3]
        u4 = users[4]
        
        # 3 blocks 4
        BlockedUser.objects.get_or_create(blocker=u3, blocked=u4)
        u3.blocked_users.add(u4)
        
        # 4 blocks 3
        BlockedUser.objects.get_or_create(blocker=u4, blocked=u3)
        u4.blocked_users.add(u3)
        
        self.stdout.write(self.style.SUCCESS(f"   🚫 SCENARIO B: Mutual Block between {u3.user.username} and {u4.user.username}"))
        
        # Create 1:1 Thread
        thread_b = ChatThread.objects.filter(
            is_group=False, 
            participants=u3
        ).filter(
            participants=u4
        ).first()

        if not thread_b:
            thread_b = ChatThread.objects.create(is_group=False, initiator=u3)
            thread_b.participants.set([u3, u4])

        
        # SCENARIO C: Group Chat with Blocked User
        # ----------------------------------------
        # Admin: user_1 (Who blocks user_2)
        # Member: user_2 (Blocked by Admin)
        # Member: user_5 (Neutral)
        
        admin = users[1]
        member_blocked = users[2]
        member_neutral = users[5]
        
        # Try to find existing group
        group = ChatThread.objects.filter(
            is_group=True, 
            group_name="QA Blocking Test Group", 
            admin=admin
        ).first()

        created_group = False
        if not group:
            group = ChatThread.objects.create(
                is_group=True, 
                group_name="QA Blocking Test Group",
                admin=admin
            )
            created_group = True
        
        group.admins.add(admin)
        group.participants.set([admin, member_blocked, member_neutral])
        group.save()
        
        if created_group:
             # Add start message
             ChatMessage.objects.create(thread=group, sender=admin, content="Welcome to the QA Block Test Group")

        self.stdout.write(self.style.SUCCESS(f"   👨‍👩‍👧‍👦 SCENARIO C: Group '{group.group_name}' (ID: {group.id})"))
        self.stdout.write(f"      ↳ Admin: {admin.user.username}")
        self.stdout.write(f"      ↳ Blocked Member: {member_blocked.user.username} (Blocked by Admin)")
        self.stdout.write(f"      ↳ Neutral Member: {member_neutral.user.username}")


        # SCENARIO D: Feed & Visibility (Content Impact)
        # ----------------------------------------------
        from core.models import Post, Follow, Comment, UserEvent
        
        # 1. User 1 (Blocker) creates posts
        p1 = self.create_post(admin, "User 1 Public Post - Should be HIDDEN for user_2")
        p2 = self.create_post(admin, "User 1 #HiddenGem - Should not appear in user_2 Explore", tags=['HiddenGem'])
        
        # 2. User 2 (Blocked) creates posts
        p3 = self.create_post(member_blocked, "User 2 Public Post - Should be HIDDEN for user_1")
        
        # 3. User 5 (Neutral) creates posts
        p4 = self.create_post(member_neutral, "User 5 Neutral Post - Visible to ALL")
        
        self.stdout.write(self.style.SUCCESS(f"   📰 SCENARIO D: Content & Feed"))
        self.stdout.write(f"      ↳ Created Posts for user_1, user_2, user_5")

        # SCENARIO E: Social Graph (Follows & Graph)
        # ------------------------------------------
        # user_5 follows BOTH user_1 and user_2
        Follow.objects.get_or_create(follower=member_neutral, followee=admin)
        Follow.objects.get_or_create(follower=member_neutral, followee=member_blocked)
        
        # user_6 follows user_1 (To populate follower lists)
        u6 = users[6]
        Follow.objects.get_or_create(follower=u6, followee=admin)
        
        self.stdout.write(self.style.SUCCESS(f"   🕸️  SCENARIO E: Social Graph"))
        self.stdout.write(f"      ↳ {member_neutral.user.username} follows BOTH {admin.user.username} and {member_blocked.user.username}")

        # SCENARIO F: Engagement & Explore Logic
        # --------------------------------------
        # user_5 Likes user_1's post (Testing if user_2 sees this activity)
        UserEvent.objects.get_or_create(user=member_neutral, post=p1, event_type='like')
        
        # user_5 Comments on user_1's post
        Comment.objects.create(post=p1, author=member_neutral, content="Great post! (Neutral comment)")
        
        # user_1 Comments on user_5's post (Should user_2 see user_1's comment on a neutral post?)
        Comment.objects.create(post=p4, author=admin, content="I am the blocker commenting here.")
        
        self.stdout.write(self.style.SUCCESS(f"   🧭 SCENARIO F: Engagement & Explore"))
        self.stdout.write(f"      ↳ {member_neutral.user.username} LIKED & COMMENTED on user_1's post")
        self.stdout.write(f"      ↳ {admin.user.username} COMMENTED on {member_neutral.user.username}'s post (Check if user_2 sees this comment)")


        self.stdout.write(self.style.SUCCESS('\n✅ QA Data Setup Complete!'))
        self.stdout.write("---------------------------------------------------------")
        self.stdout.write("LOGIN CREDENTIALS:")
        self.stdout.write("Username: user_1 ... user_10")
        self.stdout.write("Password: password123")
        self.stdout.write("---------------------------------------------------------")
        self.stdout.write("VERIFICATION CHECKLIST:")
        self.stdout.write("1. [Feed]  Log in as user_2. Search for 'User 1'. Should verify NO RESULTS.")
        self.stdout.write("2. [Feed]  Log in as user_2. Check Feed. Should NOT see 'User 1 Public Post'.")
        self.stdout.write("3. [Group] Log in as user_2. Open Group. Should NOT see user_1's messages (Bug?), but SHOULD see user_5.")
        self.stdout.write("4. [Post]  Log in as user_2. View user_5's neutral post. Should NOT see user_1's blocked comment.")
        self.stdout.write("---------------------------------------------------------")

    def create_post(self, author, content, tags=None):
        from core.models import Post
        p, created = Post.objects.get_or_create(
            author=author, 
            content=content,
            defaults={'is_public': True, 'tags': tags or []}
        )
        return p
