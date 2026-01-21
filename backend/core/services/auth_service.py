import logging
from django.contrib.auth.models import User
from django.db import transaction
from django.contrib.auth.hashers import make_password, check_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.contrib.auth import login as auth_login
from ..models import UserProfile

logger = logging.getLogger(__name__)

class AuthService:
    @staticmethod
    def register_user(request, data):
        """
        Register a new user with transactional integrity.
        Includes mandatory security clue for recovery.
        """
        username = data.get('username')
        password = data.get('password') or data.get('password1')
        clue = data.get('clue')
        email = data.get('email', '')
        
        # 1. Input Validation
        if not username or not password or not clue:
            errors = {}
            if not username:
                errors['username'] = ['Username is required']
            if not password:
                errors['password'] = ['Password is required']
                errors['password1'] = ['Password is required']
            if not clue:
                errors['clue'] = ['Security clue is required for password recovery']
            raise ValidationError(errors)
        
        if User.objects.filter(username=username).exists():
            raise ValidationError({
                'username': ['This username is already taken. Please choose another.']
            })
            
        if email and User.objects.filter(email=email).exists():
            raise ValidationError({
                'email': ['This email is already registered. Please use another or login.']
            })

        # Validate password using Django's validators with better error messages
        try:
            validate_password(password, user=None)
        except ValidationError as e:
            # Format error messages to be more user-friendly
            error_messages = []
            for msg in e.messages:
                # Make the error messages more specific and helpful
                if 'too short' in msg.lower():
                    error_messages.append('Password must be at least 8 characters long')
                elif 'too common' in msg.lower():
                    error_messages.append('Password is too common. Please choose a more unique password')
                elif 'entirely numeric' in msg.lower():
                    error_messages.append('Password cannot be entirely numeric. Include letters and symbols')
                elif 'similar' in msg.lower():
                    error_messages.append('Password is too similar to your username. Please choose a different password')
                else:
                    error_messages.append(msg)
            
            # Log the validation failure for debugging
            logger.warning(f"Password validation failed for user {username}: {', '.join(error_messages)}")
            
            # Raise with formatted messages
            raise ValidationError({
                'password1': error_messages,
                'password': error_messages
            })

        try:
            with transaction.atomic():
                # 2. Create User
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password
                )
                
                # 3. Create Profile and set Hashed Clue
                # We hash the clue just like a password for maximum security
                profile, created = UserProfile.objects.get_or_create(
                    user=user,
                    defaults={'security_clue': make_password(clue.lower().strip())}
                )
                if not created:
                    profile.security_clue = make_password(clue.lower().strip())
                    profile.save()
                
                logger.info(f"User {username} registered successfully with security clue")
                
                # 4. Log in the user immediately
                if request:
                    auth_login(request, user)
                
                return user
                
        except Exception as e:
            logger.error(f"Registration failed for {username}: {str(e)}")
            raise e

    @staticmethod
    def reset_password_with_clue(username, clue, new_password):
        """
        Securely reset password after verifying security clue.
        """
        if not username or not clue or not new_password:
            raise ValidationError("All fields are required")

        try:
            user = User.objects.get(username=username)
            profile = user.userprofile
            
            if not profile.security_clue:
                logger.warning(f"Password reset attempt for {username} failed: No clue set")
                raise ValidationError("Password recovery is not enabled for this account")

            # Verify the clue (case-insensitive and stripped)
            if not check_password(clue.lower().strip(), profile.security_clue):
                logger.warning(f"Invalid security clue attempt for user {username}")
                # Generic error to prevent enumeration/leaks
                raise ValidationError("Invalid details provided")

            # Validate new password strength
            validate_password(new_password, user=user)

            # Update password
            with transaction.atomic():
                user.set_password(new_password)
                user.save()
                logger.info(f"Password successfully reset for user {username}")
                return True

        except User.DoesNotExist:
            logger.warning(f"Reset attempt for non-existent user: {username}")
            raise ValidationError("Invalid details provided")
        except Exception as e:
            if isinstance(e, ValidationError):
                raise e
            logger.error(f"Error during password reset for {username}: {e}")
            raise ValidationError("An error occurred during password reset")
