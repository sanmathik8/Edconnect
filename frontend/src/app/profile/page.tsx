'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import {
    Settings, LogOut, MapPin, Calendar, Edit2, Check, X, Folder, Plus, Trash2,
    Bookmark, Heart, MessageCircle, Camera, ChevronLeft, ChevronRight,
    Clock, FileText, User, Sparkles, Lock
} from 'lucide-react';
import { ChangePasswordModal } from '@/components/ChangePasswordModal';
import { toast } from 'react-hot-toast';

interface ProfileData {
    user: {
        id: number;
        username: string;
        email: string;
    };
    bio?: string;
    avatar?: string;
    posts_count?: number;
    followers_count?: number;
    following_count?: number;
    username?: string;
}

export default function ProfilePage() {
    const { user, logout, updateUser } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('saved');
    const [currentPage, setCurrentPage] = useState(1);
    const postsPerPage = 12;
    const [loading, setLoading] = useState(true);
    const [profileData, setProfileData] = useState<ProfileData | null>(null);

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffInMs = now.getTime() - date.getTime();
        const diffInSeconds = Math.floor(diffInMs / 1000);
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        const diffInHours = Math.floor(diffInMinutes / 60);
        const diffInDays = Math.floor(diffInHours / 24);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInHours < 24) return `${diffInHours}h ago`;
        if (diffInDays < 7) return `${diffInDays}d ago`;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    };

    const [savedPosts, setSavedPosts] = useState<any[]>([]);
    const [collections, setCollections] = useState<any[]>([]);
    const [followers, setFollowers] = useState<any[]>([]);
    const [following, setFollowing] = useState<any[]>([]);
    const [blockedUsers, setBlockedUsers] = useState<any[]>([]);

    const [editBio, setEditBio] = useState('');
    const [editUsername, setEditUsername] = useState('');
    const [defaultAvatars, setDefaultAvatars] = useState<{ id: string, url: string }[]>([]);
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [showCreateCollectionModal, setShowCreateCollectionModal] = useState(false);
    const [showEditCollectionModal, setShowEditCollectionModal] = useState(false);
    const [showCollectionItemsModal, setShowCollectionItemsModal] = useState(false);
    const [showFollowersModal, setShowFollowersModal] = useState(false);
    const [showFollowingModal, setShowFollowingModal] = useState(false);
    const [showBlockedModal, setShowBlockedModal] = useState(false);
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
    const [collectionsPage, setCollectionsPage] = useState(1);
    const collectionsPerPage = 15; // 3*5 grid

    const [selectedCollection, setSelectedCollection] = useState<any>(null);
    const [collectionName, setCollectionName] = useState('');
    const [collectionItems, setCollectionItems] = useState<any[]>([]);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    const [showSaveToCollectionModal, setShowSaveToCollectionModal] = useState(false);
    const [postToAddToCollection, setPostToAddToCollection] = useState<any>(null);

    useEffect(() => {
        if (!user) {
            router.push('/login');
            return;
        }
        loadAllData();
    }, [user]);

    const renderPostCard = (post: any, hideActions: boolean = false) => {
        if (!post) return null;
        const content = post.content || post.caption || '';

        return (
            <div
                key={post.id}
                style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #dbdbdb',
                    borderRadius: '0.75rem',
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                }}
                onClick={() => router.push(`/${post.author?.user?.username}/post/${post.id}`)}
                onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateY(0)';
                }}
            >
                {/* Post Header */}
                <div style={{
                    padding: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    borderBottom: '1px solid #efefef'
                }}>
                    <div style={{
                        width: '2rem',
                        height: '2rem',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        flexShrink: 0
                    }}>
                        <img
                            src={apiClient.getAvatarUrl(post.author)}
                            alt={post.author?.user?.username}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: '600', color: '#262626', margin: 0, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {post.author?.user?.username || 'Unknown User'}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: '#8e8e8e', marginTop: '0.125rem' }}>
                            <Clock style={{ width: '0.75rem', height: '0.75rem' }} />
                            <span>{formatDate(post.created_at)}</span>
                        </div>
                    </div>
                    {!hideActions && savedPosts.find(p => p.id === post.id) && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                handleToggleSave(post.id);
                            }}
                            style={{
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '4px',
                                borderRadius: '50%',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <Bookmark size={18} fill="#7c3aed" color="#7c3aed" />
                        </div>
                    )}
                </div>


                {/* Post Actions */}
                <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderTop: '1px solid #efefef' }}>
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            handleToggleLike(post);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: post.is_liked ? '#ed4956' : '#262626', cursor: 'pointer' }}
                    >
                        <Heart style={{ width: '1.375rem', height: '1.375rem', fill: post.is_liked ? '#ed4956' : 'none', stroke: post.is_liked ? '#ed4956' : 'currentColor', strokeWidth: 2 }} />
                        <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>{post.likes_count || 0}</span>
                    </div>
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/${post.author?.user?.username}/post/${post.id}?openComments=true`);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#262626', cursor: 'pointer' }}
                    >
                        <MessageCircle style={{ width: '1.375rem', height: '1.375rem', strokeWidth: 2 }} />
                        <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>{post.comments_count || 0}</span>
                    </div>
                    {activeTab === 'saved' && (
                        <div
                            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '2rem', height: '2rem', borderRadius: '50%', cursor: 'pointer', transition: 'background 0.2s' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setPostToAddToCollection(post);
                                setShowSaveToCollectionModal(true);
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            title="Add to Collection"
                        >
                            <Plus style={{ width: '1.5rem', height: '1.5rem', color: '#262626' }} />
                        </div>
                    )}
                </div>

                {/* Post Content */}
                <div style={{ padding: '1.25rem', position: 'relative' }}>
                    {post.image && (
                        <div
                            style={{
                                float: 'right',
                                marginLeft: '12px',
                                marginBottom: '8px',
                                width: '80px',
                                height: '54px',
                                borderRadius: '10px',
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
                                e.currentTarget.style.transform = 'scale(1.2) rotate(2deg)';
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
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                        </div>
                    )}
                    {content && (
                        <p style={{
                            color: '#262626',
                            lineHeight: '1.5',
                            margin: 0,
                            fontSize: '0.875rem',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'break-word'
                        }}>
                            {content}
                        </p>
                    )}
                </div>
            </div>
        );
    };

    const handleToggleLike = async (post: any) => {
        try {
            await apiClient.request(`/posts/${post.id}/like/`, { method: 'POST' });

            const updatePostInList = (list: any[]) => list.map(p => {
                if (p.id === post.id) {
                    return {
                        ...p,
                        is_liked: !p.is_liked,
                        likes_count: p.is_liked ? (p.likes_count - 1) : (p.likes_count + 1)
                    };
                }
                return p;
            });

            setSavedPosts(prev => updatePostInList(prev));
            // If we had a 'posts' tab, we'd update that too.
        } catch (error) {
            console.error('Failed to toggle like', error);
        }
    };

    const handleToggleSave = async (postId: number) => {
        try {
            await apiClient.savePost(postId);
            setSavedPosts(prev => prev.filter(p => p.id !== postId));
            toast.success('Post unsaved');
        } catch (error) {
            console.error('Failed to toggle save', error);
            toast.error('Failed to update saved status');
        }
    };

    const loadAllData = async () => {
        try {
            setLoading(true);
            const [profile, sPosts, sCols, followersList, followingList] = await Promise.all([
                apiClient.getCurrentUser(),
                apiClient.getSavedPosts(),
                apiClient.getCollections(),
                apiClient.getFollowers('me'),
                apiClient.getFollowingUsers()
            ]);

            // Separate call for blocked users to avoid breaking if endpoint issue
            let blockedList: any[] = [];
            try {
                blockedList = await apiClient.getBlockedUsers();
            } catch (e) {
                console.warn('Could not load blocked users', e);
            }

            setProfileData(profile as unknown as ProfileData);
            setEditBio(profile?.bio || '');
            setEditUsername(profile?.user?.username || '');

            let savedPostsArray: any[] = [];
            if (Array.isArray(sPosts)) {
                savedPostsArray = sPosts;
            } else if (sPosts && typeof sPosts === 'object') {
                savedPostsArray = (sPosts as any).results || (sPosts as any).posts || [];
            }

            setSavedPosts(savedPostsArray);
            setCollections(Array.isArray(sCols) ? sCols : []);
            setFollowers(Array.isArray(followersList) ? followersList : []);
            setFollowing(Array.isArray(followingList) ? followingList : []);
            setBlockedUsers(Array.isArray(blockedList) ? blockedList : []);

        } catch (error) {
            console.error('Failed to load profile data', error);
        } finally {
            setLoading(false);
        }
    };

    const loadDefaultAvatars = async () => {
        try {
            const data = await apiClient.getDefaultAvatars();
            setDefaultAvatars(data.avatars);
        } catch (error) {
            console.error('Failed to load default avatars', error);
        }
    };

    const handleUpdateUsername = async () => {
        if (!editUsername) return;
        const currentUsername = (profileData as any)?.user?.username;
        if (editUsername === currentUsername) {
            toast('No changes to username');
            return;
        }

        try {
            await apiClient.updateProfile({ username: editUsername });
            const updated = await apiClient.getCurrentUser();
            setProfileData(updated as unknown as ProfileData);
            if (updateUser && updated) updateUser(updated as any);
            toast.success('Username updated successfully');
        } catch (error: any) {
            console.error('Failed to update username', error);
            const message = error.detail || error.message || 'Failed to update username';
            toast.error(message);
        }
    };

    const handleUpdateBio = async () => {
        try {
            await apiClient.updateProfile({ bio: editBio });
            const updated = await apiClient.getCurrentUser();
            setProfileData(updated as unknown as ProfileData);
            if (updateUser && updated) updateUser(updated as any);
            toast.success('Bio updated successfully');
        } catch (error: any) {
            console.error('Failed to update bio', error);
            const message = error.detail || error.message || 'Failed to update bio';
            toast.error(message);
        }
    };

    const handleSelectDefaultAvatar = async (url: string) => {
        try {
            await apiClient.updateProfile({ default_avatar_url: url });
            const updated = await apiClient.getCurrentUser();
            setProfileData(updated as unknown as ProfileData);
            if (updateUser && updated) updateUser(updated as any);
            setShowAvatarModal(false);
            toast.success('Avatar updated!');
        } catch (error) {
            console.error('Failed to update avatar', error);
            toast.error('Failed to update avatar');
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        try {
            await apiClient.updateProfile(formData);
            const updated = await apiClient.getCurrentUser();
            setProfileData(updated as unknown as ProfileData);
            if (updateUser && updated) updateUser(updated as any);
        } catch (error) {
            console.error('Failed to update avatar', error);
            toast.error('Failed to upload avatar');
        }
    };

    const handleCreateCollection = async () => {
        if (!collectionName.trim()) {
            alert('Please enter a collection name');
            return;
        }
        try {
            const newCollection = await apiClient.createCollection(collectionName);
            setCollectionName('');
            setShowCreateCollectionModal(false);

            // Immediate update for better UX
            setCollections(prev => {
                const updated = [newCollection, ...prev];
                return updated;
            });
            setCollectionsPage(1); // Reset to first page to see the new item

            // Background refresh to ensure sync
            apiClient.getCollections().then(cols => {
                if (Array.isArray(cols)) setCollections(cols);
            }).catch(console.error);

        } catch (error: any) {
            console.error('Failed to create collection', error);
            let message = error.message || 'Failed to create collection';
            if (error.formErrors) {
                const details = Object.values(error.formErrors).flat().join('\n');
                if (details) message = details;
            }
            toast.error(message);
        }
    };

    const handleUpdateCollection = async () => {
        if (!selectedCollection || !collectionName.trim()) return;
        try {
            await apiClient.updateCollection(selectedCollection.id, collectionName);
            setCollectionName('');
            setShowEditCollectionModal(false);
            setSelectedCollection(null);
            const cols = await apiClient.getCollections();
            setCollections(Array.isArray(cols) ? cols : []);
        } catch (error: any) {
            console.error('Failed to update collection', error);
            toast.error(error.message || 'Failed to update collection');
        }
    };

    const handleDeleteCollection = async (collectionId: number) => {
        if (!confirm('Delete this collection? Posts will not be deleted.')) return;
        try {
            await apiClient.deleteCollection(collectionId);
            const cols = await apiClient.getCollections();
            setCollections(Array.isArray(cols) ? cols : []);
        } catch (error: any) {
            console.error('Failed to delete collection', error);
            toast.error(error.message || 'Failed to delete collection');
        }
    };

    const handleViewCollection = async (collection: any) => {
        setSelectedCollection(collection);
        try {
            const items = await apiClient.getCollectionItems(collection.id);
            setCollectionItems(Array.isArray(items) ? items : []);
            setShowCollectionItemsModal(true);
        } catch (error) {
            console.error('Failed to load collection items', error);
        }
    };

    const handleUnblock = async (targetUserId: number) => {
        try {
            await apiClient.unblockUser(String(targetUserId));
            setBlockedUsers(prev => prev.filter(req => req.user?.id !== targetUserId));
            // Also refresh other data as unblocking might affect followers/following visibility
            const [followersList, followingList] = await Promise.all([
                apiClient.getFollowers('me'),
                apiClient.getFollowingUsers()
            ]);
            setFollowers(Array.isArray(followersList) ? followersList : []);
            setFollowing(Array.isArray(followingList) ? followingList : []);
        } catch (error) {
            console.error('Failed to unblock user', error);
            toast.error('Failed to unblock user');
        }
    };

    const handleAddToCollection = async (collectionId: number) => {
        if (!postToAddToCollection) return;
        try {
            await apiClient.addToCollection(collectionId, postToAddToCollection.id);
            toast.success('Post added to collection');
            setShowSaveToCollectionModal(false);
            setPostToAddToCollection(null);
            // Refresh collections to update counts
            const cols = await apiClient.getCollections();
            setCollections(Array.isArray(cols) ? cols : []);
        } catch (error: any) {
            console.error('Failed to add to collection', error);
            toast.error(error.message || 'Failed to add to collection');
        }
    };

    const getCurrentData = () => {
        switch (activeTab) {
            case 'saved': return savedPosts;
            case 'collections': return collections;
            case 'settings': return [];
            default: return savedPosts;
        }
    };

    const currentData = getCurrentData();
    const totalPages = Math.ceil(currentData.length / postsPerPage);
    const paginatedData = currentData.slice((currentPage - 1) * postsPerPage, currentPage * postsPerPage);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 300, behavior: 'smooth' });
    };

    const renderPagination = () => {
        if (totalPages <= 1) return null;

        const pages = [];
        const maxVisiblePages = 3;
        let startPage = currentPage;
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }

        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
                <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    style={{
                        padding: '0.625rem',
                        backgroundColor: currentPage === 1 ? '#f0f0f0' : '#ffffff',
                        border: '1px solid #dbdbdb',
                        borderRadius: '0.5rem',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        opacity: currentPage === 1 ? 0.5 : 1
                    }}
                >
                    <ChevronLeft style={{ width: '1.25rem', height: '1.25rem', color: '#262626' }} />
                </button>

                {pages.map(page => (
                    <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        style={{
                            padding: '0.625rem 0.875rem',
                            backgroundColor: page === currentPage ? '#7c3aed' : '#ffffff',
                            color: page === currentPage ? '#ffffff' : '#262626',
                            border: page === currentPage ? '1px solid #7c3aed' : '1px solid #dbdbdb',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontWeight: page === currentPage ? '600' : '500',
                            fontSize: '0.875rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        {page}
                    </button>
                ))}

                <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    style={{
                        padding: '0.625rem',
                        backgroundColor: currentPage === totalPages ? '#f0f0f0' : '#ffffff',
                        border: '1px solid #dbdbdb',
                        borderRadius: '0.5rem',
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        opacity: currentPage === totalPages ? 0.5 : 1
                    }}
                >
                    <ChevronRight style={{ width: '1.25rem', height: '1.25rem', color: '#262626' }} />
                </button>
            </div>
        );
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab]);

    if (!user) return null;

    const displayUser = profileData || { ...user, bio: '', display_name: '' };

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%)' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1rem' }}>
                {/* Profile Header */}
                <div style={{ marginBottom: '2rem', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                        {/* Avatar */}
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                width: '120px',
                                height: '120px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <div style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    background: 'white'
                                }}>
                                    <img
                                        src={displayUser.avatar || apiClient.getAvatarUrl(displayUser)}
                                        alt={displayUser.username}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                </div>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={handleAvatarUpload}
                                accept="image/*"
                            />
                            <button
                                onClick={() => {
                                    setShowAvatarModal(true);
                                    if (defaultAvatars.length === 0) loadDefaultAvatars();
                                }}
                                style={{
                                    position: 'absolute',
                                    bottom: '0',
                                    right: '0',
                                    background: '#7c3aed',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '36px',
                                    height: '36px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                                    zIndex: 2
                                }}
                                title="Change avatar"
                            >
                                <Camera size={18} />
                            </button>
                        </div>

                        {/* User Info */}
                        <div style={{ textAlign: 'center' }}>
                            <h1 style={{ fontSize: '1.875rem', fontWeight: '800', margin: '0 0 0.5rem 0', color: '#111827' }}>
                                {profileData?.username || user?.username || ''}
                            </h1>
                            <p style={{ color: '#6b7280', margin: '0 0 1rem 0', maxWidth: '400px', lineHeight: '1.5', fontSize: '0.9375rem' }}>
                                {displayUser.bio || "No bio yet."}
                            </p>

                            {/* Stats */}
                            <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center' }}>
                                <div
                                    onClick={() => setShowFollowersModal(true)}
                                    style={{ textAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s' }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>{followers.length}</div>
                                    <div style={{ fontSize: '0.8125rem', color: '#6b7280', fontWeight: '500' }}>Followers</div>
                                </div>
                                <div
                                    onClick={() => setShowFollowingModal(true)}
                                    style={{ textAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s' }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>{following.length}</div>
                                    <div style={{ fontSize: '0.8125rem', color: '#6b7280', fontWeight: '500' }}>Following</div>
                                </div>
                                <div
                                    onClick={() => setShowBlockedModal(true)}
                                    style={{ textAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s' }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ef4444' }}>{blockedUsers.length}</div>
                                    <div style={{ fontSize: '0.8125rem', color: '#6b7280', fontWeight: '500' }}>Blocked</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.7)', padding: '0.35rem', borderRadius: '1rem', border: '1px solid rgba(124, 58, 237, 0.2)', width: 'fit-content', backdropFilter: 'blur(10px)', margin: '0 auto' }}>
                        {[
                            { id: 'saved', icon: Bookmark, label: 'Saved' },
                            { id: 'collections', icon: Folder, label: 'Collections' },
                            { id: 'settings', icon: Settings, label: 'Settings' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: '0.6rem 1.5rem',
                                    borderRadius: '0.75rem',
                                    border: 'none',
                                    background: activeTab === tab.id ? '#7c3aed' : 'transparent',
                                    color: activeTab === tab.id ? '#ffffff' : '#6b7280',
                                    fontWeight: '700',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    boxShadow: activeTab === tab.id ? '0 4px 12px rgba(124, 58, 237, 0.3)' : 'none'
                                }}
                            >
                                <tab.icon style={{ width: '1rem', height: '1rem' }} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div style={{ minHeight: '300px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8rem 0' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{
                                    width: '2.5rem',
                                    height: '2.5rem',
                                    border: '3px solid #f3f3f3',
                                    borderTopColor: '#7c3aed',
                                    borderRadius: '50%',
                                    animation: 'spin 0.8s linear infinite',
                                    margin: '0 auto 1rem'
                                }}></div>
                                <p style={{ color: '#8e8e8e', fontSize: '0.9375rem' }}>Loading...</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'saved' && (
                                paginatedData.length > 0 ? (
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 350px), 1fr))',
                                        gap: '1.5rem'
                                    }}>
                                        {paginatedData.map(post => renderPostCard(post))}
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '6rem 0' }}>
                                        <div style={{
                                            width: '5rem',
                                            height: '5rem',
                                            backgroundColor: '#ffffff',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 1.5rem',
                                            border: '1px solid #dbdbdb'
                                        }}>
                                            <Bookmark style={{ width: '2.5rem', height: '2.5rem', color: '#c7c7c7' }} />
                                        </div>
                                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#262626', marginBottom: '0.5rem' }}>
                                            No saved posts yet
                                        </h3>
                                        <p style={{ color: '#8e8e8e', maxWidth: '28rem', margin: '0 auto', fontSize: '0.9375rem' }}>
                                            Posts you save will appear here
                                        </p>
                                    </div>
                                )
                            )}

                            {activeTab === 'settings' && (
                                <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                                    <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827', marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.75rem' }}>
                                            Profile Settings
                                        </h3>

                                        {/* Username Section */}
                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                                                Username
                                            </label>
                                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                                <input
                                                    type="text"
                                                    value={editUsername}
                                                    onChange={(e) => setEditUsername(e.target.value)}
                                                    placeholder="Username"
                                                    style={{
                                                        flex: 1,
                                                        padding: '0.75rem',
                                                        borderRadius: '0.5rem',
                                                        border: '1px solid #d1d5db',
                                                        fontFamily: 'inherit',
                                                        fontSize: '0.9375rem'
                                                    }}
                                                />
                                                <button
                                                    onClick={handleUpdateUsername}
                                                    style={{
                                                        padding: '0.625rem 1.25rem',
                                                        background: '#7c3aed',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '0.5rem',
                                                        fontWeight: '600',
                                                        cursor: 'pointer',
                                                        fontSize: '0.875rem',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    Update Username
                                                </button>
                                            </div>
                                            <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '4px 0 0 4px' }}>
                                                Changing your username will change your profile URL.
                                            </p>
                                        </div>

                                        {/* Bio Section */}
                                        <div style={{ marginBottom: '2rem' }}>
                                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                                                Bio
                                            </label>
                                            <textarea
                                                value={editBio}
                                                onChange={(e) => setEditBio(e.target.value)}
                                                placeholder="Tell us about yourself..."
                                                style={{
                                                    width: '100%',
                                                    padding: '0.75rem',
                                                    borderRadius: '0.5rem',
                                                    border: '1px solid #d1d5db',
                                                    minHeight: '100px',
                                                    resize: 'vertical',
                                                    marginBottom: '1rem',
                                                    fontFamily: 'inherit',
                                                    fontSize: '0.9375rem'
                                                }}
                                            />
                                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                <button
                                                    onClick={handleUpdateBio}
                                                    style={{
                                                        padding: '0.625rem 1.25rem',
                                                        background: '#7c3aed',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '0.5rem',
                                                        fontWeight: '600',
                                                        cursor: 'pointer',
                                                        fontSize: '0.875rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.5rem'
                                                    }}
                                                >
                                                    <Check size={16} /> Update Bio
                                                </button>
                                            </div>
                                        </div>

                                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827', marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.75rem', marginTop: '2rem' }}>
                                            Account Settings
                                        </h3>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <button
                                                onClick={() => setShowChangePasswordModal(true)}
                                                style={{
                                                    padding: '1rem',
                                                    background: '#f9fafb',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '0.75rem',
                                                    textAlign: 'left',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <div style={{ padding: '0.5rem', background: '#e0e7ff', borderRadius: '0.5rem', color: '#4f46e5' }}>
                                                        <Lock size={20} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: '600', color: '#111827' }}>Change Password</div>
                                                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Update your security credentials</div>
                                                    </div>
                                                </div>
                                                <ChevronRight size={20} color="#9ca3af" />
                                            </button>

                                            <button
                                                onClick={() => setShowBlockedModal(true)}
                                                style={{
                                                    padding: '1rem',
                                                    background: '#f9fafb',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '0.75rem',
                                                    textAlign: 'left',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <div style={{ padding: '0.5rem', background: '#fee2e2', borderRadius: '0.5rem', color: '#ef4444' }}>
                                                        <User size={20} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: '600', color: '#111827' }}>Blocked Users</div>
                                                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Manage users you have blocked</div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>{blockedUsers.length}</span>
                                                    <ChevronRight size={20} color="#9ca3af" />
                                                </div>
                                            </button>

                                            <button
                                                onClick={logout}
                                                style={{
                                                    padding: '1rem',
                                                    background: '#fef2f2',
                                                    border: '1px solid #fee2e2',
                                                    borderRadius: '0.75rem',
                                                    textAlign: 'left',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    transition: 'all 0.2s',
                                                    marginTop: '1rem'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <div style={{ padding: '0.5rem', background: 'white', borderRadius: '0.5rem', color: '#ef4444' }}>
                                                        <LogOut size={20} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: '600', color: '#ef4444' }}>Sign Out</div>
                                                        <div style={{ fontSize: '0.875rem', color: '#ef4444', opacity: 0.8 }}>Log out of your account</div>
                                                    </div>
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                </div>


                            )}

                            {activeTab === 'collections' && (
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                        <h3 style={{ margin: 0, color: '#111827', fontSize: '1.25rem', fontWeight: '700' }}>My Collections</h3>
                                        <button
                                            onClick={() => setShowCreateCollectionModal(true)}
                                            style={{
                                                padding: '0.75rem 1.5rem',
                                                background: '#7c3aed',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '0.75rem',
                                                fontWeight: '700',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                                                fontSize: '0.875rem',
                                                transition: 'transform 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                        >
                                            <Plus size={18} /> Create Collection
                                        </button>
                                    </div>

                                    {/* Collections Grid with Pagination */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                                        {collections.slice((collectionsPage - 1) * collectionsPerPage, collectionsPage * collectionsPerPage).map((collection) => (
                                            <div
                                                key={collection.id}
                                                style={{
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '1rem',
                                                    overflow: 'hidden',
                                                    backgroundColor: 'white',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    position: 'relative',
                                                    aspectRatio: '1/1',
                                                    display: 'flex',
                                                    flexDirection: 'column'
                                                }}
                                                onClick={() => handleViewCollection(collection)}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                                    e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.1)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                    e.currentTarget.style.boxShadow = 'none';
                                                }}
                                            >
                                                {/* Cover Image */}
                                                <div style={{ flex: 1, backgroundColor: '#f3f4f6', position: 'relative', overflow: 'hidden' }}>
                                                    {collection.first_item ? (
                                                        <img
                                                            src={apiClient.getMediaUrl(collection.first_item)}
                                                            alt={collection.name}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        />
                                                    ) : (
                                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db' }}>
                                                            <Folder size={48} />
                                                        </div>
                                                    )}
                                                    <div style={{
                                                        position: 'absolute',
                                                        bottom: 0,
                                                        left: 0,
                                                        right: 0,
                                                        background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
                                                        padding: '1.5rem 1rem 0.75rem',
                                                        color: 'white'
                                                    }}>
                                                        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>{collection.name}</h3>
                                                        <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.9 }}>{collection.items_count || 0} items</p>
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div style={{ padding: '0.75rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', background: '#ffffff' }} onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedCollection(collection);
                                                            setCollectionName(collection.name);
                                                            setShowEditCollectionModal(true);
                                                        }}
                                                        style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteCollection(collection.id);
                                                        }}
                                                        style={{ padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Collections Pagination */}
                                    {collections.length > collectionsPerPage && (
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
                                            <button
                                                onClick={() => setCollectionsPage(p => Math.max(1, p - 1))}
                                                disabled={collectionsPage === 1}
                                                style={{
                                                    padding: '0.5rem',
                                                    borderRadius: '0.5rem',
                                                    border: '1px solid #e5e7eb',
                                                    background: 'white',
                                                    cursor: collectionsPage === 1 ? 'not-allowed' : 'pointer',
                                                    opacity: collectionsPage === 1 ? 0.5 : 1
                                                }}
                                            >
                                                <ChevronLeft size={20} />
                                            </button>
                                            <span style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center' }}>
                                                Page {collectionsPage} of {Math.ceil(collections.length / collectionsPerPage)}
                                            </span>
                                            <button
                                                onClick={() => setCollectionsPage(p => Math.min(Math.ceil(collections.length / collectionsPerPage), p + 1))}
                                                disabled={collectionsPage >= Math.ceil(collections.length / collectionsPerPage)}
                                                style={{
                                                    padding: '0.5rem',
                                                    borderRadius: '0.5rem',
                                                    border: '1px solid #e5e7eb',
                                                    background: 'white',
                                                    cursor: collectionsPage >= Math.ceil(collections.length / collectionsPerPage) ? 'not-allowed' : 'pointer',
                                                    opacity: collectionsPage >= Math.ceil(collections.length / collectionsPerPage) ? 0.5 : 1
                                                }}
                                            >
                                                <ChevronRight size={20} />
                                            </button>
                                        </div>
                                    )}
                                    {!collections.length && (
                                        <div style={{ textAlign: 'center', padding: '4rem 0', color: '#6b7280' }}>
                                            <Folder size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                            <p>You haven't created any collections yet.</p>
                                            <button
                                                onClick={() => setShowCreateCollectionModal(true)}
                                                style={{ marginTop: '1rem', color: '#7c3aed', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer' }}
                                            >
                                                Create your first collection
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}


                            {renderPagination()}
                        </>
                    )}
                </div>
            </div>

            {/* Create Collection Modal */}
            {showCreateCollectionModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '1rem'
                    }}
                    onClick={() => setShowCreateCollectionModal(false)}
                >
                    <div
                        style={{
                            background: 'white',
                            borderRadius: '1rem',
                            padding: '2rem',
                            maxWidth: '400px',
                            width: '100%',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ margin: '0 0 1.5rem 0', color: '#111827', fontSize: '1.25rem', fontWeight: '700' }}>
                            Create Collection
                        </h3>
                        <input
                            type="text"
                            value={collectionName}
                            onChange={(e) => setCollectionName(e.target.value)}
                            placeholder="Collection name"
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '0.5rem',
                                fontSize: '0.875rem',
                                marginBottom: '1.5rem',
                                outline: 'none'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                        />
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => {
                                    setShowCreateCollectionModal(false);
                                    setCollectionName('');
                                }}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: '#f3f4f6',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    color: '#374151'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateCollection}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: '#7c3aed',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem'
                                }}
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Collection Modal */}
            {showEditCollectionModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '1rem'
                    }}
                    onClick={() => setShowEditCollectionModal(false)}
                >
                    <div
                        style={{
                            background: 'white',
                            borderRadius: '1rem',
                            padding: '2rem',
                            maxWidth: '400px',
                            width: '100%',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ margin: '0 0 1.5rem 0', color: '#111827', fontSize: '1.25rem', fontWeight: '700' }}>
                            Edit Collection
                        </h3>
                        <input
                            type="text"
                            value={collectionName}
                            onChange={(e) => setCollectionName(e.target.value)}
                            placeholder="Collection name"
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '0.5rem',
                                fontSize: '0.875rem',
                                marginBottom: '1.5rem',
                                outline: 'none'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                        />
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => {
                                    setShowEditCollectionModal(false);
                                    setCollectionName('');
                                    setSelectedCollection(null);
                                }}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: '#f3f4f6',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    color: '#374151'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateCollection}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: '#7c3aed',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem'
                                }}
                            >
                                Update
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Collection Items Modal */}
            {showCollectionItemsModal && selectedCollection && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '1rem'
                    }}
                    onClick={() => setShowCollectionItemsModal(false)}
                >
                    <div
                        style={{
                            background: 'white',
                            borderRadius: '1rem',
                            padding: '2rem',
                            maxWidth: '600px',
                            width: '100%',
                            maxHeight: '80vh',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, color: '#111827', fontSize: '1.25rem', fontWeight: '700' }}>
                                {selectedCollection?.name && selectedCollection.name !== 'nan' ? selectedCollection.name : 'Collection Items'}
                            </h3>
                            <button
                                onClick={() => setShowCollectionItemsModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                            >
                                <X size={24} color="#6b7280" />
                            </button>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {collectionItems.length > 0 ? (
                                <div style={{ display: 'grid', gap: '1rem' }}>
                                    {collectionItems.map((item) => (
                                        <div key={item.id} style={{ position: 'relative' }}>
                                            {/* Render Post as clickable card */}
                                            {renderPostCard(item.post, true)}

                                            {/* Remove Button Overlay */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm('Remove this post from collection?')) {
                                                        apiClient.removeFromCollection(selectedCollection.id, item.post.id)
                                                            .then(() => {
                                                                setCollectionItems(prev => prev.filter(i => i.id !== item.id));
                                                                // Update collection count locally
                                                                setCollections(prev => prev.map(c =>
                                                                    c.id === selectedCollection.id ? { ...c, items_count: c.items_count - 1 } : c
                                                                ));
                                                            })
                                                            .catch(err => toast.error('Failed to remove'));
                                                    }
                                                }}
                                                style={{
                                                    position: 'absolute',
                                                    top: '0.75rem',
                                                    right: '0.75rem',
                                                    background: 'rgba(255,255,255,0.95)',
                                                    border: 'none',
                                                    borderRadius: '50%',
                                                    padding: '0.4rem',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                                    zIndex: 10,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                title="Remove from collection"
                                            >
                                                <Trash2 size={16} color="#ef4444" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ textAlign: 'center', color: '#6b7280' }}>No items in this collection.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CSS for spinner animation */}
            <style>{`
                @keyframes spin {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }
            `}</style>

            {/* Save to Collection Modal */}
            {showSaveToCollectionModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '1rem'
                    }}
                    onClick={() => setShowSaveToCollectionModal(false)}
                >
                    <div
                        style={{
                            background: 'white',
                            borderRadius: '1rem',
                            padding: '2rem',
                            maxWidth: '400px',
                            width: '100%',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                            maxHeight: '80vh',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, color: '#111827', fontSize: '1.25rem', fontWeight: '700' }}>
                                Add to Collection
                            </h3>
                            <button
                                onClick={() => setShowSaveToCollectionModal(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '0.25rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <X size={24} color="#6b7280" />
                            </button>
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1, marginBottom: '1rem' }}>
                            {collections.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                                    <button
                                        onClick={() => {
                                            setShowSaveToCollectionModal(false);
                                            setShowCreateCollectionModal(true);
                                        }}
                                        style={{
                                            padding: '1rem',
                                            background: '#f9fafb',
                                            border: '2px dashed #e5e7eb',
                                            borderRadius: '0.75rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem',
                                            transition: 'all 0.2s',
                                            textAlign: 'center',
                                            minHeight: '80px'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                                            e.currentTarget.style.borderColor = '#d1d5db';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = '#f9fafb';
                                            e.currentTarget.style.borderColor = '#e5e7eb';
                                        }}
                                    >
                                        <div style={{
                                            background: '#e5e7eb',
                                            padding: '0.5rem',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <Plus size={20} color="#6b7280" />
                                        </div>
                                        <span style={{ fontWeight: '600', color: '#6b7280', fontSize: '0.875rem' }}>Create New</span>
                                    </button>
                                    {collections.map(collection => (
                                        <button
                                            key={collection.id}
                                            onClick={() => handleAddToCollection(collection.id)}
                                            style={{
                                                padding: '1rem',
                                                background: '#f9fafb',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '0.75rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '1rem',
                                                transition: 'all 0.2s',
                                                textAlign: 'left'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                                e.currentTarget.style.borderColor = '#d1d5db';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = '#f9fafb';
                                                e.currentTarget.style.borderColor = '#e5e7eb';
                                            }}
                                        >
                                            <div style={{
                                                background: '#efe2fe',
                                                padding: '0.5rem',
                                                borderRadius: '0.5rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <Folder size={20} color="#7c3aed" />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '600', color: '#111827', fontSize: '0.9375rem' }}>{collection.name}</div>
                                                <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>{collection.items_count || 0} items</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2rem 0', color: '#6b7280' }}>
                                    <p>No collections found.</p>
                                    <button
                                        onClick={() => {
                                            setShowSaveToCollectionModal(false);
                                            setShowCreateCollectionModal(true);
                                        }}
                                        style={{
                                            marginTop: '1rem',
                                            padding: '0.5rem 1rem',
                                            background: '#7c3aed',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '0.5rem',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            fontSize: '0.875rem'
                                        }}
                                    >
                                        Create New Collection
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Followers Modal */}
            {showFollowersModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '1rem'
                    }}
                    onClick={() => setShowFollowersModal(false)}
                >
                    <div
                        style={{
                            background: 'white',
                            borderRadius: '1rem',
                            padding: '2rem',
                            maxWidth: '500px',
                            width: '100%',
                            maxHeight: '80vh',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, color: '#111827', fontSize: '1.25rem', fontWeight: '700' }}>
                                Followers
                            </h3>
                            <button
                                onClick={() => setShowFollowersModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                            >
                                <X size={24} color="#6b7280" />
                            </button>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {followers.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {followers.map((u: any) => (
                                        <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                                                <img
                                                    src={apiClient.getAvatarUrl(u)}
                                                    alt={u.username}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: '600', color: '#111827' }}>{u.username}</div>
                                                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{u.display_name}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ textAlign: 'center', color: '#6b7280' }}>No followers yet.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Following Modal */}
            {showFollowingModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '1rem'
                    }}
                    onClick={() => setShowFollowingModal(false)}
                >
                    <div
                        style={{
                            background: 'white',
                            borderRadius: '1rem',
                            padding: '2rem',
                            maxWidth: '500px',
                            width: '100%',
                            maxHeight: '80vh',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, color: '#111827', fontSize: '1.25rem', fontWeight: '700' }}>
                                Following
                            </h3>
                            <button
                                onClick={() => setShowFollowingModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                            >
                                <X size={24} color="#6b7280" />
                            </button>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {following.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {following.map((u: any) => (
                                        <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                                                <img
                                                    src={apiClient.getAvatarUrl(u)}
                                                    alt={u.username}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: '600', color: '#111827' }}>{u.username}</div>
                                                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{u.display_name}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ textAlign: 'center', color: '#6b7280' }}>Not following anyone yet.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Blocked Users Modal */}
            {showBlockedModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '1rem'
                    }}
                    onClick={() => setShowBlockedModal(false)}
                >
                    <div
                        style={{
                            background: 'white',
                            borderRadius: '1rem',
                            padding: '2rem',
                            maxWidth: '500px',
                            width: '100%',
                            maxHeight: '80vh',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, color: '#111827', fontSize: '1.25rem', fontWeight: '700' }}>
                                Blocked Users
                            </h3>
                            <button
                                onClick={() => setShowBlockedModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                            >
                                <X size={24} color="#6b7280" />
                            </button>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {blockedUsers.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {blockedUsers.map((u: any) => (
                                        <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: '#f9fafb', border: '1px solid #f3f4f6', gap: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#e5e7eb', border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                                    {u.user?.avatar ? (
                                                        <img
                                                            src={u.user.avatar}
                                                            alt={u.user.username}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        />
                                                    ) : (
                                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
                                                            <User size={24} color="#9ca3af" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: '700', color: '#111827', fontSize: '0.9375rem' }}>
                                                        {u.user?.username || 'Unknown User'}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleUnblock(u.user?.id)}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    borderRadius: '0.5rem',
                                                    border: '1px solid #fee2e2',
                                                    background: 'white',
                                                    color: '#ef4444',
                                                    fontSize: '0.8125rem',
                                                    fontWeight: '700',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#fee2e2';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'white';
                                                }}
                                            >
                                                Unblock
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ textAlign: 'center', color: '#6b7280' }}>No blocked users.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <ChangePasswordModal
                isOpen={showChangePasswordModal}
                onClose={() => setShowChangePasswordModal(false)}
                username={profileData?.username || ''}
            />
            {/* Avatar Selection Modal */}
            {showAvatarModal && (
                <div
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1100, padding: '1rem'
                    }}
                    onClick={() => setShowAvatarModal(false)}
                >
                    <div
                        style={{
                            background: 'white', borderRadius: '1.5rem', padding: '2rem',
                            maxWidth: '600px', width: '100%', maxHeight: '90vh',
                            display: 'flex', flexDirection: 'column',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            animation: 'modalFadeIn 0.3s ease-out'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div>
                                <h3 style={{ margin: 0, color: '#111827', fontSize: '1.5rem', fontWeight: '800' }}>
                                    Choose Avatar
                                </h3>
                                <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                                    Select a default character or upload your own
                                </p>
                            </div>
                            <button
                                onClick={() => setShowAvatarModal(false)}
                                style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', display: 'flex' }}
                            >
                                <X size={20} color="#6b7280" />
                            </button>
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
                            {/* Upload Option */}
                            <div
                                onClick={() => {
                                    fileInputRef.current?.click();
                                    setShowAvatarModal(false);
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '1rem',
                                    padding: '1.25rem', background: '#f5f3ff',
                                    border: '2px dashed #c084fc', borderRadius: '1rem',
                                    cursor: 'pointer', marginBottom: '2rem',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#ede9fe';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#f5f3ff';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                <div style={{
                                    width: '48px', height: '48px', background: '#7c3aed',
                                    borderRadius: '50%', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', color: 'white'
                                }}>
                                    <Camera size={24} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: '700', color: '#5b21b6' }}>Upload from computer</div>
                                    <div style={{ fontSize: '0.8125rem', color: '#7c3aed' }}>Supports JPG, PNG or GIF</div>
                                </div>
                            </div>

                            <h4 style={{ fontSize: '1rem', fontWeight: '700', color: '#374151', marginBottom: '1rem' }}>Predefined Avatars</h4>

                            <div style={{
                                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                                gap: '1rem', paddingBottom: '1rem'
                            }}>
                                {defaultAvatars.length > 0 ? (
                                    defaultAvatars.map((avatar) => (
                                        <div
                                            key={avatar.id}
                                            onClick={() => handleSelectDefaultAvatar(avatar.url)}
                                            style={{
                                                aspectRatio: '1/1', borderRadius: '1rem',
                                                overflow: 'hidden', cursor: 'pointer',
                                                border: '3px solid transparent', transition: 'all 0.2s',
                                                background: '#f9fafb'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = '#7c3aed';
                                                e.currentTarget.style.transform = 'scale(1.05)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = 'transparent';
                                                e.currentTarget.style.transform = 'scale(1)';
                                            }}
                                        >
                                            <img
                                                src={avatar.url}
                                                alt="Avatar suggestion"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem' }}>
                                        <div style={{
                                            width: '24px', height: '24px', border: '3px solid #f3f3f3',
                                            borderTopColor: '#7c3aed', borderRadius: '50%',
                                            animation: 'spin 0.8s linear infinite', margin: '0 auto 10px'
                                        }}></div>
                                        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading avatars...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes modalFadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
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
        </div>
    );
}
