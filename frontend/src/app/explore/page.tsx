'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Bookmark, MessageCircle, Share2, Hash, Clock, User, Send, Search, X, Filter, TrendingUp, Sparkles, ChevronLeft, ChevronRight, MessageSquare, UserPlus, UserCheck, MoreVertical, Check, Users, RefreshCw, Pencil as Edit, Smile, Plus, Image as ImageIcon, Loader2, Maximize2 } from 'lucide-react';
import { apiClient, Post, ApiError, UserProfile, LikeResponse, SaveResponse, ShareResponse } from '@/lib/api';
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

interface ExplorePost extends Omit<Post, 'author'> {
    author: {
        id: number;
        user: {
            id: number;
            username: string;
            first_name?: string;
            last_name?: string;
        };
        avatar: string | null;
        bio?: string;
        is_following?: boolean;
        is_blocked?: boolean;
    };
    comments_count?: number;
    is_saved?: boolean;
    caption?: string;
}

interface FollowedUser {
    id: number;
    user_id: number;
    username: string;
    avatar: string;
    bio: string;
}

export default function ExplorePage() {
    const [posts, setPosts] = useState<ExplorePost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedPost, setExpandedPost] = useState<number | null>(null);
    const [selectedTag, setSelectedTag] = useState('');
    const [mounted, setMounted] = useState(false);
    const [activeCommentPostId, setActiveCommentPostId] = useState<number | null>(null);
    const [sendingComment, setSendingComment] = useState(false);
    const [postComments, setPostComments] = useState<Record<number, Comment[]>>({});
    const { user: authUser } = useAuth();
    const router = useRouter();

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const postsPerPage = 12;

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [searchInput, setSearchInput] = useState('');

    // Trending tags
    const [trendingTags, setTrendingTags] = useState<string[]>([]);
    const [totalResults, setTotalResults] = useState(0);
    const [feedType, setFeedType] = useState<'explore' | 'following'>('explore');
    const [sortOption, setSortOption] = useState<'recent' | 'oldest' | 'popular'>('recent');
    const [showSortDropdown, setShowSortDropdown] = useState(false);

    // User Profile Modal
    const [showUserProfile, setShowUserProfile] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [userPosts, setUserPosts] = useState<ExplorePost[]>([]);
    const [loadingUserPosts, setLoadingUserPosts] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);

    // Share Modal
    const [showShareModal, setShowShareModal] = useState(false);
    const [selectedPostForShare, setSelectedPostForShare] = useState<ExplorePost | null>(null);
    const [followedUsers, setFollowedUsers] = useState<FollowedUser[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [shareMessage, setShareMessage] = useState('');
    const [shareSearchQuery, setShareSearchQuery] = useState('');
    const [shareLoading, setShareLoading] = useState(false);
    const [shareSuccess, setShareSuccess] = useState(false);
    const [globalSearchResults, setGlobalSearchResults] = useState<FollowedUser[]>([]);
    const [isSearchingShare, setIsSearchingShare] = useState(false);

    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    // Create Post States
    const [newPost, setNewPost] = useState('');
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [posting, setPosting] = useState(false);
    const [showEmojiPanel, setShowEmojiPanel] = useState(false);
    const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);
    const [newHashtag, setNewHashtag] = useState('');
    const [uploadError, setUploadError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const postInputRef = useRef<HTMLTextAreaElement>(null);
    const hashtagInputRef = useRef<HTMLInputElement>(null);
    const emojiPanelRef = useRef<HTMLDivElement>(null);

    // Global Search Effect for Share Modal
    useEffect(() => {
        const fetchGlobalUsers = async () => {
            if (!shareSearchQuery.trim()) {
                setGlobalSearchResults([]);
                return;
            }

            setIsSearchingShare(true);
            try {
                // Search for users globally
                const results = await apiClient.getRecommendedUsers(20, shareSearchQuery, 'all');

                // Handle different response formats
                const users = Array.isArray(results) ? results : (results.recommended_users || results.users || []);

                // Map to FollowedUser interface
                const mappedUsers: FollowedUser[] = users.map((u: any) => ({
                    id: u.id,
                    user_id: u.user?.id || u.user_id,
                    username: u.username || u.user?.username,
                    avatar: u.avatar || '',
                    bio: u.bio || ''
                }));

                setGlobalSearchResults(mappedUsers);
            } catch (err) {
                console.error("Error searching users:", err);
            } finally {
                setIsSearchingShare(false);
            }
        };

        const timeoutId = setTimeout(fetchGlobalUsers, 500); // 500ms debounce
        return () => clearTimeout(timeoutId);
    }, [shareSearchQuery]);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted) {
            setCurrentPage(1);
            loadExplorePosts(1);
        }
    }, [selectedTag, searchQuery, mounted, feedType]);


    useEffect(() => {
        if (mounted) {
            loadExplorePosts();
        }
    }, [currentPage, mounted]);

    const loadExplorePosts = async (pageOverride?: number) => {
        try {
            setLoading(true);
            setError(null);

            const targetPage = pageOverride !== undefined ? pageOverride : currentPage;

            let data;
            if (feedType === 'following') {
                if (!authUser) {
                    setPosts([]);
                    setLoading(false);
                    return;
                }
                data = await apiClient.getFollowingPosts();
            } else {
                data = await apiClient.getExplorePosts(selectedTag);
            }

            let postsData = (Array.isArray(data) ? data : []) as unknown as ExplorePost[];

            if (searchQuery.trim()) {
                const query = searchQuery.trim().toLowerCase();
                postsData = postsData.filter(post => {
                    const content = (post.content || post.caption || '').toLowerCase();
                    const username = post.author?.user?.username?.toLowerCase() || '';
                    const tags = (post.tags || []).join(' ').toLowerCase();
                    return content.includes(query) || username.includes(query) || tags.includes(query);
                });
            }

            postsData = sortPosts(postsData);

            const tagFrequency: Record<string, number> = {};
            postsData.forEach(post => {
                (post.tags || []).forEach(tag => {
                    const cleanTag = tag.trim().toLowerCase();
                    if (cleanTag) {
                        tagFrequency[cleanTag] = (tagFrequency[cleanTag] || 0) + 1;
                    }
                });
            });
            const trending = Object.entries(tagFrequency)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([tag]) => tag);
            setTrendingTags(trending);

            setTotalResults(postsData.length);
            const total = Math.ceil(postsData.length / postsPerPage);
            setTotalPages(total);

            // Use targetPage instead of state currentPage
            const startIndex = (targetPage - 1) * postsPerPage;
            const endIndex = startIndex + postsPerPage;
            const paginatedPosts = postsData.slice(startIndex, endIndex);

            setPosts(paginatedPosts);

            // Pre-initialize empty comments record if needed, though lazy loading is fine
            const initialShowComments: Record<number, boolean> = {}; // Keeping for compat if needed, but we used activeCommentPostId now

        } catch (err: any) {
            if (err instanceof ApiError && err.isAuthError) {
                setError('Please log in to explore posts');
                setPosts([]);
            } else {
                console.error('Failed to load explore posts:', err);
                setError(err.message || 'Failed to load posts');
                setPosts([]);
            }
        } finally {
            setLoading(false);
        }
    };


    const loadFollowedUsers = async (): Promise<boolean> => {
        try {
            if (!authUser) {
                return false;
            }
            const users = await apiClient.getFollowingUsers();
            setFollowedUsers(users);
            return true;
        } catch (err) {
            console.error('Failed to load followed users:', err);
            return false;
        }
    };

    const openShareModal = async (post: ExplorePost) => {
        if (!authUser) {
            alert('Please log in to share posts');
            return;
        }

        setSelectedPostForShare(post);
        setSelectedUsers([]);
        setShareMessage('');
        setShareSearchQuery('');
        setShareSuccess(false);

        const success = await loadFollowedUsers();
        if (success) {
            setShowShareModal(true);
        } else {
            alert('Failed to load your followed users');
        }
    };

    const handleShareWithUsers = async () => {
        if (!selectedPostForShare || selectedUsers.length === 0) {
            alert('Please select at least one user to share with');
            return;
        }

        try {
            setShareLoading(true);
            const result = await apiClient.sharePost(
                selectedPostForShare.id,
                selectedUsers,
                shareMessage
            ) as ShareResponse;

            if (result?.status === 'success') {
                setShareSuccess(true);
                setTimeout(() => {
                    setShowShareModal(false);
                    setShareSuccess(false);
                }, 1500);
            }
        } catch (err: any) {
            console.error('Failed to share post:', err);
            alert('Failed to share post. Please try again.');
        } finally {
            setShareLoading(false);
        }
    };

    const toggleUserSelection = (userId: number) => {
        setSelectedUsers(prev => {
            if (prev.includes(userId)) {
                return prev.filter(id => id !== userId);
            } else {
                return [...prev, userId];
            }
        });
    };

    const displayedShareUsers = shareSearchQuery.trim() ? globalSearchResults : followedUsers;

    const openUserProfile = async (profileId: number) => {
        // Navigate to dedicated user profile page
        router.push(`/user/${profileId}`);
    };

    const handleFollowToggle = async (profileId: string | number) => {
        if (!authUser) {
            alert('Please log in to follow users');
            return;
        }

        try {
            // Find the post to get current follow status
            const targetPost = posts.find(p => p.author.id === profileId);
            const isCurrentlyFollowing = targetPost?.author.is_following || false;

            if (isCurrentlyFollowing) {
                await apiClient.unfollowUser(profileId);
                // Update all posts from this author
                setPosts(prev => prev.map(post =>
                    post.author.id === profileId
                        ? { ...post, author: { ...post.author, is_following: false } }
                        : post
                ));
            } else {
                await apiClient.followUser(profileId);
                // Update all posts from this author
                setPosts(prev => prev.map(post =>
                    post.author.id === profileId
                        ? { ...post, author: { ...post.author, is_following: true } }
                        : post
                ));
            }
        } catch (err: any) {
            console.error('Failed to toggle follow:', err);

            // Handle blocked user case
            if (err instanceof ApiError && err.status === 403) {
                if (confirm('You have blocked this user. Do you want to unblock them to follow?')) {
                    try {
                        await apiClient.request(`/chat/unblock/${profileId}/`, { method: 'POST' });
                        // Retry follow
                        await apiClient.followUser(profileId);
                        // Update posts
                        setPosts(prev => prev.map(post =>
                            post.author.id === profileId
                                ? { ...post, author: { ...post.author, is_following: true } }
                                : post
                        ));
                        return;
                    } catch (unblockErr) {
                        console.error('Failed to unblock and follow:', unblockErr);
                        alert('Failed to unblock user. Please try again.');
                    }
                }
            } else {
                alert('Failed to update follow status');
            }
        }
    };

    const sortPosts = (posts: ExplorePost[]) => {
        const sorted = [...posts];
        if (sortOption === 'recent') {
            return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        } else if (sortOption === 'oldest') {
            return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        } else if (sortOption === 'popular') {
            return sorted.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
        }
        return sorted;
    };

    const handleSearchInput = (value: string) => {
        setSearchInput(value);

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(() => {
            setSearchQuery(value);
            setCurrentPage(1);
        }, 500);
    };

    const clearSearch = () => {
        setSearchInput('');
        setSearchQuery('');
        setCurrentPage(1);
    };

    const handleTagClick = (tag: string) => {
        const cleanTag = tag.replace(/^#/, '').trim();
        setSearchInput('');
        setSearchQuery('');
        setSelectedTag(cleanTag);
        setCurrentPage(1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const clearTag = () => {
        setSelectedTag('');
        setCurrentPage(1);
    };

    const handleLike = async (postId: number) => {
        try {
            const result = await apiClient.likePost(postId) as LikeResponse;

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
                alert('Please log in to like posts');
            }
        }
    };

    const handleSave = async (postId: number) => {
        try {
            const result = await apiClient.savePost(postId) as SaveResponse;

            setPosts(posts.map(post =>
                post.id === postId
                    ? { ...post, is_saved: result.saved || false }
                    : post
            ));
        } catch (err: any) {
            console.error('Failed to save post:', err);
            if (err instanceof ApiError && err.isAuthError) {
                alert('Please log in to save posts');
            }
        }
    };

    const loadComments = async (postId: number) => {
        try {
            const comments = await apiClient.getComments(postId);
            setPostComments(prev => ({
                ...prev,
                [postId]: Array.isArray(comments) ? comments : []
            }));
        } catch (err) {
            console.error('Failed to load comments:', err);
            setPostComments(prev => ({
                ...prev,
                [postId]: []
            }));
        }
    };

    const handleCommentSubmit = async (content: string) => {
        if (!activeCommentPostId || !content.trim()) return;
        const postId = activeCommentPostId;

        try {
            setSendingComment(true);
            const newComment = await apiClient.addComment(postId, content) as Comment;

            // Update local comments immediately
            if (newComment) {
                setPostComments(prev => ({
                    ...prev,
                    [postId]: [newComment, ...(prev[postId] || [])]
                }));
            } else {
                // Fallback to reload if no data returned
                loadComments(postId);
            }

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
            alert('Failed to update comment');
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

    const formatDate = (dateString: string) => {
        if (!mounted || !dateString) return 'Recently';

        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Recently';

            const now = new Date();
            const diffInMs = now.getTime() - date.getTime();

            // Handle future dates (sometimes server/client clock desync)
            if (diffInMs < 0) return 'Just now';

            const diffInSeconds = Math.floor(diffInMs / 1000);
            const diffInMinutes = Math.floor(diffInSeconds / 60);
            const diffInHours = Math.floor(diffInMinutes / 60);
            const diffInDays = Math.floor(diffInHours / 24);

            if (diffInSeconds < 60) return 'Just now';
            if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
            if (diffInHours < 24) return `${diffInHours}h ago`;
            if (diffInDays < 7) return `${diffInDays}d ago`;
            if (diffInDays < 30) {
                const weeks = Math.floor(diffInDays / 7);
                return `${weeks}w ago`;
            }

            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        } catch (e) {
            console.error('Error formatting date:', e);
            return 'Recently';
        }
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
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

    if (!mounted) {
        return (
            <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%)' }}>
                <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8rem 0' }}>
                        <div style={{
                            width: '2.5rem',
                            height: '2.5rem',
                            border: '3px solid #f3f3f3',
                            borderTopColor: '#7c3aed',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite'
                        }}></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%)' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1rem' }}>
                {/* Header */}
                <div style={{ marginBottom: '2rem', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.7)', padding: '0.35rem', borderRadius: '1rem', border: '1px solid rgba(124, 58, 237, 0.2)', width: 'fit-content', backdropFilter: 'blur(10px)' }}>
                                <button
                                    onClick={() => setFeedType('explore')}
                                    style={{
                                        padding: '0.6rem 1.5rem',
                                        borderRadius: '0.75rem',
                                        border: 'none',
                                        background: feedType === 'explore' ? '#7c3aed' : 'transparent',
                                        color: feedType === 'explore' ? '#ffffff' : '#6b7280',
                                        fontWeight: '700',
                                        fontSize: '0.9375rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        boxShadow: feedType === 'explore' ? '0 4px 12px rgba(124, 58, 237, 0.3)' : 'none'
                                    }}
                                >
                                    <Sparkles style={{ width: '1.25rem', height: '1.25rem' }} />
                                    Explore
                                </button>
                                <button
                                    onClick={() => setFeedType('following')}
                                    style={{
                                        padding: '0.6rem 1.5rem',
                                        borderRadius: '0.75rem',
                                        border: 'none',
                                        background: feedType === 'following' ? '#7c3aed' : 'transparent',
                                        color: feedType === 'following' ? '#ffffff' : '#6b7280',
                                        fontWeight: '700',
                                        fontSize: '0.9375rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        boxShadow: feedType === 'following' ? '0 4px 12px rgba(124, 58, 237, 0.3)' : 'none'
                                    }}
                                >
                                    <User style={{ width: '1.25rem', height: '1.25rem' }} />
                                    Following
                                </button>
                            </div>
                            <p style={{ color: '#6b7280', margin: 0, fontSize: '0.9375rem', fontWeight: '500' }}>
                                {feedType === 'explore' ? 'Discover amazing content from the community' : 'See what your friends are sharing'}
                            </p>
                        </div>

                        {/* Header Actions */}
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <button
                                onClick={() => {
                                    setCurrentPage(1);
                                    loadExplorePosts(1);
                                }}
                                style={{
                                    padding: '0.75rem 1.25rem',
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #dbdbdb',
                                    borderRadius: '0.5rem',
                                    fontSize: '0.875rem',
                                    color: '#262626',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                            >
                                <RefreshCw style={{ width: '1rem', height: '1rem' }} className={loading ? 'animate-spin' : ''} />
                                Refresh
                            </button>

                            {/* Filter/Sort Dropdown */}
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                                    style={{
                                        padding: '0.75rem 1.25rem',
                                        backgroundColor: '#ffffff',
                                        border: '1px solid #dbdbdb',
                                        borderRadius: '0.5rem',
                                        fontSize: '0.875rem',
                                        color: '#262626',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Filter style={{ width: '1rem', height: '1rem' }} />
                                    Sort: {sortOption === 'recent' ? 'Recent' : sortOption === 'oldest' ? 'Oldest' : 'Popular'}
                                </button>

                                {showSortDropdown && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '110%',
                                        right: 0,
                                        width: '180px',
                                        backgroundColor: '#ffffff',
                                        borderRadius: '0.75rem',
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                        border: '1px solid #e5e7eb',
                                        zIndex: 50,
                                        padding: '0.5rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.25rem'
                                    }}>
                                        {[
                                            { id: 'recent', label: 'Recent', icon: <Clock size={14} /> },
                                            { id: 'oldest', label: 'Oldest', icon: <Filter size={14} /> },
                                            { id: 'popular', label: 'Popular', icon: <TrendingUp size={14} /> }
                                        ].map((opt) => (
                                            <button
                                                key={opt.id}
                                                onClick={() => {
                                                    setSortOption(opt.id as any);
                                                    setShowSortDropdown(false);
                                                    setCurrentPage(1);
                                                }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.75rem',
                                                    padding: '0.6rem 1rem',
                                                    borderRadius: '0.5rem',
                                                    border: 'none',
                                                    background: sortOption === opt.id ? '#f3f4f6' : 'transparent',
                                                    color: sortOption === opt.id ? '#7c3aed' : '#4b5563',
                                                    fontSize: '0.875rem',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {opt.icon}
                                                {opt.label}
                                                {sortOption === opt.id && <Check size={14} style={{ marginLeft: 'auto' }} />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ position: 'relative', maxWidth: '600px' }}>
                            <Search style={{
                                position: 'absolute',
                                left: '1rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '1.25rem',
                                height: '1.25rem',
                                color: '#8e8e8e'
                            }} />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => handleSearchInput(e.target.value)}
                                placeholder="Search posts, users, or tags..."
                                style={{
                                    width: '100%',
                                    padding: '0.875rem 3rem 0.875rem 3rem',
                                    border: '1px solid #dbdbdb',
                                    borderRadius: '0.75rem',
                                    fontSize: '0.9375rem',
                                    outline: 'none',
                                    backgroundColor: '#ffffff',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                    transition: 'all 0.2s',
                                    color: '#000000'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                                onBlur={(e) => e.target.style.borderColor = '#dbdbdb'}
                            />
                            {searchInput && (
                                <button
                                    onClick={clearSearch}
                                    style={{
                                        position: 'absolute',
                                        right: '1rem',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '0.25rem',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    <X style={{ width: '1.25rem', height: '1.25rem', color: '#8e8e8e' }} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Active Filters */}
                    {(selectedTag || searchQuery) && (
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                            {selectedTag && (
                                <div style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: '#7c3aed',
                                    color: '#ffffff',
                                    borderRadius: '1rem',
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <Hash style={{ width: '0.875rem', height: '0.875rem' }} />
                                    {selectedTag}
                                    <button
                                        onClick={clearTag}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: 0,
                                            display: 'flex',
                                            color: '#ffffff'
                                        }}
                                    >
                                        <X style={{ width: '1rem', height: '1rem' }} />
                                    </button>
                                </div>
                            )}
                            {searchQuery && (
                                <div style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: '#ffffff',
                                    color: '#262626',
                                    border: '1px solid #dbdbdb',
                                    borderRadius: '1rem',
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <Search style={{ width: '0.875rem', height: '0.875rem' }} />
                                    "{searchQuery}"
                                    <button
                                        onClick={clearSearch}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: 0,
                                            display: 'flex',
                                            color: '#8e8e8e'
                                        }}
                                    >
                                        <X style={{ width: '1rem', height: '1rem' }} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Trending Tags */}
                    {!selectedTag && trendingTags.length > 0 && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <TrendingUp style={{ width: '1rem', height: '1rem' }} />
                                Trending Tags
                            </h3>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {trendingTags.map((tag, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleTagClick(tag)}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            backgroundColor: '#ffffff',
                                            color: '#7c3aed',
                                            borderRadius: '1rem',
                                            fontSize: '0.8125rem',
                                            fontWeight: '600',
                                            border: '1px solid #e0e7ff',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                                            e.currentTarget.style.backgroundColor = '#f5f3ff';
                                            e.currentTarget.style.borderColor = '#7c3aed';
                                        }}
                                        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                                            e.currentTarget.style.backgroundColor = '#ffffff';
                                            e.currentTarget.style.borderColor = '#e0e7ff';
                                        }}
                                    >
                                        #{tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Loading State */}
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
                            <p style={{ color: '#8e8e8e', fontSize: '0.9375rem' }}>Loading posts...</p>
                        </div>
                    </div>
                ) : error ? (
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
                            <Hash style={{ width: '2.5rem', height: '2.5rem', color: '#c7c7c7' }} />
                        </div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#262626', marginBottom: '0.5rem' }}>
                            Failed to load posts
                        </h3>
                        <p style={{ color: '#8e8e8e', maxWidth: '28rem', margin: '0 auto 1rem', fontSize: '0.9375rem' }}>
                            {error}
                        </p>
                        <button
                            onClick={() => loadExplorePosts()}
                            style={{
                                padding: '0.75rem 2rem',
                                backgroundColor: '#7c3aed',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '0.5rem',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            Try Again
                        </button>
                    </div>
                ) : posts.length === 0 ? (
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
                            <Hash style={{ width: '2.5rem', height: '2.5rem', color: '#c7c7c7' }} />
                        </div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#262626', marginBottom: '0.5rem' }}>
                            {selectedTag || searchQuery ? 'No posts found' : 'No posts to explore'}
                        </h3>
                        <p style={{ color: '#8e8e8e', maxWidth: '28rem', margin: '0 auto', fontSize: '0.9375rem' }}>
                            {selectedTag
                                ? `No posts found with tag "${selectedTag}"`
                                : searchQuery
                                    ? `No posts match "${searchQuery}"`
                                    : 'Check back later for new content'}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Results Info */}
                        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                                    Showing {totalResults > 0 ? (currentPage - 1) * postsPerPage + 1 : 0} - {Math.min(currentPage * postsPerPage, totalResults)} of {totalResults} posts
                                </p>
                                <button
                                    onClick={() => {
                                        if (currentPage === 1) {
                                            loadExplorePosts(1);
                                        } else {
                                            setCurrentPage(1);
                                        }
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        background: '#f3f4f6',
                                        border: '1px solid #e5e7eb',
                                        padding: '0.4rem 0.8rem',
                                        borderRadius: '0.5rem',
                                        fontSize: '0.8rem',
                                        fontWeight: '600',
                                        color: '#4b5563',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <RefreshCw style={{ width: '0.9rem', height: '0.9rem' }} className={loading ? 'animate-spin' : ''} /> Refresh
                                </button>
                            </div>
                            <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                                Page {currentPage} of {totalPages}
                            </p>
                        </div>

                        {/* Posts Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 350px), 1fr))',
                            gap: '1.5rem'
                        }}>
                            {posts.map((post) => (
                                <div
                                    key={post.id}
                                    style={{
                                        backgroundColor: '#ffffff',
                                        border: '1px solid #dbdbdb',
                                        borderRadius: '0.75rem',
                                        overflow: 'hidden',
                                        transition: 'all 0.2s',
                                        position: 'relative'
                                    }}

                                    onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                                        e.currentTarget.style.boxShadow = 'none';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    {/* Post Header - MADE CLICKABLE */}
                                    <div
                                        style={{
                                            padding: '1rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            borderBottom: '1px solid #efefef'
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '2rem',
                                                height: '2rem',
                                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                overflow: 'hidden',
                                                cursor: 'pointer'
                                            }}
                                            onClick={() => openUserProfile(post.author.id)}
                                        >
                                            <img
                                                src={apiClient.getAvatarUrl(post.author)}
                                                alt={post.author.user.username}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        </div>
                                        <div
                                            style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                                            onClick={() => openUserProfile(post.author.id)}
                                        >
                                            <p style={{ fontWeight: '600', color: '#262626', margin: 0, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {post.author?.user?.username || 'Unknown User'}
                                            </p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: '#8e8e8e', marginTop: '0.125rem' }}>
                                                <Clock style={{ width: '0.75rem', height: '0.75rem' }} />
                                                <span>{formatDate(post.created_at)}</span>
                                            </div>
                                        </div>
                                        {/* Follow Button */}
                                        {authUser && post.author.id !== (authUser as any)?.profile_id && !post.author.is_blocked && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleFollowToggle(post.author.id);
                                                }}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    background: post.author.is_following ? '#efefef' : '#0095f6',
                                                    color: post.author.is_following ? '#262626' : '#ffffff',
                                                    border: 'none',
                                                    borderRadius: '0.5rem',
                                                    fontSize: '0.875rem',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.375rem',
                                                    flexShrink: 0,
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.opacity = '0.9';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.opacity = '1';
                                                }}
                                            >
                                                {post.author.is_following ? (
                                                    <>
                                                        <UserCheck size={14} />
                                                        Following
                                                    </>
                                                ) : (
                                                    <>
                                                        <UserPlus size={14} />
                                                        Follow
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>






                                    {/* Post Actions */}
                                    <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #efefef' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <button
                                                onClick={() => handleLike(post.id)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.375rem',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: 0,
                                                    color: post.is_liked ? '#ed4956' : '#262626',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <Heart style={{ width: '1.375rem', height: '1.375rem', fill: post.is_liked ? '#ed4956' : 'none', stroke: post.is_liked ? '#ed4956' : 'currentColor', strokeWidth: 2 }} />
                                                <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>{post.likes_count || 0}</span>
                                            </button>

                                            <button
                                                onClick={() => openComments(post.id)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.375rem',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: 0,
                                                    color: '#262626'
                                                }}
                                            >
                                                <MessageCircle style={{ width: '1.375rem', height: '1.375rem', strokeWidth: 2 }} />
                                                <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>{post.comments_count || 0}</span>
                                            </button>

                                            {!post.author.is_blocked && (
                                                <>
                                                    <button
                                                        onClick={() => openShareModal(post)}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            padding: 0,
                                                            color: '#262626',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.375rem'
                                                        }}
                                                        title="Share with followers"
                                                    >
                                                        <Share2 style={{ width: '1.375rem', height: '1.375rem', strokeWidth: 2 }} />
                                                    </button>

                                                    <button
                                                        onClick={() => router.push(`/conversations?userId=${post.author.id}`)}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            padding: 0,
                                                            color: '#262626',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.375rem'
                                                        }}
                                                        title="Message author"
                                                    >
                                                        <MessageSquare style={{ width: '1.375rem', height: '1.375rem', strokeWidth: 2 }} />
                                                    </button>
                                                </>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => handleSave(post.id)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: post.is_saved ? '#7c3aed' : '#262626' }}
                                        >
                                            <Bookmark style={{ width: '1.375rem', height: '1.375rem', fill: post.is_saved ? '#7c3aed' : 'none', stroke: post.is_saved ? '#7c3aed' : 'currentColor', strokeWidth: 2 }} />
                                        </button>
                                    </div>

                                    {/* Post Content */}
                                    <div style={{ padding: '1rem', position: 'relative' }}>
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
                                            color: '#262626',
                                            lineHeight: '1.5',
                                            margin: 0,
                                            fontSize: '0.875rem',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 5,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            wordBreak: 'break-word'
                                        }}>
                                            {post.content || post.caption || ''}
                                        </p>
                                        {(post.content || post.caption) && ((post.content?.length || 0) > 200 || (post.caption?.length || 0) > 200) && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/${post.author.user.username}/post/${post.id}`);
                                                }}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#667eea',
                                                    fontSize: '0.8125rem',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    padding: '0.25rem 0 0 0',
                                                    marginTop: '0.25rem',
                                                    textDecoration: 'none',
                                                    display: 'block'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                                onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                            >
                                                Read more
                                            </button>
                                        )}
                                    </div>

                                    {/* Tags Section */}
                                    {post.tags && post.tags.length > 0 && (
                                        <div style={{ padding: '0 1rem 1rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {post.tags.slice(0, 3).map((tag, index) => {
                                                const cleanTag = tag.trim();
                                                return (
                                                    <button
                                                        key={index}
                                                        onClick={() => handleTagClick(cleanTag)}
                                                        style={{
                                                            padding: '0.375rem 0.75rem',
                                                            backgroundColor: '#fef3c7',
                                                            color: '#7c3aed',
                                                            borderRadius: '0.5rem',
                                                            fontSize: '0.8125rem',
                                                            fontWeight: '600',
                                                            border: '1px solid #fde68a',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.backgroundColor = '#fde68a'}
                                                        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.backgroundColor = '#fef3c7'}
                                                    >
                                                        #{cleanTag}
                                                    </button>
                                                );
                                            })}
                                            {post.tags.length > 3 && (
                                                <span style={{ padding: '0.375rem 0.75rem', backgroundColor: '#f0f0f0', color: '#8e8e8e', borderRadius: '0.375rem', fontSize: '0.8125rem', fontWeight: '600' }}>
                                                    +{post.tags.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Comments Section Removed (Using Drawer) */}
                                </div>
                            ))}
                        </div>


                        {/* Pagination */}
                        {renderPagination()}
                    </>
                )}
            </div>

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

            {/* Share Modal */}
            {
                showShareModal && selectedPostForShare && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 50,
                        padding: '1rem'
                    }}>
                        <div style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '1rem',
                            width: '100%',
                            maxWidth: '500px',
                            maxHeight: '80vh',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            {/* Modal Header */}
                            <div style={{
                                padding: '1.25rem',
                                borderBottom: '1px solid #efefef',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#262626', margin: 0 }}>
                                    Share with Followers
                                </h3>
                                <button
                                    onClick={() => setShowShareModal(false)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '0.25rem',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    <X style={{ width: '1.5rem', height: '1.5rem', color: '#8e8e8e' }} />
                                </button>
                            </div>



                            {/* Message Input */}
                            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #efefef' }}>
                                <textarea
                                    value={shareMessage}
                                    onChange={(e) => setShareMessage(e.target.value)}
                                    placeholder="Add a message (optional)..."
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '1px solid #dbdbdb',
                                        borderRadius: '0.5rem',
                                        fontSize: '0.875rem',
                                        outline: 'none',
                                        resize: 'vertical',
                                        minHeight: '80px',
                                        fontFamily: 'inherit'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                                    onBlur={(e) => e.target.style.borderColor = '#dbdbdb'}
                                />
                            </div>

                            {/* Search Users */}
                            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #efefef' }}>
                                <div style={{ position: 'relative' }}>
                                    <Search style={{
                                        position: 'absolute',
                                        left: '0.75rem',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        width: '1.125rem',
                                        height: '1.125rem',
                                        color: '#8e8e8e'
                                    }} />
                                    <input
                                        type="text"
                                        value={shareSearchQuery}
                                        onChange={(e) => setShareSearchQuery(e.target.value)}
                                        placeholder="Search users..."
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem 2.5rem',
                                            border: '1px solid #dbdbdb',
                                            borderRadius: '0.5rem',
                                            fontSize: '0.875rem',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                                <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.5rem 0 0 0' }}>
                                    Select followers to share with
                                </p>
                            </div>

                            {/* Users List */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
                                {isSearchingShare ? (
                                    <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                                        <div style={{
                                            width: '2rem',
                                            height: '2rem',
                                            border: '2px solid #f3f3f3',
                                            borderTopColor: '#7c3aed',
                                            borderRadius: '50%',
                                            animation: 'spin 0.8s linear infinite',
                                            margin: '0 auto'
                                        }}></div>
                                    </div>
                                ) : displayedShareUsers.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                                        <Users style={{ width: '3rem', height: '3rem', color: '#d1d5db', marginBottom: '1rem' }} />
                                        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
                                            {followedUsers.length === 0
                                                ? "You're not following anyone yet."
                                                : "No users match your search."}
                                        </p>
                                    </div>
                                ) : (
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                                        gap: '1rem',
                                        padding: '1rem'
                                    }}>
                                        {displayedShareUsers.map(user => (
                                            <div
                                                key={user.id}
                                                onClick={() => toggleUserSelection(user.id)}
                                                style={{
                                                    position: 'relative',
                                                    padding: '1rem',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '0.75rem',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    backgroundColor: selectedUsers.includes(user.id) ? '#f5f3ff' : '#ffffff',
                                                    borderRadius: '1rem',
                                                    border: `1px solid ${selectedUsers.includes(user.id) ? '#7c3aed' : '#efefef'}`,
                                                    boxShadow: selectedUsers.includes(user.id) ? '0 4px 12px rgba(124, 58, 237, 0.1)' : 'none'
                                                }}
                                                onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                                                    if (!selectedUsers.includes(user.id)) {
                                                        e.currentTarget.style.borderColor = '#7c3aed';
                                                        e.currentTarget.style.backgroundColor = '#f9fafb';
                                                    }
                                                }}
                                                onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                                                    if (!selectedUsers.includes(user.id)) {
                                                        e.currentTarget.style.borderColor = '#efefef';
                                                        e.currentTarget.style.backgroundColor = '#ffffff';
                                                    }
                                                }}
                                            >
                                                <div style={{
                                                    width: '3.5rem',
                                                    height: '3.5rem',
                                                    borderRadius: '50%',
                                                    overflow: 'hidden',
                                                    border: selectedUsers.includes(user.id) ? '3px solid #7c3aed' : '2px solid #efefef',
                                                    transition: 'all 0.3s'
                                                }}>
                                                    <img
                                                        src={user.avatar}
                                                        alt={user.username}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                </div>
                                                <div style={{ textAlign: 'center', width: '100%' }}>
                                                    <p style={{ fontWeight: '700', color: '#262626', margin: 0, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {user.username}
                                                    </p>
                                                    <p style={{ color: '#6b7280', margin: '0.2rem 0 0 0', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {user.bio || 'Follower'}
                                                    </p>
                                                </div>

                                                {/* Selection Checkmark */}
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '0.75rem',
                                                    right: '0.75rem',
                                                    width: '1.25rem',
                                                    height: '1.25rem',
                                                    borderRadius: '50%',
                                                    border: `1.5px solid ${selectedUsers.includes(user.id) ? '#7c3aed' : '#dbdbdb'}`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    backgroundColor: selectedUsers.includes(user.id) ? '#7c3aed' : 'transparent',
                                                    transition: 'all 0.2s',
                                                    zIndex: 2
                                                }}>
                                                    {selectedUsers.includes(user.id) && (
                                                        <Check style={{ width: '0.75rem', height: '0.75rem', color: '#ffffff' }} />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div style={{
                                padding: '1.25rem',
                                borderTop: '1px solid #efefef',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: '0.875rem', color: '#374151', margin: 0, fontWeight: '500' }}>
                                        Share this post with {selectedUsers.length} contact{selectedUsers.length !== 1 ? 's' : ''}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button
                                        onClick={() => setShowShareModal(false)}
                                        style={{
                                            padding: '0.625rem 1.25rem',
                                            backgroundColor: '#f3f4f6',
                                            color: '#6b7280',
                                            border: 'none',
                                            borderRadius: '0.5rem',
                                            fontSize: '0.875rem',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleShareWithUsers}
                                        disabled={selectedUsers.length === 0 || shareLoading || shareSuccess}
                                        style={{
                                            padding: '0.625rem 1.5rem',
                                            backgroundColor: shareSuccess ? '#10b981' : '#7c3aed',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '0.5rem',
                                            fontSize: '0.875rem',
                                            fontWeight: '600',
                                            cursor: selectedUsers.length === 0 ? 'not-allowed' : 'pointer',
                                            opacity: selectedUsers.length === 0 ? 0.5 : 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                        }}
                                    >
                                        {shareLoading ? (
                                            <>
                                                <div style={{
                                                    width: '1rem',
                                                    height: '1rem',
                                                    border: '2px solid rgba(255,255,255,0.3)',
                                                    borderTopColor: '#ffffff',
                                                    borderRadius: '50%',
                                                    animation: 'spin 0.8s linear infinite'
                                                }}></div>
                                                Sharing...
                                            </>
                                        ) : shareSuccess ? (
                                            <>
                                                <Check style={{ width: '1rem', height: '1rem' }} />
                                                Shared!
                                            </>
                                        ) : (
                                            `Share (${selectedUsers.length})`
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* User Profile Modal */}
            {
                showUserProfile && selectedUser && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 50,
                        padding: '1rem'
                    }}>
                        <div style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '1rem',
                            width: '100%',
                            maxWidth: '800px',
                            maxHeight: '90vh',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            {/* Modal Header */}
                            <div style={{
                                padding: '1.25rem',
                                borderBottom: '1px solid #efefef',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#262626', margin: 0 }}>
                                    Profile
                                </h3>
                                <button
                                    onClick={() => setShowUserProfile(false)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '0.25rem',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    <X style={{ width: '1.5rem', height: '1.5rem', color: '#8e8e8e' }} />
                                </button>
                            </div>

                            {/* User Info */}
                            <div style={{ padding: '1.5rem', borderBottom: '1px solid #efefef' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                    <div style={{
                                        width: '4rem',
                                        height: '4rem',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        overflow: 'hidden'
                                    }}>
                                        <img
                                            src={apiClient.getAvatarUrl(selectedUser)}
                                            alt={selectedUser.user?.username}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#262626', margin: '0 0 0.25rem 0' }}>
                                            {selectedUser.user?.username}
                                        </h3>
                                        {selectedUser.bio && (
                                            <p style={{ color: '#6b7280', margin: 0, fontSize: '0.875rem' }}>
                                                {selectedUser.bio}
                                            </p>
                                        )}
                                    </div>
                                    {authUser && selectedUser.id !== authUser.profile_id && (
                                        <button
                                            onClick={() => handleFollowToggle(selectedUser.id)}
                                            disabled={followLoading}
                                            style={{
                                                padding: '0.5rem 1.25rem',
                                                backgroundColor: isFollowing ? '#f3f4f6' : '#7c3aed',
                                                color: isFollowing ? '#262626' : '#ffffff',
                                                border: 'none',
                                                borderRadius: '0.5rem',
                                                fontSize: '0.875rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem'
                                            }}
                                        >
                                            {followLoading ? (
                                                <div style={{
                                                    width: '1rem',
                                                    height: '1rem',
                                                    border: '2px solid rgba(124, 58, 237, 0.3)',
                                                    borderTopColor: isFollowing ? '#262626' : '#ffffff',
                                                    borderRadius: '50%',
                                                    animation: 'spin 0.8s linear infinite'
                                                }}></div>
                                            ) : isFollowing ? (
                                                <>
                                                    <UserCheck style={{ width: '1rem', height: '1rem' }} />
                                                    Following
                                                </>
                                            ) : (
                                                <>
                                                    <UserPlus style={{ width: '1rem', height: '1rem' }} />
                                                    Follow
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '2rem' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <p style={{ fontWeight: '700', color: '#262626', margin: 0, fontSize: '1rem' }}>
                                            {userPosts.length}
                                        </p>
                                        <p style={{ color: '#6b7280', margin: '0.25rem 0 0 0', fontSize: '0.75rem' }}>
                                            Posts
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <p style={{ fontWeight: '700', color: '#262626', margin: 0, fontSize: '1rem' }}>
                                            {selectedUser.followers_count || 0}
                                        </p>
                                        <p style={{ color: '#6b7280', margin: '0.25rem 0 0 0', fontSize: '0.75rem' }}>
                                            Followers
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <p style={{ fontWeight: '700', color: '#262626', margin: 0, fontSize: '1rem' }}>
                                            {selectedUser.following_count || 0}
                                        </p>
                                        <p style={{ color: '#6b7280', margin: '0.25rem 0 0 0', fontSize: '0.75rem' }}>
                                            Following
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* User's Posts */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                                {loadingUserPosts ? (
                                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                                        <div style={{
                                            width: '2.5rem',
                                            height: '2.5rem',
                                            border: '3px solid #f3f3f3',
                                            borderTopColor: '#7c3aed',
                                            borderRadius: '50%',
                                            animation: 'spin 0.8s linear infinite',
                                            margin: '0 auto 1rem'
                                        }}></div>
                                        <p style={{ color: '#8e8e8e', fontSize: '0.9375rem' }}>Loading posts...</p>
                                    </div>
                                ) : userPosts.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                                        <div style={{
                                            width: '4rem',
                                            height: '4rem',
                                            backgroundColor: '#f9fafb',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 1rem'
                                        }}>
                                            <Hash style={{ width: '2rem', height: '2rem', color: '#d1d5db' }} />
                                        </div>
                                        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                                            No posts yet
                                        </p>
                                    </div>
                                ) : (
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                                        gap: '1rem'
                                    }}>
                                        {userPosts.map(post => (
                                            <div
                                                key={post.id}
                                                style={{
                                                    backgroundColor: '#ffffff',
                                                    border: '1px solid #dbdbdb',
                                                    borderRadius: '0.5rem',
                                                    overflow: 'hidden',
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => {
                                                    // Navigate to post detail or open in modal
                                                    router.push(`/post/${post.id}`);
                                                }}
                                            >
                                                {post.image && (
                                                    <div style={{ width: '100%', aspectRatio: '1/1', overflow: 'hidden', backgroundColor: '#f7f7f7' }}>
                                                        <img
                                                            src={apiClient.getMediaUrl(post.image)}
                                                            alt="Post"
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                        />
                                                    </div>
                                                )}
                                                <div style={{ padding: '0.75rem' }}>
                                                    <p style={{
                                                        color: '#262626',
                                                        fontSize: '0.8125rem',
                                                        margin: 0,
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: 'vertical',
                                                        overflow: 'hidden'
                                                    }}>
                                                        {post.content || post.caption || ''}
                                                    </p>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                                <Heart style={{ width: '0.875rem', height: '0.875rem', color: post.is_liked ? '#ed4956' : '#9ca3af', fill: post.is_liked ? '#ed4956' : 'none' }} />
                                                                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{post.likes_count || 0}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                                <MessageCircle style={{ width: '0.875rem', height: '0.875rem', color: '#9ca3af' }} />
                                                                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{post.comments_count || 0}</span>
                                                            </div>
                                                        </div>
                                                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                                            {formatDate(post.created_at)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Lightbox Modal */}
            {
                lightboxImage && (
                    <div
                        onClick={() => setLightboxImage(null)}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.95)',
                            padding: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 9999,
                            cursor: 'zoom-out'
                        }}
                    >
                        <div style={{ position: 'relative', maxWidth: '95vw', maxHeight: '95vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img
                                src={lightboxImage}
                                alt="Zoomed"
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '95vh',
                                    objectFit: 'contain',
                                    borderRadius: '12px',
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
                                    background: 'rgba(255,255,255,0.2)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: 'white',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.4)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                )
            }

            <style>{`
                @keyframes popIn {
                    0% { opacity: 0; transform: scale(0.5) translateY(40px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                * {
                    box-sizing: border-box;
                }
                .post-thumbnail-pop:hover .hover-overlay-hint {
                    opacity: 1 !important;
                }
            `}</style>
        </div >
    );
}