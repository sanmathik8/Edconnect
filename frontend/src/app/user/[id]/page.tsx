'use client';
/** User Profile Page */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Heart, MessageCircle, Bookmark, UserPlus, UserCheck, MessageSquare, ArrowLeft, Grid, Share2, Loader2, X } from 'lucide-react';
import CommentsDrawer from '@/components/CommentsDrawer';

interface UserProfile {
    id: number;
    user: {
        id: number;
        username: string;
        email: string;
    };
    bio: string;
    interests: string[];
    avatar?: string;
    is_following: boolean;
    followers_count: number;
    following_count: number;
}

interface Post {
    id: number;
    content: string;
    caption?: string;
    image?: string;
    created_at: string;
    likes_count: number;
    is_liked: boolean;
    is_saved?: boolean;
    tags: string[];
    author: any;
    comments_count?: number;
}

export default function UserProfilePage() {
    const params = useParams();
    const router = useRouter();
    const { user: authUser } = useAuth();
    const userId = params.id as string;

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [postsLoading, setPostsLoading] = useState(true);
    const [followLoading, setFollowLoading] = useState(false);

    // Comment states
    const [showComments, setShowComments] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [sendingComment, setSendingComment] = useState(false);
    const [selectedPostComments, setSelectedPostComments] = useState<any[]>([]);
    const [selectedPostCommentsCount, setSelectedPostCommentsCount] = useState(0);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    useEffect(() => {
        if (userId) {
            loadProfile();
            loadUserPosts();
        }
    }, [userId]);

    const loadProfile = async () => {
        try {
            setLoading(true);
            const profileData = await apiClient.getUserProfile(parseInt(userId));
            // Ensure is_following is always a boolean
            setProfile({
                ...profileData,
                id: Number(profileData.id),
                user: {
                    ...profileData.user,
                    id: Number(profileData.user.id)
                },
                is_following: profileData.is_following || false
            });
        } catch (error) {
            console.error('Failed to load profile:', error);
            if (error instanceof ApiError && error.isAuthError) {
                router.push('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    const loadUserPosts = async () => {
        try {
            setPostsLoading(true);
            const postsData = await apiClient.getUserPosts(userId);
            setPosts(Array.isArray(postsData) ? postsData : []);
        } catch (error) {
            console.error('Failed to load posts:', error);
            setPosts([]);
        } finally {
            setPostsLoading(false);
        }
    };

    const handleFollowToggle = async () => {
        if (!authUser) {
            router.push('/login');
            return;
        }

        if (!profile || followLoading) return;

        try {
            setFollowLoading(true);
            if (profile.is_following) {
                await apiClient.unfollowUser(profile.id);
                setProfile({
                    ...profile,
                    is_following: false,
                    followers_count: Math.max(0, profile.followers_count - 1)
                });
            } else {
                await apiClient.followUser(profile.id);
                setProfile({
                    ...profile,
                    is_following: true,
                    followers_count: profile.followers_count + 1
                });
            }
        } catch (error) {
            console.error('Failed to toggle follow:', error);
        } finally {
            setFollowLoading(false);
        }
    };

    const handleMessage = () => {
        if (!authUser) {
            router.push('/login');
            return;
        }
        router.push(`/conversations?userId=${profile?.id}`);
    };

    const handleLike = async (postId: number) => {
        try {
            const result: any = await apiClient.likePost(postId);
            setPosts(posts.map(post =>
                post.id === postId
                    ? {
                        ...post,
                        is_liked: result.liked || false,
                        likes_count: result.likes_count || 0
                    }
                    : post
            ));
        } catch (err: any) {
            console.error('Failed to like post:', err);
            if (err instanceof ApiError && err.isAuthError) {
                router.push('/login');
            }
        }
    };

    const handleSave = async (postId: number) => {
        try {
            const result: any = await apiClient.savePost(postId);
            setPosts(posts.map(post =>
                post.id === postId
                    ? { ...post, is_saved: result.saved || false }
                    : post
            ));
        } catch (err: any) {
            console.error('Failed to save post:', err);
            if (err instanceof ApiError && err.isAuthError) {
                router.push('/login');
            }
        }
    };

    const handleCommentOpen = async (post: Post) => {
        if (!profile) return;
        setSelectedPostId(post.id);
        setSelectedPostCommentsCount(post.comments_count || 0);
        setShowComments(true);
        setCommentsLoading(true);
        try {
            const response: any = await apiClient.getComments(post.id);
            setSelectedPostComments(response.comments || response || []);
        } catch (err) {
            console.error('Failed to load comments:', err);
        } finally {
            setCommentsLoading(false);
        }
    };

    const handleAddComment = async (text: string) => {
        if (!selectedPostId || !authUser || !profile) return;
        setSendingComment(true);
        try {
            const newComment = await apiClient.addComment(selectedPostId, text);
            setSelectedPostComments(prev => [...prev, newComment]);
            setSelectedPostCommentsCount(prev => prev + 1);
            // Update the post count in the grid
            setPosts(prev => prev.map(p =>
                p.id === selectedPostId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p
            ));
        } catch (err) {
            console.error('Failed to add comment:', err);
        } finally {
            setSendingComment(false);
        }
    };

    const handleCommentUpdate = async (commentId: number, text: string) => {
        if (!selectedPostId) return;
        try {
            const updated = await apiClient.updateComment(selectedPostId, commentId, text);
            setSelectedPostComments(prev => prev.map(c => c.id === commentId ? updated : c));
        } catch (err) {
            console.error('Failed to update comment:', err);
        }
    };

    const handleCommentDelete = async (commentId: number) => {
        if (!selectedPostId) return;
        try {
            await apiClient.deleteComment(selectedPostId, commentId);
            setSelectedPostComments(prev => prev.filter(c => c.id !== commentId));
            setSelectedPostCommentsCount(prev => Math.max(0, prev - 1));
            setPosts(prev => prev.map(p =>
                p.id === selectedPostId ? { ...p, comments_count: Math.max(0, (p.comments_count || 0) - 1) } : p
            ));
        } catch (err) {
            console.error('Failed to delete comment:', err);
        }
    };

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%)'
            }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    border: '4px solid #f3f3f3',
                    borderTop: '4px solid #7c3aed',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }}></div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%)'
            }}>
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Profile not found</h2>
                    <button
                        onClick={() => router.back()}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: '#7c3aed',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%)' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
                {/* Back Button */}
                <button
                    onClick={() => router.back()}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1rem',
                        background: 'rgba(255, 255, 255, 0.9)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        marginBottom: '1.5rem',
                        fontWeight: '600',
                        color: '#374151'
                    }}
                >
                    <ArrowLeft size={20} />
                    Back
                </button>

                {/* Profile Header */}
                <div style={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '1rem',
                    padding: '2rem',
                    marginBottom: '2rem',
                    border: '1px solid rgba(124, 58, 237, 0.1)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                        {/* Avatar */}
                        <div style={{
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            border: '4px solid #7c3aed',
                            flexShrink: 0
                        }}>
                            <img
                                src={apiClient.getAvatarUrl(profile)}
                                alt={profile.user.username}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        </div>

                        {/* Profile Info */}
                        <div style={{ flex: 1 }}>
                            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#111827' }}>
                                {profile.user.username}
                            </h1>
                            <p style={{ color: '#6b7280', marginBottom: '1rem' }}>{profile.user.email}</p>

                            {/* Stats */}
                            <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
                                <div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#7c3aed' }}>
                                        {posts.length}
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Posts</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#7c3aed' }}>
                                        {profile.followers_count}
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Followers</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#7c3aed' }}>
                                        {profile.following_count}
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Following</div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            {authUser && String(authUser.id) !== String(profile.user.id) && (
                                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                    <button
                                        onClick={handleFollowToggle}
                                        disabled={followLoading}
                                        style={{
                                            padding: '0.75rem 1.5rem',
                                            background: profile.is_following ? 'transparent' : '#7c3aed',
                                            color: profile.is_following ? '#7c3aed' : 'white',
                                            border: `2px solid #7c3aed`,
                                            borderRadius: '0.5rem',
                                            fontWeight: '600',
                                            cursor: followLoading ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            opacity: followLoading ? 0.7 : 1,
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {profile.is_following ? <UserCheck size={20} /> : <UserPlus size={20} />}
                                        {profile.is_following ? 'Following' : 'Follow'}
                                    </button>
                                    <button
                                        onClick={handleMessage}
                                        style={{
                                            padding: '0.75rem 1.5rem',
                                            background: 'white',
                                            color: '#7c3aed',
                                            border: '2px solid #7c3aed',
                                            borderRadius: '0.5rem',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <MessageSquare size={20} />
                                        Message
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bio */}
                    {profile.bio && (
                        <div style={{ marginBottom: '1rem' }}>
                            <p style={{ color: '#374151', lineHeight: '1.6' }}>{profile.bio}</p>
                        </div>
                    )}

                    {/* Interests */}
                    {profile.interests && profile.interests.length > 0 && (
                        <div>
                            <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.5rem' }}>
                                Interests
                            </h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {profile.interests.map((interest, index) => (
                                    <span
                                        key={index}
                                        style={{
                                            padding: '0.375rem 0.75rem',
                                            background: '#f5f3ff',
                                            color: '#7c3aed',
                                            borderRadius: '1rem',
                                            fontSize: '0.875rem',
                                            fontWeight: '500',
                                            border: '1px solid #e0e7ff'
                                        }}
                                    >
                                        #{interest}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Posts Grid */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                        <Grid size={24} color="#7c3aed" />
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>Posts</h2>
                    </div>

                    {postsLoading ? (
                        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                border: '4px solid #f3f3f3',
                                borderTop: '4px solid #7c3aed',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                                margin: '0 auto'
                            }}></div>
                        </div>
                    ) : posts.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '3rem',
                            background: 'rgba(255, 255, 255, 0.9)',
                            borderRadius: '1rem',
                            border: '1px dashed #e5e7eb'
                        }}>
                            <p style={{ color: '#6b7280' }}>No posts yet</p>
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                            gap: '1.5rem'
                        }}>
                            {posts.map((post) => (
                                <div
                                    key={post.id}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.95)',
                                        borderRadius: '1rem',
                                        overflow: 'hidden',
                                        border: '1px solid rgba(124, 58, 237, 0.1)',
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                                        transition: 'all 0.2s',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => router.push(`/${profile.user.username}/post/${post.id}`)}
                                >
                                    <div style={{ padding: '1.5rem', position: 'relative' }}>
                                        {post.image && (
                                            <div
                                                style={{
                                                    float: 'right',
                                                    marginLeft: '12px',
                                                    marginBottom: '8px',
                                                    width: '90px',
                                                    height: '60px',
                                                    borderRadius: '12px',
                                                    overflow: 'hidden',
                                                    boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
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
                                                    e.currentTarget.style.transform = 'scale(1.2) rotate(2deg)';
                                                    e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.18)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
                                                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.12)';
                                                }}
                                            >
                                                <img
                                                    src={apiClient.getMediaUrl(post.image)}
                                                    alt="Preview"
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                />
                                            </div>
                                        )}
                                        <p style={{
                                            color: '#374151',
                                            marginBottom: '0.75rem',
                                            lineHeight: '1.5',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 3,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden'
                                        }}>
                                            {post.content || post.caption}
                                        </p>

                                        {/* Tags */}
                                        {post.tags && post.tags.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.75rem' }}>
                                                {post.tags.slice(0, 3).map((tag, idx) => (
                                                    <span
                                                        key={idx}
                                                        style={{
                                                            fontSize: '0.75rem',
                                                            color: '#7c3aed',
                                                            background: '#f5f3ff',
                                                            padding: '0.25rem 0.5rem',
                                                            borderRadius: '0.5rem'
                                                        }}
                                                    >
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #f3f4f6' }}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleLike(post.id);
                                                }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.375rem',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: post.is_liked ? '#ef4444' : '#6b7280',
                                                    fontSize: '0.875rem',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                <Heart size={18} fill={post.is_liked ? '#ef4444' : 'none'} />
                                                {post.likes_count}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCommentOpen(post);
                                                }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.375rem',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: '#6b7280',
                                                    fontSize: '0.875rem',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                <MessageCircle size={18} />
                                                {post.comments_count || 0}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSave(post.id);
                                                }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.375rem',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: post.is_saved ? '#7c3aed' : '#6b7280',
                                                    marginLeft: 'auto'
                                                }}
                                            >
                                                <Bookmark size={18} fill={post.is_saved ? '#7c3aed' : 'none'} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <style jsx global>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes popIn {
                    0% { opacity: 0; transform: scale(0.5) translateY(40px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
                .post-thumbnail-pop:hover {
                    z-index: 20;
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
                        zIndex: 2000,
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

            <CommentsDrawer
                isOpen={showComments}
                onClose={() => setShowComments(false)}
                comments={selectedPostComments}
                commentsCount={selectedPostCommentsCount}
                loading={commentsLoading}
                onAddComment={handleAddComment}
                onEditComment={handleCommentUpdate}
                onDeleteComment={handleCommentDelete}
                isSending={sendingComment}
            />
        </div>
    );
}
