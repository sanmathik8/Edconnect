from django.test import TestCase
from django.contrib.auth import get_user_model
from core.services.auth_service import AuthService
from django.core.exceptions import ValidationError

User = get_user_model()

class AuthServiceTests(TestCase):
    def test_register_user_success(self):
        data = {
            'username': 'newuser',
            'password': 'StrongPassword123!',
            'email': 'new@example.com'
        }
        user = AuthService.register_user(None, data) # request can be None for testing logic
        
        self.assertEqual(user.username, 'newuser')
        self.assertTrue(user.check_password('StrongPassword123!'))
        self.assertEqual(user.email, 'new@example.com')
        # Check profile creation
        self.assertTrue(hasattr(user, 'userprofile'))

    def test_register_duplicate_username(self):
        User.objects.create_user(username='existing', password='password')
        
        data = {
            'username': 'existing',
            'password': 'StrongPassword123!'
        }
        
        with self.assertRaises(ValidationError) as cm:
            AuthService.register_user(None, data)
        self.assertIn('Username already taken', str(cm.exception))
        
    def test_register_invalid_password(self):
        data = {
            'username': 'badpass',
            'password': '123' # Too short
        }
        
        with self.assertRaises(ValidationError):
            AuthService.register_user(None, data)
            
        # Ensure user was NOT created
        self.assertFalse(User.objects.filter(username='badpass').exists())
