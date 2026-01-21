import json
from channels.generic.websocket import AsyncWebsocketConsumer

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.thread_id = self.scope['url_route']['kwargs']['thread_id']
        self.group_name = f'thread_{self.thread_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        print(f"✅ [WS] Connected to thread {self.thread_id}")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        message = data.get('message')
        sender = self.scope['user'].username if self.scope.get('user') and self.scope['user'].is_authenticated else 'anon'
        # broadcast to group
        await self.channel_layer.group_send(self.group_name, {
            'type': 'chat.message',
            'message': message,
            'sender': sender,
        })

    async def chat_message(self, event):
        # Send full event payload to WebSocket
        # This allows sending full message objects, delete events, etc.
        await self.send(text_data=json.dumps(event))
