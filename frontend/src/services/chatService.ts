/**
 * Chat Service Layer
 * Centralizes all chat-related business logic and API calls
 */

import { apiClient } from '@/lib/api';

export interface Thread {
    id: number;
    participants: Participant[];
    status: 'active' | 'pending' | 'rejected' | 'blocked' | 'archived';
    last_message?: Message;
    unread_count?: number;
    is_group: boolean;
    group_name?: string;
    group_avatar?: string;
    admin?: Participant;
    admins?: Participant[];
    initiator?: Participant;
    is_muted?: boolean;
    created_at: string;
    updated_at?: string;
    blocked_by_id?: string | number;
}

export interface Participant {
    id: string;
    username?: string; // Top-level username fallback
    user?: {
        id: string;
        username: string;
    };
    avatar?: string;
    is_following?: boolean;
    is_blocked?: boolean;
    is_blocked_by_me?: boolean;
    is_blocking_me?: boolean;
}

export interface Message {
    id: number | string;
    content: string;
    sender: Participant;
    created_at: string;
    read?: boolean;
    read_at?: string;
    attachments?: Attachment[];
    reactions?: Reaction[];
    reply_to_message?: any;
    shared_post?: any;
    is_pinned?: boolean;
    is_edited?: boolean;
    client_encrypted_content?: string;
    client_iv?: string;
    client_encryption_version?: number;
    // UI-only and computed fields
    reaction_counts?: Record<string, number>;
    user_reaction?: string;
    sending?: boolean;
    failed?: boolean;
}

export interface Attachment {
    id: number;
    file_url: string;
    file_type: 'image' | 'video' | 'audio' | 'voice' | 'document';
    file_size: number;
    file_name: string;
    thumbnail_url?: string;
}

export interface Reaction {
    id: number;
    user: any;
    emoji: string;
}

export class ChatService {
    private currentUserId: string | null = null;

    setCurrentUserId(userId: string) {
        this.currentUserId = userId;
    }

    /**
     * Get all active chats (accepted conversations)
     */
    async getActiveChats(): Promise<Thread[]> {
        const threads = await apiClient.getThreads();
        return threads.filter(t =>
            t.status === 'active' && !t.is_group
        );
    }

    /**
     * Get incoming message requests (pending threads initiated by others)
     */
    async getMessageRequests(): Promise<Thread[]> {
        const threads = await apiClient.getThreads();
        return threads.filter(t =>
            t.status === 'pending' &&
            t.initiator?.id !== this.currentUserId
        );
    }

    /**
     * Get all group chats
     */
    async getGroupChats(): Promise<Thread[]> {
        const threads = await apiClient.getThreads();
        return threads.filter(t =>
            t.is_group && t.status === 'active'
        );
    }

    /**
     * Get all threads (for main thread list)
     */
    async getAllThreads(): Promise<Thread[]> {
        return await apiClient.getThreads();
    }

    /**
     * Accept a message request
     */
    async acceptRequest(threadId: number): Promise<void> {
        await apiClient.request(`chat/threads/${threadId}/accept/`, {
            method: 'POST'
        });
    }

    /**
     * Reject a message request
     */
    async rejectRequest(threadId: number): Promise<void> {
        await apiClient.request(`chat/threads/${threadId}/reject/`, {
            method: 'POST'
        });
    }

    /**
     * Block a user from a message request
     */
    async blockFromRequest(threadId: number, userId: string): Promise<void> {
        // First reject the thread
        await this.rejectRequest(threadId);
        // Then block the user
        await this.blockUser(userId);
    }

    /**
     * Create a new thread (1:1 or group)
     */
    async createThread(
        userIds: string[],
        options?: { is_group?: boolean; group_name?: string }
    ): Promise<Thread> {
        return await apiClient.createThread(userIds, options);
    }

    /**
     * Create a group chat
     */
    async createGroup(userIds: string[], groupName: string): Promise<Thread> {
        if (userIds.length < 2) {
            throw new Error('Group must have at least 2 members');
        }
        return await this.createThread(userIds, {
            is_group: true,
            group_name: groupName
        });
    }

    /**
     * Add members to an existing group
     */
    async addMembersToGroup(threadId: number, userIds: string[]): Promise<void> {
        await apiClient.addMembersToGroup(threadId, userIds);
    }

    /**
     * Promote a member to admin
     */
    async promoteToAdmin(threadId: number, userId: string): Promise<void> {
        await apiClient.request(`chat/threads/${threadId}/promote-admin/`, {
            method: 'POST',
            body: JSON.stringify({ participant_id: userId })
        });
    }

    /**
     * Demote an admin to member
     */
    async demoteFromAdmin(threadId: number, userId: string): Promise<void> {
        await apiClient.request(`chat/threads/${threadId}/demote-admin/`, {
            method: 'POST',
            body: JSON.stringify({ participant_id: userId })
        });
    }

    /**
     * Remove member from group
     */
    async removeMember(threadId: number, userId: string): Promise<void> {
        await apiClient.removeMemberFromGroup(threadId, userId);
    }



    /**
     * Leave a group chat
     */
    async leaveGroup(threadId: number): Promise<void> {
        await apiClient.leaveGroup(threadId);
    }

    /**
     * Delete a thread (soft delete for groups, hard delete for 1:1 chats)
     */
    async deleteThread(threadId: number): Promise<void> {
        console.log('[ChatService] Deleting thread:', threadId);

        // Call the DELETE endpoint
        await apiClient.deleteThread(threadId);

        console.log('[ChatService] Delete request completed');
    }

