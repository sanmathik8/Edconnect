from django.urls import path
from . import views
from . import collection_views

app_name = 'core'

urlpatterns = [
    # Authentication
    path('api/login/', views.login_view, name='login'),
    path('api/logout/', views.logout_view, name='logout'),
    path('api/register/', views.register, name='register'),
    path('api/csrf/', views.get_csrf_token, name='csrf'),
    
    # Collections
    path('api/collections/', collection_views.CollectionListCreate.as_view(), name='collection-list'),
    path('api/collections/<int:pk>/', collection_views.CollectionDetail.as_view(), name='collection-detail'),
    path('api/collections/<int:pk>/add/', collection_views.CollectionAddItem.as_view(), name='collection-add'),
    path('api/collections/<int:pk>/remove/', collection_views.CollectionRemoveItem.as_view(), name='collection-remove'),
    path('api/collections/<int:pk>/items/', collection_views.CollectionItemsList.as_view(), name='collection-items'),

    path('api/profiles/', views.ProfileList.as_view(), name='profile-list'),
    path('api/profiles/<int:pk>/', views.ProfileDetail.as_view(), name='profile-detail'),
    path('api/profiles/me/', views.MeProfileView.as_view(), name='profile-me'),
    path('api/profiles/username/<str:username>/', views.ProfileByUsername.as_view(), name='profile-by-username'),
    path('api/profiles/default-avatars/', views.DefaultAvatarListView.as_view(), name='default-avatars'),
    
    # Posts
    path('api/posts/', views.PostList.as_view(), name='post-list'),
    path('api/posts/<int:pk>/', views.PostDetail.as_view(), name='post-detail'),
    path('api/posts/<int:pk>/like/', views.PostLikeView.as_view(), name='post-like'),
    path('api/posts/<int:pk>/delete/', views.PostDeleteView.as_view(), name='post-delete'),
    path('api/posts/<int:pk>/save/', views.PostSaveView.as_view(), name='post-save'),
    path('api/posts/saved/', views.SavedPostsView.as_view(), name='posts-saved'),
    path('api/posts/explore/', views.PostExploreView.as_view(), name='post-explore'),
    path('api/posts/feed/', views.PostsFeedView.as_view(), name='posts-feed'),
    path('api/posts/following/', views.FollowingPostsView.as_view(), name='posts-following'),
    path('api/posts/user/', views.PostsFromUserView.as_view(), name='posts-from-user'),
    path('api/posts/<int:pk>/update/', views.PostUpdateView.as_view(), name='post-update'),
    
    # Comments
    path('api/posts/<int:pk>/comments/', views.PostCommentsView.as_view(), name='post-comments'),
    path('api/comments/create/', views.CommentCreate.as_view(), name='comment-create'),
    path('api/posts/<int:post_id>/comments/<int:pk>/', views.CommentDetail.as_view(), name='comment-detail-nested'),
    path('api/comments/<int:pk>/delete/', views.CommentDetail.as_view(), name='comment-delete'),
    path('api/comments/my/', views.MyCommentsView.as_view(), name='my-comments'),
    path('api/posts/<int:post_id>/comment/', views.CommentOnPostView.as_view(), name='post-comment-create'),
    
    # Events
    path('api/events/', views.EventCreate.as_view(), name='event-create'),
    
    # Recommendations
    path('api/recommendations/', views.RecommendationView.as_view(), name='recommendations'),
    path('api/discover/', views.DiscoverView.as_view(), name='discover'),
    path('api/trending-tags/', views.TrendingTagsView.as_view(), name='trending-tags'),
    path('api/debug/my-posts/', views.DebugMyPostsView.as_view(), name='debug-my-posts'),
    
    
    # Follow
    path('api/follow/<int:pk>/', views.FollowUser.as_view(), name='follow-user'),
    path('api/unfollow/<int:pk>/', views.UnfollowUser.as_view(), name='unfollow-user'),
    path('api/profiles/me/following/', views.GetFollowingUsersView.as_view(), name='me-following'),
    path('api/profiles/me/followers/', views.MeFollowersView.as_view(), name='me-followers'),
    path('api/following/users/', views.GetFollowingUsersView.as_view(), name='following-users'),
    
    # Notifications
    path('api/notifications/', views.NotificationList.as_view(), name='notification-list'),
    path('api/notifications/unread-count/', views.NotificationUnreadCountView.as_view(), name='notification-unread-count'),
    path('api/notifications/<int:pk>/read/', views.NotificationRead.as_view(), name='notification-read'),
    path('api/notifications/<int:pk>/delete/', views.NotificationDelete.as_view(), name='notification-delete'),
    
    # Share
    path('api/posts/<int:pk>/share-with-users/', views.SharePostWithUsersView.as_view(), name='post-share-users'),
    path('api/posts/shared-with-me/', views.SharedWithMeView.as_view(), name='shared-with-me'),
    path('api/posts/shared-with-me/<int:pk>/read/', views.MarkSharedPostReadView.as_view(), name='mark-shared-read'),
    
    # Misc
    path('api/auth/reset-password-clue/', views.reset_password, name='reset-password-clue'),
]