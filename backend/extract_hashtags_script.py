import os
import django
import re

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project.settings')
django.setup()

from core.models import Post

# Process all posts
posts = Post.objects.all()
updated_count = 0

print(f'Processing {posts.count()} posts...\n')

for post in posts:
    # Get text content
    text = post.caption or post.content or ''
    
    if text:
        # Extract hashtags using regex
        hashtags = re.findall(r"#(\w+)", text)
        
        if hashtags:
            # Clean and deduplicate tags - match backend normalization
            tags = [
                tag.lstrip('#').lower().strip().replace(' ', '').replace('\t', '').replace('\n', '')
                for tag in hashtags 
                if tag and tag.strip()
            ]
            # Remove duplicates while preserving order, limit to 15 tags
            tags = list(dict.fromkeys(tags))[:15]
            # Filter out any empty strings
            tags = [t for t in tags if t]
            
            # Update post
            post.tags = tags
            post.save()
            updated_count += 1
            
            print(f'✓ Post {post.id}: {len(tags)} tags extracted - {tags}')

print(f'\n✅ Successfully updated {updated_count} posts with hashtags!')
