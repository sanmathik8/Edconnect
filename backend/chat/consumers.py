"""
Enhanced WebSocket Consumer for Real-Time Chat
File: chat/consumers.py
"""

import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from datetime import timedelta


class ChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time chat functionality
    Handles: messages, typing indicators, read receipts, online status
    """
    
    async def connect(self):
        """Handle WebSocket connection"""
        self.thread_id = self.scope['url_route']['kwargs']['thread_id']
        self.room_group_name = f'chat_{self.thread_id}'
        self.user = self.scope.get('user')
        
        # Reject if not authenticated
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return
        
        try:
            # Get user profile
            self.user_profile = await self.get_user_profile()
            if not self.user_profile:
                await self.close(code=4002)
                return
            
            # Check if user has access to this thread
            has_access = await self.check_thread_access()
            if not has_access:
                await self.close(code=4003)
                return
            
            # Join room group
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            
            await self.accept()
            
            # Notify others that user is online
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_status',
                    'user_id': self.user_profile.id,
                    'username': self.user.username,
                    'status': 'online'
                }
            )
            
        except Exception as e:
            print(f"Connection error: {e}")
            await self.close(code=4000)
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        if hasattr(self, 'room_group_name') and hasattr(self, 'user_profile'):
            # Notify others that user is offline
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_status',
                    'user_id': self.user_profile.id,
                    'username': self.user.username,
                    'status': 'offline'
                }
            )
            
            # Leave room group
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
    
    async def receive(self, text_data):
        """
        Handle incoming WebSocket messages
        Supports: send_message, typing, read_receipt, delete_message
        """
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'send_message':
                await self.handle_send_message(data)
            
            elif message_type == 'typing':
                await self.handle_typing(data)
            
            elif message_type == 'read_receipt':
                await self.handle_read_receipt(data)
            
            elif message_type == 'delete_message':
                await self.handle_delete_message(data)
            
            elif message_type == 'edit_message':
                await self.handle_edit_message(data)
            
            elif message_type == 'react_message':
                await self.handle_react_message(data)
                
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON'
            }))
        except Exception as e:
            print(f"Receive error: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))
    
    # ========== MESSAGE HANDLERS ==========
    
    async def handle_send_message(self, data):
        """Handle sending a new message"""
        content = data.get('content', '').strip()
        reply_to_id = data.get('reply_to_id')
        client_encrypted_content = data.get('client_encrypted_content')
        client_iv = data.get('client_iv')
        
        if not content and not client_encrypted_content:
            return
        
        # Create message in database
        message = await self.create_message(
            content=content,
            reply_to_id=reply_to_id,
            client_encrypted_content=client_encrypted_content,
            client_iv=client_iv
        )
        
        if message:
            # Get serialized message data
            message_data = await self.serialize_message(message)
            
            # Broadcast to room group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'new_message',
                    'message': message_data
                }
            )
    
    async def handle_typing(self, data):
        """Handle typing indicator"""
        is_typing = data.get('is_typing', False)
        
        if is_typing:
            await self.update_typing_indicator()
        
        # Broadcast typing status (don't send to self)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_typing',
                'user_id': self.user_profile.id,
                'username': self.user.username,
                'is_typing': is_typing
            }
        )
    
    async def handle_read_receipt(self, data):
        """Handle marking messages as read"""
        message_ids = data.get('message_ids', [])
        
        if message_ids:
            await self.mark_messages_read(message_ids)
            
            # Notify sender that messages were read
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'messages_read',
                    'message_ids': message_ids,
                    'read_by_user_id': self.user_profile.id,
                    'read_by_username': self.user.username,
                    'read_at': timezone.now().isoformat()
                }
            )
    
    async def handle_delete_message(self, data):
        """Handle message deletion"""
        message_id = data.get('message_id')
        delete_for_everyone = data.get('delete_for_everyone', False)
        
        success = await self.delete_message(message_id, delete_for_everyone)
        
        if success:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'message_deleted',
                    'message_id': message_id,
                    'deleted_by_user_id': self.user_profile.id,
                    'delete_for_everyone': delete_for_everyone
                }
            )
    
    async def handle_edit_message(self, data):
        """Handle message editing"""
        message_id = data.get('message_id')
        new_content = data.get('content', '').strip()
        
        if not new_content:
            return
        
        message = await self.edit_message(message_id, new_content)
        
        if message:
            message_data = await self.serialize_message(message)
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'message_edited',
                    'message': message_data
                }
            )
    
    async def handle_react_message(self, data):
        """Handle message reaction"""
        message_id = data.get('message_id')
        emoji = data.get('emoji')
        
        if not emoji:
            return
        
        reaction = await self.toggle_reaction(message_id, emoji)
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'message_reaction',
                'message_id': message_id,
                'user_id': self.user_profile.id,
                'username': self.user.username,
                'emoji': emoji,
                'action': 'added' if reaction else 'removed'
            }
        )
    
    # ========== CHANNEL LAYER HANDLERS ==========
    
    async def new_message(self, event):
        """Send new message to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'new_message',
            'message': event['message']
        }))
    
    async def user_typing(self, event):
        """Send typing indicator to WebSocket (except to sender)"""
        if event['user_id'] != self.user_profile.id:
            await self.send(text_data=json.dumps({
                'type': 'user_typing',
                'user_id': event['user_id'],
                'username': event['username'],
                'is_typing': event['is_typing']
            }))
    
    async def messages_read(self, event):
        """Send read receipt to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'messages_read',
            'message_ids': event['message_ids'],
            'read_by_user_id': event['read_by_user_id'],
            'read_by_username': event['read_by_username'],
            'read_at': event['read_at']
        }))
    
    async def user_status(self, event):
        """Send user online/offline status"""
        if event['user_id'] != self.user_profile.id:
            await self.send(text_data=json.dumps({
                'type': 'user_status',
                'user_id': event['user_id'],
                'username': event['username'],
                'status': event['status']
            }))
    
    async def message_deleted(self, event):
        """Send message deletion notification"""
        await self.send(text_data=json.dumps({
            'type': 'message_deleted',
            'message_id': event['message_id'],
            'deleted_by_user_id': event['deleted_by_user_id'],
            'delete_for_everyone': event['delete_for_everyone']
        }))
    
    async def message_edited(self, event):
        """Send message edit notification"""
        await self.send(text_data=json.dumps({
            'type': 'message_edited',
            'message': event['message']
        }))
    
    async def message_reaction(self, event):
        """Send message reaction notification"""
        await self.send(text_data=json.dumps({
            'type': 'message_reaction',
            'message_id': event['message_id'],
            'user_id': event['user_id'],
            'username': event['username'],
            'emoji': event['emoji'],
            'action': event['action']
        }))
    
    # ========== DATABASE OPERATIONS ==========
    
    @database_sync_to_async
    def get_user_profile(self):
        """Get user profile"""
        from core.models import UserProfile
        try:
            return UserProfile.objects.get(user=self.user)
        except UserProfile.DoesNotExist:
            return None
    
    @database_sync_to_async
    def check_thread_access(self):
        """Check if user has access to this thread"""
        from chat.models import ChatThread, BlockedUser
        
        try:
            thread = ChatThread.objects.get(id=self.thread_id)
            
            # Check if user is a participant
            if not thread.participants.filter(id=self.user_profile.id).exists():
                return False
            
            # Check if any participant has blocked the user
            participants = thread.participants.exclude(id=self.user_profile.id)
            for participant in participants:
                if BlockedUser.objects.filter(
                    blocker=participant, 
                    blocked=self.user_profile
                ).exists():
                    return False
            
            return True
            
        except ChatThread.DoesNotExist:
            return False
    
    @database_sync_to_async
    def create_message(self, content, reply_to_id=None, 
                      client_encrypted_content=None, client_iv=None):
        """Create a new message"""
        from chat.models import ChatThread, ChatMessage
        
        try:
            thread = ChatThread.objects.get(id=self.thread_id)
            
            message = ChatMessage.objects.create(
                thread=thread,
                sender=self.user_profile,
                content=content,
                client_encrypted_content=client_encrypted_content,
                client_iv=client_iv,
                reply_to_id=reply_to_id if reply_to_id else None
            )
            
            # Update thread's updated_at
            thread.updated_at = timezone.now()
            thread.last_message_text = content[:100] if content else '[Encrypted]'
            thread.last_message_time = timezone.now()
            thread.save()
            
            return message
            
        except Exception as e:
            print(f"Create message error: {e}")
            return None
    
    @database_sync_to_async
    def serialize_message(self, message):
        """Serialize message for sending"""
        from chat.serializers import ChatMessageSerializer
        
        serializer = ChatMessageSerializer(message)
        return serializer.data
    
    @database_sync_to_async
    def update_typing_indicator(self):
        """Update or create typing indicator"""
        from chat.models import TypingIndicator, ChatThread
        
        try:
            thread = ChatThread.objects.get(id=self.thread_id)
            TypingIndicator.objects.update_or_create(
                thread=thread,
                user=self.user_profile,
                defaults={'last_typed_at': timezone.now()}
            )
        except Exception as e:
            print(f"Typing indicator error: {e}")
    
    @database_sync_to_async
    def mark_messages_read(self, message_ids):
        """Mark multiple messages as read"""
        from chat.models import ChatMessage
        
        try:
            # Only mark messages not sent by current user
            ChatMessage.objects.filter(
                id__in=message_ids,
                thread_id=self.thread_id,
                read=False
            ).exclude(
                sender=self.user_profile
            ).update(
                read=True,
                read_at=timezone.now()
            )
        except Exception as e:
            print(f"Mark read error: {e}")
    
    @database_sync_to_async
    def delete_message(self, message_id, delete_for_everyone):
        """Delete a message"""
        from chat.models import ChatMessage
        
        try:
            message = ChatMessage.objects.get(
                id=message_id,
                thread_id=self.thread_id
            )
            
            # Check if user is sender
            if message.sender != self.user_profile:
                return False
            
            if delete_for_everyone:
                message.is_deleted_for_everyone = True
                message.content = None
                message.save()
            else:
                message.deleted_by.add(self.user_profile)
            
            return True
            
        except ChatMessage.DoesNotExist:
            return False
    
    @database_sync_to_async
    def edit_message(self, message_id, new_content):
        """Edit a message"""
        from chat.models import ChatMessage
        
        try:
            message = ChatMessage.objects.get(
                id=message_id,
                thread_id=self.thread_id,
                sender=self.user_profile
            )
            
            message.content = new_content
            message.edited_at = timezone.now()
            message.save()
            
            return message
            
        except ChatMessage.DoesNotExist:
            return None
    
    @database_sync_to_async
    def toggle_reaction(self, message_id, emoji):
        """Toggle reaction on a message"""
        from chat.models import MessageReaction, ChatMessage
        
        try:
            message = ChatMessage.objects.get(
                id=message_id,
                thread_id=self.thread_id
            )
            
            # Check if reaction already exists
            reaction = MessageReaction.objects.filter(
                message=message,
                user=self.user_profile,
                emoji=emoji
            ).first()
            
            if reaction:
                # Remove reaction
                reaction.delete()
                return None
            else:
                # Add reaction
                reaction = MessageReaction.objects.create(
                    message=message,
                    user=self.user_profile,
                    emoji=emoji
                )
                return reaction
                
        except ChatMessage.DoesNotExist:
            return None