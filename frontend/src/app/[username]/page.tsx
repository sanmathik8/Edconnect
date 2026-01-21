'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Heart, MessageCircle, Bookmark, UserPlus, UserCheck, MessageSquare, ArrowLeft, Grid, Share2, Lock, Ban, X } from 'lucide-react';

interface UserProfile {
    id: number;
    uuid: string;
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
    is_blocked: boolean;
    is_blocked_by_me: boolean;
    is_blocking_me: boolean;
    is_private: boolean;
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

export default function UserProfileByUsernamePage() {
    const params = useParams();
    const router = useRouter();
    const { user: authUser } = useAuth();
    const username = params.username as string;

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [postsLoading, setPostsLoading] = useState(true);
    const [followLoading, setFollowLoading] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    useEffect(() => {
        if (username) {
            loadProfile();
        }
    }, [username]);

    const loadProfile = async () => {
        try {
            setLoading(true);
            const profileData = await apiClient.getProfileByUsername(username);
            // Cast to local interface which includes specific fields returned by this endpoint
            setProfile(profileData as unknown as UserProfile);

            loadUserPosts(Number(profileData.id)); // Ensure ID is number
        } catch (error) {
            console.error('Failed to load profile:', error);
            if (error instanceof ApiError && error.isAuthError) {
                router.push('/login');
            } else {
                setLoading(false);
            }
        } finally {
            setLoading(false);
        }
    };

    const loadUserPosts = async (userId: number) => {
        try {
            setPostsLoading(true);
            const postsData = await apiClient.getUserPosts(String(userId));
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

        if (!profile || followLoading || profile.is_blocked) return;

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
        if (profile?.is_blocked) return;
        router.push(`/conversations?userId=${profile?.id}`);
    };

    const handleBlockToggle = async () => {
        if (!profile || !authUser) return;

        try {
            if (profile.is_blocked_by_me) {
                await apiClient.request(`/chat/unblock/${profile.id}/`, { method: 'POST' });
                // Reload the full profile to get accurate state from backend
                await loadProfile();
            } else {
                if (confirm(`Block ${profile.user.username}? They won't be able to message you or see your posts.`)) {
                    await apiClient.request(`/chat/block/${profile.id}/`, { method: 'POST' });
                    setProfile({
                        ...profile,
                        is_blocked_by_me: true,
                        is_blocked: true,
                        is_following: false
                    });
                    setPosts([]);
                }
            }
        } catch (error) {
            console.error('Failed to toggle block:', error);
        }
    };

    const handleLike = async (postId: number) => {
        if (profile?.is_blocked) return;
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
        }
    };

    const handleSave = async (postId: number) => {
        if (profile?.is_blocked) return;
        try {
            const result: any = await apiClient.savePost(postId);
            setPosts(posts.map(post =>
                post.id === postId
                    ? { ...post, is_saved: result.saved || false }
                    : post
            ));
        } catch (err: any) {
            console.error('Failed to save post:', err);
        }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%)' }}>
                <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #7c3aed', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%)' }}>
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Profile not found</h2>
                    <button onClick={() => router.back()} style={{ padding: '0.75rem 1.5rem', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer' }}>Go Back</button>
                </div>
            </div>
        );
    }



    // Fix ID comparison - ensure types match
    const isMe = Number(authUser?.id) === profile.user.id || authUser?.profile_id === String(profile.id);

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fef3c7 0%, #e0e7ff 100%)' }}>
            <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem' }}>
                {/* Header with Back Button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                    <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#fff', border: '1px solid #eee', borderRadius: '20px', cursor: 'pointer', fontWeight: 600, color: '#4b5563' }}>
                        <ArrowLeft size={18} /> Back
                    </button>
                    {!isMe && (
                        <button onClick={handleBlockToggle} style={{ color: profile.is_blocked_by_me ? '#ef4444' : '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Ban size={16} />
                            {profile.is_blocked_by_me ? 'Unblock' : profile.is_blocking_me ? 'Blocked' : 'Block'}
                        </button>
                    )}
                </div>

                {/* Profile Card */}
                <div style={{ background: '#fff', borderRadius: '24px', padding: '2.5rem', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2.5rem', flexWrap: 'wrap' }}>
                        {/* Avatar */}
                        <div style={{ width: '150px', height: '150px', borderRadius: '50%', overflow: 'hidden', border: '5px solid #f5f3ff', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', flexShrink: 0 }}>
                            <img src={apiClient.getAvatarUrl(profile)} alt={profile.user.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>

                        {/* Info Section */}
                        <div style={{ flex: 1, minWidth: '300px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#1f2937', margin: 0 }}>{profile.user.username}</h1>
                                {profile.is_private && <Lock size={20} color="#6b7280" />}
                            </div>
                            <p style={{ fontSize: '1.2rem', color: '#6b7280', marginBottom: '1.5rem' }}>{profile.user.email}</p>

                            {/* Stats */}
                            <div style={{ display: 'flex', gap: '2.5rem', marginBottom: '2rem' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#7c3aed' }}>{posts.length}</div>
                                    <div style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: 500 }}>Posts</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#7c3aed' }}>{profile.followers_count}</div>
                                    <div style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: 500 }}>Followers</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#7c3aed' }}>{profile.following_count}</div>
                                    <div style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: 500 }}>Following</div>
                                </div>
                            </div>

                            {/* Actions */}
                            {!isMe && (
                                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                    {profile.is_blocked_by_me ? (
                                        <button
                                            onClick={handleBlockToggle}
                                            style={{ padding: '0.8rem 2rem', background: '#fee2e2', color: '#ef4444', border: '2px solid #fee2e2', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}
                                        >
                                            <Ban size={20} /> Unblock to Interact
                                        </button>
                                    ) : profile.is_blocking_me ? (
                                        <div style={{ padding: '0.8rem 2rem', background: '#f3f4f6', color: '#6b7280', borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Ban size={20} /> Restricted
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                onClick={handleFollowToggle}
                                                disabled={followLoading}
                                                style={{ padding: '0.8rem 2rem', background: profile.is_following ? '#fff' : '#7c3aed', color: profile.is_following ? '#7c3aed' : '#fff', border: '2px solid #7c3aed', borderRadius: '12px', fontWeight: 700, cursor: followLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}
                                            >
                                                {profile.is_following ? <UserCheck size={20} /> : <UserPlus size={20} />}
                                                {profile.is_following ? 'Following' : 'Follow'}
                                            </button>
                                            <button
                                                onClick={handleMessage}
                                                style={{ padding: '0.8rem 2rem', background: '#fff', color: '#7c3aed', border: '2px solid #7c3aed', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}
                                            >
                                                <MessageSquare size={20} /> Message
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bio */}
                    {profile.bio && (
                        <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f9fafb', borderRadius: '16px', color: '#4b5563', lineHeight: 1.6 }}>
                            {profile.bio}
                        </div>
                    )}
                </div>

                {/* Content Section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                    <Grid size={24} color="#7c3aed" />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1f2937', margin: 0 }}>Posts</h2>
                    {profile.is_blocked && (
                        <span style={{ fontSize: '13px', background: '#fee2e2', color: '#ef4444', padding: '4px 12px', borderRadius: '12px', fontWeight: 600, marginLeft: 'auto' }}>
                            Blurred for restrictions
                        </span>
                    )}
                </div>
                {postsLoading ? (
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #7c3aed', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
                    </div>
                ) : posts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '24px', border: '1px dashed #ddd' }}>
                        <p style={{ color: '#6b7280', fontSize: '1.1rem' }}>No posts yet</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                        {posts.map(post => (
                            <div key={post.id} onClick={() => router.push(`/${profile.user.username}/post/${post.id}`)} style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6', transition: 'transform 0.2s' }}>
                                <div style={{ padding: '1.25rem', position: 'relative' }}>
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
                                                cursor: profile.is_blocked ? 'default' : 'pointer',
                                                backgroundColor: '#ffffff',
                                                zIndex: 10,
                                                border: '2px solid white',
                                                transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                            }}
                                            className="post-thumbnail-pop"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!profile.is_blocked) {
                                                    setLightboxImage(apiClient.getMediaUrl(post.image!));
                                                }
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!profile.is_blocked) {
                                                    e.currentTarget.style.transform = 'scale(1.2) rotate(2deg)';
                                                    e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.18)';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
                                                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.12)';
                                            }}
                                        >
                                            <img
                                                src={apiClient.getMediaUrl(post.image)}
                                                alt="Preview"
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover',
                                                    display: 'block',
                                                    filter: profile.is_blocked ? 'blur(10px)' : 'none'
                                                }}
                                            />
                                            {profile.is_blocked && (
                                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.1)' }}>
                                                    <Lock size={16} color="white" style={{ opacity: 0.7 }} />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <p style={{
                                        margin: 0,
                                        color: '#374151',
                                        fontSize: '0.95rem',
                                        lineHeight: 1.5,
                                        display: '-webkit-box',
                                        WebkitLineClamp: 3,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        filter: profile.is_blocked ? 'blur(4px)' : 'none',
                                        opacity: profile.is_blocked ? 0.5 : 1
                                    }}>
                                        {post.content || post.caption}
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f3f4f6' }}>
                                        <button onClick={(e) => { e.stopPropagation(); handleLike(post.id); }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: post.is_liked ? '#ef4444' : '#6b7280', fontWeight: 600 }}>
                                            <Heart size={18} fill={post.is_liked ? '#ef4444' : 'none'} /> {post.likes_count}
                                        </button>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7280', fontWeight: 500 }}>
                                            <MessageCircle size={18} /> {post.comments_count || 0}
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); handleSave(post.id); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: post.is_saved ? '#7c3aed' : '#6b7280' }}>
                                            <Bookmark size={18} fill={post.is_saved ? '#7c3aed' : 'none'} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <style jsx>{`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
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
        </div>
    );
}
