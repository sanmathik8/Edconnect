/**
 * API Client utilities for RecoM frontend
 * Handles all communication with Django backend with comprehensive error handling
 */

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

export interface AuthUser {
    id: string;
    username: string;
    avatar?: string | null;
    profile_id?: string;
    bio?: string;
}

export interface AuthResponse {
    ok: boolean;
    user?: AuthUser;
    error?: string;
    form_errors?: Record<string, string[]>;
    redirect?: string;
}

export interface UserProfile {
    id: string;
    user: {
        id: string;
        username: string;
        email: string;
    };
    bio: string;
    interests: string[];
    avatar?: string;
    default_avatar_url?: string;
    is_following: boolean;
    followers_count: number;
    following_count: number;
    username?: string;
}

export interface DefaultAvatarsResponse {
    avatars: { id: string; url: string }[];
}

export interface Post {
    id: number;
    content: string;
    image?: string;
    created_at: string;
    likes_count: number;
    is_liked: boolean;
    tags: string[];
    author: {
        id: string;
        username: string;
    };
}

export interface LikeResponse {
    liked: boolean;
    likes_count: number;
}

export interface SaveResponse {
    saved: boolean;
    saves_count: number;
}

export interface ShareResponse {
    status: string;
    shared_count: number;
    errors?: string[];
}

// Custom error types for better error handling
export class ApiError extends Error {
    status: number;
    code?: string;
    formErrors?: Record<string, string[]>;

    constructor(message: string, status: number, code?: string, formErrors?: Record<string, string[]>) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.formErrors = formErrors;

        // Ensure proper prototype chain for instanceof checks
        Object.setPrototypeOf(this, ApiError.prototype);
    }

    get isAuthError() {
        return this.status === 401;
    }

    get isAccessDenied() {
        return this.status === 403;
    }

    get isNotFound() {
        return this.status === 404;
    }

    get isValidationError() {
        return this.status === 400;
    }
}

export class ValidationError extends Error {
    formErrors: Record<string, string[]>;

    constructor(message: string, formErrors: Record<string, string[]>) {
        super(message);
        this.name = 'ValidationError';
        this.formErrors = formErrors;
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}

export class NetworkError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NetworkError';
    }
}



class ApiClient {
    private baseUrl: string;

