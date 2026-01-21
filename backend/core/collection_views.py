from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Count
from .models import Collection, CollectionItem, Post, UserProfile
from .serializers import CollectionSerializer, CollectionItemSerializer
from .views import _get_profile

class CollectionListCreate(generics.ListCreateAPIView):
    serializer_class = CollectionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        profile = _get_profile(self.request)
        if not profile:
            return Collection.objects.none()
        return Collection.objects.filter(user=profile).annotate(
            items_count_annotated=Count('items')
        ).order_by('-updated_at')

    def perform_create(self, serializer):
        from django.db import IntegrityError
        from rest_framework.exceptions import ValidationError
        
        profile = _get_profile(self.request)
        if not profile:
            raise permissions.PermissionDenied("Authentication required")
        try:
            serializer.save(user=profile)
        except IntegrityError:
            raise ValidationError({'name': ['Collection with this name already exists.']})

class CollectionDetail(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CollectionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        profile = _get_profile(self.request)
        if not profile:
            return Collection.objects.none()
        return Collection.objects.filter(user=profile)

class CollectionAddItem(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        profile = _get_profile(request)
        if not profile:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            collection = Collection.objects.get(pk=pk, user=profile)
        except Collection.DoesNotExist:
            return Response({'error': 'Collection not found'}, status=status.HTTP_404_NOT_FOUND)
        
        post_id = request.data.get('post_id')
        if not post_id:
            return Response({'error': 'Post ID required'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            post = Post.objects.get(pk=post_id)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
            
        # Check if already in collection
        if CollectionItem.objects.filter(collection=collection, post=post).exists():
             return Response({'status': 'already_added'})
             
        CollectionItem.objects.create(collection=collection, post=post)
        return Response({'status': 'added'})

class CollectionRemoveItem(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        profile = _get_profile(request)
        if not profile:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            collection = Collection.objects.get(pk=pk, user=profile)
        except Collection.DoesNotExist:
            return Response({'error': 'Collection not found'}, status=status.HTTP_404_NOT_FOUND)
            
        post_id = request.data.get('post_id')
        if not post_id:
             return Response({'error': 'Post ID required'}, status=status.HTTP_400_BAD_REQUEST)
             
        CollectionItem.objects.filter(collection=collection, post_id=post_id).delete()
        return Response({'status': 'removed'})

class CollectionItemsList(generics.ListAPIView):
    serializer_class = CollectionItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        profile = _get_profile(self.request)
        if not profile:
            return CollectionItem.objects.none()
            
        collection_id = self.kwargs.get('pk')
        return CollectionItem.objects.filter(
            collection__id=collection_id, 
            collection__user=profile
        ).select_related('post', 'post__author__user').order_by('-added_at')
