import { apiClient } from '@/lib/api';

export class WebSocketService {
    private socket: WebSocket | null = null;
    private callbacks: { [key: string]: ((data: any) => void)[] } = {};
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private threadId: number | null = null;

    connect(threadId: number) {
        if (this.socket && this.threadId === threadId) return;

        if (this.socket) {
            this.disconnect();
        }

        this.threadId = threadId;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Get host from env, stripping http/https/trailing slashes
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
        const host = apiBase.replace(/^https?:\/\//, '').split('/')[0];
        const wsUrl = `${protocol}//${host}/ws/chat/${threadId}/`;

        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            console.log('WebSocket connected');
            this.reconnectAttempts = 0;
            this.emit('connected', { threadId });
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.emit(data.type || 'message', data);
            } catch (e) {
                console.error('WebSocket message parse error:', e);
            }
        };

        this.socket.onclose = () => {
            console.log('WebSocket disconnected');
            this.emit('disconnected', {});
            // Implement simple reconnect logic
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                setTimeout(() => {
                    this.reconnectAttempts++;
                    this.connect(threadId);
                }, 1000 * Math.pow(2, this.reconnectAttempts));
            }
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.emit('error', error);
        };
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
            this.threadId = null;
        }
    }

    sendMessage(content: string, type: 'text' | 'image' | 'voice' = 'text', metadata: any = {}) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'chat_message',
                message: content,
                message_type: type,
                ...metadata
            }));
        } else {
            console.warn('WebSocket not connected');
        }
    }

    sendTyping() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'typing'
            }));
        }
    }

    on(event: string, callback: (data: any) => void) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }
        this.callbacks[event].push(callback);
        return () => this.off(event, callback);
    }

    off(event: string, callback: (data: any) => void) {
        if (!this.callbacks[event]) return;
        this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
    }

    private emit(event: string, data: any) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(cb => cb(data));
        }
    }
}

export const webSocketService = new WebSocketService();
