# core/recommendations.py
import logging
from django.db.models import Count, Q, Prefetch
from django.utils import timezone
from datetime import timedelta
from collections import Counter
from .models import UserProfile, Post, UserEvent, Follow

logger = logging.getLogger(__name__)

def get_hashtag_recommendations(profile, k=12):
    """
    Get hashtag-based recommendations.
    1. Build user profile from hashtags in their posts.
    2. Rank other users by hashtag similarity.
    3. Weight by recency and activity.
    """
    # 1. Get my hashtag profile (all time but weighted? No, keep it simple first)
    my_posts = Post.objects.filter(author=profile).prefetch_related('author__user')
    my_tags_counter = Counter()
    for post in my_posts:
        if post.tags:
            my_tags_counter.update([t.lower() for t in post.tags])
    
    if not my_tags_counter:
        return []

    my_tags_set = set(my_tags_counter.keys())
    
    # 2. Find candidate users (shared tags)
    # Exclude self and already followed
    following_ids = Follow.objects.filter(follower=profile).values_list('followee_id', flat=True)
    
    # Get all users who have at least one shared hashtag
    candidates = UserProfile.objects.exclude(id=profile.id).exclude(id__in=following_ids)
    
    active_cutoff = timezone.now() - timedelta(days=30)
    
    recommendations = []
    
    for candidate in candidates:
        candidate_posts = Post.objects.filter(author=candidate, is_public=True).order_by('-created_at')[:50]
        if not candidate_posts:
            continue
            
        candidate_tags_counter = Counter()
        for post in candidate_posts:
            if post.tags:
                candidate_tags_counter.update([t.lower() for t in post.tags])
        
        if not candidate_tags_counter:
            continue
            
        candidate_tags_set = set(candidate_tags_counter.keys())
        shared_tags = my_tags_set & candidate_tags_set
        
        if not shared_tags:
            continue
            
        # Calculate Similarity Score (Jaccard-like or overlap)
        # Score = (Count of shared tags) / (Total unique tags between both)
        score = len(shared_tags) / len(my_tags_set | candidate_tags_set)
        
        # Weighting:
        # Extra weight for shared tags that are frequent for BOTH
        for tag in shared_tags:
            # Boost score based on how much they both like this tag
            weight = (my_tags_counter[tag] * candidate_tags_counter[tag]) ** 0.5
            score += (weight * 0.05) # Small boost per strong shared interest
            
        # Recency Boost
        latest_post = candidate_posts[0].created_at
        days_since_post = (timezone.now() - latest_post).days
        if days_since_post <= 7:
            score *= 1.2 # 20% boost for active this week
        elif days_since_post <= 30:
            score *= 1.1 # 10% boost for active this month
            
        # Normalize/Cap
        score = min(score, 1.0)
        
        # Reason building
        top_shared = sorted(list(shared_tags), key=lambda t: my_tags_counter[t] + candidate_tags_counter[t], reverse=True)[:3]
        reason = f"Combined interests: #{', #'.join(top_shared)}"
        
        recommendations.append({
            'profile': candidate,
            'score': score,
            'matchPercentage': int(score * 100),
            'reason': reason,
            'matched_tags': list(shared_tags)[:5],
            'is_active': days_since_post <= 14,
            'activity_badge': "🔥 Active" if days_since_post <= 7 else "📝 Recent" if days_since_post <= 30 else "💤 Inactive",
            'recent_posts': [] # Can be populated in view if needed
        })

    # Sort and return top K
    recommendations.sort(key=lambda x: x['score'], reverse=True)
    return recommendations[:k]

def get_trending_hashtags(limit=10, days=7):
    """Simple trending tags based on count"""
    cutoff = timezone.now() - timedelta(days=days)
    posts = Post.objects.filter(created_at__gte=cutoff, is_public=True)
    
    counter = Counter()
    for post in posts:
        if post.tags:
            counter.update([t.lower() for t in post.tags])
            
    return counter.most_common(limit)