    constructor(baseUrl = API_BASE_URL) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
    }

    getMediaUrl(path: string | null | undefined): string {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        const base = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api').replace('/api', '');
        return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
    }

    getAvatarUrl(user: any): string {
        if (!user) return 'https://api.dicebear.com/7.x/avataaars/svg?seed=guest';

        // Check various common field names for avatar
        const avatar = user.avatar || user.profile?.avatar;
        if (avatar) return this.getMediaUrl(avatar);

        const defaultAvatar = user.default_avatar_url || user.profile?.default_avatar_url;
        if (defaultAvatar) return defaultAvatar;

        const username = user.username || user.user?.username || 'user';
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}&mouth=smile&eyes=happy`;
    }

    // ---------------- CSRF TOKEN FETCHER ----------------
    async fetchCsrfToken(): Promise<string | null> {
        try {
            let token = this.getCookie('csrftoken');
            if (token) {
                console.log('[ApiClient] CSRF token found in cookie');
                return token;
            }

            console.log('[ApiClient] Attempting to fetch CSRF token from server');
            const response = await fetch(`${this.baseUrl}/csrf/`, {
                credentials: 'include',
            });

            if (response.ok) {
                const text = await response.text();
                try {
                    const data = JSON.parse(text);
                    token = data.csrfToken || this.getCookie('csrftoken');
                    if (token) {
                        console.log('[ApiClient] CSRF token fetched successfully');
                        return token;
                    }
                } catch {
                    console.warn('[ApiClient] CSRF endpoint returned non-JSON response');
                }
            }
        } catch (error) {
            console.warn('[ApiClient] Could not fetch CSRF token:', error);
        }

        return null;
    }

    // ---------------- CSRF ----------------
    private getCookie(name: string): string | null {
        if (typeof document === 'undefined') return null;
        const value = document.cookie
            .split('; ')
            .find(row => row.startsWith(name + '='))
            ?.split('=')[1];
        return value || null;
    }

    // ---------------- URL BUILDER ----------------
    private buildUrl(endpoint: string): string {
        const base = this.baseUrl.replace(/\/+$/, '');
        let fullPath = endpoint.replace(/^\/+/, '');

        // Handle query strings separately to avoid appending trailing slash to them
        const [pathPart, queryPart] = fullPath.split('?');
        let normalizedPath = pathPart;

        if (!normalizedPath.endsWith('/')) {
            normalizedPath += '/';
        }

        const finalPath = queryPart ? `${normalizedPath}?${queryPart}` : normalizedPath;
        return `${base}/${finalPath}`;
    }

    // ---------------- ERROR HANDLER ----------------
    private handleError(response: Response, data: any, text: string): never {
        const status = response.status;

        // Handle HTML error pages (Django debug pages)
        if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
            console.error('🚨 Django returned HTML instead of JSON');
            throw new ApiError(
                'Server configuration error',
                status,
                'DJANGO_HTML_ERROR'
            );
        }

        // Handle specific HTTP status codes
        switch (status) {
            case 400:
                // Validation errors
                if (data.form_errors) {
                    throw new ValidationError(
                        data.error || 'Validation failed',
                        data.form_errors
                    );
                }
                throw new ApiError(
                    data.error || data.detail || 'Bad request',
                    400,
                    'VALIDATION_ERROR',
                    data.form_errors
                );

            case 401:
                throw new ApiError(
                    data.error || data.detail || 'Authentication required',
                    401,
                    'AUTH_REQUIRED'
                );

            case 403:
                throw new ApiError(
                    data.error || data.detail || 'Access denied',
                    403,
                    'ACCESS_DENIED'
                );

            case 404:
                throw new ApiError(
                    data.error || data.detail || 'Not found',
                    404,
                    'NOT_FOUND'
                );

            case 500:
                // Check if it's a database error
                if (text.includes('OperationalError') || text.includes('no such column')) {
                    throw new ApiError(
                        'Database error - please contact support',
                        500,
                        'DATABASE_ERROR'
                    );
                }
                throw new ApiError(
                    data.error || data.detail || 'Server error',
                    500,
                    'SERVER_ERROR'
                );

            default:
                throw new ApiError(
                    data.error || data.detail || `HTTP ${status}`,
                    status,
                    'UNKNOWN_ERROR'
                );
        }
    }

    // ---------------- CORE REQUEST ----------------
    public async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = this.buildUrl(endpoint);

        const headers: Record<string, string> = {
            Accept: 'application/json',
        };

        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        if (options.method && options.method !== 'GET') {
            const csrf = this.getCookie('csrftoken');
            if (csrf) {
                headers['X-CSRFToken'] = csrf;
            }
        }

        if (typeof window !== 'undefined') {
            headers['Referer'] = window.location.origin;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                credentials: 'include',
            });

            const text = await response.text();
            let data;

            try {
                data = text ? JSON.parse(text) : {};
            } catch (parseError) {
                // If JSON parsing fails, check if it's HTML (Django error page)
                if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
                    throw new ApiError(
                        'Server returned HTML instead of JSON',
                        response.status,
                        'DJANGO_HTML_ERROR'
                    );
                }
                // Otherwise, it's a JSON parsing error
                data = { detail: 'Invalid server response' };
            }

            if (!response.ok) {
                this.handleError(response, data, text);
            }

            return data as T;
        } catch (error: any) {
            // Network errors (server not reachable)
            if (error instanceof TypeError || error.message === 'Failed to fetch') {
                if (typeof window !== 'undefined' && !window.location.pathname.includes('/server-busy')) {
                    window.location.href = '/server-busy';
                    // Return a never-resolving promise to halt execution chains and prevent alerts
                    return new Promise(() => { });
                }
                throw new NetworkError(
                    'Cannot reach server. Make sure Django is running on http://localhost:8000'
                );
            }

            // Re-throw our custom errors
            throw error;
        }
    }

    // ---------------- AUTH WITH ENHANCED ERROR HANDLING ----------------
    async login(username: string, password: string): Promise<AuthResponse> {
        try {
            await this.fetchCsrfToken();
            return await this.request<AuthResponse>('login/', {
                method: 'POST',
                body: JSON.stringify({ username, password }),
            });
        } catch (error: any) {
            if (error instanceof ValidationError) {
                return {
                    ok: false,
                    error: error.message,
                    form_errors: error.formErrors
                };
            }
            if (error instanceof ApiError) {
                if (error.status === 401) {
                    return {
                        ok: false,
                        error: 'Invalid username or password',
                        form_errors: error.formErrors
                    };
                }
                return {
                    ok: false,
                    error: error.message,
                    form_errors: error.formErrors
                };
            }
            if (error instanceof NetworkError) {
                return {
                    ok: false,
                    error: 'Cannot connect to server. Please check if the server is running.'
                };
            }
            return {
                ok: false,
                error: 'An unexpected error occurred. Please try again.'
            };
        }
    }

    async changePassword(currentPassword: string, newPassword: string): Promise<AuthResponse> {
        try {
            await this.fetchCsrfToken();
            return await this.request<AuthResponse>('auth/password/change/', {
                method: 'POST',
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });
        } catch (error: any) {
            if (error instanceof ValidationError) {
                return {
                    ok: false,
                    error: error.message,
                    form_errors: error.formErrors
                };
            }
            if (error instanceof ApiError) {
                return {
                    ok: false,
                    error: error.message,
                    form_errors: error.formErrors
                };
            }
            return {
                ok: false,
                error: 'Failed to change password'
            };
        }
    }

    async register(data: {
        username: string;
        password1: string;
        password2: string;
        email?: string;
        clue: string;
    }): Promise<AuthResponse> {
        try {
            await this.fetchCsrfToken();
            return await this.request<AuthResponse>('register/', {
                method: 'POST',
                body: JSON.stringify(data),
            });
        } catch (error: any) {
            if (error instanceof ValidationError) {
                return {
                    ok: false,
                    error: error.message,
                    form_errors: error.formErrors
                };
            }
            if (error instanceof ApiError) {
                // Handle specific registration errors
                if (error.formErrors?.username?.some(e => e.includes('already exists'))) {
                    return {
                        ok: false,
                        error: 'Username already taken. Please choose another.',
                        form_errors: error.formErrors
                    };
                }
                if (error.formErrors?.password2?.some(e => e.includes('match'))) {
                    return {
                        ok: false,
                        error: 'Passwords do not match',
                        form_errors: error.formErrors
                    };
                }
                if (error.formErrors?.password1 || error.formErrors?.password2) {
                    return {
                        ok: false,
                        error: 'Password does not meet requirements',
                        form_errors: error.formErrors
                    };
                }
                return {
                    ok: false,
                    error: error.message,
                    form_errors: error.formErrors
                };
            }
            if (error instanceof NetworkError) {
                return {
                    ok: false,
                    error: 'Cannot connect to server. Please check if the server is running.'
                };
            }
            return {
                ok: false,
                error: 'Registration failed. Please try again.'
            };
        }
    }

    async logout() {
        try {
            return await this.request<{ ok: boolean }>('logout/', {
                method: 'POST',
            });
        } catch (error) {
            console.error('Logout error:', error);
            return { ok: false };
        }
    }

    async resetPasswordWithClue(data: {
        username: string;
        clue: string;
        new_password: string;
    }): Promise<AuthResponse> {
        try {
            return await this.request<AuthResponse>('auth/reset-password-clue/', {
                method: 'POST',
                body: JSON.stringify(data),
            });
        } catch (error) {
            console.error('Reset password with clue error:', error);
            return { ok: false, error: 'Failed to reset password. Please try again later.' };
        }
    }

    // ---------------- PROFILES ----------------
    async getCurrentUser(): Promise<UserProfile | null> {
        try {
            return await this.request<UserProfile>('profiles/me/');
        } catch (error: any) {
            if (error instanceof ApiError && error.status === 404) {
                console.warn('User profile not found');
                return null;
            }
            throw error;
        }
    }

    getMyProfile() {
        return this.getCurrentUser();
    }

    getUserProfile(userId: string | number) {
        return this.request<UserProfile>(`profiles/${userId}/`);
    }

    getProfileByUsername(username: string) {
        return this.request<UserProfile>(`profiles/username/${username}/`);
    }

    updateProfile(data: FormData | Partial<UserProfile>) {
        const isFormData = data instanceof FormData;
        return this.request<UserProfile>('profiles/me/', {
            method: 'PUT',
            body: isFormData ? data : JSON.stringify(data),
            headers: isFormData ? {} : { 'Content-Type': 'application/json' }
        });
    }

    async getFollowingUsers(): Promise<any[]> {
        const data = await this.request<any>('profiles/me/following/');
        return Array.isArray(data) ? data : (data.following || []);
    }

    async getFollowers(userId: string | number): Promise<any[]> {
        // Use the self-followers endpoint if it's the current user
        const endpoint = userId === 'me' || !userId ? 'profiles/me/followers/' : `profiles/${userId}/followers/`;
        const data = await this.request<any>(endpoint);
        return Array.isArray(data) ? data : (data.followers || []);
    }

    async followUser(userId: string | number) {
        return this.request(`follow/${userId}/`, { method: 'POST' });
    }

    async unfollowUser(userId: string | number) {
        return this.request(`unfollow/${userId}/`, { method: 'POST' });
    }

    async sharePost(postId: number, userIds: number[], message?: string): Promise<ShareResponse> {
        return this.request<ShareResponse>(`posts/${postId}/share-with-users/`, {
            method: 'POST',
            body: JSON.stringify({ user_ids: userIds, message })
        });
    }

    // ---------------- POSTS ----------------
    getFeed() {
        return this.request<Post[]>('posts/feed/');
    }

    getExplore() {
        return this.request<Post[]>('posts/explore/');
    }

    getSavedPosts() {
        return this.request<Post[]>('posts/saved/');
    }

    getUserPosts(userId?: string) {
        const query = userId ? `?user_id=${userId}` : '';
        return this.request<Post[]>(`posts/user/${query}`);
    }

    getFollowingPosts() {
        return this.request<Post[]>('posts/following/');
    }

    async getExplorePosts(tag = '') {
        try {
            // Clean the tag - remove # if present and trim whitespace
            const cleanTag = tag ? tag.replace(/^#/, '').trim() : '';

            console.log(`[ApiClient] Fetching explore posts for tag: "${cleanTag}"`); // Debug log

            // Add timestamp to bypass any caching
            const timestamp = new Date().getTime();
            const query = cleanTag ? `?tag=${encodeURIComponent(cleanTag)}&t=${timestamp}` : `?t=${timestamp}`;

            // Using the known working endpoint 'posts/explore/'
            const data = await this.request<Post[]>(`posts/explore/${query}`);

            console.log('[ApiClient] Received explore posts:', Array.isArray(data) ? data.length : 0); // Debug log
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('[ApiClient] Error fetching explore posts:', error);
            throw error;
        }
    }


    getRecommendedUsers(limit = 12, query = '', filter = 'last_post') {
        return this.request<any>(`discover/?limit=${limit}&q=${query}&filter=${filter}`);
    }

    async getTrendingTags(limit = 15, days = 30): Promise<string[]> {
        try {
            const data = await this.request<{ tags: string[]; period_days: number }>(`trending-tags/?limit=${limit}&days=${days}`);
            return data.tags || [];
        } catch (error) {
            console.error('[ApiClient] Error fetching trending tags:', error);
            return [];
        }
    }

    getPost(postId: number) {
        return this.request<Post>(`posts/${postId}/`);
    }

    deletePost(postId: number) {
        return this.request(`posts/${postId}/`, {
            method: 'DELETE',
        });
    }

    createPost(content: string, image?: File, tags?: string[]) {
        const formData = new FormData();
        formData.append('content', content);
        if (image) formData.append('image', image);
        if (tags) formData.append('tags', JSON.stringify(tags));

        return this.request<Post>('posts/', {
            method: 'POST',
            body: formData,
        });
    }

    likePost(postId: number) {
        return this.request<LikeResponse>(`posts/${postId}/like/`, { method: 'POST' });
    }

    savePost(postId: number) {
        return this.request<SaveResponse>(`posts/${postId}/save/`, { method: 'POST' });
    }

    // ---------------- ENGAGEMENT ----------------
    getComments(postId: number) {
        return this.request<any[]>(`posts/${postId}/comments/`);
    }

    addComment(postId: number, content: string) {
        return this.request(`posts/${postId}/comment/`, {
            method: 'POST',
            body: JSON.stringify({ content }),
        });
    }

    deleteComment(postId: number, commentId: number) {
        return this.request(`posts/${postId}/comments/${commentId}/`, {
            method: 'DELETE',
        });
    }

    updateComment(postId: number, commentId: number, content: string) {
        return this.request<any>(`posts/${postId}/comments/${commentId}/`, {
            method: 'PUT',
            body: JSON.stringify({ content }),
        });
    }

    recordEvent(targetId: number, eventType: string) {
        return this.request('events/', {
            method: 'POST',
            body: JSON.stringify({ target_id: targetId, event_type: eventType }),
        });
    }

    // ---------------- CHAT ----------------
    async getThreads(): Promise<any[]> {
        try {
            return await this.request<any[]>('chat/threads/');
        } catch (error: any) {
            if (error instanceof ApiError && error.code === 'DATABASE_ERROR') {
                console.error('Database error loading chats');
                return [];
            }
            throw error;
        }
    }

    getThread(threadId: number) {
        return this.request<any>(`chat/threads/${threadId}/`);
    }

    getMessages(threadId: number, sinceId?: number, beforeId?: number, limit: number = 50) {
        const params = new URLSearchParams();
        if (sinceId) params.append('since', sinceId.toString());
        if (beforeId) params.append('before_id', beforeId.toString());
        if (limit) params.append('limit', limit.toString());

        const queryString = params.toString() ? `?${params.toString()}` : '';
        return this.request<{ messages: any[] }>(`chat/threads/${threadId}/${queryString}`);
    }

    searchChats(query: string) {
        return this.request<any[]>(`chat/search/?q=${encodeURIComponent(query)}`);
    }

    searchGroups(query: string) {
        return this.request<any[]>(`chat/groups/search/?q=${encodeURIComponent(query)}`);
    }

    rejoinGroup(threadId: number) {
        return this.request<any>(`chat/groups/${threadId}/rejoin/`, { method: 'POST' });
    }

    createThread(participants: string[], options?: { is_group?: boolean; group_name?: string }) {
        return this.request<any>('chat/threads/', {
            method: 'POST',
            body: JSON.stringify({ participants, ...options }),
        });
    }

    sendMessage(threadId: number, content: string, attachment?: File) {
        if (attachment) {
            const formData = new FormData();
            formData.append('thread', threadId.toString());
            formData.append('content', content);
            formData.append('attachment', attachment);
            return this.request<any>('chat/messages/', {
                method: 'POST',
                body: formData,
            });
        }
        return this.request<any>('chat/messages/', {
            method: 'POST',
            body: JSON.stringify({ thread: threadId, content }),
        });
    }

    acceptThread(threadId: number) {
        return this.request(`chat/threads/${threadId}/accept/`, { method: 'POST' });
    }

    rejectThread(threadId: number) {
        return this.request(`chat/threads/${threadId}/reject/`, { method: 'POST' });
    }

    muteThread(threadId: number) {
        return this.request(`chat/threads/${threadId}/mute/`, { method: 'POST' });
    }

    blockThread(threadId: number) {
        return this.request(`chat/threads/${threadId}/block/`, { method: 'POST' });
    }

    archiveThread(threadId: number) {
        return this.request(`chat/threads/${threadId}/archive/`, { method: 'POST' });
    }

    deleteThread(threadId: number) {
        return this.request(`chat/threads/${threadId}/delete/`, { method: 'DELETE' });
    }

    reportThread(threadId: number, reason: string) {
        return this.request(`chat/threads/${threadId}/report/`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        });
    }

    addMembersToGroup(threadId: number, userIds: string[]) {
        return this.request(`chat/threads/${threadId}/add-members/`, {
            method: 'POST',
            body: JSON.stringify({ participants: userIds }),
        });
    }

    leaveGroup(threadId: number) {
        return this.request(`chat/threads/${threadId}/leave/`, { method: 'POST' });
    }

    removeMemberFromGroup(threadId: number, userId: string) {
        return this.request(`chat/threads/${threadId}/remove-member/`, {
            method: 'POST',
            body: JSON.stringify({ participant_id: userId }),
        });
    }

    promoteToAdmin(threadId: number, userId: string) {
        return this.request(`chat/threads/${threadId}/promote-admin/`, {
            method: 'POST',
            body: JSON.stringify({ participant_id: userId }),
        });
    }

    demoteFromAdmin(threadId: number, userId: string) {
        return this.request(`chat/threads/${threadId}/demote-admin/`, {
            method: 'POST',
            body: JSON.stringify({ participant_id: userId }),
        });
    }

    transferGroupOwnership(threadId: number, userId: string) {
        return this.request(`chat/threads/${threadId}/transfer-ownership/`, {
            method: 'POST',
            body: JSON.stringify({ participant_id: userId }),
        });
    }


    // ---------------- INSTAGRAM-LIKE CHAT FEATURES ----------------
    reactToMessage(messageId: number, emoji: string) {
        return this.request(`chat/messages/${messageId}/react/`, {
            method: 'POST',
            body: JSON.stringify({ emoji }),
        });
    }

    updateMessage(messageId: number, content: string) {
        return this.request(`chat/messages/${messageId}/update/`, {
            method: 'PATCH',
            body: JSON.stringify({ content }),
        });
    }

    deleteMessage(messageId: number, type: 'me' | 'everyone' = 'me') {
        return this.request(`chat/messages/${messageId}/delete/`, {
            method: 'POST',
            body: JSON.stringify({ type }),
        });
    }

    forwardMessage(messageId: number, threadIds: number[]) {
        return this.request(`chat/messages/${messageId}/forward/`, {
            method: 'POST',
            body: JSON.stringify({ thread_ids: threadIds }),
        });
    }

    pinMessage(messageId: number) {
        return this.request(`chat/messages/${messageId}/pin/`, { method: 'POST' });
    }

    replyToMessage(messageId: number, content: string) {
        return this.request(`chat/messages/${messageId}/reply/`, {
            method: 'POST',
            body: JSON.stringify({ content }),
        });
    }

    sendTypingIndicator(threadId: number) {
        return this.request(`chat/threads/${threadId}/typing/`, { method: 'POST' });
    }

    getTypingUsers(threadId: number) {
        return this.request<{ typing_users: any[] }>(`chat/threads/${threadId}/typing/list/`);
    }

    setDisappearingMessages(threadId: number, duration: number | null) {
        return this.request(`chat/threads/${threadId}/disappearing/`, {
            method: 'POST',
            body: JSON.stringify({ duration }),
        });
    }

    async uploadChatMedia(file: File, messageId?: number) {
        const formData = new FormData();
        formData.append('file', file);
        if (messageId) formData.append('message_id', messageId.toString());
        return this.request<any>('chat/upload/', {
            method: 'POST',
            body: formData,
        });
    }

    async uploadVoiceMessage(audioBlob: Blob, threadId: number) {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'voice.webm');
        formData.append('thread_id', threadId.toString());
        return this.request<any>('chat/voice/', {
            method: 'POST',
            body: formData,
        });
    }

    searchMessages(query: string, threadId?: number) {
        const params = new URLSearchParams({ q: query });
        if (threadId) params.append('thread_id', threadId.toString());
        return this.request<{ results: any[] }>(`chat/search/?${params}`);
    }

    blockUser(userId: string) {
        return this.request(`chat/block/${userId}/`, { method: 'POST' });
    }

    unblockUser(userId: string) {
        return this.request(`chat/unblock/${userId}/`, { method: 'POST' });
    }

    reportMessage(messageId: number, reason: string) {
        return this.request(`chat/messages/${messageId}/report/`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        });
    }

    getLikedPosts() {
        return this.request<any[]>('posts/liked/');
    }

    getCommentedPosts() {
        return this.request<any[]>('posts/commented/');
    }

    // ---------------- NOTIFICATIONS ----------------
    getNotifications() {
        return this.request<any[]>('notifications/');
    }

    markNotificationRead(id: number) {
        return this.request(`notifications/${id}/read/`, { method: 'POST' });
    }

    deleteNotification(id: number) {
        return this.request(`notifications/${id}/delete/`, { method: 'DELETE' });
    }

    getNotificationUnreadCount() {
        return this.request<{ unread_count: number }>('notifications/unread-count/');
    }

    getDefaultAvatars() {
        return this.request<DefaultAvatarsResponse>('profiles/default-avatars/');
    }

    async passwordResetRequest(usernameOrEmail: string) {
        await this.fetchCsrfToken();
        const payload = usernameOrEmail.includes('@') ? { email: usernameOrEmail } : { username: usernameOrEmail };
        return this.request<any>('auth/password-reset/', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    async passwordResetConfirm(data: any) {
        await this.fetchCsrfToken();
        return this.request<any>('auth/password-reset-confirm/', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // ---------------- COLLECTIONS ----------------
    async getCollections() {
        const data = await this.request<any>('collections/');
        return Array.isArray(data) ? data : (data.results || []);
    }

    async getCollectionItems(collectionId: number) {
        const data = await this.request<any>(`collections/${collectionId}/items/`);
        return Array.isArray(data) ? data : (data.results || []);
    }

    async createCollection(name: string) {
        return this.request('collections/', {
            method: 'POST',
            body: JSON.stringify({ name }),
        });
    }

    async updateCollection(id: number, name: string) {
        return this.request(`collections/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify({ name }),
        });
    }

    async deleteCollection(id: number) {
        return this.request(`collections/${id}/`, {
            method: 'DELETE',
        });
    }

    async addToCollection(collectionId: number, postId: number) {
        return this.request(`collections/${collectionId}/add/`, {
            method: 'POST',
            body: JSON.stringify({ post_id: postId }),
        });
    }

    async removeFromCollection(collectionId: number, postId: number) {
        return this.request(`collections/${collectionId}/remove/`, {
            method: 'POST',
            body: JSON.stringify({ post_id: postId }),
        });
    }

    async getBlockedUsers() {
        // Assuming restrictions endpoint returns blocked users
        return this.request<any[]>('chat/restrictions/?type=block');
    }
}

export const apiClient = new ApiClient();