'use client';


import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MessageCircle, MessageSquare, Send, MoreVertical, Search, Paperclip, Smile, Image as ImageIcon, Mic, Check, CheckCheck, X, Ban, Users, Trash2, StopCircle, Plus, Settings, ChevronLeft, ChevronRight, Palette, Crown, Shield, UserMinus, ArrowUp, ArrowDown } from 'lucide-react';
import { chatService, Thread, Message, Participant } from '@/services/chatService';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api';
import Dropdown, { DropdownItem, DropdownDivider, DropdownContext } from '@/components/Dropdown';

export default function ChatInterface() {
    const { user } = useAuth();
    const router = useRouter();
    const [conversations, setConversations] = useState<Thread[]>([]);
    const [selectedChat, setSelectedChat] = useState<Thread | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
    const [threadSearchResults, setThreadSearchResults] = useState<Thread[]>([]);
    const [groupSearchResults, setGroupSearchResults] = useState<any[]>([]); // New state for group search
    const [showMobileChat, setShowMobileChat] = useState(false);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState<number | string | null>(null);
    const [activeMessageId, setActiveMessageId] = useState<number | string | null>(null);
    const [deletedThreadIds, setDeletedThreadIds] = useState<Set<number>>(new Set());

    // Chat Theme State
    const [chatTheme, setChatTheme] = useState('default');
    const chatThemes = {
        default: { bg: 'linear-gradient(135deg, #bfaf8eff 0%, #454443ff 100%)', chatBg: '#fdf2e7ff', name: 'Classic Beige' },
        ocean: { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', chatBg: '#f0f4ff', name: 'Ocean Blue' },
        sunset: { bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', chatBg: '#fff0f3', name: 'Sunset Pink' },
        forest: { bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', chatBg: '#f0fbff', name: 'Forest Green' },
        lavender: { bg: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', chatBg: '#faf5ff', name: 'Lavender Dream' },
        peach: { bg: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', chatBg: '#fff9f5', name: 'Peach Glow' },
        mint: { bg: 'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)', chatBg: '#f5fff9', name: 'Mint Fresh' },
        royal: { bg: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)', chatBg: '#f8f4ff', name: 'Royal Purple' },
        fire: { bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', chatBg: '#fffbf0', name: 'Fire Glow' }
    };

    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Voice Recording State
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);

    const [activeTab, setActiveTab] = useState<'primary' | 'groups'>('primary');
    // Group Modal State
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [groupSearchQuery, setGroupSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedGroupUsers, setSelectedGroupUsers] = useState<any[]>([]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Ref to track deleted threads across stale closures (polling)
    const deletedThreadIdsRef = useRef<Set<number>>(new Set());

    // Followed Users Pagination (for Group Modal)
    const [followedUsers, setFollowedUsers] = useState<any[]>([]);
    const [followedPage, setFollowedPage] = useState(1);
    const followedPerPage = 6;
    const [hoveredConvId, setHoveredConvId] = useState<number | null>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);


    // WebSocket Reference
    const socketRef = useRef<WebSocket | null>(null);

    // Group Settings State
    const [showGroupSettingsModal, setShowGroupSettingsModal] = useState(false);
    const [editingGroupName, setEditingGroupName] = useState('');
    const [addMemberSearchQuery, setAddMemberSearchQuery] = useState('');
    const [addMemberSearchResults, setAddMemberSearchResults] = useState<any[]>([]);

    // Block Confirmation State
    const [showBlockConfirm, setShowBlockConfirm] = useState(false);
    const [userToBlock, setUserToBlock] = useState<{ id: string, username: string } | null>(null);

    // Delete Confirmation State
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [threadToDelete, setThreadToDelete] = useState<number | null>(null);

    // Message Delete Confirmation State
    const [showDeleteMessageConfirm, setShowDeleteMessageConfirm] = useState(false);
    const [messageToDeleteData, setMessageToDeleteData] = useState<{ id: number | string, forEveryone: boolean } | null>(null);

    // Generic Confirmation Dialog State
    const [confirmDialog, setConfirmDialog] = useState<{
        title: string,
        message: string,
        onConfirm: () => void,
        confirmText?: string,
        cancelText?: string,
        type?: 'danger' | 'warning' | 'info' | 'success'
    } | null>(null);

    // Banner Message State
    const [bannerMessage, setBannerMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);

    // Auto-hide banner message
    useEffect(() => {
        if (bannerMessage) {
            const timer = setTimeout(() => {
                setBannerMessage(null);
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [bannerMessage]);

    // URL Params for Direct Messaging
    const searchParams = useSearchParams();
    const userIdParam = searchParams.get('userId');

    // Responsive: Handle window resize
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setShowMobileChat(false);
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Initial Load & URL Param Handling
    useEffect(() => {
        if (user) {
            loadConversations().then(async () => {
                if (userIdParam) {
                    try {
                        console.log('🟢 [CONVERSATIONS] Opening chat from URL param:', {
                            userIdParam,
                            currentUser: user?.id
                        });
                        setLoading(true);
                        const thread = await chatService.getOrCreateThread(userIdParam);
                        console.log('🟢 [CONVERSATIONS] Thread created/retrieved:', {
                            threadId: thread.id,
                            participants: thread.participants.map(p => ({ id: p.id, username: p.user?.username }))
                        });
                        setConversations(prev => {
                            if (prev.some(t => String(t.id) === String(thread.id))) return prev;
                            const uniquePrev = prev.filter(t => String(t.id) !== String(thread.id));
                            return [thread, ...uniquePrev];
                        });
                        setSelectedChat(thread);
                        setShowMobileChat(true); // Show chat on mobile after opening

                        // Clean up URL to prevent re-triggering this effect
                        setTimeout(() => {
                            router.replace('/conversations', { scroll: false });
                        }, 100);

                        console.log('🟢 [CONVERSATIONS] Chat opened successfully');
                    } catch (error: any) {
                        console.error('❌ [CONVERSATIONS] Failed to open chat from URL:', {
                            error: error.message,
                            status: error.status,
                            detail: error.detail
                        });
                        setBannerMessage({ text: `Failed to open chat: ${error.message || 'Unknown error'}`, type: 'error' });
                    } finally {
                        setLoading(false);
                    }
                }
            });
        }
    }, [user, userIdParam, router]);

    // Track selected chat ID separately to prevent unnecessary re-renders
    const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
    const prevChatIdRef = useRef<number | null>(null);
    const selectedChatIdRef = useRef<number | null>(null);

    // Update selectedChatId when selectedChat changes
    useEffect(() => {
        if (selectedChat) {
            setSelectedChatId(selectedChat.id);
            selectedChatIdRef.current = selectedChat.id;
        } else {
            setSelectedChatId(null);
            selectedChatIdRef.current = null;
        }
    }, [selectedChat]);

    // WebSocket & Polling System
    useEffect(() => {
        if (!user) return;

        // Still poll conversation list for new threads (less frequency)
        const convInterval = setInterval(() => loadConversations(true), 5000);

        // WebSocket logic for Messages
        if (selectedChatId !== null) {
            // 1. Initial Load (HTTP)
            const isSwitchingChats = prevChatIdRef.current !== null && prevChatIdRef.current !== selectedChatId;
            if (isSwitchingChats) {
                setMessages([]);
            }
            prevChatIdRef.current = selectedChatId;
            loadMessages(selectedChatId, !isSwitchingChats);

            // 2. Connect WebSocket
            const wsUrl = `ws://localhost:8000/ws/chat/${selectedChatId}/`;
            console.log('[WS] Connecting to:', wsUrl);

            if (socketRef.current) {
                socketRef.current.close();
            }

            const socket = new WebSocket(wsUrl);
            socketRef.current = socket;

            socket.onopen = () => {
                console.log('[WS] Connected');
            };

            socket.onmessage = (e) => {
                const event = JSON.parse(e.data);
                console.log('[WS] Received:', event);

                // Handle 'new_message'
                if (event.type === 'new_message' && event.message) {
                    const newMsg = event.message;
                    setMessages(prev => {
                        // Prevent duplicates (strict string comparison)
                        if (prev.some(m => String(m.id) === String(newMsg.id))) return prev;

                        // Add and sort
                        const updated = [...prev, newMsg];
                        return updated.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                    });
                }
                // Handle 'message_deleted'
                else if (event.type === 'message_deleted' && event.message_id) {
                    const deletedId = event.message_id;
                    setMessages(prev => prev.filter(m => m.id !== deletedId));
                }
                // Handle 'user_typing'
                else if (event.type === 'user_typing') {
                    // Logic for typing indicators if needed
                    // console.log(`User ${event.username} is typing: ${event.is_typing}`);
                }
                // Fallback / Legacy
                else if (event.action === 'new_message' && event.data) {
                    // Handle potential legacy format if any
                    const newMsg = event.data;
                    setMessages(prev => [...prev, newMsg]);
                }
                else {
                    console.log('[WS] Unhandled message type:', event.type);
                }
            };

            socket.onclose = (event) => {
                console.log(`[WS] Disconnected. Code: ${event.code}, Reason: ${event.reason}`);
                if (event.code === 4003) {
                    console.error('Access denied to chat thread.');
                }
            };

            socket.onerror = (err) => {
                // Determine if it's a connection error (often empty object in browser)
                console.error('[WS] Connection Error. Make sure backend is running.', err);
            };
        } else {
            // No chat selected, close socket if open
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
        }

        return () => {
            clearInterval(convInterval);
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
        };
    }, [user, selectedChatId]);

    // Cleanup hover timeout on unmount
    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
            }
        };
    }, []);

    // Load followed users for group modal
    useEffect(() => {
        if (showGroupModal) {
            loadFollowedUsers();
        }
    }, [showGroupModal]);

    const loadFollowedUsers = async () => {
        try {
            const users = await apiClient.getFollowingUsers();
            setFollowedUsers(users || []);
        } catch (error) {
            console.error('Failed to load followed users', error);
        }
    };

    // Group Search (for Group Creation Modal)
    useEffect(() => {
        if (showGroupModal && groupSearchQuery.length > 2) {
            const timeoutId = setTimeout(async () => {
                try {
                    const results = await apiClient.getRecommendedUsers(5, groupSearchQuery);
                    setSearchResults(results.results || []);
                } catch (error) {
                    console.error('Search failed', error);
                }
            }, 300);
            return () => clearTimeout(timeoutId);
        } else {
            setSearchResults([]);
        }
    }, [groupSearchQuery, showGroupModal]);

    // Add Member Search (for Group Settings Modal)
    useEffect(() => {
        if (showGroupSettingsModal && addMemberSearchQuery.length > 2) {
            const timeoutId = setTimeout(async () => {
                try {
                    const results = await apiClient.getRecommendedUsers(10, addMemberSearchQuery);
                    setAddMemberSearchResults(results.results || []);
                } catch (error) {
                    console.error('Add member search failed', error);
                }
            }, 300);
            return () => clearTimeout(timeoutId);
        } else {
            setAddMemberSearchResults([]);
        }
    }, [addMemberSearchQuery, showGroupSettingsModal]);

    // Global User & Thread & Group Search
    useEffect(() => {
        if (searchQuery.length > 1) {
            const timeoutId = setTimeout(async () => {
                try {
                    console.log('🔍 Searching for:', searchQuery);

                    // Parallel search: Users, Threads (Messages), AND Groups (New!)
                    const [userResults, threadResults, groupResults] = await Promise.all([
                        apiClient.getRecommendedUsers(10, searchQuery),
                        apiClient.searchChats(searchQuery),
                        apiClient.searchGroups(searchQuery).catch(() => [])
                    ]);

                    console.log('🔍 Search results:', { userResults, threadResults, groupResults });

                    // CRITICAL: Replace previous thread results (no appending)
                    setThreadSearchResults(threadResults || []);

                    // Set Group Results
                    setGroupSearchResults((groupResults as any[]) || []);

                    // Handle User Results - deduplicate by unique ID
                    const allResults = [
                        ...(userResults.results || []),
                        ...(userResults.matched_by_tags || [])
                    ];

                    // Remove duplicates by ID for users using Map for better performance
                    const uniqueMap = new Map();
                    allResults.forEach(user => {
                        const userId = user.user?.id || user.id;
                        if (userId && !uniqueMap.has(String(userId))) {
                            uniqueMap.set(String(userId), user);
                        }
                    });

                    // CRITICAL: Replace previous user results (no appending)
                    setGlobalSearchResults(Array.from(uniqueMap.values()));
                } catch (error) {
                    console.error('❌ Global search failed:', error);
                    // CRITICAL: Clear results on error
                    setGlobalSearchResults([]);
                    setThreadSearchResults([]);
                    setGroupSearchResults([]);
                }
            }, 300);
            return () => clearTimeout(timeoutId);
        } else {
            // CRITICAL: Clear results when search query is empty
            setGlobalSearchResults([]);
            setThreadSearchResults([]);
            setGroupSearchResults([]);
        }
    }, [searchQuery]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadConversations = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const threads = await chatService.getAllThreads();

            // CRITICAL: Filter out recently deleted threads to prevent resurrection
            // Use REF to avoid stale closures in setInterval
            const filteredThreads = threads.filter(thread => !deletedThreadIdsRef.current.has(Number(thread.id)));

            const uniqueMap = new Map<string, Thread>();

            filteredThreads.forEach(thread => {
                const threadId = String(thread.id);

                // If it's a group, deduplicate by Thread ID strictly
                if (thread.is_group) {
                    // Only keep if not already present (assuming input is sorted or we verify timestamp)
                    // But threads comes from API, which might have duplicates?
                    if (!uniqueMap.has(threadId)) {
                        uniqueMap.set(threadId, thread);
                    }
                } else {
                    // For 1:1, deduplicate by "Other User ID" to prevent "Duplicate Usernames"
                    const other = getOtherParticipant(thread);
                    if (other && other.user && other.user.id) {
                        const userId = String(other.user.id);
                        // We use a composite key for the map to track "user threads" logic
                        // But wait, we want ONE entry per USER in the UI for 1:1 chats
                        // So we should track processing by userID

                        // We need to decide which thread to keep if there are multiple for same user
                        // We'll keep the one already in the map if it's newer, or the current one.
                        // Actually, let's process into a meaningful list.
                    }
                }
            });

            // SIMPLIFIED LOGIC:
            // 1. Group chats: Unique by ID.
            // 2. 1:1 chats: Unique by Other User ID (Keep most recent).

            const processedGroups = new Map<string, Thread>();
            const processedDirects = new Map<string, Thread>();

            filteredThreads.forEach(thread => {
                if (thread.is_group) {
                    // Map by Thread ID
                    if (!processedGroups.has(String(thread.id))) {
                        processedGroups.set(String(thread.id), thread);
                    }
                } else {
                    const other = getOtherParticipant(thread);
                    if (other && other.user && other.user.id) {
                        const userId = String(other.user.id);
                        const existing = processedDirects.get(userId);

                        // If no existing thread for this user, OR this thread is newer
                        if (!existing) {
                            processedDirects.set(userId, thread);
                        } else {
                            const existingTime = new Date(existing.updated_at || existing.created_at).getTime();
                            const currentTime = new Date(thread.updated_at || thread.created_at).getTime();
                            if (currentTime > existingTime) {
                                processedDirects.set(userId, thread);
                            }
                        }
                    } else {
                        // Fallback for weird data (no other participant?)
                        // Just dedupe by thread ID
                        // But likely this is "self chat" or broken
                    }
                }
            });

            const uniqueThreads = [...Array.from(processedDirects.values()), ...Array.from(processedGroups.values())];

            const sortedThreads = uniqueThreads.sort((a, b) =>
                new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
            );

            // Double check for ID uniqueness just in case
            const finalUniqueThreads = sortedThreads.filter((t, index, self) =>
                index === self.findIndex(x => x.id === t.id)
            );

            setConversations(finalUniqueThreads);

            // Sync currently selected chat to get status updates (like block/unblock)
            if (selectedChatIdRef.current) {
                const updated = sortedThreads.find(t => String(t.id) === String(selectedChatIdRef.current));
                if (updated) {
                    setSelectedChat(updated);
                } else {
                    // Thread no longer exists (deleted or hidden) - hard reset
                    setSelectedChat(null);
                    setSelectedChatId(null);
                    selectedChatIdRef.current = null;
                    setMessages([]);
                }
            }
        } catch (error) {
            console.error('Failed to load conversations:', error);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const loadMessages = async (threadId: number, silent = false, beforeId?: number) => {
        // CRITICAL: Don't load messages for deleted threads
        if (deletedThreadIds.has(threadId)) {
            console.log('[LOAD_MESSAGES] ⛔ Skipping - thread', threadId, 'is deleted');
            return;
        }

        // CRITICAL: Don't load if no chat is selected
        if (selectedChatIdRef.current === null) {
            console.log('[LOAD_MESSAGES] ⛔ Skipping - no chat selected');
            return;
        }

        try {
            if (beforeId) setIsLoadingMore(true);
            else if (!silent) setLoading(true);

            const msgs = await chatService.getMessages(threadId, undefined, beforeId);
            if (msgs.length < 50) setHasMore(false);

            // Log shared posts for debugging
            const sharedPostMsgs = msgs.filter(m => m.shared_post);
            if (sharedPostMsgs.length > 0) {
                console.log(`📥 FRONTEND: Received ${sharedPostMsgs.length} messages with shared posts:`, sharedPostMsgs.map(m => ({
                    msgId: m.id,
                    sharedPost: m.shared_post
                })));
            }

            setMessages(prev => {
                const uniqueMsgs = new Map<string, Message>();

                // Prioritize existing messages to keep state stable, BUT new messages might update them (e.g. read status)
                // Actually, new messages from backend are 'truth'.

                // If appending (polling):
                if (silent && !beforeId) {
                    // Add prev
                    prev.forEach(m => uniqueMsgs.set(String(m.id), m));
                    // Add new (overwriting if exists to update status)
                    msgs.forEach(m => uniqueMsgs.set(String(m.id), m));
                }
                // If paginating (history):
                else if (beforeId) {
                    // Add new fetched history
                    msgs.forEach(m => uniqueMsgs.set(String(m.id), m));
                    // Add prev (keeping newer ones)
                    prev.forEach(m => uniqueMsgs.set(String(m.id), m));
                }
                // Full reload
                else {
                    msgs.forEach(m => uniqueMsgs.set(String(m.id), m));
                }

                const allMessages = Array.from(uniqueMsgs.values());

                // Force sort by Date then ID to guarantee order
                return allMessages.sort((a, b) => {
                    const dateA = new Date(a.created_at).getTime();
                    const dateB = new Date(b.created_at).getTime();
                    if (dateA === dateB) {
                        return Number(a.id) - Number(b.id);
                    }
                    return dateA - dateB;
                });
            });
        } catch (error: any) {
            if (error.status === 404 && (error.message === 'Thread not found' || error.detail === 'Thread not found')) {
                // Thread vanished (deleted by other person) - deselect gracefully
                setSelectedChat(null);
            } else {
                console.error('Failed to load messages:', error);
            }
        } finally {
            if (!silent) setLoading(false);
            setIsLoadingMore(false);
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight } = e.currentTarget;
        if (scrollTop === 0 && hasMore && !isLoadingMore && !loading && selectedChat) {
            const oldestMessage = messages[0];
            if (oldestMessage) {
                const currentScrollHeight = scrollHeight;
                loadMessages(selectedChat.id, false, oldestMessage.id as number).then(() => {
                    setTimeout(() => {
                        if (messagesContainerRef.current) {
                            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight - currentScrollHeight;
                        }
                    }, 0);
                });
            }
        }
    };

    const handleSendMessage = async () => {
        if (!messageInput.trim() || !selectedChat) return;

        // Block check for 1:1
        if (!selectedChat.is_group) {
            const other = getOtherParticipant(selectedChat);
            if (other?.is_blocked_by_me || other?.is_blocking_me) {
                setBannerMessage({ text: 'Conversation is frozen', type: 'error' });
                return;
            }
        }

        const content = messageInput;
        setMessageInput('');
        setSending(true);
        try {
            if (editingMessageId) {
                // Edit existing message
                await chatService.updateMessage(Number(editingMessageId), content);
                setEditingMessageId(null);
                loadMessages(selectedChat.id);
            } else {
                // Send new message
                const newMessage = await chatService.sendMessage(selectedChat.id, content);
                setMessages(prev => {
                    // Prevent duplicate if WebSocket already added it
                    if (prev.some(m => String(m.id) === String(newMessage.id))) {
                        return prev;
                    }
                    return [...prev, newMessage];
                });
                scrollToBottom();

                // If currently untrusted or pending, user reply accepts the request
                if (selectedChat.status === 'pending' && selectedChat.initiator?.id !== user?.id) {
                    handleAcceptRequest();
                }
            }
            loadConversations(true);
        } catch (error) {
            console.error('Failed to send/edit message:', error);
            setMessageInput(content);
        } finally {
            setSending(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedChat) return;
        try {
            const message = await chatService.sendMessage(selectedChat.id, 'Sent an attachment');
            await chatService.uploadAttachment(file, Number(message.id));
            loadMessages(selectedChat.id);
        } catch (error) {
            console.error('Failed to upload file:', error);
        }
    };


    const handleBlockUser = async () => {
        if (!selectedChat) return;

        const targetParticipant = selectedChat.is_group
            ? selectedChat.initiator
            : getOtherParticipant(selectedChat);

        if (!targetParticipant?.id) return;

        setUserToBlock({
            id: String(targetParticipant.id),
            username: targetParticipant.user?.username || targetParticipant.username || 'this user'
        });
        setShowBlockConfirm(true);
    };

    const confirmBlock = async () => {
        if (!userToBlock) return;
        const targetId = userToBlock.id;
        const targetUsername = userToBlock.username;

        setShowBlockConfirm(false);
        setUserToBlock(null);

        try {
            // Use profile ID, not user.id
            await chatService.blockUser(targetId);

            // If this was from a pending request, also reject/close the thread
            if (selectedChat && selectedChat.status === 'pending') {
                setSelectedChat(null);
                selectedChatIdRef.current = null;
            }

            setBannerMessage({ text: 'User blocked successfully', type: 'success' });
        } catch (error) {
            console.error('Failed to block user:', error);
            setBannerMessage({ text: 'Failed to block user', type: 'error' });
        }
    };

    const cancelBlock = () => {
        setShowBlockConfirm(false);
        setUserToBlock(null);
    };

    const handleUnblockUser = async () => {
        if (!selectedChat) return;

        const targetParticipant = selectedChat.is_group
            ? selectedChat.initiator
            : getOtherParticipant(selectedChat);

        if (!targetParticipant?.id) return;

        try {
            // Use profile ID, not user.id
            await chatService.unblockUser(String(targetParticipant.id));
            await loadConversations(true);
            setBannerMessage({ text: 'User unblocked successfully', type: 'success' });
        } catch (error) {
            console.error('Failed to unblock user:', error);
            setBannerMessage({ text: 'Failed to unblock user', type: 'error' });
        }
    };

    const handleDeleteThread = async () => {
        console.log('🔴 handleDeleteThread called!', selectedChat?.id);
        if (!selectedChat) {
            console.log('🔴 No selected chat, returning');
            return;
        }
        console.log('🔴 Setting up delete confirmation for ID:', selectedChat.id);
        setThreadToDelete(selectedChat.id);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (threadToDelete === null) return;
        setShowDeleteConfirm(false);
        await handleDeleteThreadById(threadToDelete);
        setThreadToDelete(null);
    };

    const cancelDelete = () => {
        setShowDeleteConfirm(false);
        setThreadToDelete(null);
    };

    const handleDeleteThreadById = async (threadId: number) => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[DELETE] 🗑️  DELETE THREAD INITIATED');
        console.log('[DELETE] Thread ID:', threadId);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        try {
            const isSelectedChat = selectedChatIdRef.current === threadId || selectedChat?.id === threadId;

            // STEP 1: Clear UI state IMMEDIATELY
            if (isSelectedChat) {
                console.log('[DELETE] Clearing selected chat state...');
                setSelectedChat(null);
                selectedChatIdRef.current = null;
                setSelectedChatId(null);
                prevChatIdRef.current = null;
                setMessages([]);
                setMessageInput('');
                setEditingMessageId(null);
                setActiveMessageId(null);
                setShowMobileChat(false);
            }

            // STEP 2: Mark as deleted immediately to prevent polling from restoring it
            console.log('[DELETE] Marking thread as deleted...');
            setDeletedThreadIds(prev => new Set(prev).add(threadId));
            deletedThreadIdsRef.current.add(threadId); // Sync Ref immediately

            // STEP 3: Remove from conversations list IMMEDIATELY
            console.log('[DELETE] Removing from conversations list...');
            setConversations(prev => prev.filter(c => c.id !== threadId));

            // STEP 4: Delete on backend
            console.log('[DELETE] Calling backend API...');
            await chatService.deleteThread(threadId);
            console.log('[DELETE] ✅ Backend delete completed');

            // STEP 5: Verify deletion
            console.log('[DELETE] Verifying deletion...');
            const isDeleted = await chatService.verifyThreadDeleted(threadId);
            if (isDeleted) {
                console.log('[DELETE] ✅ VERIFIED: Thread completely removed from database');
            } else {
                console.error('[DELETE] ⚠️ WARNING: Thread may still exist in database');
            }

            // STEP 6: Keep in deleted set for 30 seconds to prevent resurrection during polling
            setTimeout(() => {
                console.log('[DELETE] Removing from protection set');
                setDeletedThreadIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(threadId);
                    return newSet;
                });
                deletedThreadIdsRef.current.delete(threadId); // Sync Ref
            }, 30000);

            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('[DELETE] ✅ DELETE COMPLETED SUCCESSFULLY');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        } catch (error: any) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.error('[DELETE] ❌ DELETE FAILED');
            console.error('[DELETE] Error:', error);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            // Remove from deleted set since delete failed
            setDeletedThreadIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(threadId);
                return newSet;
            });
            deletedThreadIdsRef.current.delete(threadId); // Sync Ref

            if (error.status === 404) {
                console.log('[DELETE] ✅ Thread was already deleted (404) - Treating as success');
                // Even if 404, we make sure it's gone from UI
                setConversations(prev => prev.filter(c => c.id !== threadId));
                setSelectedChat(null);
            } else {
                setBannerMessage({ text: 'Failed to delete conversation: ' + (error.message || 'Unknown error'), type: 'error' });
                console.log('[DELETE] Reloading conversations to restore state...');
                await loadConversations(true);
            }
        }
    };


    const handleUpdateGroupName = async () => {
        if (!selectedChat || !editingGroupName.trim()) return;
        try {
            await apiClient.request(`chat/threads/${selectedChat.id}/`, {
                method: 'PATCH',
                body: JSON.stringify({ group_name: editingGroupName })
            });
            // Update local state
            setSelectedChat({ ...selectedChat, group_name: editingGroupName });
            setConversations(prev => prev.map(c => c.id === selectedChat.id ? { ...c, group_name: editingGroupName } : c));
            setShowGroupSettingsModal(false);
            setBannerMessage({ text: 'Group name updated successfully!', type: 'success' });
        } catch (error: any) {
            console.error('Failed to update group name:', error);
            const errorMessage = error?.detail || error?.message || 'Failed to update group name';
            setBannerMessage({ text: errorMessage, type: 'error' });
        }
    };

    const handleLeaveGroup = async () => {
        if (!selectedChat) return;
        setConfirmDialog({
            title: 'Leave Group?',
            message: `Are you sure you want to leave ${selectedChat.group_name || 'this group'}?`,
            confirmText: 'Leave',
            type: 'danger',
            onConfirm: async () => {
                try {
                    await chatService.leaveGroup(selectedChat.id);
                    setSelectedChat(null);
                    setMessages([]);
                    loadConversations(true);
                    setShowGroupSettingsModal(false);
                    setBannerMessage({ text: 'You have left the group', type: 'info' });
                } catch (error: any) {
                    console.error('Failed to leave group:', error);
                    const errorMessage = error?.detail || error?.message || 'Failed to leave group';
                    setBannerMessage({ text: errorMessage, type: 'error' });
                }
            }
        });
    };

    const handleDeleteMessage = async (messageId: number | string, forEveryone: boolean) => {
        setMessageToDeleteData({ id: messageId, forEveryone });
        setShowDeleteMessageConfirm(true);
    };

    const confirmMessageDelete = async () => {
        if (!messageToDeleteData || !selectedChat) return;
        const { id: messageId, forEveryone } = messageToDeleteData;
        setShowDeleteMessageConfirm(false);
        setMessageToDeleteData(null);

        try {
            setMessages(prev => prev.filter(m => String(m.id) !== String(messageId)));
            await chatService.deleteMessage(Number(messageId), forEveryone);
            loadMessages(selectedChat.id, true); // Silent reload to sync
            setBannerMessage({ text: 'Message deleted', type: 'success' });
        } catch (error) {
            console.error('Failed to delete message:', error);
            loadMessages(selectedChat.id); // Full reload on error to restore state
            setBannerMessage({ text: 'Failed to delete message', type: 'error' });
        }
    };

    const cancelMessageDelete = () => {
        setShowDeleteMessageConfirm(false);
        setMessageToDeleteData(null);
    };

    const handleAcceptRequest = async () => {
        if (!selectedChat) return;
        console.log('[ChatInterface] Accepting request for thread:', selectedChat.id);

        // Optimistic UI update
        setSelectedChat(prev => prev ? { ...prev, status: 'active' } : null);
        setConversations(prev => prev.map(c => c.id === selectedChat.id ? { ...c, status: 'active' } : c));

        try {
            await chatService.acceptRequest(selectedChat.id);
            console.log('[ChatInterface] Request accepted successfully');
            // Re-load conversations to sync with backend
            await loadConversations(true);
        } catch (error) {
            console.error('Failed to accept request:', error);
            // Rollback if needed (though next poll will fix it)
            setBannerMessage({ text: 'Failed to accept request', type: 'error' });
            await loadConversations(true);
        }
    };

    const handleRejectRequest = async () => {
        if (!selectedChat) return;
        // Immediate action for rejecting request as it's already a choice from a menu
        try {
            await chatService.rejectRequest(selectedChat.id);
            setSelectedChat(null);
            selectedChatIdRef.current = null;
            await loadConversations(true);
        } catch (error) {
            console.error('Failed to reject request:', error);
            setBannerMessage({ text: 'Failed to reject request', type: 'error' });
        }
    };

    // Voice Recording Logic
    const startRecording = async () => {
        if (!selectedChat) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            const chunks: BlobPart[] = [];
            mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                await chatService.uploadVoiceMessage(blob, selectedChat.id);
                loadMessages(selectedChat.id);
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Failed to start recording:', err);
            alert('Could not access microphone');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            const tracks = mediaRecorderRef.current.stream.getTracks();
            tracks.forEach(track => track.stop());
            setIsRecording(false);
        }
    };

    // Group Logic
    // Helper to render message attachments (including voice)
    const renderAttachment = (attachment: any) => {
        if (attachment.file_type === 'voice' || attachment.file_type === 'audio') {
            return (
                <div key={attachment.id} style={{ marginTop: '8px', width: '100%', minWidth: '220px' }}>
                    <audio
                        controls
                        src={apiClient.getMediaUrl(attachment.file_url)}
                        style={{ width: '100%', height: '32px' }}
                    />
                </div>
            );
        }

        if (attachment.file_type === 'image') {
            return (
                <div key={attachment.id} style={{ marginTop: '8px' }}>
                    <img
                        src={apiClient.getMediaUrl(attachment.file_url)}
                        alt="Attachment"
                        style={{ maxWidth: '100%', borderRadius: '12px', cursor: 'pointer' }}
                        onClick={() => window.open(apiClient.getMediaUrl(attachment.file_url), '_blank')}
                    />
                </div>
            );
        }

        return (
            <div key={attachment.id} style={{ marginTop: '8px', padding: '10px', background: 'rgba(0,0,0,0.05)', borderRadius: '8px', fontSize: '13px' }}>
                <a href={apiClient.getMediaUrl(attachment.file_url)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Paperclip size={14} />
                    {attachment.file_name || 'Download Attachment'}
                </a>
            </div>
        );
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim() || selectedGroupUsers.length < 2) {
            alert('Please enter a group name and select at least 2 members');
            return;
        }

        try {
            const userIds = selectedGroupUsers.map(u => u.id);
            // Include current user implicitly handled by backend for group? 
            // Usually current user is automatically added.

            await chatService.createGroup(userIds, groupName);
            setShowGroupModal(false);
            setGroupName('');
            setSelectedGroupUsers([]);
            setActiveTab('groups'); // Switch to groups tab to see new group
            loadConversations();
        } catch (error) {
            console.error('Failed to create group:', error);
            alert('Failed to create group');
        }
    };

    const getOtherParticipant = (thread: Thread) => {
        if (!thread || !user) return null;
        const other = thread.participants.find(p => p.user?.id !== user?.id) || thread.participants[0];
        return other || null;
    };

    const filteredConversations = conversations.filter(conv => {
        // 1. Search Filtering
        if (searchQuery.trim()) {
            if (conv.is_group) {
                // For groups, search by group name
                if (!(conv.group_name || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
            } else {
                // For 1:1, search by other participant's name
                const other = getOtherParticipant(conv);
                const matches = (other?.user?.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (other?.user?.username || '').toLowerCase().includes(searchQuery.toLowerCase());
                if (!matches) return false;
            }
        }

        // 2. Tab Filtering

        // Groups Tab
        if (activeTab === 'groups') {
            return conv.is_group;
        }

        // For Chats (Primary) and Requests, we only allow 1-on-1 chats
        if (conv.is_group) return false;

        const otherUser = getOtherParticipant(conv);

        // Safety Fallback: if no other user, usually assume Chats
        if (!otherUser) return activeTab === 'primary';

        // Check Relationship Status
        // is_following comes from the backend UserProfileSerializer
        const isFollowing = otherUser.is_following === true;

        // Check Engagement (Did I send the last message?)
        // If I sent the last message, I have engaged/replied, so it's active.
        const myUsername = user?.username;
        // Handle potential nested user structure or flat username
        const lastSenderUsername = conv.last_message?.sender?.user?.username || conv.last_message?.sender?.username;
        const didIReply = lastSenderUsername === myUsername;

        // All other 1-on-1 chats go to Primary tab
        return activeTab === 'primary';
    });

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const getMessagePreview = (message?: Message) => {
        if (!message) return 'Start a conversation';

        const isMe = message.sender?.user?.id === user?.id;

        // If not me, user requested "show they sent a message" style
        if (!isMe) {
            if (message.shared_post) return `Sent a shared post`;
            if (message.attachments && message.attachments.length > 0) return `Sent an attachment`;
            return `Sent a message`;
        }

        // For me, show content as usual or "You sent..."
        const prefix = 'You: ';

        if (message.shared_post) {
            return `${prefix}Shared a post`;
        }

        if (message.attachments && message.attachments.length > 0) {
            const first = message.attachments[0];
            if (first.file_type === 'image') return `${prefix}Sent an image`;
            if (first.file_type === 'video') return `${prefix}Sent a video`;
            if (first.file_type === 'voice' || first.file_type === 'audio') return `${prefix}Sent a voice message`;
            return `${prefix}Sent a file`;
        }

        return `${prefix}${message.content || message.client_encrypted_content || '...'}`;
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div style={{
            height: '100vh',
            background: 'linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%)',
            display: 'flex',
            alignItems: 'center', // Center vertically
            justifyContent: 'center',
            padding: showMobileChat ? '0' : '20px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            boxSizing: 'border-box',
            overflow: 'hidden'
        }}>
            <div className="chat-container" style={{
                width: '100%',
                maxWidth: '1400px',
                height: showMobileChat ? '100vh' : 'calc(100vh - 40px)',
                background: 'rgba(255, 255, 255, 0.4)', // More transparent for better glass effect
                borderRadius: showMobileChat ? '0' : '40px',
                boxShadow: '0 50px 100px rgba(0, 0, 0, 0.15)',
                overflow: 'hidden',
                display: 'flex',
                backdropFilter: 'blur(15px)',
                position: 'relative',
                padding: showMobileChat ? '0' : '10px', // Space between edge and panels
                gap: showMobileChat ? '0' : '10px' // Space between sidebar and chat
            }}>
                <div className="sidebar" style={{
                    width: showMobileChat ? '0' : '350px',
                    minWidth: showMobileChat ? '0' : '350px',
                    background: 'linear-gradient(180deg, #F5F1ED 0%, #E8E0D5 100%)',
                    borderRadius: showMobileChat ? '0' : '30px',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflow: 'hidden',
                    opacity: showMobileChat ? 0 : 1,
                    visibility: showMobileChat ? 'hidden' : 'visible',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)'
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '24px',
                        background: 'linear-gradient(135deg, #8B7355 0%, #6B5444 100%)',
                        color: 'white'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h1 style={{
                                fontSize: '28px',
                                fontWeight: '700',
                                margin: 0,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}>
                                <MessageCircle size={32} />
                                Messages
                            </h1>
                            <button
                                onClick={() => setShowGroupModal(true)}
                                style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    border: 'none',
                                    borderRadius: '20px',
                                    padding: '8px 16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    color: 'white',
                                    fontWeight: '600',
                                    fontSize: '13px'
                                }}
                            >
                                <Plus size={18} />

                            </button>
                        </div>

                        {/* Search Bar */}
                        <div style={{
                            position: 'relative',
                            background: 'rgba(255, 255, 255, 0.2)',
                            borderRadius: '12px',
                            overflow: 'hidden'
                        }}>
                            <Search style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'rgba(255, 255, 255, 0.8)'
                            }} size={20} />
                            <input
                                type="text"
                                placeholder="Search conversations..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px 12px 12px 44px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '15px',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    </div>

                    {/* Tab Switcher */}
                    <div style={{ display: 'flex', padding: '0 24px', gap: '20px', borderBottom: '1px solid rgba(139, 115, 85, 0.1)' }}>
                        <button
                            onClick={() => setActiveTab('primary')}
                            style={{
                                padding: '16px 0',
                                background: 'none',
                                border: 'none',
                                borderBottom: activeTab === 'primary' ? '2px solid #8B7355' : '2px solid transparent',
                                color: activeTab === 'primary' ? '#8B7355' : '#aaa',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontSize: '14px'
                            }}
                        >
                            Chats
                        </button>
                        <button
                            onClick={() => setActiveTab('groups')}
                            style={{
                                padding: '16px 0',
                                background: 'none',
                                border: 'none',
                                borderBottom: activeTab === 'groups' ? '2px solid #8B7355' : '2px solid transparent',
                                color: activeTab === 'groups' ? '#8B7355' : '#aaa',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontSize: '14px'
                            }}
                        >
                            Groups
                        </button>
                    </div>

                    {/* Conversation List */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '8px'
                    }}>
                        {/* Thread Search Results (Groups & Existing Chats) */}
                        {threadSearchResults.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ padding: '8px 12px', color: '#8B7355', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
                                    Conversations
                                </div>
                                {threadSearchResults.map((thread) => {
                                    const otherUser = getOtherParticipant(thread);
                                    return (
                                        <div
                                            key={`search-thread-${thread.id}`}
                                            onClick={() => {
                                                setMessages([]);
                                                setSelectedChat(thread);
                                                setSearchQuery('');
                                                setThreadSearchResults([]);
                                                setGlobalSearchResults([]);
                                                setGroupSearchResults([]);
                                                if (window.innerWidth < 768) setShowMobileChat(true);
                                            }}
                                            style={{
                                                padding: '12px 16px',
                                                cursor: 'pointer',
                                                background: '#FFF',
                                                borderRadius: '12px',
                                                marginBottom: '4px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                transition: 'all 0.2s',
                                                border: '1px solid #E8E0D5'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = '#F5F1ED'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = '#FFF'}
                                        >
                                            {/* Avatar logic */}
                                            {thread.is_group ? (
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#8B7355', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                                    <Users size={20} />
                                                </div>
                                            ) : (
                                                <img
                                                    src={apiClient.getAvatarUrl(otherUser)}
                                                    alt={otherUser?.user?.username || 'User'}
                                                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                                                />
                                            )}

                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: '600', color: '#3E2723', fontSize: '14px' }}>
                                                    {thread.is_group ? thread.group_name : (otherUser?.user?.username)}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#8B7355', opacity: 0.8 }}>
                                                    {thread.is_group ? `${thread.participants.length} members` : `@${otherUser?.user?.username}`}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div style={{ height: '1px', background: '#E8E0D5', margin: '12px 0' }} />
                            </div>
                        )}

                        {/* Group Search Results (New!) */}
                        {groupSearchResults.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ padding: '8px 12px', color: '#8B7355', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
                                    Available Groups
                                </div>
                                {groupSearchResults.map((group) => (
                                    <div
                                        key={`search-group-${group.id}`}
                                        onClick={async () => {
                                            try {
                                                console.log('🔗 Rejoining/Joining group:', group.id);
                                                // Call Rejoin/Join endpoint
                                                const updatedGroup = (await apiClient.request(`chat/groups/${group.id}/rejoin/`, {
                                                    method: 'POST'
                                                })) as any;

                                                // Update local interactions
                                                setConversations(prev => {
                                                    // If already exists (shouldn't happen if deleted), update it
                                                    const exists = prev.some(t => t.id === updatedGroup.id);
                                                    if (exists) {
                                                        return prev.map(t => t.id === updatedGroup.id ? updatedGroup : t);
                                                    }
                                                    return [updatedGroup, ...prev];
                                                });

                                                // Clear deleted status if present
                                                setDeletedThreadIds(prev => {
                                                    const newSet = new Set(prev);
                                                    newSet.delete(updatedGroup.id);
                                                    return newSet;
                                                });
                                                deletedThreadIdsRef.current.delete(updatedGroup.id);

                                                setSelectedChat(updatedGroup);
                                                setSearchQuery('');
                                                setGroupSearchResults([]);
                                                setGlobalSearchResults([]);
                                                setThreadSearchResults([]);
                                                if (window.innerWidth < 768) setShowMobileChat(true);
                                            } catch (error) {
                                                console.error('Failed to join group:', error);
                                                alert('Failed to join group.');
                                            }
                                        }}
                                        style={{
                                            padding: '12px 16px',
                                            cursor: 'pointer',
                                            background: '#FFF',
                                            borderRadius: '12px',
                                            marginBottom: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            transition: 'all 0.2s',
                                            border: '1px solid #E8E0D5'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#F5F1ED'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#FFF'}
                                    >
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#E65100', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                            <Users size={20} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '600', color: '#3E2723', fontSize: '14px' }}>
                                                {group.group_name}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#e65100', opacity: 0.9, fontWeight: 500 }}>
                                                {conversations.some(c => c.id === group.id) ? 'tap to rejoin' : 'tap to join'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div style={{ height: '1px', background: '#E8E0D5', margin: '12px 0' }} />
                            </div>
                        )}

                        {/* Global Search Results */}
                        {globalSearchResults.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ padding: '8px 12px', color: '#8B7355', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
                                    Search Results
                                </div>
                                {globalSearchResults.map((searchUser) => (
                                    <div
                                        key={`search-user-${searchUser.user?.id || searchUser.id}`}
                                        onClick={async () => {
                                            // Use user.id if available (from profile object), otherwise use id directly
                                            const userId = searchUser.user?.id || searchUser.id;
                                            try {
                                                console.log('🔗 Opening chat with user ID:', userId, 'Profile:', searchUser);
                                                const thread = await chatService.getOrCreateThread(String(userId));
                                                setConversations(prev => {
                                                    if (prev.some(t => String(t.id) === String(thread.id))) return prev;
                                                    return [thread, ...prev.filter(t => String(t.id) !== String(thread.id))];
                                                });
                                                setSelectedChat(thread);
                                                setSearchQuery('');
                                                setGlobalSearchResults([]);
                                                if (window.innerWidth < 768) setShowMobileChat(true);
                                            } catch (error: any) {
                                                console.error('Failed to open chat:', error);
                                                if (error.status === 404) {
                                                    alert('This user no longer exists.');
                                                    // Proactively remove the ghost user from results
                                                    setGlobalSearchResults(prev => prev.filter(u => {
                                                        const uId = u.user?.id || u.id;
                                                        return String(uId) !== String(userId);
                                                    }));
                                                } else if (error.status === 403) {
                                                    alert('Messaging restricted: You have blocked this user or been blocked.');
                                                } else {
                                                    alert('Failed to start conversation. Please try again later.');
                                                }
                                            }
                                        }}
                                        style={{
                                            padding: '12px 16px',
                                            cursor: 'pointer',
                                            background: '#FFF',
                                            borderRadius: '12px',
                                            marginBottom: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            transition: 'all 0.2s',
                                            border: '1px solid #E8E0D5'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#F5F1ED'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#FFF'}
                                    >
                                        <img
                                            src={apiClient.getAvatarUrl(searchUser)}
                                            alt={searchUser.user?.username || searchUser.username}
                                            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                                        />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ fontWeight: '600', color: '#3E2723', fontSize: '14px' }}>
                                                    {searchUser.user?.username || searchUser.username}
                                                </div>
                                                {(searchUser.is_blocked_by_me || searchUser.is_blocked) && (
                                                    <span style={{
                                                        background: '#FEF2F2',
                                                        color: '#B91C1C',
                                                        fontSize: '10px',
                                                        padding: '2px 6px',
                                                        borderRadius: '10px',
                                                        fontWeight: '700',
                                                        border: '1px solid #FCA5A5'
                                                    }}>
                                                        BLOCKED
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#8B7355', opacity: 0.8 }}>
                                                @{searchUser.user?.username || searchUser.username}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div style={{ height: '1px', background: '#E8E0D5', margin: '12px 0' }} />
                            </div>
                        )}

                        {loading && conversations.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', color: '#8B7355', opacity: 0.6 }}>
                                <div className="spinner" style={{
                                    width: '30px',
                                    height: '30px',
                                    border: '3px solid rgba(139, 115, 85, 0.1)',
                                    borderTop: '3px solid #8B7355',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite',
                                    marginBottom: '12px'
                                }} />
                                <span>Loading your chats...</span>
                            </div>
                        ) : filteredConversations.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8B7355', opacity: 0.6 }}>
                                <MessageCircle size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                                <p style={{ fontSize: '15px', fontWeight: '500', margin: 0 }}>
                                    {conversations.length === 0 ? 'No conversations yet' : 'No conversations found'}
                                </p>
                                <p style={{ fontSize: '13px', marginTop: '4px' }}>
                                    {conversations.length === 0
                                        ? 'Search for users above to start your first conversation!'
                                        : 'Try searching for a user or start a new chat!'}
                                </p>
                            </div>
                        ) : (
                            filteredConversations.map((conv) => {
                                const otherUser = getOtherParticipant(conv);
                                const isActive = selectedChat?.id === conv.id;

                                return (
                                    <div
                                        key={`conversation-${conv.id}`}
                                        onClick={() => {
                                            if (selectedChat?.id !== conv.id) {
                                                // setMessages([]); // Clear immediately to prevent stale data
                                                setLoading(true);
                                                setSelectedChat(conv);
                                                selectedChatIdRef.current = conv.id;
                                                setShowMobileChat(true);
                                            }
                                        }}
                                        style={{
                                            padding: '16px',
                                            margin: '4px 0',
                                            borderRadius: '16px',
                                            cursor: 'pointer',
                                            background: isActive
                                                ? 'linear-gradient(135deg, rgba(139, 115, 85, 0.15) 0%, rgba(107, 84, 68, 0.15) 100%)'
                                                : 'transparent',
                                            border: isActive
                                                ? '2px solid rgba(139, 115, 85, 0.3)'
                                                : '2px solid transparent',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            position: 'relative',
                                            opacity: conv.status === 'blocked' ? 0.6 : 1,
                                            filter: conv.status === 'blocked' ? 'grayscale(0.4)' : 'none'
                                        }}
                                        onMouseEnter={(e) => {
                                            // Clear any existing timeout
                                            if (hoverTimeoutRef.current) {
                                                clearTimeout(hoverTimeoutRef.current);
                                                hoverTimeoutRef.current = null;
                                            }
                                            setHoveredConvId(conv.id);
                                            if (!isActive) {
                                                e.currentTarget.style.background = 'rgba(139, 115, 85, 0.05)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            // Capture the element reference before the timeout
                                            const element = e.currentTarget;
                                            // Add a small delay to prevent the button from disappearing before click fires
                                            hoverTimeoutRef.current = setTimeout(() => {
                                                setHoveredConvId(null);
                                                if (!isActive && element) {
                                                    element.style.background = 'transparent';
                                                }
                                                hoverTimeoutRef.current = null;
                                            }, 100);
                                        }}
                                    >
                                        <div style={{ position: 'relative', flexShrink: 0 }}>
                                            {conv.is_group ? (
                                                <div style={{
                                                    width: '56px',
                                                    height: '56px',
                                                    borderRadius: '50%',
                                                    background: 'linear-gradient(135deg, #8B7355 0%, #6B5444 100%)',
                                                    color: 'white',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '24px',
                                                    fontWeight: '700',
                                                    border: '3px solid white',
                                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                                                }}>
                                                    {(conv.group_name || 'G')[0].toUpperCase()}
                                                </div>
                                            ) : (
                                                <img
                                                    src={apiClient.getAvatarUrl(otherUser)}
                                                    alt={otherUser?.user?.username || 'User'}
                                                    style={{
                                                        width: '56px',
                                                        height: '56px',
                                                        borderRadius: '50%',
                                                        objectFit: 'cover',
                                                        border: '3px solid white',
                                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                                                    }}
                                                />
                                            )}
                                        </div>



                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: '4px'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <h3 style={{
                                                        fontSize: '16px',
                                                        fontWeight: '700',
                                                        color: '#3E2723',
                                                        margin: 0,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {conv.is_group ? conv.group_name : (otherUser?.user?.username || 'User')}
                                                    </h3>
                                                    {(conv.status === 'blocked' || otherUser?.is_blocked_by_me || otherUser?.is_blocking_me) && (
                                                        <span style={{
                                                            fontSize: '10px',
                                                            background: '#FEE2E2',
                                                            color: '#B91C1C',
                                                            padding: '2px 8px',
                                                            borderRadius: '12px',
                                                            fontWeight: '700',
                                                            border: '1px solid rgba(185, 28, 28, 0.2)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}>
                                                            <Ban size={10} />
                                                            Blocked
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <p style={{
                                                fontSize: '14px',
                                                color: isActive ? '#3E2723' : '#6B5444',
                                                margin: 0,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                fontWeight: (conv.unread_count || 0) > 0 ? '700' : '400',
                                                opacity: (conv.unread_count || 0) > 0 ? 1 : 0.8
                                            }}>
                                                {getMessagePreview(conv.last_message)}
                                            </p>
                                        </div>

                                        <div style={{
                                            background: 'linear-gradient(135deg, #8B7355 0%, #6B5444 100%)',
                                            color: 'white',
                                            fontSize: '12px',
                                            fontWeight: '700',

                                            display: 'none' // Hidden as requested "dont show message count"
                                        }}>
                                            {conv.unread_count}
                                        </div>


                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Side - Active Chat */}
                <div className="chat-right-panel" style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'white',
                    width: showMobileChat ? '100%' : 'auto',
                    minWidth: 0,
                    overflow: 'hidden',
                    borderRadius: showMobileChat ? '0' : '30px',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                    {selectedChat ? (
                        (() => {
                            const otherParticipant = getOtherParticipant(selectedChat);
                            const isBlocked = selectedChat.status === 'blocked' ||
                                otherParticipant?.is_blocked_by_me ||
                                otherParticipant?.is_blocking_me;

                            return (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    height: '100%',
                                    position: 'relative',
                                    filter: isBlocked ? 'grayscale(0.2)' : 'none',
                                }}>
                                    {/* Chat Header */}
                                    <div className="chat-header" style={{
                                        width: '100%',
                                        padding: '20px 24px',
                                        borderBottom: '1px solid #E8E0D5',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        background: 'white',
                                        position: 'relative',
                                        zIndex: 100
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            {showMobileChat && (
                                                <button
                                                    onClick={() => setShowMobileChat(false)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        padding: '8px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        color: '#6B5444'
                                                    }}
                                                >
                                                    <X size={24} />
                                                </button>
                                            )}
                                            <div style={{ position: 'relative' }}>
                                                {selectedChat.is_group ? (
                                                    <div style={{
                                                        width: '48px',
                                                        height: '48px',
                                                        borderRadius: '50%',
                                                        background: 'linear-gradient(135deg, #8B7355 0%, #6B5444 100%)',
                                                        color: 'white',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '20px',
                                                        fontWeight: '700',
                                                        border: '2px solid #E8E0D5',
                                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                                                    }}>
                                                        {(selectedChat.group_name || 'G')[0].toUpperCase()}
                                                    </div>
                                                ) : (
                                                    <img
                                                        src={apiClient.getAvatarUrl(getOtherParticipant(selectedChat))}
                                                        alt="User"
                                                        style={{
                                                            width: '48px',
                                                            height: '48px',
                                                            borderRadius: '50%',
                                                            objectFit: 'cover',
                                                            border: '2px solid #E8E0D5'
                                                        }}
                                                    />
                                                )}
                                            </div>
                                            <div>
                                                <h2 style={{
                                                    fontSize: '18px',
                                                    fontWeight: '600',
                                                    color: '#3E2723',
                                                    margin: '0 0 4px 0'
                                                }}>
                                                    {selectedChat.is_group
                                                        ? (selectedChat.group_name || 'Group Chat')
                                                        : (getOtherParticipant(selectedChat)?.user?.username || 'User')
                                                    }
                                                </h2>
                                                {selectedChat.is_group && (
                                                    <p style={{ fontSize: '12px', color: '#8B7355', margin: 0 }}>
                                                        {selectedChat.participants.length} members
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            <Dropdown
                                                align="right"
                                                trigger={
                                                    <button
                                                        style={{
                                                            background: '#F5F1ED',
                                                            border: 'none',
                                                            borderRadius: '12px',
                                                            padding: '10px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.2s ease',
                                                            color: '#6B5444'
                                                        }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = '#E8E0D5' }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = '#F5F1ED' }}
                                                    >
                                                        <MoreVertical size={20} />
                                                    </button>
                                                }
                                            >
                                                <div style={{ padding: '12px', borderBottom: '1px solid #E8E0D5', marginBottom: '8px', minWidth: '220px' }}>
                                                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#8B7355', marginBottom: '8px', letterSpacing: '0.05em' }}>CHAT THEME</div>
                                                    <DropdownContext.Consumer>
                                                        {(dropdown) => (
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                                                                {Object.entries(chatThemes).map(([id, theme]) => (
                                                                    <button
                                                                        key={id}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setChatTheme(id);
                                                                            // Close the dropdown after selection
                                                                            dropdown?.closeDropdown();
                                                                        }}
                                                                        title={theme.name}
                                                                        style={{
                                                                            width: '100%',
                                                                            aspectRatio: '1',
                                                                            background: theme.bg,
                                                                            border: chatTheme === id ? '2px solid #8B7355' : '1px solid #E8E0D5',
                                                                            borderRadius: '6px',
                                                                            cursor: 'pointer',
                                                                            transition: 'transform 0.15s',
                                                                            boxShadow: chatTheme === id ? '0 0 0 2px rgba(139, 115, 85, 0.2)' : 'none'
                                                                        }}
                                                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                                                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </DropdownContext.Consumer>
                                                </div>

                                                {selectedChat.is_group && (
                                                    <DropdownItem
                                                        icon={<Settings size={16} />}
                                                        onClick={() => {
                                                            setEditingGroupName(selectedChat.group_name || '');
                                                            setShowGroupSettingsModal(true);
                                                        }}
                                                    >
                                                        Group Settings
                                                    </DropdownItem>
                                                )}

                                                {!selectedChat.is_group && (
                                                    <DropdownItem
                                                        icon={selectedChat.status === 'blocked' ? <Check size={16} /> : <Ban size={16} />}
                                                        onClick={() => {
                                                            if (selectedChat.status === 'blocked' && String(selectedChat.blocked_by_id) === String(user?.id)) {
                                                                handleUnblockUser();
                                                            } else if (selectedChat.status !== 'blocked') {
                                                                handleBlockUser();
                                                            }
                                                        }}
                                                        variant={selectedChat.status === 'blocked' ? 'default' : 'danger'}
                                                        disabled={selectedChat.status === 'blocked' && String(selectedChat.blocked_by_id) !== String(user?.id)}
                                                    >
                                                        {selectedChat.status === 'blocked'
                                                            ? (String(selectedChat.blocked_by_id) === String(user?.id) ? 'Unblock User' : 'User Blocked')
                                                            : 'Block User'}
                                                    </DropdownItem>
                                                )}

                                                <DropdownDivider />

                                                <DropdownItem
                                                    icon={<Trash2 size={16} />}
                                                    onClick={() => {
                                                        handleDeleteThread();
                                                    }}
                                                    variant="danger"
                                                >
                                                    Delete Conversation
                                                </DropdownItem>
                                            </Dropdown>
                                        </div>
                                    </div>
                                    <div
                                        className="chat-messages-area"
                                        ref={messagesContainerRef}
                                        onScroll={handleScroll}
                                        style={{
                                            flex: 1,
                                            overflowY: 'auto',
                                            overflowX: 'visible',
                                            padding: '24px 24px 80px 24px',
                                            background: chatThemes[chatTheme as keyof typeof chatThemes]?.chatBg || '#FDFCFB',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '2px',
                                            position: 'relative',
                                            pointerEvents: isBlocked ? 'none' : 'auto',
                                            userSelect: isBlocked ? 'none' : 'auto'
                                        }}
                                    >
                                        {messages.map((message, index) => {
                                            const isMe = message.sender?.user?.id === user?.id;
                                            const prevMessage = messages[index - 1];
                                            const nextMessage = messages[index + 1];

                                            const isSequence = prevMessage && prevMessage.sender?.user?.id === message.sender?.user?.id;
                                            const nextIsSequence = nextMessage && nextMessage.sender?.user?.id === message.sender?.user?.id;

                                            const showAvatar = !isMe && !nextIsSequence;

                                            let borderRadius = '';
                                            if (isMe) {
                                                borderRadius = `20px ${isSequence ? '4px' : '20px'} ${nextIsSequence ? '4px' : '20px'} 20px`;
                                            } else {
                                                borderRadius = `${isSequence ? '4px' : '20px'} 20px 20px ${nextIsSequence ? '4px' : '20px'}`;
                                            }

                                            return (
                                                <div
                                                    key={`message-${message.id}`}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: isMe ? 'flex-end' : 'flex-start',
                                                        animation: 'slideIn 0.3s ease',
                                                        marginTop: isSequence ? '2px' : '16px',
                                                        alignItems: 'flex-end',
                                                        padding: isMe ? '0 0 0 40px' : '0 40px 0 0'
                                                    }}
                                                    onMouseEnter={() => setActiveMessageId(message.id)}
                                                    onMouseLeave={() => setActiveMessageId(null)}
                                                >
                                                    {/* Blocked User Message Placeholder */}
                                                    {(message.sender?.is_blocked || message.sender?.is_blocked_by_me || message.sender?.is_blocking_me) ? (
                                                        <div style={{
                                                            padding: '10px 16px',
                                                            background: '#F3F4F6',
                                                            borderRadius: '12px',
                                                            color: '#9CA3AF',
                                                            fontSize: '13px',
                                                            fontStyle: 'italic',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            userSelect: 'none'
                                                        }}>
                                                            <Ban size={14} />
                                                            Blocked user message
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {!isMe && (
                                                                <div style={{ width: '32px', marginRight: '8px', flexShrink: 0 }}>
                                                                    {showAvatar ? (
                                                                        <img
                                                                            src={apiClient.getAvatarUrl(message.sender)}
                                                                            alt={message.sender?.user?.username || 'User'}
                                                                            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                                                                        />
                                                                    ) : null}
                                                                </div>
                                                            )}

                                                            {/* Message wrapper with reserved space for menu - Positioned based on sender */}
                                                            <div style={{
                                                                position: 'relative',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                paddingLeft: isMe ? '0' : '48px',
                                                                paddingRight: isMe ? '48px' : '0',
                                                                overflow: 'visible',
                                                                maxWidth: '85%'
                                                            }}>
                                                                {/* Menu Button - Absolutely Positioned */}
                                                                {(activeMessageId === message.id) && (
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        left: isMe ? 'auto' : '8px',
                                                                        right: isMe ? '8px' : 'auto',
                                                                        top: '50%',
                                                                        transform: 'translateY(-50%)',
                                                                        zIndex: 9999
                                                                    }}>
                                                                        <Dropdown
                                                                            align={isMe ? "right" : "left"}
                                                                            trigger={
                                                                                <button
                                                                                    style={{
                                                                                        background: 'white',
                                                                                        border: '1px solid #E8E0D5',
                                                                                        borderRadius: '50%',
                                                                                        cursor: 'pointer',
                                                                                        color: '#6B5444',
                                                                                        width: '32px',
                                                                                        height: '32px',
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        justifyContent: 'center',
                                                                                        boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
                                                                                        transition: 'all 0.2s ease'
                                                                                    }}
                                                                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                                                                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                                                >
                                                                                    <MoreVertical size={16} />
                                                                                </button>
                                                                            }
                                                                        >
                                                                            {isMe && (
                                                                                <DropdownItem
                                                                                    onClick={(e) => {
                                                                                        e.preventDefault();
                                                                                        e.stopPropagation();
                                                                                        setMessageInput(message.content || '');
                                                                                        setEditingMessageId(message.id);
                                                                                    }}
                                                                                >
                                                                                    Edit
                                                                                </DropdownItem>
                                                                            )}
                                                                            {isMe && (
                                                                                <DropdownItem
                                                                                    onClick={(e) => {
                                                                                        e.preventDefault();
                                                                                        e.stopPropagation();
                                                                                        handleDeleteMessage(message.id, true);
                                                                                    }}
                                                                                    variant="danger"
                                                                                >
                                                                                    Delete for everyone
                                                                                </DropdownItem>
                                                                            )}
                                                                            <DropdownItem
                                                                                onClick={(e) => {
                                                                                    e.preventDefault();
                                                                                    e.stopPropagation();
                                                                                    handleDeleteMessage(message.id, false);
                                                                                }}
                                                                            >
                                                                                Delete for me
                                                                            </DropdownItem>
                                                                        </Dropdown>
                                                                    </div>
                                                                )}

                                                                {/* Message Content */}
                                                                <div style={{
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    gap: '4px',
                                                                    alignItems: isMe ? 'flex-end' : 'flex-start',
                                                                    flex: 1
                                                                }}>

                                                                    <div style={{
                                                                        padding: '12px 18px',
                                                                        borderRadius: '18px',
                                                                        background: isMe
                                                                            ? (chatThemes[chatTheme as keyof typeof chatThemes]?.bg || chatThemes.default.bg)
                                                                            : '#F5F1ED',
                                                                        color: isMe ? 'white' : '#3E2723',
                                                                        boxShadow: '0 3px 12px rgba(0, 0, 0, 0.08)',
                                                                        fontSize: '15px',
                                                                        lineHeight: '1.5',
                                                                        wordWrap: 'break-word',
                                                                        whiteSpace: 'pre-wrap',
                                                                        position: 'relative',
                                                                        transition: 'all 0.3s ease',
                                                                        maxWidth: '100%'
                                                                    }}>
                                                                        {selectedChat.is_group && !isMe && !isSequence && (
                                                                            <div style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', opacity: 0.8, color: '#8B7355' }}>
                                                                                {message.sender?.user?.username || 'Unknown'}
                                                                            </div>
                                                                        )}

                                                                        {(() => {
                                                                            const hasSharedPost = !!message.shared_post;
                                                                            const content = message.content || message.client_encrypted_content || '';
                                                                            const sharedPostContent = message.shared_post?.content || message.shared_post?.caption || '';

                                                                            if (hasSharedPost && (
                                                                                content === 'Shared a post' ||
                                                                                content === sharedPostContent ||
                                                                                !content.trim()
                                                                            )) {
                                                                                return null;
                                                                            }

                                                                            return content;
                                                                        })()}

                                                                        {message.shared_post && (
                                                                            <div
                                                                                style={{
                                                                                    marginTop: '8px',
                                                                                    background: isMe ? 'rgba(255, 255, 255, 0.15)' : 'white',
                                                                                    borderRadius: '12px',
                                                                                    overflow: 'hidden',
                                                                                    border: isMe ? '1px solid rgba(255,255,255,0.3)' : '1px solid #E8E0D5',
                                                                                    opacity: 1,
                                                                                    minWidth: '220px',
                                                                                    maxWidth: '100%',
                                                                                    cursor: 'pointer',
                                                                                    transition: 'transform 0.2s',
                                                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                                                                                }}
                                                                                onClick={(e) => {
                                                                                    e.preventDefault();
                                                                                    e.stopPropagation();
                                                                                    const authorUsername = message.shared_post.author?.user?.username || message.shared_post.author?.username || 'user';
                                                                                    console.log('Navigating to post:', authorUsername, message.shared_post.id);
                                                                                    router.push(`/${authorUsername}/post/${message.shared_post.id}`);
                                                                                }}
                                                                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                                                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                                                            >
                                                                                {message.shared_post.image && (
                                                                                    <img
                                                                                        src={apiClient.getMediaUrl(message.shared_post.image)}
                                                                                        alt="Post"
                                                                                        style={{ width: '100%', height: '160px', objectFit: 'cover' }}
                                                                                    />
                                                                                )}
                                                                                <div style={{ padding: '10px' }}>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                                                        <img
                                                                                            src={apiClient.getAvatarUrl(message.shared_post.author)}
                                                                                            style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #E8E0D5' }}
                                                                                        />
                                                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                                            <span style={{ fontWeight: '700', fontSize: '12px', color: isMe ? 'white' : '#3E2723' }}>
                                                                                                {message.shared_post.author?.user?.username || 'Unknown'}
                                                                                            </span>
                                                                                            <span style={{ fontSize: '10px', opacity: 0.8, color: isMe ? 'white' : '#8B7355' }}>
                                                                                                @{message.shared_post.author?.user?.username || message.shared_post.author?.username || 'user'}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <p style={{
                                                                                        margin: 0,
                                                                                        fontSize: '12px',
                                                                                        display: '-webkit-box',
                                                                                        WebkitLineClamp: 3,
                                                                                        WebkitBoxOrient: 'vertical',
                                                                                        overflow: 'hidden',
                                                                                        lineHeight: '1.4',
                                                                                        color: isMe ? 'rgba(255,255,255,0.9)' : '#5D4037'
                                                                                    }}>
                                                                                        {message.shared_post.content || message.shared_post.caption}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {message.attachments && message.attachments.length > 0 && (
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                                {message.attachments.map(att => (
                                                                                    <React.Fragment key={att.id}>
                                                                                        {renderAttachment(att)}
                                                                                    </React.Fragment>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {!nextIsSequence && isMe && (
                                                                        <div style={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            fontSize: '11px',
                                                                            color: '#8B7355',
                                                                            marginTop: '2px',
                                                                            padding: '0 4px'
                                                                        }}>
                                                                            {message.read ? <CheckCheck size={14} /> : <Check size={14} />}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        <div style={{ minHeight: '20px' }} />
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Request Actions or Input */}
                                    {
                                        (() => {
                                            if (isBlocked) {
                                                const blockedByMe = otherParticipant?.is_blocked_by_me || (selectedChat.status === 'blocked' && String(selectedChat.blocked_by_id) === String(user?.id));
                                                return (
                                                    <div style={{
                                                        padding: '20px',
                                                        background: '#FEF2F2',
                                                        borderTop: '1px solid #FCA5A5',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '12px'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B91C1C', fontWeight: '600' }}>
                                                            <Ban size={20} />
                                                            <span>
                                                                {blockedByMe ? 'You have blocked this user' : 'You have been blocked by this user'}
                                                            </span>
                                                        </div>

                                                        {blockedByMe && (
                                                            <button
                                                                onClick={handleUnblockUser}
                                                                style={{
                                                                    padding: '8px 24px',
                                                                    borderRadius: '20px',
                                                                    background: '#B91C1C',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    fontWeight: '600',
                                                                    cursor: 'pointer',
                                                                    fontSize: '14px',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                            >
                                                                Unblock to interact
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            const isPending = selectedChat.status === 'pending' && selectedChat.initiator?.id !== user?.id;
                                            const isUntrusted = selectedChat && !selectedChat.is_group &&
                                                selectedChat.status !== 'active' &&
                                                otherParticipant && !otherParticipant.is_following &&
                                                selectedChat.initiator?.id !== user?.id &&
                                                selectedChat.last_message?.sender?.id !== user?.id;

                                            if (isPending || isUntrusted) {
                                                return (
                                                    <div style={{
                                                        padding: '24px',
                                                        borderTop: '1px solid #E8E0D5',
                                                        background: 'white',
                                                        textAlign: 'center'
                                                    }}>
                                                        <h3 style={{ margin: '0 0 8px 0', color: '#3E2723' }}>
                                                            {selectedChat.is_group ? 'Join Group?' : 'Accept Message Request?'}
                                                        </h3>
                                                        <p style={{ margin: '0 0 16px 0', color: '#6B5444', fontSize: '14px' }}>
                                                            {selectedChat.is_group
                                                                ? 'You have been invited to this group.'
                                                                : 'Accept only if you know this person. They won\'t know if you\'ve seen this.'
                                                            }
                                                        </p>
                                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                                                            <button
                                                                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                                onClick={selectedChat.is_group ? handleRejectRequest : handleBlockUser}
                                                                style={{
                                                                    padding: '10px 24px',
                                                                    borderRadius: '24px',
                                                                    border: '1px solid #d32f2f',
                                                                    background: 'transparent',
                                                                    color: '#d32f2f',
                                                                    fontWeight: '600',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                {selectedChat.is_group ? 'Decline' : 'Block'}
                                                            </button>
                                                            {selectedChat.is_group && (
                                                                <button
                                                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                                    onClick={handleBlockUser}
                                                                    style={{
                                                                        padding: '10px 24px',
                                                                        borderRadius: '24px',
                                                                        border: '1px solid #d32f2f',
                                                                        background: 'transparent',
                                                                        color: '#d32f2f',
                                                                        fontWeight: '600',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    Block Sender
                                                                </button>
                                                            )}
                                                            <button
                                                                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                                onClick={handleAcceptRequest}
                                                                style={{
                                                                    padding: '10px 24px',
                                                                    borderRadius: '24px',
                                                                    border: 'none',
                                                                    background: 'linear-gradient(135deg, #8B7355 0%, #6B5444 100%)',
                                                                    color: 'white',
                                                                    fontWeight: '600',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                {selectedChat.is_group ? 'Join' : 'Accept'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()
                                        || (
                                            <div className="chat-input-area" style={{
                                                padding: '20px 24px',
                                                borderTop: '1px solid #E8E0D5',
                                                background: 'white'
                                            }}>
                                                {/* Editing Indicator */}
                                                {editingMessageId && (
                                                    <div style={{
                                                        padding: '8px 12px',
                                                        background: '#FFF9E6',
                                                        borderLeft: '3px solid #8B7355',
                                                        borderRadius: '4px',
                                                        marginBottom: '12px',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center'
                                                    }}>
                                                        <span style={{ fontSize: '13px', color: '#8B7355', fontWeight: '600' }}>
                                                            ✏️ Editing message
                                                        </span>
                                                        <button
                                                            onClick={() => {
                                                                setEditingMessageId(null);
                                                                setMessageInput('');
                                                            }}
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                color: '#8B7355',
                                                                fontSize: '12px',
                                                                fontWeight: '600'
                                                            }}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                )}
                                                <div className="message-input-wrapper" style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-end',
                                                    gap: '12px',
                                                    background: '#F5F1ED',
                                                    borderRadius: '24px',
                                                    padding: (selectedChat && !selectedChat.is_group && (getOtherParticipant(selectedChat)?.is_blocked_by_me || getOtherParticipant(selectedChat)?.is_blocking_me)) ? '16px 24px' : '8px 8px 8px 16px',
                                                    border: '2px solid transparent',
                                                    transition: 'all 0.3s ease',
                                                    justifyContent: (selectedChat && !selectedChat.is_group && (getOtherParticipant(selectedChat)?.is_blocked_by_me || getOtherParticipant(selectedChat)?.is_blocking_me)) ? 'center' : 'flex-start'
                                                }}>
                                                    {selectedChat && !selectedChat.is_group && (getOtherParticipant(selectedChat)?.is_blocked_by_me || getOtherParticipant(selectedChat)?.is_blocking_me) ? (
                                                        <div style={{ color: '#d32f2f', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <Ban size={18} />
                                                            {getOtherParticipant(selectedChat)?.is_blocking_me ? 'You have been blocked by this user' : 'You have blocked this user'}
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <input
                                                                type="file"
                                                                ref={fileInputRef}
                                                                style={{ display: 'none' }}
                                                                onChange={handleFileUpload}
                                                            />

                                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                                <button
                                                                    onClick={() => fileInputRef.current?.click()}
                                                                    title="Attach File"
                                                                    style={{
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        cursor: 'pointer',
                                                                        padding: '8px',
                                                                        color: '#6B5444',
                                                                        display: 'flex',
                                                                        alignItems: 'center'
                                                                    }}
                                                                >
                                                                    <Paperclip size={20} />
                                                                </button>
                                                                <button
                                                                    title="Send Image"
                                                                    onClick={() => fileInputRef.current?.click()}
                                                                    style={{
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        cursor: 'pointer',
                                                                        padding: '8px',
                                                                        color: '#6B5444',
                                                                        display: 'flex',
                                                                        alignItems: 'center'
                                                                    }}
                                                                >
                                                                    <ImageIcon size={20} />
                                                                </button>
                                                            </div>

                                                            <textarea
                                                                className="message-input-textarea"
                                                                value={messageInput}
                                                                onChange={(e) => setMessageInput(e.target.value)}
                                                                onKeyDown={handleKeyPress}
                                                                placeholder="Type a message..."
                                                                style={{
                                                                    flex: 1,
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    resize: 'none',
                                                                    padding: '10px 0',
                                                                    maxHeight: '100px',
                                                                    outline: 'none',
                                                                    color: '#3E2723',
                                                                    fontSize: '15px',
                                                                    lineHeight: '1.5',
                                                                    fontFamily: 'inherit'
                                                                }}
                                                                rows={1}
                                                            />

                                                            {messageInput.trim() || isRecording ? (
                                                                <button
                                                                    onClick={handleSendMessage}
                                                                    disabled={sending}
                                                                    style={{
                                                                        background: '#8B7355',
                                                                        border: 'none',
                                                                        borderRadius: '50%',
                                                                        width: '40px',
                                                                        height: '40px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        cursor: 'pointer',
                                                                        color: 'white',
                                                                        transition: 'all 0.2s',
                                                                        opacity: sending ? 0.7 : 1
                                                                    }}
                                                                >
                                                                    <Send size={18} />
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onMouseDown={startRecording}
                                                                    onMouseUp={stopRecording}
                                                                    onMouseLeave={stopRecording}
                                                                    style={{
                                                                        background: isRecording ? '#d32f2f' : 'transparent',
                                                                        border: 'none',
                                                                        borderRadius: '50%',
                                                                        width: '40px',
                                                                        height: '40px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        cursor: 'pointer',
                                                                        color: isRecording ? 'white' : '#8B7355',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                >
                                                                    {isRecording ? <StopCircle size={20} /> : <Mic size={20} />}
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    }
                                </div>
                            );
                        })()
                    ) : (
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            color: '#8B7355',
                            background: 'linear-gradient(135deg, #FDFCFB 0%, #F5F1ED 100%)',
                            textAlign: 'center',
                            padding: '40px'
                        }}>
                            <div style={{
                                width: '120px',
                                height: '120px',
                                background: 'white',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '24px',
                                boxShadow: '0 20px 40px rgba(139, 115, 85, 0.1)'
                            }}>
                                <MessageCircle size={48} style={{ color: '#8B7355' }} />
                            </div>
                            <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#3E2723', marginBottom: '12px' }}>
                                {conversations.length > 0 ? 'Select a Conversation' : 'Your Conversations'}
                            </h2>
                            <p style={{ opacity: 0.7, maxWidth: '300px', fontSize: '16px', lineHeight: '1.6' }}>
                                {conversations.length > 0
                                    ? 'Choose a chat from the list to start messaging your friends.'
                                    : 'Connect with your friends and share your favorite posts.'}
                            </p>
                            <button
                                onClick={() => router.push('/explore')}
                                style={{
                                    marginTop: '24px',
                                    padding: '12px 24px',
                                    background: 'linear-gradient(135deg, #8B7355 0%, #6B5444 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '30px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    boxShadow: '0 10px 20px rgba(139, 115, 85, 0.2)'
                                }}
                            >
                                Explore Users
                            </button>
                        </div>
                    )}
                </div>
            </div >

            {/* Group Creation Modal */}
            {
                showGroupModal && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 100
                    }}>
                        <div style={{
                            background: 'white',
                            padding: '24px',
                            borderRadius: '24px',
                            width: '400px',
                            maxWidth: '90%',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <h2 style={{ margin: 0, color: '#3E2723' }}>New Group</h2>
                                <button onClick={() => setShowGroupModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <X size={24} color="#6B5444" />
                                </button>
                            </div>

                            <input
                                type="text"
                                placeholder="Group Name"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '12px',
                                    border: '1px solid #E8E0D5',
                                    marginBottom: '16px',
                                    outline: 'none'
                                }}
                            />

                            <div style={{ marginBottom: '16px' }}>
                                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#8B7355' }}>Add Members:</p>

                                {/* Followed Users Section */}
                                {!groupSearchQuery && followedUsers.length > 0 && (
                                    <div style={{ marginBottom: '16px', background: '#fcfaf8', padding: '12px', borderRadius: '12px', border: '1px solid #f0e8e0' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                            {followedUsers.slice((followedPage - 1) * followedPerPage, followedPage * followedPerPage).map(itemUser => (
                                                <div
                                                    key={itemUser.id}
                                                    onClick={() => {
                                                        if (!selectedGroupUsers.find(u => (u.id === itemUser.id || u.user_id === itemUser.user_id))) {
                                                            setSelectedGroupUsers([...selectedGroupUsers, itemUser]);
                                                        } else {
                                                            setSelectedGroupUsers(selectedGroupUsers.filter(u => !(u.id === itemUser.id || u.user_id === itemUser.user_id)));
                                                        }
                                                    }}
                                                    style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '8px',
                                                        borderRadius: '12px',
                                                        background: selectedGroupUsers.find(u => (u.id === itemUser.id || u.user_id === itemUser.user_id)) ? 'rgba(139, 115, 85, 0.15)' : 'white',
                                                        cursor: 'pointer',
                                                        border: selectedGroupUsers.find(u => (u.id === itemUser.id || u.user_id === itemUser.user_id)) ? '1px solid #8B7355' : '1px solid #eee',
                                                        transition: 'all 0.2s',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                                    }}
                                                >
                                                    <img
                                                        src={apiClient.getAvatarUrl(itemUser)}
                                                        style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                                                        alt={itemUser.username}
                                                    />
                                                    <span style={{
                                                        fontSize: '10px',
                                                        textAlign: 'center',
                                                        overflow: 'hidden',
                                                        width: '100%',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        fontWeight: '600',
                                                        color: '#3E2723'
                                                    }}>
                                                        {itemUser.username}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        {followedUsers.length > followedPerPage && (
                                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                                                <button
                                                    disabled={followedPage === 1}
                                                    onClick={() => setFollowedPage(prev => Math.max(1, prev - 1))}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        color: followedPage === 1 ? '#ccc' : '#8B7355',
                                                        padding: '4px'
                                                    }}
                                                >
                                                    <ChevronLeft size={18} />
                                                </button>
                                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#8B7355', minWidth: '40px', textAlign: 'center' }}>
                                                    {followedPage} / {Math.ceil(followedUsers.length / followedPerPage)}
                                                </span>
                                                <button
                                                    disabled={followedPage >= Math.ceil(followedUsers.length / followedPerPage)}
                                                    onClick={() => setFollowedPage(prev => prev + 1)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        color: followedPage >= Math.ceil(followedUsers.length / followedPerPage) ? '#ccc' : '#8B7355',
                                                        padding: '4px'
                                                    }}
                                                >
                                                    <ChevronRight size={18} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <input
                                    type="text"
                                    placeholder="Search users by name..."
                                    value={groupSearchQuery}
                                    onChange={(e) => setGroupSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        borderRadius: '12px',
                                        border: '1px solid #E8E0D5',
                                        outline: 'none',
                                        fontSize: '14px',
                                        backgroundColor: '#fafafa'
                                    }}
                                />

                                {/* Search Results */}
                                {searchResults.length > 0 && (
                                    <div style={{
                                        maxHeight: '150px',
                                        overflowY: 'auto',
                                        border: '1px solid #E8E0D5',
                                        borderRadius: '8px',
                                        marginTop: '8px'
                                    }}>
                                        {searchResults.map(resultUser => (
                                            <div
                                                key={resultUser.id}
                                                onClick={() => {
                                                    if (!selectedGroupUsers.find(u => u.id === resultUser.id)) {
                                                        setSelectedGroupUsers([...selectedGroupUsers, resultUser]);
                                                    }
                                                    setGroupSearchQuery('');
                                                    setSearchResults([]);
                                                }}
                                                style={{
                                                    padding: '8px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px'
                                                }}
                                            >
                                                <img
                                                    src={apiClient.getAvatarUrl(resultUser)}
                                                    style={{ width: '24px', height: '24px', borderRadius: '50%' }}
                                                    alt="Avatar"
                                                />
                                                <span style={{ fontSize: '14px' }}>{resultUser?.username || resultUser?.user?.username || 'User'}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Selected Members */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                                {selectedGroupUsers.map(user => (
                                    <div
                                        key={user.id}
                                        style={{
                                            background: '#F5F1ED',
                                            padding: '4px 8px',
                                            borderRadius: '16px',
                                            fontSize: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            color: '#6B5444'
                                        }}
                                    >
                                        {user?.username || user?.user?.username || 'User'}
                                        <button
                                            onClick={() => setSelectedGroupUsers(selectedGroupUsers.filter(u => u.id !== user.id))}
                                            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleCreateGroup}
                                disabled={!groupName.trim() || selectedGroupUsers.length < 2}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: 'linear-gradient(135deg, #8B7355 0%, #6B5444 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    opacity: (!groupName.trim() || selectedGroupUsers.length < 2) ? 0.5 : 1
                                }}
                            >
                                Create Group
                            </button>
                        </div>
                    </div>
                )
            }

            {/* Group Settings Modal */}
            {
                showGroupSettingsModal && selectedChat && (
                    <div style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}>
                        <div style={{
                            background: 'white',
                            padding: '24px',
                            borderRadius: '24px',
                            width: '400px',
                            maxWidth: '90%',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                            animation: 'slideIn 0.3s ease'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <h2 style={{ margin: 0, color: '#3E2723' }}>Group Settings</h2>
                                <button onClick={() => setShowGroupSettingsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <X size={24} color="#6B5444" />
                                </button>
                            </div>

                            {/* Admin Only: Edit Name */}
                            {(
                                (selectedChat.admin?.user?.id && user?.id && String(selectedChat.admin.user.id) === String(user.id)) ||
                                (selectedChat.initiator?.user?.id && user?.id && String(selectedChat.initiator.user.id) === String(user.id)) ||
                                selectedChat.admins?.some(a => a.user?.id && user?.id && String(a.user.id) === String(user.id))
                            ) ? (
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', fontSize: '14px', color: '#8B7355', marginBottom: '8px', fontWeight: '600' }}>
                                        Group Name
                                    </label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            type="text"
                                            value={editingGroupName}
                                            onChange={(e) => setEditingGroupName(e.target.value)}
                                            style={{
                                                flex: 1,
                                                padding: '12px',
                                                borderRadius: '12px',
                                                border: '1px solid #E8E0D5',
                                                outline: 'none',
                                                fontSize: '14px'
                                            }}
                                        />
                                        <button
                                            onClick={handleUpdateGroupName}
                                            style={{
                                                background: '#8B7355',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '12px',
                                                padding: '0 16px',
                                                cursor: 'pointer',
                                                fontWeight: '600'
                                            }}
                                        >
                                            Save
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', fontSize: '14px', color: '#8B7355', marginBottom: '8px', fontWeight: '600' }}>
                                        Group Name
                                    </label>
                                    <p style={{ margin: 0, fontSize: '16px', color: '#3E2723', fontWeight: '600' }}>{selectedChat.group_name}</p>
                                </div>
                            )}

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '14px', color: '#8B7355', marginBottom: '12px', fontWeight: '600' }}>
                                    Members ({selectedChat.participants.length})
                                </label>

                                {/* Admin Add Member Section */}
                                {((selectedChat.admin?.user?.id && String(selectedChat.admin.user.id) === String(user?.id)) ||
                                    (selectedChat.initiator?.user?.id && String(selectedChat.initiator.user.id) === String(user?.id)) ||
                                    (selectedChat.admins?.some(a => a.user?.id && String(a.user.id) === String(user?.id)))) && (
                                        <div style={{ marginBottom: '16px' }}>
                                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                                <input
                                                    type="text"
                                                    placeholder="Search users to add..."
                                                    value={addMemberSearchQuery}
                                                    onChange={(e) => setAddMemberSearchQuery(e.target.value)}
                                                    style={{
                                                        flex: 1,
                                                        padding: '8px 12px',
                                                        borderRadius: '8px',
                                                        border: '1px solid #E8E0D5',
                                                        fontSize: '13px',
                                                        outline: 'none'
                                                    }}
                                                />
                                            </div>
                                            {/* Add Member Search Results */}
                                            {addMemberSearchResults.length > 0 && addMemberSearchQuery && (
                                                <div style={{
                                                    maxHeight: '120px',
                                                    overflowY: 'auto',
                                                    border: '1px solid #E8E0D5',
                                                    borderRadius: '8px',
                                                    marginBottom: '12px',
                                                    background: '#fafafa'
                                                }}>
                                                    {addMemberSearchResults.map(resultUser => {
                                                        // Filter out existing members
                                                        if (selectedChat.participants.some(p => p.user?.id === resultUser.id)) return null;

                                                        return (
                                                            <div
                                                                key={resultUser.id}
                                                                onClick={() => {
                                                                    setConfirmDialog({
                                                                        title: 'Add Member?',
                                                                        message: `Add ${resultUser.username} to the group?`,
                                                                        confirmText: 'Add',
                                                                        onConfirm: async () => {
                                                                            try {
                                                                                await chatService.addMembersToGroup(selectedChat.id, [String(resultUser.id)]);
                                                                                setAddMemberSearchQuery('');
                                                                                setAddMemberSearchResults([]);
                                                                                loadConversations(true);
                                                                                setBannerMessage({ text: 'Member added successfully!', type: 'success' });
                                                                            } catch (e: any) {
                                                                                console.error(e);
                                                                                const errorMessage = e?.detail || e?.message || 'Failed to add member';
                                                                                setBannerMessage({ text: errorMessage, type: 'error' });
                                                                            }
                                                                        }
                                                                    });
                                                                }}
                                                                style={{
                                                                    padding: '8px',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '8px',
                                                                    borderBottom: '1px solid #eee'
                                                                }}
                                                                onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
                                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                            >
                                                                <img
                                                                    src={apiClient.getAvatarUrl(resultUser)}
                                                                    style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                                                                    alt={resultUser.username}
                                                                />
                                                                <div style={{ flex: 1 }}>
                                                                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#3E2723' }}>
                                                                        {resultUser.username}
                                                                    </div>
                                                                    {resultUser.bio && (
                                                                        <div style={{ fontSize: '11px', color: '#8B7355' }}>
                                                                            {resultUser.bio.substring(0, 30)}{resultUser.bio.length > 30 ? '...' : ''}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div style={{
                                                                    padding: '4px 10px',
                                                                    background: '#E8F5E9',
                                                                    color: '#2E7D32',
                                                                    borderRadius: '6px',
                                                                    fontSize: '11px',
                                                                    fontWeight: 'bold'
                                                                }}>
                                                                    Add
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {selectedChat.participants.map(p => {
                                        // Determine roles
                                        const pUserId = p?.user?.id ? String(p.user.id) : null;
                                        const currentUserId = user?.id ? String(user.id) : null;

                                        if (!pUserId) return null; // Skip invalid users

                                        const isOwner = (selectedChat.admin?.user?.id && String(selectedChat.admin.user.id) === pUserId) ||
                                            (selectedChat.initiator?.user?.id && String(selectedChat.initiator.user.id) === pUserId);
                                        const isAdmin = selectedChat.admins?.some(a => a.user?.id && String(a.user.id) === pUserId);

                                        const isCurrentUserOwner = (selectedChat.admin?.user?.id && currentUserId && String(selectedChat.admin.user.id) === currentUserId) ||
                                            (selectedChat.initiator?.user?.id && currentUserId && String(selectedChat.initiator.user.id) === currentUserId);

                                        const isCurrentUserAdmin = selectedChat.admins?.some(a => a.user?.id && currentUserId && String(a.user.id) === currentUserId) || isCurrentUserOwner;

                                        return (
                                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <img src={apiClient.getAvatarUrl(p)} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontSize: '14px', color: '#3E2723', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {p?.username || p?.user?.username || 'User'} {pUserId === currentUserId && '(You)'}

                                                        {isOwner && (
                                                            <span style={{ fontSize: '10px', color: '#1565C0', background: '#E3F2FD', padding: '2px 6px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '2px', border: '1px solid #BBDEFB', fontWeight: 600 }}>
                                                                <Shield size={10} /> Admin
                                                            </span>
                                                        )}
                                                        {!isOwner && isAdmin && (
                                                            <span style={{ fontSize: '10px', color: '#1565C0', background: '#E3F2FD', padding: '2px 6px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '2px', border: '1px solid #BBDEFB', fontWeight: 600 }}>
                                                                <Shield size={10} /> Admin
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>

                                                <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                                                    {/* Common Actions (Remove Member / Message) */}
                                                    {pUserId !== currentUserId && (
                                                        <>
                                                            {/* Remove Member - Admin Only */}
                                                            {isCurrentUserAdmin && !isOwner && (!isAdmin || isCurrentUserOwner) && (
                                                                <button
                                                                    onClick={async () => {
                                                                        setConfirmDialog({
                                                                            title: 'Remove Member?',
                                                                            message: `Are you sure you want to remove ${p.user?.username || 'this user'} from the group?`,
                                                                            confirmText: 'Remove',
                                                                            type: 'danger',
                                                                            onConfirm: async () => {
                                                                                try {
                                                                                    await chatService.removeMember(selectedChat.id, String(p.id));
                                                                                    loadConversations(true);
                                                                                    setSelectedChat(prev => prev ? { ...prev, participants: prev.participants.filter(x => x.id !== p.id) } : null);
                                                                                    setBannerMessage({ text: 'Member removed', type: 'success' });
                                                                                } catch (e: any) {
                                                                                    const errorMessage = e?.detail || e?.message || 'Failed to remove member';
                                                                                    setBannerMessage({ text: errorMessage, type: 'error' });
                                                                                }
                                                                            }
                                                                        });
                                                                    }}
                                                                    title="Remove Member from group"
                                                                    style={{ border: 'none', background: '#FBE9E7', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: '#D32F2F', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                >
                                                                    <UserMinus size={14} />
                                                                    <span style={{ fontSize: '11px', fontWeight: 'bold' }}>Remove</span>
                                                                </button>
                                                            )}

                                                        </>
                                                    )}

                                                    {/* Admin Role Actions (Promote/Demote) */}
                                                    {isCurrentUserAdmin && pUserId !== currentUserId && (
                                                        <>
                                                            {/* Promote/Demote */}
                                                            {isAdmin ? (
                                                                isCurrentUserOwner && (
                                                                    <button
                                                                        onClick={async () => {
                                                                            setConfirmDialog({
                                                                                title: 'Dismiss Admin?',
                                                                                message: `Remove admin privileges from ${p.user?.username || 'this user'}?`,
                                                                                confirmText: 'Dismiss',
                                                                                type: 'warning',
                                                                                onConfirm: async () => {
                                                                                    try {
                                                                                        await chatService.demoteFromAdmin(selectedChat.id, String(p.id));
                                                                                        loadConversations(true);
                                                                                        setBannerMessage({ text: 'Admin demoted', type: 'success' });
                                                                                    } catch (e: any) {
                                                                                        const errorMessage = e?.detail || e?.message || 'Failed to demote';
                                                                                        setBannerMessage({ text: errorMessage, type: 'error' });
                                                                                    }
                                                                                }
                                                                            });
                                                                        }}
                                                                        title="Demote to Member"
                                                                        style={{ border: 'none', background: '#FFF3E0', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: '#F57C00', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                    >
                                                                        <ArrowDown size={14} />
                                                                        <span style={{ fontSize: '11px', fontWeight: 'bold' }}>Dismiss Admin</span>
                                                                    </button>
                                                                )
                                                            ) : (
                                                                <button
                                                                    onClick={async () => {
                                                                        setConfirmDialog({
                                                                            title: 'Promote to Admin?',
                                                                            message: `Make ${p.user?.username || 'this user'} an admin of this group?`,
                                                                            confirmText: 'Promote',
                                                                            type: 'success',
                                                                            onConfirm: async () => {
                                                                                try {
                                                                                    await chatService.promoteToAdmin(selectedChat.id, String(p.id));
                                                                                    loadConversations(true);
                                                                                    setBannerMessage({ text: 'Promoted to admin', type: 'success' });
                                                                                } catch (e: any) {
                                                                                    const errorMessage = e?.detail || e?.message || 'Failed to promote';
                                                                                    setBannerMessage({ text: errorMessage, type: 'error' });
                                                                                }
                                                                            }
                                                                        });
                                                                    }}
                                                                    title="Promote to Admin"
                                                                    style={{ border: 'none', background: '#E8F5E9', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: '#4CAF50', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                >
                                                                    <ArrowUp size={14} />
                                                                    <span style={{ fontSize: '11px', fontWeight: 'bold' }}>Make Admin</span>
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button
                                onClick={handleLeaveGroup}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '12px',
                                    border: '1px solid #ef4444',
                                    background: 'white',
                                    color: '#ef4444',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                Leave Group
                            </button>

                            {(selectedChat.admin?.user?.id === user?.id || selectedChat.initiator?.user?.id === user?.id) && (
                                <button
                                    onClick={() => {
                                        setConfirmDialog({
                                            title: 'Delete Group?',
                                            message: `Are you sure you want to permanently delete ${selectedChat.group_name || 'this group'}? This action cannot be undone for any member.`,
                                            confirmText: 'Delete Group',
                                            type: 'danger',
                                            onConfirm: async () => {
                                                try {
                                                    await handleDeleteThreadById(selectedChat.id);
                                                    setShowGroupSettingsModal(false);
                                                    setBannerMessage({ text: 'Group deleted successfully', type: 'success' });
                                                } catch (e: any) {
                                                    const errorMessage = e?.detail || e?.message || 'Failed to delete group';
                                                    setBannerMessage({ text: errorMessage, type: 'error' });
                                                }
                                            }
                                        });
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        borderRadius: '12px',
                                        border: 'none',
                                        background: '#ef4444',
                                        color: 'white',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Delete Group
                                </button>
                            )}
                        </div>
                    </div>
                )
            }


            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @keyframes bannerSlideIn {
                    from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
                
                /* Scrollbar Styling */
                *::-webkit-scrollbar { width: 8px; height: 8px; }
                *::-webkit-scrollbar-track { background: transparent; }
                *::-webkit-scrollbar-thumb { background: rgba(139, 115, 85, 0.2); border-radius: 4px; }
                *::-webkit-scrollbar-thumb:hover { background: rgba(139, 115, 85, 0.3); }
                
                input::placeholder, textarea::placeholder { color: #8B7355; opacity: 0.6; }
                
                /* Mobile Phones (Portrait) - 320px to 480px */
                @media (max-width: 480px) {
                    body {
                        overflow-x: hidden;
                    }
                    
                    /* Ensure message input is visible */
                    .chat-messages-area {
                        padding-bottom: 120px !important;
                        min-height: calc(100vh - 200px) !important;
                    }
                    
                    /* Make input area sticky at bottom */
                    .chat-input-area {
                        position: sticky !important;
                        bottom: 0 !important;
                        background: white !important;
                        z-index: 100 !important;
                        padding: 12px !important;
                        box-shadow: 0 -4px 12px rgba(0,0,0,0.1) !important;
                    }
                    
                    /* Reduce padding on mobile */
                    .message-bubble {
                        max-width: 85% !important;
                        font-size: 14px !important;
                    }
                }
                
                /* Mobile Phones & Small Tablets (Portrait) - up to 768px */
                @media (max-width: 768px) {
                    .chat-container { 
                        height: 100vh !important;
                        height: 100dvh !important; /* Dynamic viewport height for mobile browsers */
                        border-radius: 0 !important;
                        max-width: 100% !important;
                    }
                    
                    /* Hide sidebar when chat is open on mobile */
                    ${showMobileChat ? `
                        .sidebar {
                            display: none !important;
                        }
                    ` : ''}
                    
                    /* Ensure proper flex layout on mobile */
                    .chat-right-panel {
                        display: flex !important;
                        flex-direction: column !important;
                        height: 100vh !important;
                        height: 100dvh !important;
                    }
                    
                    /* Messages area should scroll */
                    .chat-messages-area {
                        flex: 1 !important;
                        overflow-y: auto !important;
                        -webkit-overflow-scrolling: touch !important;
                        padding: 16px 12px 100px 12px !important;
                    }
                    
                    /* Input area fixed at bottom */
                    .chat-input-area {
                        flex-shrink: 0 !important;
                        padding: 12px !important;
                        background: white !important;
                        border-top: 1px solid #E8E0D5 !important;
                    }
                    
                    /* Adjust header on mobile */
                    .chat-header {
                        padding: 12px 16px !important;
                    }
                    
                    /* Make message input responsive */
                    .message-input-wrapper {
                        padding: 6px !important;
                    }
                    
                    .message-input-textarea {
                        font-size: 16px !important; /* Prevents zoom on iOS */
                        max-height: 80px !important;
                    }
                }
                
                /* Tablets (Portrait) - 768px to 1024px */
                @media (min-width: 769px) and (max-width: 1024px) {
                    .chat-container {
                        max-width: 95% !important;
                    }
                }
                
                /* Small Laptops - 1024px to 1366px */
                @media (min-width: 1025px) and (max-width: 1366px) {
                    .chat-container {
                        max-width: 1200px !important;
                    }
                }
                
                /* Large Screens - 1367px and above */
                @media (min-width: 1367px) {
                    .chat-container {
                        max-width: 1400px !important;
                    }
                }
                
                /* Ultra-wide Screens - 1920px and above */
                @media (min-width: 1920px) {
                    .chat-container {
                        max-width: 1600px !important;
                    }
                }
                
                /* Height-based responsive adjustments */
                @media (max-height: 600px) {
                    .chat-container {
                        height: 100vh !important;
                    }
                    
                    .chat-messages-area {
                        padding-bottom: 80px !important;
                    }
                }
                
                /* Fix for very small screens */
                @media (max-width: 360px) {
                    .message-bubble {
                        max-width: 90% !important;
                        font-size: 13px !important;
                        padding: 8px 12px !important;
                    }
                    
                    .chat-input-area {
                        padding: 8px !important;
                    }
                }
            `}</style>

            {/* Delete Confirmation Modal */}
            {
                showDeleteConfirm && (() => {
                    // Determine if it's a group from either threadToDelete or selectedChat
                    let isGroup = false;
                    if (threadToDelete) {
                        const threadData = conversations.find(c => c.id === threadToDelete);
                        isGroup = threadData?.is_group || false;
                    } else if (selectedChat) {
                        isGroup = selectedChat.is_group || false;
                    }

                    return (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10000
                        }}>
                            <div style={{
                                background: 'white',
                                borderRadius: '16px',
                                padding: '32px',
                                maxWidth: '400px',
                                width: '90%',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                            }}>
                                <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '700', color: '#3E2723' }}>
                                    {isGroup ? 'Leave Group?' : 'Delete Conversation?'}
                                </h2>
                                <p style={{ margin: '0 0 24px 0', color: '#6B5444', fontSize: '15px', lineHeight: '1.5' }}>
                                    {isGroup
                                        ? 'The group will be hidden from your chats. You can rejoin by searching for it later.'
                                        : 'All messages and history will be permanently removed. This cannot be undone.'
                                    }
                                </p>
                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={cancelDelete}
                                        style={{
                                            padding: '10px 24px',
                                            borderRadius: '8px',
                                            border: '1px solid #E8E0D5',
                                            background: 'white',
                                            color: '#6B5444',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            fontSize: '14px'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        style={{
                                            padding: '10px 24px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: isGroup ? '#FF9800' : '#d32f2f',
                                            color: 'white',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            fontSize: '14px'
                                        }}
                                    >
                                        {isGroup ? 'Leave' : 'Delete'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()
            }
            {/* Block Confirmation Modal */}
            {
                showBlockConfirm && userToBlock && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10000
                    }}>
                        <div style={{
                            background: 'white',
                            borderRadius: '16px',
                            padding: '32px',
                            maxWidth: '400px',
                            width: '90%',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                        }}>
                            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '700', color: '#3E2723' }}>
                                Block {userToBlock.username}?
                            </h2>
                            <p style={{ margin: '0 0 24px 0', color: '#6B5444', fontSize: '15px', lineHeight: '1.5' }}>
                                They will no longer be able to message you or see your posts. Your mutual followers will not be notified.
                            </p>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={cancelBlock}
                                    style={{
                                        padding: '10px 24px',
                                        borderRadius: '8px',
                                        border: '1px solid #E8E0D5',
                                        background: 'white',
                                        color: '#6B5444',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmBlock}
                                    style={{
                                        padding: '10px 24px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: '#d32f2f',
                                        color: 'white',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                    }}
                                >
                                    Block
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Delete Message Confirmation Modal */}
            {
                showDeleteMessageConfirm && messageToDeleteData && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10000
                    }}>
                        <div style={{
                            background: 'white',
                            borderRadius: '16px',
                            padding: '32px',
                            maxWidth: '400px',
                            width: '90%',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                            animation: 'slideIn 0.3s ease-out'
                        }}>
                            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '700', color: '#3E2723' }}>
                                {messageToDeleteData.forEveryone ? 'Unsend Message?' : 'Delete Message?'}
                            </h2>
                            <p style={{ margin: '0 0 24px 0', color: '#6B5444', fontSize: '15px', lineHeight: '1.5' }}>
                                {messageToDeleteData.forEveryone
                                    ? 'This message will be removed for everyone in the chat. They may have already seen it.'
                                    : 'This message will be removed for you. Others in the chat will still be able to see it.'
                                }
                            </p>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={cancelMessageDelete}
                                    style={{
                                        padding: '10px 24px',
                                        borderRadius: '8px',
                                        border: '1px solid #E8E0D5',
                                        background: 'white',
                                        color: '#6B5444',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmMessageDelete}
                                    style={{
                                        padding: '10px 24px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: '#d32f2f',
                                        color: 'white',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                    }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* UI Banner Message */}
            {
                bannerMessage && (
                    <div style={{
                        position: 'fixed',
                        top: '20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 20000,
                        padding: '12px 24px',
                        borderRadius: '12px',
                        background: bannerMessage.type === 'success' ? '#4CAF50' :
                            bannerMessage.type === 'error' ? '#f44336' : '#2196F3',
                        color: 'white',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        animation: 'bannerSlideIn 0.3s ease-out',
                        fontWeight: '600'
                    }}>
                        {bannerMessage.type === 'success' ? <Check size={20} /> :
                            bannerMessage.type === 'error' ? <X size={20} /> : <MessageSquare size={20} />}
                        <span style={{ fontSize: '15px' }}>{bannerMessage.text}</span>
                    </div>
                )
            }
            {/* Generic Confirmation Dialog */}
            {
                confirmDialog && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10000
                    }}>
                        <div style={{
                            background: 'white',
                            borderRadius: '16px',
                            padding: '32px',
                            maxWidth: '400px',
                            width: '90%',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                            animation: 'slideIn 0.3s ease-out'
                        }}>
                            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '700', color: '#3E2723' }}>
                                {confirmDialog.title}
                            </h2>
                            <p style={{ margin: '0 0 24px 0', color: '#6B5444', fontSize: '15px', lineHeight: '1.5' }}>
                                {confirmDialog.message}
                            </p>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setConfirmDialog(null)}
                                    style={{
                                        padding: '10px 24px',
                                        borderRadius: '8px',
                                        border: '1px solid #E8E0D5',
                                        background: 'white',
                                        color: '#6B5444',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                    }}
                                >
                                    {confirmDialog.cancelText || 'Cancel'}
                                </button>
                                <button
                                    onClick={() => {
                                        confirmDialog.onConfirm();
                                        setConfirmDialog(null);
                                    }}
                                    style={{
                                        padding: '10px 24px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: confirmDialog.type === 'danger' ? '#d32f2f' :
                                            confirmDialog.type === 'warning' ? '#FF9800' :
                                                confirmDialog.type === 'success' ? '#4CAF50' : '#8B7355',
                                        color: 'white',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                    }}
                                >
                                    {confirmDialog.confirmText || 'Confirm'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}