    /**
     * Rejoin a group (un-hide/un-archive)
     */
    async rejoinGroup(threadId: number): Promise<any> {
        return await apiClient.rejoinGroup(threadId);
    }

    /**
     * Verify thread is deleted (for testing)
     */
    async verifyThreadDeleted(threadId: number): Promise<boolean> {
        try {
            await apiClient.getThread(threadId);
            // If we get here, thread still exists
            return false;
        } catch (error: any) {
            // 404 means it's deleted
            return error.status === 404;
        }
    }

    /**
     * Transfer group ownership
     */
    async transferOwnership(threadId: number, userId: string): Promise<void> {
        await apiClient.transferGroupOwnership(threadId, userId);
    }

    /**
     * Block a user
     */
    async blockUser(userId: string): Promise<void> {
        await apiClient.blockUser(userId);
    }

    /**
     * Unblock a user
     */
    async unblockUser(userId: string): Promise<void> {
        await apiClient.unblockUser(userId);
    }

    /**
     * Mute a thread
     */
    async muteThread(threadId: number): Promise<void> {
        await apiClient.muteThread(threadId);
    }

    /**
     * Unmute a thread
     */
    async unmuteThread(threadId: number): Promise<void> {
        // Assuming the same endpoint toggles mute
        await apiClient.muteThread(threadId);
    }

    /**
     * Get messages for a thread
     */
    async getMessages(threadId: number, sinceId?: number, beforeId?: number, limit: number = 50): Promise<Message[]> {
        const response = await apiClient.getMessages(threadId, sinceId, beforeId, limit);
        return response.messages || [];
    }





    /**
     * Send a message to a thread
     */
    async sendMessage(threadId: number, content: string, attachment?: File): Promise<Message> {
        return await apiClient.sendMessage(threadId, content, attachment) as Message;
    }

    /**
     * Update an existing message
     */
    async updateMessage(messageId: number, content: string): Promise<Message> {
        return await apiClient.updateMessage(messageId, content) as Message;
    }

    async deleteMessage(messageId: number, forEveryone: boolean = false): Promise<void> {
        await apiClient.deleteMessage(messageId, forEveryone ? 'everyone' : 'me');
    }

    /**
     * React to a message
     */
    async reactToMessage(messageId: number, emoji: string): Promise<void> {
        await apiClient.reactToMessage(messageId, emoji);
    }

    /**
     * Send typing indicator
     */
    async sendTypingIndicator(threadId: number): Promise<void> {
        await apiClient.sendTypingIndicator(threadId);
    }

    /**
     * Get typing users
     */
    async getTypingUsers(threadId: number): Promise<any[]> {
        const response = await apiClient.getTypingUsers(threadId);
        return response.typing_users || [];
    }

    /**
     * Upload file attachment
     */
    async uploadAttachment(file: File, messageId: number): Promise<void> {
        await apiClient.uploadChatMedia(file, messageId);
    }

    /**
     * Upload voice message
     */
    async uploadVoiceMessage(blob: Blob, threadId: number): Promise<void> {
        await apiClient.uploadVoiceMessage(blob, threadId);
    }

    /**
     * Check if user can message another user (not blocked)
     */
    async canMessageUser(userId: string): Promise<boolean> {
        try {
            // Try to create a thread - if blocked, it will fail
            await this.createThread([userId]);
            return true;
        } catch (error: any) {
            if (error.status === 403) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Get thread by user ID (find existing 1:1 conversation)
     */
    async getThreadByUserId(userId: string): Promise<Thread | null> {
        const threads = await this.getAllThreads();
        return threads.find(t =>
            !t.is_group &&
            t.participants.some(p => String(p.user?.id) === String(userId) || String(p.id) === String(userId))
        ) || null;
    }

    /**
     * Get or create thread with a user
     */
    async getOrCreateThread(userId: string): Promise<Thread> {
        const existing = await this.getThreadByUserId(userId);
        if (existing) {
            return existing;
        }
        return await this.createThread([userId]);
    }

    /**
     * Filter threads by search query
     */
    filterThreads(threads: Thread[], query: string): Thread[] {
        if (!query.trim()) return threads;

        const lowerQuery = query.toLowerCase();
        return threads.filter(thread => {
            // Search in group name
            if (thread.is_group && thread.group_name?.toLowerCase().includes(lowerQuery)) {
                return true;
            }

            // Search in participant names
            return thread.participants.some(p =>
                (p.user?.username || p.username || '').toLowerCase().includes(lowerQuery)
            );
        });
    }

    /**
     * Sort threads by last message time
     */
    sortThreads(threads: Thread[]): Thread[] {
        return threads.sort((a, b) => {
            const aTime = a.last_message?.created_at || a.created_at;
            const bTime = b.last_message?.created_at || b.created_at;
            return new Date(bTime).getTime() - new Date(aTime).getTime();
        });
    }

    /**
     * Get unread count across all threads
     */
    getTotalUnreadCount(threads: Thread[]): number {
        return threads.reduce((sum, t) => sum + (t.unread_count || 0), 0);
    }



    /**
     * Mark thread as read
     */
    async markThreadAsRead(threadId: number): Promise<void> {
        // This happens automatically when fetching messages
        // But we can explicitly call it if needed
        await this.getMessages(threadId);
    }
}

// Export singleton instance
export const chatService = new ChatService();
