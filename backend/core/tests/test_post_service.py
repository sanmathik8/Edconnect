from django.test import TestCase
from django.contrib.auth import get_user_model
from core.models import UserProfile, Post, UserEvent
from core.services.post_service import PostService

User = get_user_model()

class PostServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='password123')
        # Profile is created by signal
        self.profile = self.user.userprofile

    def test_create_post_with_tags(self):
        data = {
            'content': 'Hello world #django #testing',
            'is_public': True
        }
        
        post = PostService.create_post(self.profile, data)
        
        self.assertEqual(post.content, 'Hello world #django #testing')
        self.assertEqual(post.author, self.profile)
        self.assertIn('django', post.tags)
        self.assertIn('testing', post.tags)
        self.assertEqual(len(post.tags), 2)

    def test_toggle_like(self):
        post = PostService.create_post(self.profile, {'content': 'Like me'})
        
        # Like
        result = PostService.toggle_like(self.profile, post.id)
        self.assertTrue(result['liked'])
        self.assertEqual(result['likes_count'], 1)
        self.assertTrue(UserEvent.objects.filter(user=self.profile, post=post, event_type='like').exists())

        # Unlike
        result = PostService.toggle_like(self.profile, post.id)
        self.assertFalse(result['liked'])
        self.assertEqual(result['likes_count'], 0)
        self.assertFalse(UserEvent.objects.filter(user=self.profile, post=post, event_type='like').exists())
