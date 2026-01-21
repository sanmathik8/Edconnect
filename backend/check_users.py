import os
import django
import sys

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project.settings')
django.setup()

from core.models import UserProfile
from django.contrib.auth.models import User

def check_users():
    print(f"{'Username':<20} | {'Password'}")
    print("-" * 40)
    
    users = User.objects.filter(is_superuser=False).order_by('username')[:10]
    
    for user in users:
        # All seeded users in the management command use 'password123'
        print(f"{user.username:<20} | password123")

if __name__ == "__main__":
    check_users()


