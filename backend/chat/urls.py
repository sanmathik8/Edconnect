from django.urls import path
from . import views
from . import group_views

urlpatterns = [
    # Threads
    path('threads/', views.ChatThreadListCreate.as_view(), name='chat-threads'),
    path('threads/<int:pk>/', views.ChatThreadDetail.as_view(), name='chat-thread-detail'),
    path('threads/<int:pk>/add-members/', views.ChatThreadAddParticipants.as_view(), name='chat-thread-add-members'),
    path('threads/<int:pk>/delete/', views.ChatThreadDestroy.as_view(), name='chat-thread-delete'),
    path('threads/<int:pk>/accept/', views.ChatThreadAccept.as_view(), name='chat-thread-accept'),
    path('threads/<int:pk>/reject/', views.ChatThreadReject.as_view(), name='chat-thread-reject'),
    
    # Group Management
    path('threads/<int:pk>/leave/', group_views.ChatThreadLeave.as_view(), name='chat-thread-leave'),
    path('threads/<int:pk>/remove-member/', group_views.ChatThreadRemoveParticipant.as_view(), name='chat-thread-remove-member'),
    path('threads/<int:pk>/promote-admin/', group_views.ChatThreadPromoteAdmin.as_view(), name='chat-thread-promote-admin'),
    path('threads/<int:pk>/demote-admin/', group_views.ChatThreadDemoteAdmin.as_view(), name='chat-thread-demote-admin'),
    path('threads/<int:pk>/transfer-ownership/', group_views.ChatThreadTransferOwnership.as_view(), name='chat-thread-transfer-ownership'),
    
    # Messages
    path('messages/', views.ChatMessageCreate.as_view(), name='chat-message-create'),
    path('messages/<int:pk>/delete/', views.ChatMessageDelete.as_view(), name='chat-message-delete'),
    path('messages/<int:pk>/update/', views.ChatMessageUpdate.as_view(), name='chat-message-update'),
    
    # Search
    path('search/', views.ChatMessageSearch.as_view(), name='chat-search'),
    
    # User Actions (Block/Unblock)
    path('restrictions/', views.UserRestrictionList.as_view(), name='user-restrictions'),
    path('block/<int:user_id>/', views.BlockUserView.as_view(), name='block-user'),
    path('unblock/<int:user_id>/', views.UnblockUserView.as_view(), name='unblock-user'),
    
    # Group Search & Rejoin
    path('groups/search/', group_views.GroupSearch.as_view(), name='group-search'),
    path('groups/<int:pk>/rejoin/', group_views.GroupRejoin.as_view(), name='group-rejoin'),
]
