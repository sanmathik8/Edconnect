'use client';

import { useState, useEffect } from 'react';
import { apiClient, ApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
    Bell, Heart, UserPlus, MessageCircle, Mail, CheckCheck, Trash2, Loader2, Check
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
    id: number;
    notification_type: 'like' | 'follow' | 'comment' | 'message' | 'share' | 'group_join' | 'group_leave';
    actor: {
        id: number;
        user: { username: string };
        avatar?: string;
        username?: string;
    };
    message: string;
    created_at: string;
    read: boolean;
    post?: {
        id: number;
        content: string;
        image?: string;
        author?: {
            id: number;
            username: string;
        };
    };
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const { user: authUser } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!authUser && !loading) {
            router.push('/login');
            return;
        }
        loadNotifications();
    }, [authUser]);

    const loadNotifications = async () => {
        try {
            setLoading(true);
            const data = await apiClient.getNotifications();
            setNotifications(Array.isArray(data) ? data : []);
        } catch (error) {
            if (error instanceof ApiError && error.isAuthError) {
                // Auth error handled by context/router
            } else {
                console.error('Failed to load notifications:', error);
            }
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (id: number) => {
        try {
            setNotifications(notifications.map(notif =>
                notif.id === id ? { ...notif, read: true } : notif
            ));
            await apiClient.markNotificationRead(id);
            window.dispatchEvent(new Event('notificationUpdate'));
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
        if (unreadIds.length === 0) return;

        setNotifications(notifications.map(notif => ({ ...notif, read: true })));

        try {
            await Promise.all(unreadIds.map(id => apiClient.markNotificationRead(id)));
            window.dispatchEvent(new Event('notificationUpdate'));
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const deleteNotification = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            setNotifications(prev => prev.filter(n => n.id !== id));
            await apiClient.deleteNotification(id);
            window.dispatchEvent(new Event('notificationUpdate'));
        } catch (error) {
            console.error('Failed to delete notification:', error);
        }
    };

    const deleteAllNotifications = async () => {
        if (!confirm('Are you sure you want to clear all notifications?')) return;

        const toDeleteIds = notifications.map(n => n.id);
        setNotifications([]);

        try {
            await Promise.all(toDeleteIds.map(id => apiClient.deleteNotification(id)));
            window.dispatchEvent(new Event('notificationUpdate'));
        } catch (error) {
            console.error('Failed to clear notifications:', error);
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.read) {
            markAsRead(notification.id);
        }

        switch (notification.notification_type) {
            case 'follow':
                router.push(`/profile/${notification.actor.username || notification.actor.user.username}`);
                break;
            case 'like':
            case 'comment':
            case 'share':
                if (notification.post?.id && notification.post.author?.username) {
                    const query = notification.notification_type === 'comment' ? '?openComments=true' : '';
                    router.push(`/${notification.post.author.username}/post/${notification.post.id}${query}`);
                }
                break;
            case 'message':
                router.push('/chat');
                break;
            case 'group_join':
            case 'group_leave':
                router.push('/conversations'); // Redirect to chat/conversations list
                break;
            default:
                break;
        }
    };

    const handleProfileClick = (e: React.MouseEvent, username: string) => {
        e.stopPropagation();
        router.push(`/profile/${username}`);
    };

    const filteredNotifications = filter === 'all'
        ? notifications
        : notifications.filter(n => !n.read);

    const getIcon = (type: string) => {
        switch (type) {
            case 'like':
                return <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #FF6B6B, #E64A19)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(255, 107, 107, 0.3)' }}><Heart size={20} fill="#fff" color="#fff" /></div>;
            case 'follow':
                return <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #8B7355, #6B5444)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(139, 115, 85, 0.3)' }}><UserPlus size={20} color="#fff" /></div>;
            case 'comment':
                return <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #5D4037, #3E2723)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(62, 39, 35, 0.3)' }}><MessageCircle size={20} color="#fff" /></div>;
            case 'message':
                return <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #8B7355, #5D4037)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(139, 115, 85, 0.3)' }}><Mail size={20} color="#fff" /></div>;
            case 'share':
                return <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #D4AF37, #8B7355)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(212, 175, 55, 0.3)' }}><Bell size={20} color="#fff" /></div>;
            case 'group_join':
                return <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)' }}><UserPlus size={20} color="#fff" /></div>;
            case 'group_leave':
                return <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #f43f5e, #e11d48)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(244, 63, 94, 0.3)' }}><Bell size={20} color="#fff" /></div>;
            default:
                return <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #8B7355, #6B5444)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(139, 115, 85, 0.3)' }}><Bell size={20} color="#fff" /></div>;
        }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <Loader2 style={{ width: 48, height: 48, color: '#8B7355', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                    <p style={{ color: '#3E2723', fontSize: 16, fontWeight: 600 }}>Loading Notifications...</p>
                </div>
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="notifications-container">
            {/* Header */}
            <div className="header-wrapper">
                <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                        <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #8B7355 0%, #6B5444 100%)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px rgba(139, 115, 85, 0.2)' }}>
                            <Bell style={{ width: 24, height: 24, color: '#fff' }} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, background: 'linear-gradient(135deg, #8B7355 0%, #3E2723 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' }}>Notifications</h1>
                            <p style={{ fontSize: 15, color: '#6B5444', margin: '4px 0 0 0', fontWeight: 500, opacity: 0.8 }}>Latest activity from your network</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px 60px' }}>
                {/* Filters & Actions */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 24,
                    gap: 12,
                    flexWrap: 'wrap',
                    background: 'rgba(255, 255, 255, 0.5)',
                    padding: '12px',
                    borderRadius: '20px',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
                }}>
                    {/* Filter Tabs */}
                    <div style={{ display: 'flex', background: 'rgba(139, 115, 85, 0.1)', padding: 4, borderRadius: 14, gap: 4 }}>
                        <button
                            onClick={() => setFilter('all')}
                            style={{
                                padding: '10px 24px',
                                borderRadius: 10,
                                fontSize: 14,
                                fontWeight: 700,
                                border: 'none',
                                cursor: 'pointer',
                                background: filter === 'all' ? 'linear-gradient(135deg, #8B7355 0%, #6B5444 100%)' : 'transparent',
                                color: filter === 'all' ? '#fff' : '#8B7355',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: filter === 'all' ? '0 4px 12px rgba(139, 115, 85, 0.2)' : 'none'
                            }}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilter('unread')}
                            style={{
                                padding: '10px 24px',
                                borderRadius: 10,
                                fontSize: 14,
                                fontWeight: 700,
                                border: 'none',
                                cursor: 'pointer',
                                background: filter === 'unread' ? 'linear-gradient(135deg, #8B7355 0%, #6B5444 100%)' : 'transparent',
                                color: filter === 'unread' ? '#fff' : '#8B7355',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                position: 'relative',
                                boxShadow: filter === 'unread' ? '0 4px 12px rgba(139, 115, 85, 0.2)' : 'none'
                            }}
                        >
                            Unread
                            {notifications.some(n => !n.read) && (
                                <div style={{
                                    width: 8,
                                    height: 8,
                                    background: filter === 'unread' ? '#fff' : '#d32f2f',
                                    borderRadius: '50%',
                                    boxShadow: filter === 'unread' ? 'none' : '0 0 8px rgba(211, 47, 47, 0.5)'
                                }} />
                            )}
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 10 }}>
                        {notifications.some(n => !n.read) && (
                            <button
                                onClick={markAllAsRead}
                                style={{
                                    padding: '10px 18px',
                                    background: '#fff',
                                    border: '1px solid rgba(139, 115, 85, 0.2)',
                                    borderRadius: 14,
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: '#8B7355',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    transition: 'all 0.2s',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                                }}
                            >
                                <CheckCheck size={18} />
                                <span className="action-label">Mark all as read</span>
                            </button>
                        )}
                        {notifications.length > 0 && (
                            <button
                                onClick={deleteAllNotifications}
                                style={{
                                    padding: '10px 18px',
                                    background: '#fff',
                                    border: '1px solid rgba(211, 47, 47, 0.1)',
                                    borderRadius: 14,
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: '#d32f2f',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    transition: 'all 0.2s',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                                }}
                            >
                                <Trash2 size={18} />
                                <span className="action-label">Clear All</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Notifications List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {filteredNotifications.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '80px 40px',
                            background: 'rgba(255, 255, 255, 0.4)',
                            borderRadius: 30,
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            boxShadow: '0 20px 40px rgba(139, 115, 85, 0.05)'
                        }}>
                            <div style={{
                                width: 80,
                                height: 80,
                                borderRadius: '50%',
                                background: 'rgba(139, 115, 85, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 24px',
                                color: '#8B7355'
                            }}>
                                <Bell size={40} opacity={0.5} />
                            </div>
                            <h3 style={{ fontSize: 22, fontWeight: 800, color: '#3E2723', marginBottom: 12 }}>
                                {filter === 'unread' ? "You're all caught up!" : "No notifications yet"}
                            </h3>
                            <p style={{ fontSize: 16, color: '#6B5444', opacity: 0.7, maxWidth: 300, margin: '0 auto', lineHeight: 1.6 }}>
                                {filter === 'unread' ? "There are no unread notifications waiting for your attention." : "We'll notify you when someone interacts with your posts or profile."}
                            </p>
                        </div>
                    ) : (
                        filteredNotifications.map((notif) => (
                            <div
                                key={notif.id}
                                onClick={() => handleNotificationClick(notif)}
                                className="notification-card"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 16,
                                    padding: '20px',
                                    background: notif.read ? 'white' : 'linear-gradient(135deg, white, #FFFAF0)',
                                    borderRadius: 24,
                                    border: '1px solid',
                                    borderColor: notif.read ? 'rgba(139, 115, 85, 0.1)' : '#8B7355',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    position: 'relative',
                                    boxShadow: notif.read ? '0 4px 15px rgba(0,0,0,0.02)' : '0 10px 30px rgba(139, 115, 85, 0.1)',
                                    transform: 'translateZ(0)'
                                }}
                            >
                                {/* Icon */}
                                <div style={{ flexShrink: 0 }}>
                                    {getIcon(notif.notification_type)}
                                </div>

                                {/* Content */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ marginBottom: 4 }}>
                                        <span
                                            onClick={(e) => handleProfileClick(e, notif.actor?.username || notif.actor?.user?.username)}
                                            style={{ fontWeight: 800, color: '#3E2723', fontSize: 16, cursor: 'pointer' }}
                                            className="hover:underline"
                                        >
                                            {notif.actor?.username || notif.actor?.user?.username || 'Someone'}
                                        </span>
                                        <span style={{ color: '#6B5444', fontSize: 16, marginLeft: 8, fontWeight: 500 }}>
                                            {notif.notification_type === 'like' && 'liked your post'}
                                            {notif.notification_type === 'follow' && 'started following you'}
                                            {notif.notification_type === 'comment' && 'commented on your post'}
                                            {notif.notification_type === 'share' && 'shared a post'}
                                            {notif.notification_type === 'message' && 'sent you a message'}
                                            {notif.notification_type === 'group_join' && 'joined your group'}
                                            {notif.notification_type === 'group_leave' && 'left your group'}
                                        </span>
                                    </div>

                                    {notif.message && notif.message.length > 0 && !notif.message.includes('liked') && !notif.message.includes('following') && (
                                        <p style={{
                                            fontSize: 14,
                                            color: '#6B5444',
                                            lineHeight: 1.5,
                                            margin: '6px 0 10px 0',
                                            background: 'rgba(139, 115, 85, 0.05)',
                                            padding: '8px 12px',
                                            borderRadius: '12px',
                                            borderLeft: '3px solid #8B7355'
                                        }}>
                                            {notif.message.substring(0, 100)}{notif.message.length > 100 ? '...' : ''}
                                        </p>
                                    )}

                                    <div style={{ fontSize: 12, color: '#8B7355', marginTop: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#8B7355' }} />
                                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12, flexShrink: 0 }}>
                                    {!notif.read && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                markAsRead(notif.id);
                                            }}
                                            className="mark-read-btn-hover"
                                            style={{
                                                background: 'rgba(34, 197, 94, 0.1)',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: 10,
                                                borderRadius: 12,
                                                color: '#15803d',
                                                transition: 'all 0.2s',
                                                marginBottom: 'auto'
                                            }}
                                            title="Mark as read"
                                        >
                                            <Check size={18} />
                                        </button>
                                    )}
                                    {/* Visual indicator for read status if needed, but background change is strong.
                                        User asked "keep any symbol so userknows".
                                        Maybe a small checkmark if read? 
                                    */}
                                    {notif.read && (
                                        <div style={{ color: '#15803d', opacity: 0.5 }}>
                                            <CheckCheck size={18} />
                                        </div>
                                    )}

                                    <button
                                        onClick={(e) => deleteNotification(notif.id, e)}
                                        className="delete-btn-hover"
                                        style={{
                                            background: 'rgba(139, 115, 85, 0.05)',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: 10,
                                            borderRadius: 12,
                                            color: '#8B7355',
                                            transition: 'all 0.2s'
                                        }}
                                        title="Delete notification"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <style jsx>{`
                .notifications-container {
                    min-height: 100vh;
                    background: linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%);
                    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    padding-bottom: 80px;
                }
                .notification-card {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .notification-card:hover {
                    transform: translateY(-4px) scale(1.01);
                    box-shadow: 0 20px 40px rgba(139, 115, 85, 0.15) !important;
                    background: white !important;
                }
                .action-label {
                    display: none;
                }
                .header-wrapper {
                    background: transparent;
                }
                .delete-btn-hover:hover {
                    background: #fee2e2 !important;
                    color: #d32f2f !important;
                    transform: scale(1.1);
                }
                .mark-read-btn-hover:hover {
                    background: #dcfce7 !important; /* light green */
                    color: #166534 !important; /* dark green */
                    transform: scale(1.1);
                }
                @media (min-width: 640px) {
                    .action-label {
                        display: inline;
                    }
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                /* Mobile Optimization */
                @media (max-width: 640px) {
                    .notifications-container {
                        padding-bottom: 40px;
                    }
                    h1 {
                        font-size: 28px !important;
                    }
                }
            `}</style>
        </div >
    );
}