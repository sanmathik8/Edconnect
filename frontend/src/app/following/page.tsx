'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, MessageCircle, Search, X, Filter, TrendingUp, Clock, Loader2, UserX } from 'lucide-react';
import { apiClient, Post, ApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import CommentsDrawer from '@/components/CommentsDrawer';

interface Comment {
    id: number;
    content: string;
    created_at: string;
    author: {
        id: number;
        user: {
            username: string;
        };
        avatar: string | null;
    };
}

interface FollowingPost extends Omit<Post, 'author'> {
    author: {
        id: number;
        user: {
            id: number;
            username: string;
        };
        avatar: string | null;
    };
    comments_count?: number;
    is_saved?: boolean;
    caption?: string;
}

export default function FollowingPage() {
    const [posts, setPosts] = useState<FollowingPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('recent');
    const [showFilterMenu, setShowFilterMenu] = useState(false);

    // Comments Drawer State
    const [activeCommentPostId, setActiveCommentPostId] = useState<number | null>(null);
    const [sendingComment, setSendingComment] = useState(false);
    const [postComments, setPostComments] = useState<Record<number, Comment[]>>({});
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    const { user: authUser } = useAuth();
    const router = useRouter();

    useEffect(() => {
        loadFollowingPosts();
    }, []);

    const loadFollowingPosts = async () => {
        try {
            setLoading(true);
            if (!authUser) {
                router.push('/auth/login?next=/following');
                return;
            }

            const data = await apiClient.getFollowingPosts();
            const postsData = (Array.isArray(data) ? data : []) as unknown as FollowingPost[];
            setPosts(postsData);
        } catch (err: any) {
            console.error('Failed to load following posts:', err);
            setError('Failed to load posts from following');
        } finally {
            setLoading(false);
        }
    };

    const handleLike = async (postId: number) => {
        try {
            const result: any = await apiClient.likePost(postId);
            setPosts(posts.map(post =>
                post.id === postId
                    ? { ...post, is_liked: result.liked, likes_count: result.likes_count }
                    : post
            ));
        } catch (err) {
            console.error('Failed to like post:', err);
        }
    };

    const loadComments = async (postId: number) => {
        try {
            const result: any = await apiClient.getComments(postId);
            const comments = result.comments || result || [];
            setPostComments(prev => ({
                ...prev,
                [postId]: Array.isArray(comments) ? comments : []
            }));
        } catch (err) {
            console.error('Failed to load comments:', err);
        }
    };

    const handleCommentSubmit = async (content: string) => {
        if (!activeCommentPostId || !content.trim()) return;
        const postId = activeCommentPostId;

        try {
            setSendingComment(true);
            await apiClient.addComment(postId, content);

            loadComments(postId);

            setPosts(posts.map(post =>
                post.id === postId
                    ? {
                        ...post,
                        comments_count: (post.comments_count || 0) + 1
                    }
                    : post
            ));
        } catch (err: any) {
            console.error('Failed to post comment:', err);
            if (err instanceof ApiError && err.isAuthError) {
                alert('Please log in to comment');
            }
        } finally {
            setSendingComment(false);
        }
    };

    const handleCommentUpdate = async (commentId: number, text: string) => {
        if (!activeCommentPostId) return;
        const postId = activeCommentPostId;
        try {
            const updated = await apiClient.updateComment(postId, commentId, text);
            setPostComments(prev => ({
                ...prev,
                [postId]: prev[postId]?.map(c => c.id === commentId ? updated : c) || []
            }));
        } catch (err) {
            console.error('Failed to update comment:', err);
        }
    };

    const handleCommentDelete = async (commentId: number) => {
        if (!activeCommentPostId) return;
        const postId = activeCommentPostId;

        if (!confirm('Are you sure you want to delete this comment?')) return;

        try {
            await apiClient.deleteComment(postId, commentId);

            setPostComments(prev => ({
                ...prev,
                [postId]: prev[postId]?.filter(c => c.id !== commentId) || []
            }));

            setPosts(posts.map(post =>
                post.id === postId
                    ? {
                        ...post,
                        comments_count: Math.max((post.comments_count || 0) - 1, 0)
                    }
                    : post
            ));
        } catch (err) {
            console.error('Failed to delete comment:', err);
            alert('Failed to delete comment');
        }
    };

    const openComments = (postId: number) => {
        setActiveCommentPostId(postId);
        if (!postComments[postId]) {
            loadComments(postId);
        }
    };

    const closeComments = () => {
        setActiveCommentPostId(null);
    };

    // Filter and Sort Logic
    const filteredPosts = posts.filter(post => {
        const query = searchQuery.toLowerCase();
        return (
            (post.content && post.content.toLowerCase().includes(query)) ||
            (post.caption && post.caption.toLowerCase().includes(query)) ||
            (post.author.user.username.toLowerCase().includes(query))
        );
    });

    const sortedPosts = [...filteredPosts].sort((a, b) => {
        if (sortBy === 'popular') {
            return (b.likes_count || 0) - (a.likes_count || 0);
        } else if (sortBy === 'trending') {
            const scoreA = (a.likes_count || 0) + (a.comments_count || 0) * 2;
            const scoreB = (b.likes_count || 0) + (b.comments_count || 0) * 2;
            return scoreB - scoreA;
        }
        // Recent
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '2rem 1rem' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header Section */}
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h1 style={{ fontSize: '2rem', fontWeight: '800', color: '#1e293b', margin: 0, letterSpacing: '-0.5px' }}>Following</h1>
                            <p style={{ color: '#64748b', marginTop: '0.5rem', fontSize: '1.1rem' }}>Latest updates from people you follow</p>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <button
                                onClick={() => router.push('/explore')}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: 'white',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '12px',
                                    color: '#64748b',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <Search size={18} />
                                Find More People
                            </button>
                        </div>
                    </div>

                    {/* Search and Filter Bar */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '300px', position: 'relative' }}>
                            <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={20} />
                            <input
                                type="text"
                                placeholder="Search posts..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '1rem 1rem 1rem 3rem',
                                    borderRadius: '1rem',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                                }}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>

                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setShowFilterMenu(!showFilterMenu)}
                                style={{
                                    height: '100%',
                                    padding: '0 1.5rem',
                                    background: 'white',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    color: '#475569',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                                }}
                            >
                                <Filter size={18} />
                                {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
                            </button>

                            {showFilterMenu && (
                                <div style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 8px)',
                                    right: 0,
                                    background: 'white',
                                    borderRadius: '12px',
                                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                                    border: '1px solid #e2e8f0',
                                    padding: '0.5rem',
                                    minWidth: '180px',
                                    zIndex: 20
                                }}>
                                    {[
                                        { id: 'recent', label: 'Recent', icon: Clock },
                                        { id: 'popular', label: 'Popular', icon: Heart },
                                        { id: 'trending', label: 'Trending', icon: TrendingUp }
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => { setSortBy(opt.id); setShowFilterMenu(false); }}
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem 1rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.75rem',
                                                background: sortBy === opt.id ? '#f3f4f6' : 'transparent',
                                                border: 'none',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                color: sortBy === opt.id ? '#1e293b' : '#64748b',
                                                fontWeight: sortBy === opt.id ? '600' : '400',
                                                textAlign: 'left'
                                            }}
                                        >
                                            <opt.icon size={16} />
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content Grid */}
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                        <Loader2 className="spin" size={40} color="#6366f1" />
                    </div>
                ) : sortedPosts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                        <div style={{ width: '80px', height: '80px', background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                            <UserX size={40} color="#94a3b8" />
                        </div>
                        <h2 style={{ color: '#1e293b', marginBottom: '0.5rem' }}>No posts found</h2>
                        <p style={{ color: '#64748b' }}>
                            {searchQuery ? "No posts match your search." : "Follow more people to see their posts here!"}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={() => router.push('/explore')}
                                style={{ marginTop: '1.5rem', padding: '0.75rem 2rem', background: '#6366f1', color: 'white', borderRadius: '12px', border: 'none', fontWeight: '600', cursor: 'pointer' }}
                            >
                                Explore People
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: '2rem'
                    }}>
                        {sortedPosts.map(post => (
                            <div key={post.id} className="post-card" style={{
                                background: 'white',
                                borderRadius: '20px',
                                overflow: 'hidden',
                                border: '1px solid #e2e8f0',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                position: 'relative'
                            }}>



                                {/* Post Info */}
                                <div style={{ padding: '1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                                        <div
                                            style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', cursor: 'pointer', border: '1px solid #e2e8f0' }}
                                            onClick={() => router.push(`/user/${post.author.id}`)}
                                        >
                                            <img src={post.author.avatar || '/default-avatar.png'} alt={post.author.user.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{ fontWeight: '700', color: '#1e293b', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                onClick={() => router.push(`/user/${post.author.id}`)}
                                            >
                                                {post.author.user.username}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                                {new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                onClick={() => handleLike(post.id)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: post.is_liked ? '#ef4444' : '#94a3b8', transition: 'transform 0.2s', padding: 0 }}
                                                className="like-btn"
                                            >
                                                <Heart fill={post.is_liked ? '#ef4444' : 'none'} size={22} />
                                            </button>
                                            <button
                                                onClick={() => openComments(post.id)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', transition: 'transform 0.2s', padding: 0 }}
                                                className="comment-btn"
                                            >
                                                <MessageCircle size={22} />
                                            </button>
                                        </div>
                                    </div>

                                    {post.image && (
                                        <div
                                            style={{
                                                float: 'right',
                                                marginLeft: '12px',
                                                marginBottom: '8px',
                                                width: '80px',
                                                height: '60px',
                                                borderRadius: '12px',
                                                overflow: 'hidden',
                                                boxShadow: '0 8px 16px rgba(0,0,0,0.12)',
                                                cursor: 'pointer',
                                                backgroundColor: '#ffffff',
                                                zIndex: 10,
                                                border: '2px solid white',
                                                transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                            }}
                                            className="post-thumbnail-pop"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setLightboxImage(apiClient.getMediaUrl(post.image!));
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'scale(1.2) rotate(-2deg)';
                                                e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.18)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
                                                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.12)';
                                            }}
                                        >
                                            <img
                                                src={apiClient.getMediaUrl(post.image)}
                                                alt="Preview"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        </div>
                                    )}
                                    <p
                                        onClick={() => router.push(`/${post.author.user.username}/post/${post.id}`)}
                                        style={{
                                            color: '#334155',
                                            lineHeight: '1.5',
                                            fontSize: '0.95rem',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            marginBottom: '0',
                                            minHeight: '2.8rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {post.content || post.caption}
                                    </p>

                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style jsx global>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
                @keyframes popIn {
                    0% { opacity: 0; transform: scale(0.5) translateY(40px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes spin { 100% { transform: rotate(360deg); } }
                
                .post-card:hover {
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
                    transform: translateY(-4px);
                }
                .post-card:hover .post-image {
                    transform: scale(1.05);
                }
                .overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                .post-card:hover .overlay {
                    opacity: 1;
                }
                .like-btn:active, .comment-btn:active {
                    transform: scale(0.8);
                }
                .comment-btn:hover {
                    color: #6366f1 !important;
                }
            `}</style>
            {/* Lightbox Modal */}
            {lightboxImage && (
                <div
                    onClick={() => setLightboxImage(null)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.85)',
                        backdropFilter: 'blur(8px)',
                        padding: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        cursor: 'pointer'
                    }}
                >
                    <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
                        <img
                            src={lightboxImage}
                            alt="Full view"
                            style={{
                                maxWidth: '100%',
                                maxHeight: '90vh',
                                objectFit: 'contain',
                                borderRadius: '16px',
                                boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
                                animation: 'popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                            }}
                        />
                        <button
                            onClick={(e) => { e.stopPropagation(); setLightboxImage(null); }}
                            style={{
                                position: 'absolute',
                                top: '-40px',
                                right: '0px',
                                background: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: '#1e293b'
                            }}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}

            {/* Comments Drawer */}
            <CommentsDrawer
                isOpen={!!activeCommentPostId}
                onClose={closeComments}
                comments={activeCommentPostId ? postComments[activeCommentPostId] || [] : []}
                commentsCount={activeCommentPostId && posts.find(p => p.id === activeCommentPostId)?.comments_count || 0}
                loading={activeCommentPostId ? !postComments[activeCommentPostId] : false}
                onAddComment={handleCommentSubmit}
                onEditComment={handleCommentUpdate}
                onDeleteComment={handleCommentDelete}
                isSending={sendingComment}
            />
        </div>
    );
}
