"""
Management command to extract and update hashtags for all existing posts
"""
from django.core.management.base import BaseCommand
from core.models import Post
import re


class Command(BaseCommand):
    help = 'Extract hashtags from post content/caption and update tags field'

    def handle(self, *args, **options):
        posts = Post.objects.all()
        updated_count = 0
        
        self.stdout.write(f'Processing {posts.count()} posts...')
        
        for post in posts:
            # Get text content
            text = post.caption or post.content or ''
            
            if text:
                # Extract hashtags using regex
                hashtags = re.findall(r"#(\w+)", text)
                
                if hashtags:
                    # Clean and deduplicate tags
                    tags = [tag.lstrip('#').lower().strip() for tag in hashtags if tag and tag.strip()]
                    tags = list(set(tags))[:15]  # Limit to 15 unique tags
                    
                    # Update post
                    post.tags = tags
                    post.save()
                    updated_count += 1
                    
                    self.stdout.write(
                        self.style.SUCCESS(f'✓ Post {post.id}: {len(tags)} tags extracted - {tags}')
                    )
        
        self.stdout.write(
            self.style.SUCCESS(f'\n✅ Successfully updated {updated_count} posts with hashtags!')
        )
