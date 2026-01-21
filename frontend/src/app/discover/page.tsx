'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { UserPlus, UserCheck, Search, Sparkles, TrendingUp, Calendar, Clock, Hash, Users, X, ChevronRight, Filter, MessageSquare } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface RecommendedUser {
    id: number;
    user_id: number;
    username: string;
    avatar: string | null;
    bio: string;
    reason: string;
    is_following: boolean;
    is_blocked: boolean;
    tags?: string[];
    is_match?: boolean;
    shared_count?: number;
    shared_tags?: string[];
}

export default function DiscoverPage() {
    const { user: authUser } = useAuth();
    const router = useRouter();
    const [users, setUsers] = useState<RecommendedUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [filter, setFilter] = useState<'all_time' | 'last_post' | 'week' | 'month'>('all_time');
    const [trendingTags, setTrendingTags] = useState<string[]>([]);
    const [selectedTag, setSelectedTag] = useState<string>('');
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (authUser) {
            loadDiscoverUsers();
            loadTrendingTags();
        }
    }, [authUser, filter, selectedTag]);

    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(() => {
            setSearchQuery(searchInput);
        }, 500);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchInput]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filter, searchQuery, selectedTag]);

    const loadDiscoverUsers = useCallback(async () => {
        if (!authUser) {
            setUsers([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            let url = `/discover/?limit=1000&filter=${filter}`;
            if (searchQuery.trim()) {
                url += `&q=${encodeURIComponent(searchQuery.trim())}`;
            }


            console.log('🔍 [DISCOVER] Fetching:', url);
            console.log('🔍 [DISCOVER] Current filter:', filter);
            const response: any = await apiClient.request(url);
            console.log('📦 [DISCOVER] Raw response:', response);
            console.log('📦 [DISCOVER] Response type:', typeof response);
            console.log('📦 [DISCOVER] Is array?:', Array.isArray(response));
            console.log('📦 [DISCOVER] Has results key?:', 'results' in response);

            const results = Array.isArray(response) ? response : (response?.results || []);
            console.log('✅ [DISCOVER] Results count:', results.length);
            console.log('📋 [DISCOVER] Results:', results);
            console.log('📋 [DISCOVER] Filter applied:', response?.filter_applied);
            console.log('📋 [DISCOVER] Matched by tags:', response?.matched_by_tags);
            console.log('📋 [DISCOVER] Message from backend:', response?.message);

            // NO FALLBACK - Respect empty results from backend
            if (Array.isArray(results)) {
                setUsers(results);
                if (results.length === 0 && response?.message) {
                    console.log('ℹ️ [DISCOVER] Backend message:', response.message);
                }
            } else {
                setUsers([]);
            }

        } catch (error: any) {
            console.error('❌ [DISCOVER] Error:', error);
            setError(error.message || 'Failed to load recommendations');
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, [authUser, filter, searchQuery, selectedTag]);

    const loadTrendingTags = async () => {
        try {
            // Use the new dedicated trending tags endpoint
            // This only returns hashtag names, not full post data
            const tags = await apiClient.getTrendingTags(15, 30);
            setTrendingTags(tags);
        } catch (error) {
            console.error('Failed to load trending tags:', error);
            setTrendingTags([]);
        }
    };

    const handleFollow = async (userId: number) => {
        if (!authUser) {
            router.push('/login');
            return;
        }

        const user = users.find(u => u.id === userId);
        if (!user) return;

        try {
            if (user.is_following) {
                await apiClient.unfollowUser(userId);
                setUsers(prev => prev.map(u =>
                    u.id === userId ? { ...u, is_following: false } : u
                ));
            } else {
                await apiClient.followUser(userId);
                setUsers(prev => prev.map(u =>
                    u.id === userId ? { ...u, is_following: true } : u
                ));
            }
        } catch (error: any) {
            console.error('Failed to toggle follow:', error);

            // Handle blocked user case
            if (error instanceof ApiError && error.status === 403) {
                if (confirm('You have blocked this user. Do you want to unblock them to follow?')) {
                    try {
                        await apiClient.request(`/chat/unblock/${userId}/`, { method: 'POST' });
                        // Retry follow
                        await apiClient.followUser(userId);
                        setUsers(prev => prev.map(u =>
                            u.id === userId ? { ...u, is_following: true } : u
                        ));
                        return;
                    } catch (unblockErr) {
                        console.error('Failed to unblock and follow:', unblockErr);
                        alert('Failed to unblock user. Please try again.');
                    }
                }
            }

            if (error instanceof ApiError && error.isAuthError) {
                router.push('/login');
            }
        }
    };

    const handleTagClick = (tag: string) => {
        const cleanTag = tag.replace(/^#/, '').trim();
        setSelectedTag(cleanTag);
        setSearchInput('');
        setSearchQuery('');
    };

    const clearTag = () => {
        setSelectedTag('');
    };

    const getFilterLabel = (filterType: string) => {
        switch (filterType) {
            case 'last_post': return 'Last Post';
            case 'week': return 'Last Week';
            case 'month': return 'Last Month';
            case 'all_time': return 'All Time';
            default: return filterType;
        }
    };

    const getFilterIcon = (filterType: string) => {
        switch (filterType) {
            case 'last_post': return <Clock size={16} />;
            case 'week': return <Calendar size={16} />;
            case 'month': return <TrendingUp size={16} />;
            case 'all_time': return <Sparkles size={16} />;
            default: return <Filter size={16} />;
        }
    };

    // Filter users based on search
    const filteredUsers = users.filter(user => {
        if (selectedTag) {
            return user.tags?.some(tag => tag.toLowerCase().includes(selectedTag.toLowerCase()));
        }
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                user.username.toLowerCase().includes(query) ||
                user.bio.toLowerCase().includes(query) ||
                user.tags?.some(tag => tag.toLowerCase().includes(query))
            );
        }
        return true;
    });

    if (!authUser) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <Sparkles size={48} color="#7c3aed" style={{ marginBottom: '1rem' }} />
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                        Discover People
                    </h1>
                    <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                        Please log in to discover users to follow
                    </p>
                    <button
                        onClick={() => router.push('/login')}
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
                        Log In
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%)' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
                {/* Header */}
                <header style={{ marginBottom: '2rem' }}>
                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <Sparkles size={28} color="#7c3aed" />
                            <h1 style={{ fontSize: '1.875rem', fontWeight: '800', background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
                                Discover People
                            </h1>
                        </div>
                        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                            Connect with members sharing your interests
                        </p>
                    </div>

                    {/* Search Bar */}
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ position: 'relative', maxWidth: '600px', margin: '0 auto' }}>
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
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Search by username, bio, or interests..."
                                style={{
                                    width: '100%',
                                    padding: '0.875rem 3rem 0.875rem 3rem',
                                    border: '1px solid #dbdbdb',
                                    borderRadius: '0.75rem',
                                    fontSize: '0.9375rem',
                                    outline: 'none',
                                    backgroundColor: '#ffffff',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                }}
                            />
                            {searchInput && (
                                <button
                                    onClick={() => setSearchInput('')}
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

                    {/* Filter Section */}
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                                onClick={() => setShowFilterMenu(!showFilterMenu)}
                                style={{
                                    padding: '0.625rem 1.25rem',
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #dbdbdb',
                                    borderRadius: '0.5rem',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    color: '#262626',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                }}
                            >
                                {getFilterIcon(filter)}
                                {getFilterLabel(filter)}
                            </button>

                            {showFilterMenu && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    marginTop: '0.5rem',
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #dbdbdb',
                                    borderRadius: '0.75rem',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    padding: '0.5rem',
                                    zIndex: 10,
                                    minWidth: '180px'
                                }}>
                                    {(['all_time', 'last_post', 'week', 'month'] as const).map((filterType) => (
                                        <button
                                            key={filterType}
                                            onClick={() => {
                                                setFilter(filterType);
                                                setShowFilterMenu(false);
                                            }}
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem 1rem',
                                                backgroundColor: filter === filterType ? '#f5f3ff' : 'transparent',
                                                border: 'none',
                                                borderRadius: '0.5rem',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                fontSize: '0.875rem',
                                                fontWeight: filter === filterType ? '600' : '500',
                                                color: '#262626',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem'
                                            }}
                                        >
                                            {getFilterIcon(filterType)}
                                            {getFilterLabel(filterType)}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Active Filters */}
                    {selectedTag && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                            <div style={{
                                padding: '0.5rem 0.875rem',
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
                        </div>
                    )}

                    {/* Trending Tags */}
                    {!selectedTag && trendingTags.length > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <TrendingUp style={{ width: '1rem', height: '1rem', color: '#6b7280' }} />
                                <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', margin: 0 }}>
                                    Trending Interests
                                </h3>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {trendingTags.map((tag, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleTagClick(tag)}
                                        style={{
                                            padding: '0.5rem 0.875rem',
                                            backgroundColor: '#ffffff',
                                            color: '#7c3aed',
                                            borderRadius: '1rem',
                                            fontSize: '0.8125rem',
                                            fontWeight: '600',
                                            border: '1px solid #e0e7ff',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = '#f5f3ff';
                                            e.currentTarget.style.borderColor = '#7c3aed';
                                        }}
                                        onMouseLeave={(e) => {
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
                </header>

                {/* Main Content */}
                <main>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                            <div style={{
                                width: '3rem',
                                height: '3rem',
                                border: '3px solid #f3f3f3',
                                borderTopColor: '#7c3aed',
                                borderRadius: '50%',
                                animation: 'spin 0.8s linear infinite',
                                margin: '0 auto 1rem'
                            }}></div>
                            <p style={{ color: '#8e8e8e', fontSize: '0.9375rem' }}>Finding people you might like...</p>
                        </div>
                    ) : error ? (
                        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                            <div style={{
                                width: '4rem',
                                height: '4rem',
                                backgroundColor: '#ffffff',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1.5rem',
                                border: '1px solid #dbdbdb'
                            }}>
                                <Users style={{ width: '2rem', height: '2rem', color: '#c7c7c7' }} />
                            </div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#262626', marginBottom: '0.5rem' }}>
                                Failed to load recommendations
                            </h3>
                            <p style={{ color: '#8e8e8e', maxWidth: '28rem', margin: '0 auto 1rem', fontSize: '0.9375rem' }}>
                                {error}
                            </p>
                            <button
                                onClick={loadDiscoverUsers}
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
                    ) : filteredUsers.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                            <div style={{
                                width: '4rem',
                                height: '4rem',
                                backgroundColor: '#ffffff',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1.5rem',
                                border: '1px solid #dbdbdb'
                            }}>
                                <Users style={{ width: '2rem', height: '2rem', color: '#c7c7c7' }} />
                            </div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#262626', marginBottom: '0.5rem' }}>
                                {selectedTag ? `No users found with tag "${selectedTag}"` : 'No users found'}
                            </h3>
                            <p style={{ color: '#8e8e8e', maxWidth: '28rem', margin: '0 auto', fontSize: '0.9375rem' }}>
                                {selectedTag
                                    ? `Try searching for a different tag or browse trending tags above.`
                                    : searchQuery
                                        ? `No users match "${searchQuery}". Try a different search.`
                                        : 'Try changing the filter or search for specific interests.'}
                            </p>
                            {!searchQuery && !selectedTag && (
                                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
                                    <button
                                        onClick={() => setFilter('all_time')}
                                        style={{
                                            padding: '0.75rem 1.5rem',
                                            backgroundColor: '#7c3aed',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '0.5rem',
                                            fontSize: '0.875rem',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Show All Users
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                    {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'} found
                                </span>
                                <span style={{ fontSize: '0.875rem', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '0.25rem 0.75rem', borderRadius: '1rem' }}>
                                    {getFilterLabel(filter)}
                                </span>
                            </div>

                            {/* Grid Layout 5 Columns */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(5, 1fr)',
                                gap: '1rem',
                                marginBottom: '2rem'
                            }} className="users-grid">
                                {filteredUsers.slice((currentPage - 1) * 25, currentPage * 25).map((user) => (
                                    <div
                                        key={user.id}
                                        onClick={() => router.push(`/user/${user.id}`)}
                                        style={{
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '0.75rem',
                                            padding: '1rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            textAlign: 'center',
                                            transition: 'all 0.2s',
                                            cursor: 'pointer',
                                            minHeight: '280px',
                                            position: 'relative'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.boxShadow = '0 10px 25px rgba(124, 58, 237, 0.1)';
                                            e.currentTarget.style.transform = 'translateY(-4px)';
                                            e.currentTarget.style.borderColor = '#d8b4fe';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.boxShadow = 'none';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.borderColor = '#e5e7eb';
                                        }}
                                    >
                                        <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                                            <div style={{
                                                width: '5rem',
                                                height: '5rem',
                                                borderRadius: '50%',
                                                overflow: 'hidden',
                                                border: '3px solid #f3f4f6',
                                                padding: '2px',
                                                background: 'white'
                                            }}>
                                                <img
                                                    src={apiClient.getAvatarUrl(user)}
                                                    alt={user.username}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                                                />
                                            </div>
                                            {user.is_match !== false && (
                                                <div style={{
                                                    position: 'absolute',
                                                    bottom: 0,
                                                    right: 0,
                                                    backgroundColor: '#7c3aed',
                                                    color: 'white',
                                                    borderRadius: '50%',
                                                    padding: '4px',
                                                    border: '2px solid white'
                                                }} title="Match">
                                                    <Sparkles size={12} fill="white" />
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ width: '100%', marginBottom: '1rem', flex: 1 }}>
                                            <div style={{ fontWeight: '700', color: '#111827', fontSize: '0.9375rem', marginBottom: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {user.username}
                                            </div>

                                            {user.bio && (
                                                <p style={{
                                                    color: '#4b5563',
                                                    fontSize: '0.8125rem',
                                                    lineHeight: '1.4',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                    marginBottom: '0.5rem',
                                                    height: '2.4em'
                                                }}>
                                                    {user.bio}
                                                </p>
                                            )}

                                            {/* Show matched hashtags prominently if available */}
                                            {user.shared_tags && user.shared_tags.length > 0 ? (
                                                <div style={{ marginTop: '0.5rem', width: '100%' }}>
                                                    {/* Matched Interests Label REMOVED as per request */}
                                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                                                        {user.shared_tags.slice(0, 3).map((tag, idx) => (
                                                            <span
                                                                key={idx}
                                                                style={{
                                                                    fontSize: '0.75rem',
                                                                    color: '#ffffff',
                                                                    background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                                                                    padding: '0.125rem 0.625rem',
                                                                    borderRadius: '2rem',
                                                                    fontWeight: '700',
                                                                    boxShadow: '0 2px 4px rgba(236, 72, 153, 0.2)'
                                                                }}
                                                            >
                                                                #{tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : user.tags && user.tags.length > 0 ? (
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem', flexWrap: 'wrap', marginTop: 'auto' }}>
                                                    {user.tags.slice(0, 2).map((tag, idx) => (
                                                        <span
                                                            key={idx}
                                                            style={{
                                                                fontSize: '0.7rem',
                                                                color: '#6b7280',
                                                                backgroundColor: '#f3f4f6',
                                                                padding: '0.125rem 0.375rem',
                                                                borderRadius: '0.25rem'
                                                            }}
                                                        >
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', marginTop: 'auto' }}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleFollow(user.id);
                                                }}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.5rem',
                                                    backgroundColor: user.is_following ? '#f3f4f6' : '#7c3aed',
                                                    color: user.is_following ? '#374151' : '#ffffff',
                                                    border: 'none',
                                                    borderRadius: '0.5rem',
                                                    fontSize: '0.8125rem',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.375rem',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {user.is_following ? (
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
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    console.log('🔵 [DISCOVER] Opening chat with user:', {
                                                        profileId: user.id,
                                                        username: user.username
                                                    });
                                                    router.push(`/conversations?userId=${user.id}`);
                                                }}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.5rem',
                                                    backgroundColor: '#ffffff',
                                                    color: '#7c3aed',
                                                    border: '1px solid #7c3aed',
                                                    borderRadius: '0.5rem',
                                                    fontSize: '0.8125rem',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.375rem',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f3ff'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                                            >
                                                <MessageSquare size={14} />
                                                Message
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Pagination Controls */}
                            {filteredUsers.length > 25 && (
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem', marginBottom: '2rem' }}>
                                    <button
                                        onClick={() => {
                                            if (currentPage > 1) {
                                                setCurrentPage(prev => prev - 1);
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }
                                        }}
                                        disabled={currentPage === 1}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            border: '1px solid #dbdbdb',
                                            borderRadius: '0.5rem',
                                            background: currentPage === 1 ? '#f3f4f6' : 'white',
                                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                            color: currentPage === 1 ? '#9ca3af' : '#262626'
                                        }}
                                    >
                                        Previous
                                    </button>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        {Array.from({ length: Math.ceil(filteredUsers.length / 25) }, (_, i) => i + 1).map(page => (
                                            <button
                                                key={page}
                                                onClick={() => {
                                                    setCurrentPage(page);
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }}
                                                style={{
                                                    width: '2rem',
                                                    height: '2rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    borderRadius: '0.5rem',
                                                    background: currentPage === page ? '#7c3aed' : 'white',
                                                    color: currentPage === page ? 'white' : '#262626',
                                                    border: currentPage === page ? 'none' : '1px solid #dbdbdb',
                                                    cursor: 'pointer',
                                                    fontSize: '0.875rem'
                                                }}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => {
                                            if (currentPage < Math.ceil(filteredUsers.length / 25)) {
                                                setCurrentPage(prev => prev + 1);
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }
                                        }}
                                        disabled={currentPage >= Math.ceil(filteredUsers.length / 25)}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            border: '1px solid #dbdbdb',
                                            borderRadius: '0.5rem',
                                            background: currentPage >= Math.ceil(filteredUsers.length / 25) ? '#f3f4f6' : 'white',
                                            cursor: currentPage >= Math.ceil(filteredUsers.length / 25) ? 'not-allowed' : 'pointer',
                                            color: currentPage >= Math.ceil(filteredUsers.length / 25) ? '#9ca3af' : '#262626'
                                        }}
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>

            <style jsx global>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                * {
                    box-sizing: border-box;
                }
                
                @media (max-width: 1024px) {
                    .users-grid {
                        grid-template-columns: repeat(3, 1fr) !important;
                    }
                }
                
                @media (max-width: 768px) {
                    .discover-page {
                        padding: 1rem 0.75rem;
                    }
                    
                    .users-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                }
                
                @media (max-width: 480px) {
                    .users-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
                
                /* Keep existing styles just in case but grid overrides them */
            `}</style>
        </div>
    );
}