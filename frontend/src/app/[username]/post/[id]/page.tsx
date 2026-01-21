'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Heart, MessageCircle, Bookmark, Send, ArrowLeft, Loader2, Lock, X, Ban } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import CommentsDrawer from '@/components/CommentsDrawer';

interface UserProfile {
    id: number;
    user: {
        id: number;
        username: string;
        email: string;
    };
    bio: string;
    is_private: boolean;
    interests: string[];
    avatar: string | null;
    is_blocked: boolean;
    is_blocked_by_me: boolean;
    is_blocking_me: boolean;
}

interface Comment {
    id: number;
    post: number;
    author: UserProfile;
    content: string;
    created_at: string;
}

interface Post {
    id: number;
    author: UserProfile;
    content: string;
    caption: string;
    image: string | null;
    tags: string[];
    is_public: boolean;
    created_at: string;
    likes_count: number;
    comments_count: number;
    is_liked: boolean;
    is_saved: boolean;
    comments?: Comment[];
}

export default function PostPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user: authUser } = useAuth();
    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sendingComment, setSendingComment] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [isDesktop, setIsDesktop] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    useEffect(() => {
        if (searchParams.get('openComments') === 'true') {
            setShowComments(true);
        }
    }, [searchParams]);

    const postId = Array.isArray(params.id) ? params.id[0] : params.id;
    const username = Array.isArray(params.username) ? params.username[0] : params.username;

    useEffect(() => {
        const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const loadPost = useCallback(async () => {
        if (!postId) return;

        try {
            setLoading(true);
            const data = await apiClient.request<Post>(`/posts/${postId}/`, {
                method: 'GET'
            });
            setPost(data);
        } catch (err) {
            console.error('Failed to load post:', err);
            setError('Post not found or access denied');
        } finally {
            setLoading(false);
        }
    }, [postId]);

    useEffect(() => {
        loadPost();
    }, [loadPost]);

    const handleLike = async () => {
        if (!post || post.author.is_blocked) return;
        try {
            const endpoint = `/posts/${post.id}/like/`;
            await apiClient.request(endpoint, { method: 'POST' });

            setPost(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    is_liked: !prev.is_liked,
                    likes_count: prev.is_liked ? prev.likes_count - 1 : prev.likes_count + 1
                };
            });
        } catch (error) {
            console.error('Failed to like post:', error);
        }
    };

    const handleSave = async () => {
        if (!post || post.author.is_blocked) return;
        try {
            const endpoint = `/posts/${post.id}/save/`;
            await apiClient.request(endpoint, { method: 'POST' });

            setPost(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    is_saved: !prev.is_saved
                };
            });
        } catch (error) {
            console.error('Failed to save post:', error);
        }
    };

    const handleAddComment = async (content: string) => {
        if (!post || !content.trim() || post.author.is_blocked) return;

        try {
            setSendingComment(true);
            const newComment = await apiClient.request<Comment>(`/posts/${post.id}/comment/`, {
                method: 'POST',
                body: JSON.stringify({ content })
            });

            setPost(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    comments: [newComment, ...(prev.comments || [])],
                    comments_count: prev.comments_count + 1
                };
            });
        } catch (error) {
            console.error('Failed to add comment:', error);
            alert('Failed to post comment');
        } finally {
            setSendingComment(false);
        }
    };

    const handleCommentDelete = async (commentId: number) => {
        if (!post) return;

        if (!confirm('Are you sure you want to delete this comment?')) return;

        try {
            await apiClient.deleteComment(post.id, commentId);

            setPost(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    comments: prev.comments?.filter(c => c.id !== commentId) || [],
                    comments_count: Math.max(prev.comments_count - 1, 0)
                };
            });
        } catch (error) {
            console.error('Failed to delete comment:', error);
            alert('Failed to delete comment');
        }
    };

    const handleCommentUpdate = async (commentId: number, content: string) => {
        if (!post) return;
        try {
            const updatedComment = await apiClient.updateComment(post.id, commentId, content);
            setPost(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    comments: prev.comments?.map(c => c.id === commentId ? updatedComment : c) || []
                };
            });
        } catch (error) {
            console.error('Failed to update comment:', error);
            alert('Failed to update comment');
        }
    };

    const handleBack = () => {
        router.back();
    };

    const handleBlockToggle = async () => {
        if (!post || !authUser) return;
        try {
            if (post.author.is_blocked_by_me) {
                await apiClient.unblockUser(String(post.author.id));
                // Reload the post to get accurate author state from backend
                await loadPost();
            } else {
                if (confirm(`Block ${post.author.user.username}?`)) {
                    await apiClient.blockUser(String(post.author.id));
                    setPost(prev => prev ? {
                        ...prev,
                        author: { ...prev.author, is_blocked_by_me: true, is_blocked: true }
                    } : null);
                }
            }
        } catch (error) {
            console.error('Failed to toggle block:', error);
        }
    };

    const getAvatarUrl = (profile: UserProfile) => {
        if (profile.avatar) return apiClient.getMediaUrl(profile.avatar);
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.user.username)}&background=random`;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
        if (diffInHours < 1) {
            const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
            return diffInMinutes < 1 ? 'Just now' : `${diffInMinutes}m`;
        }
        return diffInHours < 24 ? `${diffInHours}h` : `${Math.floor(diffInHours / 24)}d`;
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <Loader2 style={{ width: 48, height: 48, color: '#7c3aed', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                    <p style={{ color: '#4b5563', fontSize: 16, fontWeight: 500 }}>Loading...</p>
                </div>
            </div>
        );
    }

    if (error || !post) {
        return (
            <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <div style={{ background: '#fff', padding: 40, borderRadius: 20, textAlign: 'center', maxWidth: 400, width: '100%' }}>
                    <Lock style={{ width: 48, height: 48, color: '#ef4444', margin: '0 auto 16px' }} />
                    <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: '#1f2937' }}>Post Not Found</h2>
                    <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>{error || 'This post is unavailable'}</p>
                    <button onClick={handleBack} style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%)', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 100 }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 20px', display: 'flex', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <button onClick={handleBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ArrowLeft style={{ width: 24, height: 24, color: '#7c3aed' }} />
                        </button>
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', margin: 0 }}>Post</h1>
                    </div>
                </div>
            </div>

            {/* Layout Wrapper */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', maxWidth: 1200, margin: '0 auto', width: '100%', transition: 'all 0.3s ease' }}>
                {/* Main Content Area */}
                <div style={{
                    flex: 1,
                    padding: '24px 16px',
                    transition: 'all 0.3s ease',
                    maxWidth: (isDesktop && showComments) ? 'calc(100% - 400px)' : '100%',
                    height: 'calc(100vh - 64px)',
                    overflowY: 'auto'
                }}>
                    <div style={{ maxWidth: 768, margin: '0 auto' }}>
                        {/* Post Card */}
                        <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', marginBottom: 20 }}>
                            {/* Author Header */}
                            <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f3f4f6' }}>
                                <img src={getAvatarUrl(post.author)} alt="Avatar" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#1f2937' }}>{post.author.user.username}</h3>
                                        {!post.is_public && <Lock style={{ width: 14, height: 14, color: '#9ca3af' }} />}
                                    </div>
                                    <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{formatDate(post.created_at)} ago</p>
                                </div>
                            </div>

                            {/* Image */}
                            {post.image && (
                                <div style={{
                                    width: '100%',
                                    maxHeight: 600,
                                    overflow: 'hidden',
                                    background: '#f9fafb',
                                    position: 'relative'
                                }}>
                                    <img
                                        src={apiClient.getMediaUrl(post.image)}
                                        alt="Post"
                                        onClick={() => !post.author.is_blocked && setLightboxImage(apiClient.getMediaUrl(post.image!))}
                                        style={{
                                            width: '100%',
                                            height: 'auto',
                                            display: 'block',
                                            filter: post.author.is_blocked ? 'blur(20px)' : 'none',
                                            transition: 'all 0.3s ease',
                                            transform: post.author.is_blocked ? 'scale(1.1)' : 'scale(1)',
                                            cursor: post.author.is_blocked ? 'default' : 'zoom-in'
                                        }}
                                    />
                                    {post.author.is_blocked && (
                                        <div style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: 'rgba(0,0,0,0.1)',
                                            zIndex: 1
                                        }}>
                                            <Lock size={48} color="white" style={{ opacity: 0.8 }} />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Interactions */}
                            {post.author.is_blocked ? (
                                <div style={{
                                    padding: '16px',
                                    background: '#fee2e2',
                                    color: '#ef4444',
                                    textAlign: 'center',
                                    fontWeight: 600,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 12,
                                    borderBottom: '1px solid #f3f4f6'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Ban size={18} />
                                        <span>Interactions disabled for blocked users</span>
                                    </div>
                                    {post.author.is_blocked_by_me && (
                                        <button
                                            onClick={handleBlockToggle}
                                            style={{
                                                padding: '6px 16px',
                                                background: '#ef4444',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '20px',
                                                fontSize: '13px',
                                                cursor: 'pointer',
                                                fontWeight: 700,
                                                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
                                            }}
                                        >
                                            Unblock to View & Interact
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6' }}>
                                    <div style={{ display: 'flex', gap: 16 }}>
                                        <button onClick={handleLike} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 4 }}>
                                            <Heart style={{ width: 24, height: 24, color: post.is_liked ? '#ef4444' : '#6b7280', fill: post.is_liked ? '#ef4444' : 'none' }} />
                                            <span style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>{post.likes_count}</span>
                                        </button>
                                        <button
                                            onClick={() => setShowComments(!showComments)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 4 }}
                                        >
                                            <MessageCircle style={{ width: 24, height: 24, color: '#6b7280', fill: showComments ? '#7c3aed33' : 'none' }} />
                                            <span style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>{post.comments_count}</span>
                                        </button>
                                    </div>
                                    <button onClick={handleSave} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                                        <Bookmark style={{ width: 24, height: 24, color: post.is_saved ? '#7c3aed' : '#6b7280', fill: post.is_saved ? '#7c3aed' : 'none' }} />
                                    </button>
                                </div>
                            )}

                            {/* Content */}
                            <div style={{ padding: 16, position: 'relative' }}>
                                <div style={{
                                    filter: post.author.is_blocked ? 'blur(10px)' : 'none',
                                    opacity: post.author.is_blocked ? 0.4 : 1,
                                    transition: 'all 0.3s ease',
                                    pointerEvents: post.author.is_blocked ? 'none' : 'auto'
                                }}>
                                    <p style={{ fontSize: 15, lineHeight: 1.6, color: '#1f2937', marginBottom: 12, whiteSpace: 'pre-wrap' }}>{post.content}</p>
                                    {post.tags && post.tags.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                            {post.tags.map(tag => (
                                                <span key={tag} style={{ fontSize: 13, padding: '4px 10px', background: '#f5f3ff', borderRadius: 16, color: '#7c3aed', fontWeight: 600, border: '1px solid #ddd6fe' }}>
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side Comments Panel (Desktop) */}
                {isDesktop && showComments && (
                    <div style={{ width: 400, flexShrink: 0 }}>
                        <CommentsDrawer
                            isOpen={showComments}
                            onClose={() => setShowComments(false)}
                            comments={post?.comments || []}
                            commentsCount={post?.comments_count || 0}
                            loading={false}
                            onAddComment={handleAddComment}
                            onEditComment={handleCommentUpdate}
                            onDeleteComment={handleCommentDelete}
                            isSending={sendingComment}
                            isInline={true}
                        />
                    </div>
                )}
            </div>

            {/* Mobile Comments Drawer (Overlay) */}
            {!isDesktop && (
                <CommentsDrawer
                    isOpen={showComments}
                    onClose={() => setShowComments(false)}
                    comments={post?.comments || []}
                    commentsCount={post?.comments_count || 0}
                    loading={false}
                    onAddComment={handleAddComment}
                    onEditComment={handleCommentUpdate}
                    onDeleteComment={handleCommentDelete}
                    isSending={sendingComment}
                />
            )}
        </div>
    );
}
