'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, MessageCircle, Bookmark, Send, Image as ImageIcon, Globe, Lock, X, Hash, Plus, Loader2, RefreshCw, User, Edit, Trash2, Smile, Pencil } from 'lucide-react';
import { apiClient, ApiError, AuthUser } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

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

interface Comment {
    id: number;
    post: number;
    author: UserProfile;
    content: string;
    created_at: string;
}

const HAPPY_EMOJIS = [
    'https://www.svgrepo.com/show/492551/happy-2.svg',
    'https://www.svgrepo.com/show/343904/happy.svg',
    'https://www.svgrepo.com/show/270340/happy-emoji.svg',
    'https://www.svgrepo.com/show/271860/happy.svg',
    'https://www.svgrepo.com/show/209064/happy-emoji.svg'
];

const ensurePostFields = (post: any): Post => {
    return {
        ...post,
        tags: post.tags || [],
        likes_count: post.likes_count || 0,
        comments_count: post.comments_count || (post.comments ? post.comments.length : 0),
        is_liked: post.is_liked || false,
        is_saved: post.is_saved || false,
        comments: post.comments || [],
        content: post.content || post.caption || '',
        caption: post.caption || post.content || '',
        image: post.image || null,
        is_public: post.is_public !== undefined ? post.is_public : true
    };
};

export default function PersonalFeedPage() {
    const { user: authUser } = useAuth();
    const router = useRouter();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [newPost, setNewPost] = useState('');
    const [posting, setPosting] = useState(false);
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [expandedComments, setExpandedComments] = useState<number[]>([]);
    const [commentText, setCommentText] = useState<{ [key: number]: string }>({});
    const [error, setError] = useState<string | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);
    const [newHashtag, setNewHashtag] = useState('');
    const [showEmojiPanel, setShowEmojiPanel] = useState(false);
    const [editingPost, setEditingPost] = useState<Post | null>(null);
    const [editContent, setEditContent] = useState('');
    const [editHashtags, setEditHashtags] = useState<string[]>([]);
    const [newEditHashtag, setNewEditHashtag] = useState('');
    const [expandedPosts, setExpandedPosts] = useState<number[]>([]);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const postInputRef = useRef<HTMLTextAreaElement>(null);
    const hashtagInputRef = useRef<HTMLInputElement>(null);
    const emojiPanelRef = useRef<HTMLDivElement>(null);
    const editHashtagInputRef = useRef<HTMLInputElement>(null);

    const fetchUserPosts = useCallback(async (showLoading = true) => {
        if (!authUser) {
            setLoading(false);
            setInitialLoading(false);
            return;
        }

        if (showLoading) {
            setLoading(true);
            setError(null);
        }

        try {
            const postsData = await apiClient.request('/posts/user/', {
                method: 'GET'
            });

            const enhancedPosts = Array.isArray(postsData)
                ? postsData.map(ensurePostFields)
                : [];

            setPosts(enhancedPosts);
            setError(null);
        } catch (error) {
            if (error instanceof ApiError && error.isAuthError) {
                setError('Authentication required. Please log in to view your posts.');
                setPosts([]);
            } else if (error instanceof ApiError && error.isNotFound) {
                setPosts([]);
                setError(null);
            } else {
                console.error('Failed to fetch posts:', error);
                setPosts([]);
                if (error instanceof Error && error.message.includes('Failed to fetch')) {
                    setError('Failed to load your posts. Please check your connection.');
                } else {
                    setError(error instanceof Error ? error.message : 'An unexpected error occurred');
                }
            }
        } finally {
            if (showLoading) {
                setLoading(false);
                setInitialLoading(false);
            }
        }
    }, [authUser]);

    useEffect(() => {
        setIsClient(true);
        fetchUserPosts();
    }, [fetchUserPosts]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPanelRef.current && !emojiPanelRef.current.contains(event.target as Node)) {
                setShowEmojiPanel(false);
            }
        };

        if (showEmojiPanel) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showEmojiPanel]);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedImage(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const addHashtag = () => {
        if (newHashtag.trim()) {
            let hashtag = newHashtag.trim();
            if (!hashtag.startsWith('#')) {
                hashtag = `#${hashtag}`;
            }
            const cleanHashtag = hashtag.startsWith('#') ? hashtag.slice(1) : hashtag;
            if (!selectedHashtags.includes(cleanHashtag)) {
                setSelectedHashtags([...selectedHashtags, cleanHashtag]);
            }
            setNewHashtag('');
        }
    };

    const addEditHashtag = () => {
        if (newEditHashtag.trim()) {
            let hashtag = newEditHashtag.trim();
            if (!hashtag.startsWith('#')) {
                hashtag = `#${hashtag}`;
            }
            const cleanHashtag = hashtag.startsWith('#') ? hashtag.slice(1) : hashtag;
            if (!editHashtags.includes(cleanHashtag)) {
                setEditHashtags([...editHashtags, cleanHashtag]);
            }
            setNewEditHashtag('');
        }
    };

    const removeHashtag = (tag: string) => {
        setSelectedHashtags(selectedHashtags.filter(t => t !== tag));
    };

    const removeEditHashtag = (tag: string) => {
        setEditHashtags(editHashtags.filter(t => t !== tag));
    };

    const addEmoji = (emojiUrl: string) => {
        const emojiText = ` [${emojiUrl}] `;
        const textarea = postInputRef.current;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = newPost.substring(0, start) + emojiText + newPost.substring(end);
            setNewPost(text);
            textarea.focus();
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + emojiText.length;
            }, 0);
        }
        setShowEmojiPanel(false);
    };

    const handleCreatePost = async (e: React.FormEvent) => {
        e.preventDefault();

        if ((!newPost.trim() && !selectedImage)) {
            setError('Please write something or select an image');
            return;
        }

        if (selectedHashtags.length === 0) {
            setError('Please add at least one hashtag');
            return;
        }

        if (posting) return;

        setPosting(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('content', newPost);
            formData.append('caption', newPost);
            formData.append('tags', JSON.stringify(selectedHashtags));

            if (selectedImage) {
                formData.append('image', selectedImage);
            }

            const newPostData = await apiClient.request('/posts/', {
                method: 'POST',
                body: formData
            });

            const enhancedNewPost = ensurePostFields(newPostData);

            setPosts(prev => [enhancedNewPost, ...prev]);
            setNewPost('');
            setSelectedImage(null);
            setImagePreview(null);
            setSelectedHashtags([]);
            setNewHashtag('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (error) {
            console.error('Failed to create post:', error);
            setError(error instanceof Error ? error.message : 'Failed to share your post');
        } finally {
            setPosting(false);
        }
    };

    const handleEditPost = (post: Post) => {
        setEditingPost(post);
        setEditContent(post.content || post.caption || '');
        setEditHashtags(post.tags || []);
    };

    const cancelEdit = () => {
        setEditingPost(null);
        setEditContent('');
        setEditHashtags([]);
        setNewEditHashtag('');
    };

    const handleUpdatePost = async () => {
        if (!editingPost) return;

        if (editContent.trim() === '') {
            setError('Post content cannot be empty');
            return;
        }

        if (editHashtags.length === 0) {
            setError('Please add at least one hashtag');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('content', editContent);
            formData.append('caption', editContent);
            formData.append('tags', JSON.stringify(editHashtags));

            const updatedPostData = await apiClient.request(`/posts/${editingPost.id}/update/`, {
                method: 'PUT',
                body: formData
            });

            const updatedPost = ensurePostFields(updatedPostData);

            setPosts(prev => prev.map(post =>
                post.id === editingPost.id ? updatedPost : post
            ));
            cancelEdit();
        } catch (error) {
            console.error('Failed to update post:', error);
            setError(error instanceof Error ? error.message : 'Failed to update post');
        }
    };

    const handleLike = async (postId: number) => {
        try {
            await apiClient.likePost(postId);
            setPosts(prev => prev.map(post => {
                if (post.id === postId) {
                    const isLiked = !post.is_liked;
                    return {
                        ...post,
                        is_liked: isLiked,
                        likes_count: isLiked ? (post.likes_count || 0) + 1 : Math.max(0, (post.likes_count || 1) - 1)
                    };
                }
                return post;
            }));
        } catch (error) {
            console.error('Failed to like post:', error);
        }
    };

    const handleSave = async (postId: number) => {
        try {
            await apiClient.savePost(postId);
            setPosts(prev => prev.map(post => {
                if (post.id === postId) {
                    return {
                        ...post,
                        is_saved: !post.is_saved
                    };
                }
                return post;
            }));
        } catch (error) {
            console.error('Failed to save post:', error);
        }
    };

    const handleDeletePost = async (postId: number) => {
        if (!confirm('Are you sure you want to delete this post?')) return;

        try {
            await apiClient.request(`/posts/${postId}/delete/`, {
                method: 'DELETE'
            });
            setPosts(prev => prev.filter(post => post.id !== postId));
        } catch (error) {
            console.error('Failed to delete post:', error);
            setError('Failed to delete post. Please try again.');
        }
    };

    const toggleComments = async (postId: number) => {
        if (expandedComments.includes(postId)) {
            setExpandedComments(expandedComments.filter(id => id !== postId));
            return;
        }

        try {
            const comments = await apiClient.getComments(postId);
            setPosts(prev => prev.map(post => {
                if (post.id === postId) {
                    return {
                        ...post,
                        comments: comments || []
                    };
                }
                return post;
            }));
            setExpandedComments([...expandedComments, postId]);
        } catch (error) {
            console.error('Failed to fetch comments:', error);
        }
    };

    const togglePostText = (postId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedPosts(prev =>
            prev.includes(postId)
                ? prev.filter(id => id !== postId)
                : [...prev, postId]
        );
    };

    const handleAddComment = async (e: React.FormEvent, postId: number) => {
        e.preventDefault();
        const content = commentText[postId];
        if (!content?.trim()) return;

        try {
            const newComment = await apiClient.addComment(postId, content.trim()) as Comment;
            setPosts(prev => prev.map(post => {
                if (post.id === postId) {
                    return {
                        ...post,
                        comments_count: (post.comments_count || 0) + 1,
                        comments: [...(post.comments || []), newComment]
                    };
                }
                return post;
            }));
            setCommentText(prev => ({ ...prev, [postId]: '' }));
        } catch (error) {
            console.error('Failed to add comment:', error);
        }
    };

    const formatDate = (dateString: string) => {
        if (!isClient || !dateString) return 'Just now';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Just now';

            const now = new Date();
            const diffInMs = now.getTime() - date.getTime();

            // Handle clock skew (future dates)
            if (diffInMs < 0) return 'Just now';

            const diffInSeconds = Math.floor(diffInMs / 1000);
            if (diffInSeconds < 60) return 'Just now';

            const diffInMinutes = Math.floor(diffInSeconds / 60);
            if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

            const diffInHours = Math.floor(diffInMinutes / 60);
            if (diffInHours < 24) return `${diffInHours}h ago`;

            const diffInDays = Math.floor(diffInHours / 24);
            if (diffInDays < 7) return `${diffInDays}d ago`;
            if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`;
            if (diffInDays < 365) return `${Math.floor(diffInDays / 30)}mo ago`;
            return `${Math.floor(diffInDays / 365)}y ago`;
        } catch {
            return 'Just now';
        }
    };

    const getAvatarUrl = (user: any) => {
        return apiClient.getAvatarUrl(user);
    };

    if (!isClient) {
        return (
            <div className="loading-container">
                <Loader2 className="spinner" />
            </div>
        );
    }

    return (
        <div className="page-container">
            {/* Top gradient bar */}
            <div className="top-gradient-bar" />

            {/* Main Container */}
            <div className="main-container">
                {/* Header */}
                <header className="page-header">
                    <div className="header-content">
                        <div className="header-top">
                            <div className="header-title">
                                <div className="icon-wrapper">
                                    <User className="header-icon" />
                                </div>
                                <h1 className="gradient-title">Personal Feed</h1>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="content-area">
                    {/* Create Post Form */}
                    <div className="create-post-card">

                        <div className="form-header">
                            <Edit className="form-icon" />
                            <h2 className="form-title">Create New Post</h2>
                        </div>

                        <form onSubmit={handleCreatePost}>
                            <div className="post-input-section">
                                <div className="avatar-container">
                                    <img
                                        src={getAvatarUrl(authUser)}
                                        alt="Your avatar"
                                        className="user-avatar"
                                    />
                                </div>
                                <div className="input-wrapper">
                                    <div className="textarea-container">
                                        <textarea
                                            ref={postInputRef}
                                            value={newPost}
                                            onChange={(e) => setNewPost(e.target.value)}
                                            placeholder="What's making you happy today? Share your thoughts... 😊"
                                            rows={4}
                                            className="post-textarea"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowEmojiPanel(!showEmojiPanel)}
                                            className="emoji-button"
                                            title="Add emoji"
                                        >
                                            <Smile className="emoji-icon" />
                                        </button>
                                    </div>

                                    {showEmojiPanel && (
                                        <div ref={emojiPanelRef} className="emoji-panel">
                                            <div className="emoji-panel-header">
                                                <span className="emoji-title">Happy Emojis</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowEmojiPanel(false)}
                                                    className="close-emoji-button"
                                                >
                                                    <X className="close-icon" />
                                                </button>
                                            </div>
                                            <div className="emoji-grid">
                                                {HAPPY_EMOJIS.map((emoji, index) => (
                                                    <button
                                                        key={index}
                                                        type="button"
                                                        onClick={() => addEmoji(emoji)}
                                                        className="emoji-button-item"
                                                        title="Add happy emoji"
                                                    >
                                                        <img
                                                            src={emoji}
                                                            alt={`Happy emoji ${index + 1}`}
                                                            className="emoji-image"
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Hashtags Section */}
                            <div className="hashtags-section">
                                <div className="hashtags-header">
                                    <label className="hashtags-label">
                                        <Hash className="hashtag-icon" />
                                        Hashtags (Required) *
                                    </label>
                                    <span className={`hashtag-count ${selectedHashtags.length === 0 ? 'error' : 'success'}`}>
                                        {selectedHashtags.length === 0 ? 'Add at least 1 hashtag' : `${selectedHashtags.length} hashtags added`}
                                    </span>
                                </div>

                                <div className="hashtags-list">
                                    {selectedHashtags.map(tag => (
                                        <div key={tag} className="hashtag-tag">
                                            <span className="hashtag-text">#{tag}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeHashtag(tag)}
                                                className="remove-hashtag-button"
                                            >
                                                <X className="remove-icon" />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="hashtag-input-group">
                                    <input
                                        ref={hashtagInputRef}
                                        type="text"
                                        value={newHashtag}
                                        onChange={(e) => setNewHashtag(e.target.value)}
                                        placeholder="Create new hashtag (e.g., happy, coding)"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addHashtag();
                                            }
                                        }}
                                        className="hashtag-input"
                                    />
                                    <button
                                        type="button"
                                        onClick={addHashtag}
                                        className="add-hashtag-button"
                                    >
                                        <Plus className="add-icon" />
                                        Add
                                    </button>
                                </div>

                                <p className="hashtag-hint">
                                    Hashtags help categorize your posts and make them discoverable.
                                </p>
                            </div>

                            {imagePreview && (
                                <div className="image-preview">
                                    <img
                                        src={imagePreview}
                                        alt="Selected"
                                        className="preview-image"
                                        onClick={() => setLightboxImage(imagePreview)}
                                        style={{ cursor: 'zoom-in' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedImage(null);
                                            setImagePreview(null);
                                            if (fileInputRef.current) fileInputRef.current.value = '';
                                        }}
                                        className="remove-image-button"
                                    >
                                        <X className="remove-image-icon" />
                                    </button>
                                </div>
                            )}

                            {error && (
                                <div className="error-message">
                                    {error}
                                </div>
                            )}

                            {/* Post Actions */}
                            <div className="post-actions">
                                <div className="action-buttons">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="action-button image-button"
                                    >
                                        <ImageIcon className="action-icon" />
                                        <span>Add Image</span>
                                    </button>

                                    <input
                                        type="file"
                                        accept="image/*"
                                        ref={fileInputRef}
                                        className="hidden-file-input"
                                        onChange={handleImageSelect}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={(!newPost.trim() && !selectedImage) || posting || selectedHashtags.length === 0}
                                    className={`submit-button ${((!newPost.trim() && !selectedImage) || posting || selectedHashtags.length === 0) ? 'disabled' : ''}`}
                                >
                                    {posting ? (
                                        <>
                                            <Loader2 className="spinner-icon" />
                                            <span>Sharing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Send className="send-icon" />
                                            <span>Post Update</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Edit Post Modal */}
                    {editingPost && (
                        <div className="modal-overlay">
                            <div className="edit-modal">
                                <div className="modal-header">
                                    <h2 className="modal-title">Edit Post</h2>
                                    <button
                                        onClick={cancelEdit}
                                        className="close-modal-button"
                                    >
                                        <X className="close-modal-icon" />
                                    </button>
                                </div>

                                <div className="modal-content">
                                    <textarea
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        placeholder="Edit your post..."
                                        rows={4}
                                        className="edit-textarea"
                                    />
                                </div>

                                <div className="edit-hashtags-section">
                                    <div className="hashtags-header">
                                        <label className="hashtags-label">
                                            <Hash className="hashtag-icon" />
                                            Hashtags (Required) *
                                        </label>
                                        <span className={`hashtag-count ${editHashtags.length === 0 ? 'error' : 'success'}`}>
                                            {editHashtags.length === 0 ? 'Add at least 1 hashtag' : `${editHashtags.length} hashtags added`}
                                        </span>
                                    </div>

                                    <div className="hashtags-list">
                                        {editHashtags.map(tag => (
                                            <div key={tag} className="hashtag-tag">
                                                <span className="hashtag-text">#{tag}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeEditHashtag(tag)}
                                                    className="remove-hashtag-button"
                                                >
                                                    <X className="remove-icon" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="hashtag-input-group">
                                        <input
                                            ref={editHashtagInputRef}
                                            type="text"
                                            value={newEditHashtag}
                                            onChange={(e) => setNewEditHashtag(e.target.value)}
                                            placeholder="Add hashtag (e.g., happy, coding)"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addEditHashtag();
                                                }
                                            }}
                                            className="hashtag-input"
                                        />
                                        <button
                                            type="button"
                                            onClick={addEditHashtag}
                                            className="add-hashtag-button"
                                        >
                                            <Plus className="add-icon" />
                                            Add
                                        </button>
                                    </div>
                                </div>

                                <div className="modal-actions">
                                    <button
                                        onClick={cancelEdit}
                                        className="cancel-button"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleUpdatePost}
                                        disabled={editContent.trim() === '' || editHashtags.length === 0}
                                        className={`update-button ${editContent.trim() === '' || editHashtags.length === 0 ? 'disabled' : ''}`}
                                    >
                                        Update Post
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Posts List */}
                    <div className="posts-section">
                        <div className="posts-header">
                            <h2 className="posts-title">Your Posts ({posts.length})</h2>
                            <button
                                onClick={() => fetchUserPosts()}
                                className="refresh-button"
                            >
                                <RefreshCw className="refresh-icon" />
                                Refresh
                            </button>
                        </div>

                        {initialLoading ? (
                            <div className="loading-posts">
                                <Loader2 className="spinner" />
                                <p className="loading-text">Loading your posts...</p>
                            </div>
                        ) : error ? (
                            <div className="error-state">
                                <div className="emoji-background">
                                    {HAPPY_EMOJIS.map((emoji, index) => (
                                        <img
                                            key={index}
                                            src={emoji}
                                            alt="Happy emoji"
                                            className="emoji-bg-item"
                                            style={{
                                                width: `${60 + index * 10}px`,
                                                top: `${15 + index * 15}%`,
                                                left: `${10 + index * 18}%`,
                                                transform: `rotate(${index * 20}deg)`
                                            }}
                                        />
                                    ))}
                                </div>

                                <div className="error-content">
                                    <p className="error-title">{error}</p>
                                    <button
                                        onClick={() => fetchUserPosts()}
                                        className="retry-button"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            </div>
                        ) : posts.length === 0 ? (
                            <div className="empty-state">
                                <div className="emoji-background">
                                    {HAPPY_EMOJIS.map((emoji, index) => (
                                        <img
                                            key={index}
                                            src={emoji}
                                            alt="Happy emoji"
                                            className="emoji-bg-item"
                                            style={{
                                                width: `${60 + index * 10}px`,
                                                top: `${15 + index * 15}%`,
                                                left: `${10 + index * 18}%`,
                                                transform: `rotate(${index * 20}deg)`
                                            }}
                                        />
                                    ))}
                                </div>

                                <div className="empty-content">
                                    <p className="empty-title">You haven't created any posts yet.</p>
                                    <p className="empty-hint">
                                        Start by creating your first post above! Share something that makes you happy 😊
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="posts-grid">
                                {posts.map((post) => (
                                    <div
                                        key={post.id}
                                        className="post-card"
                                        onClick={() => router.push(`/${post.author.user.username}/post/${post.id}`)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {authUser && String(post.author.user.id) === String(authUser.id) && (
                                            <div className="post-actions-menu">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEditPost(post);
                                                    }}
                                                    className="edit-post-button"
                                                    title="Edit post"
                                                >
                                                    <Pencil className="action-icon-small" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeletePost(post.id);
                                                    }}
                                                    className="delete-post-button"
                                                    title="Delete post"
                                                >
                                                    <Trash2 className="action-icon-small" />
                                                </button>
                                            </div>
                                        )}

                                        <div className="post-header">
                                            <div className="post-avatar">
                                                <img
                                                    src={getAvatarUrl(post.author)}
                                                    alt={post.author.user.username}
                                                    className="post-author-avatar"
                                                />
                                            </div>
                                            <div className="post-author-info">
                                                <div className="author-details">
                                                    <h3 className="author-name">
                                                        {post.author.user.username}
                                                    </h3>
                                                    <span className="post-date">
                                                        {formatDate(post.created_at)}
                                                    </span>
                                                </div>
                                                {post.tags && post.tags.length > 0 && (
                                                    <div className="post-tags">
                                                        {post.tags.map(tag => (
                                                            <span key={tag} className="post-tag">
                                                                #{tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className={`post-content-wrapper ${expandedPosts.includes(post.id) ? 'expanded' : ''}`}>
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
                                            <p className="post-content">
                                                {post.content}
                                            </p>
                                        </div>
                                        {post.content.length > 200 && (
                                            <button
                                                className="read-more-button"
                                                onClick={(e) => togglePostText(post.id, e)}
                                            >
                                                {expandedPosts.includes(post.id) ? 'Show less' : 'Read more'}
                                            </button>
                                        )}


                                        <div className="post-interactions">
                                            <div className="interaction-buttons">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleLike(post.id);
                                                    }}
                                                    className="like-button"
                                                >
                                                    <Heart
                                                        className={`heart-icon ${post.is_liked ? 'liked' : ''}`}
                                                    />
                                                    <span className="interaction-count">
                                                        {post.likes_count}
                                                    </span>
                                                </button>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleComments(post.id);
                                                    }}
                                                    className="comment-button"
                                                >
                                                    <MessageCircle className="comment-icon" />
                                                    <span className="interaction-count">
                                                        {post.comments_count}
                                                    </span>
                                                </button>
                                            </div>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSave(post.id);
                                                }}
                                                className="save-button"
                                            >
                                                <Bookmark
                                                    className={`bookmark-icon ${post.is_saved ? 'saved' : ''}`}
                                                />
                                            </button>
                                        </div>

                                        {expandedComments.includes(post.id) && (
                                            <div className="comments-section" onClick={(e) => e.stopPropagation()}>
                                                <div className="comments-list">
                                                    {post.comments && post.comments.length > 0 ? (
                                                        <div className="comments-container">
                                                            {post.comments.map((comment) => (
                                                                <div key={comment.id} className="comment-item">
                                                                    <div className="comment-avatar-wrapper">
                                                                        <img
                                                                            src={getAvatarUrl(comment.author)}
                                                                            alt={comment.author.user.username}
                                                                            className="comment-avatar"
                                                                        />
                                                                    </div>
                                                                    <div className="comment-content">
                                                                        <div className="comment-header">
                                                                            <span className="comment-author-name">
                                                                                {comment.author.user.username}
                                                                            </span>
                                                                            <span className="comment-time">{formatDate(comment.created_at)}</span>
                                                                        </div>
                                                                        <p className="comment-text-body">
                                                                            {comment.content}
                                                                        </p>
                                                                        {authUser && String(comment.author.user.id) === String(authUser.id) && (
                                                                            <div className="comment-actions">
                                                                                <button className="comment-action-btn edit">Edit</button>
                                                                                <button className="comment-action-btn delete">Delete</button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="no-comments">
                                                            <MessageCircle className="no-comments-icon" />
                                                            <p>No comments yet. Share your thoughts!</p>
                                                        </div>
                                                    )}
                                                </div>

                                                <form onSubmit={(e) => handleAddComment(e, post.id)} className="comment-form">
                                                    <div className="comment-input-wrapper">
                                                        <textarea
                                                            value={commentText[post.id] || ''}
                                                            onChange={(e) => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                                                            placeholder="Write a comment..."
                                                            className="comment-textarea"
                                                            rows={1}
                                                            onInput={(e) => {
                                                                const target = e.target as HTMLTextAreaElement;
                                                                target.style.height = 'auto';
                                                                target.style.height = target.scrollHeight + 'px';
                                                            }}
                                                        />
                                                        <button
                                                            type="submit"
                                                            disabled={!commentText[post.id]?.trim()}
                                                            className="comment-send-button"
                                                        >
                                                            <Send size={18} />
                                                        </button>
                                                    </div>
                                                </form>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {loading && !initialLoading && (
                            <div className="loading-more">
                                <Loader2 className="spinner-small" />
                                <p>Loading...</p>
                            </div>
                        )}
                    </div>
                </main>

            </div>

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
                            alt="Full view"
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
            )}

            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

                * {
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                }

                body {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%);
                    min-height: 100vh;
                }

                /* Animation keyframes */
                @keyframes zoomIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* Global styles */
                .page-container {
                    min-height: 100vh;
                    background: linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%);
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }

                .top-gradient-bar {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 4px;
                    background: linear-gradient(90deg, #7C3AED, #3B82F6, #7C3AED);
                    background-size: 200% 100%;
                    z-index: 1000;
                    animation: shimmer 2s linear infinite;
                }

                .main-container {
                    width: 100%;
                    max-width: 900px;
                    margin: 0 auto;
                    padding: 0 24px;
                }

                /* Header styles */
                .page-header {
                    padding: 60px 0 40px 0;
                    margin-bottom: 48px;
                    background: transparent;
                }

                .header-content {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }

                .header-top {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 24px;
                    flex-wrap: wrap;
                }

                .header-title {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .icon-wrapper {
                    width: 48px;
                    height: 48px;
                    background: linear-gradient(135deg, #7C3AED, #3B82F6);
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 8px 16px -4px rgba(124, 58, 237, 0.3);
                }

                .header-icon {
                    width: 24px;
                    height: 24px;
                    color: white;
                }

                .gradient-title {
                    font-size: 42px;
                    font-weight: 900;
                    background: linear-gradient(135deg, #1f2937 0%, #4b5563 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin: 0;
                    letter-spacing: -0.05em;
                }



                /* Content area */
                .content-area {
                    width: 100%;
                }

                /* Create post card */
                .create-post-card {
                    background: rgba(255, 255, 255, 0.9);
                    border-radius: 24px;
                    padding: 32px;
                    box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.04), 0 4px 10px -2px rgba(0, 0, 0, 0.02);
                    border: 1px solid rgba(255, 255, 255, 0.8);
                    backdrop-filter: blur(20px);
                    position: relative;
                    overflow: hidden;
                    margin-bottom: 32px;
                    animation: fadeIn 0.5s ease-out;
                }

                .emoji-background {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    pointer-events: none;
                    overflow: hidden;
                    border-radius: 16px;
                    opacity: 0.03;
                }

                .emoji-bg-item {
                    position: absolute;
                    height: auto;
                    opacity: 0.7;
                }

                .form-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 20px;
                    position: relative;
                    z-index: 1;
                }

                .form-icon {
                    width: 22px;
                    height: 22px;
                    color: #7C3AED;
                    flex-shrink: 0;
                }

                .form-title {
                    font-size: 20px;
                    font-weight: 700;
                    color: #111827;
                    margin: 0;
                    letter-spacing: -0.01em;
                }

                .post-input-section {
                    display: flex;
                    align-items: flex-start;
                    gap: 16px;
                    margin-bottom: 20px;
                    position: relative;
                    z-index: 1;
                }

                .avatar-container {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    overflow: hidden;
                    border: 2px solid #e5e7eb;
                    flex-shrink: 0;
                }

                .user-avatar {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .input-wrapper {
                    flex: 1;
                    position: relative;
                }

                .textarea-container {
                    position: relative;
                    width: 100%;
                }

                .post-textarea {
                    width: 100%;
                    border: 1px solid rgba(229, 231, 235, 0.5);
                    outline: none;
                    font-size: 17px;
                    color: #111827;
                    background: #f8fafc;
                    resize: none;
                    font-family: inherit;
                    padding: 20px;
                    border-radius: 20px;
                    padding-right: 50px;
                    box-sizing: border-box;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.02);
                    line-height: 1.6;
                }

                .post-textarea:focus {
                    border-color: #7C3AED;
                    background: #ffffff;
                    box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.1), inset 0 2px 4px 0 rgba(0, 0, 0, 0.02);
                }

                .emoji-button {
                    position: absolute;
                    right: 12px;
                    top: 12px;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .emoji-icon {
                    width: 20px;
                    height: 20px;
                    color: #9ca3af;
                }

                .emoji-panel {
                    position: absolute;
                    right: 0;
                    top: 100%;
                    margin-top: 8px;
                    background: #ffffff;
                    border-radius: 12px;
                    border: 1px solid #e5e7eb;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                    padding: 12px;
                    z-index: 1000;
                    min-width: 200px;
                    max-width: calc(100% - 64px);
                }

                .emoji-panel-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 12px;
                }

                .emoji-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: #1f2937;
                    word-wrap: break-word;
                }

                .close-emoji-button {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    flex-shrink: 0;
                }

                .close-icon {
                    width: 16px;
                    height: 16px;
                    color: #6b7280;
                }

                .emoji-grid {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    justify-content: center;
                }

                .emoji-button-item {
                    padding: 8px;
                    background: #f9fafb;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }

                .emoji-button-item:hover {
                    background: #f3f4f6;
                }

                .emoji-image {
                    width: 24px;
                    height: 24px;
                    max-width: 100%;
                }

                /* Hashtags section */
                .hashtags-section {
                    margin-bottom: 20px;
                    position: relative;
                    z-index: 1;
                }

                .hashtags-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 12px;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .hashtags-label {
                    font-size: 14px;
                    font-weight: 600;
                    color: #1f2937;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;
                }

                .hashtag-icon {
                    width: 16px;
                    height: 16px;
                }

                .hashtag-count {
                    font-size: 12px;
                    flex-shrink: 0;
                }

                .hashtag-count.error {
                    color: #ef4444;
                }

                .hashtag-count.success {
                    color: #10b981;
                }

                .hashtags-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-bottom: 12px;
                }

                .hashtag-tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    background: linear-gradient(135deg, #EDE9FE, #FCE7F3);
                    color: #7C3AED;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: 500;
                    border: 1px solid rgba(124, 58, 237, 0.2);
                    max-width: 100%;
                    word-break: break-word;
                }

                .hashtag-text {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 150px;
                }

                .remove-hashtag-button {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .remove-icon {
                    width: 14px;
                    height: 14px;
                    color: #7C3AED;
                }

                .hashtag-input-group {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .hashtag-input {
                    flex: 1;
                    min-width: 200px;
                    padding: 10px 16px;
                    border: 1px solid #e5e7eb;
                    border-radius: 12px;
                    font-size: 14px;
                    color: #1f2937;
                    background: rgba(255, 255, 255, 0.9);
                    box-sizing: border-box;
                }

                .hashtag-input:focus {
                    outline: none;
                    border-color: #7C3AED;
                }

                .add-hashtag-button {
                    padding: 10px 16px;
                    background: linear-gradient(135deg, #7C3AED, #3B82F6);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    box-shadow: 0 2px 4px rgba(124, 58, 237, 0.2);
                    flex-shrink: 0;
                }

                .add-hashtag-button:hover {
                    opacity: 0.9;
                }

                .add-icon {
                    width: 16px;
                    height: 16px;
                }

                .hashtag-hint {
                    font-size: 12px;
                    color: #6b7280;
                    margin-top: 8px;
                }

                /* Image preview */
                .image-preview {
                    margin: 10px 0;
                    position: relative;
                    display: inline-block;
                    border-radius: 12px;
                    overflow: hidden;
                    z-index: 10;
                    width: 140px;
                    height: 140px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                    border: 3px solid white;
                    background: #f3f4f6;
                    transition: transform 0.2s;
                }
                
                .image-preview:hover {
                    transform: scale(1.02);
                }

                .preview-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .remove-image-button {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: #ef4444;
                    color: white;
                    border-radius: 50%;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    border: none;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                }

                .remove-image-icon {
                    width: 16px;
                    height: 16px;
                }

                /* Error message */
                .error-message {
                    background: linear-gradient(135deg, #FEE2E2, #FECACA);
                    border: 1px solid #ef4444;
                    border-radius: 12px;
                    padding: 12px;
                    margin-bottom: 16px;
                    color: #ef4444;
                    font-size: 14px;
                    position: relative;
                    z-index: 1;
                    word-wrap: break-word;
                }

                /* Post actions */
                .post-actions {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                    flex-wrap: wrap;
                    gap: 12px;
                    position: relative;
                    z-index: 1;
                }

                .action-buttons {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex-wrap: wrap;
                }

                .action-button {
                    padding: 10px 16px;
                    color: #4b5563;
                    background: rgba(249, 250, 251, 0.9);
                    border: 1px solid #e5e7eb;
                    border-radius: 10px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }

                .action-button:hover {
                    background: rgba(243, 244, 246, 0.9);
                    border-color: #7C3AED;
                }

                .action-icon {
                    width: 18px;
                    height: 18px;
                }

                .visibility-button.public {
                    border-color: #10b981;
                    background: rgba(209, 250, 229, 0.9);
                    color: #10b981;
                }

                .visibility-button.private {
                    border-color: #f59e0b;
                    background: rgba(254, 243, 199, 0.9);
                    color: #f59e0b;
                }

                .hidden-file-input {
                    display: none;
                }

                .submit-button {
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    font-size: 14px;
                    background: linear-gradient(135deg, #7C3AED, #3B82F6);
                    color: white;
                    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
                    transition: all 0.3s;
                    flex-shrink: 0;
                }

                .submit-button:hover:not(.disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(124, 58, 237, 0.4);
                }

                .submit-button.disabled {
                    background: #e5e7eb;
                    cursor: not-allowed;
                    opacity: 0.5;
                    box-shadow: none;
                }

                .spinner-icon {
                    width: 18px;
                    height: 18px;
                    animation: spin 1s linear infinite;
                }

                .send-icon {
                    width: 18px;
                    height: 18px;
                }

                /* Edit modal */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 20px;
                }

                .edit-modal {
                    background: #ffffff;
                    border-radius: 16px;
                    padding: 24px;
                    max-width: 600px;
                    width: 100%;
                    max-height: 90vh;
                    overflow: auto;
                    box-sizing: border-box;
                }

                .modal-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 20px;
                }

                .modal-title {
                    font-size: 20px;
                    font-weight: 600;
                    color: #1f2937;
                    margin: 0;
                    word-wrap: break-word;
                    max-width: calc(100% - 40px);
                }

                .close-modal-button {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .close-modal-icon {
                    width: 20px;
                    height: 20px;
                    color: #6b7280;
                }

                .modal-content {
                    margin-bottom: 20px;
                    width: 100%;
                }

                .edit-textarea {
                    width: 100%;
                    border: 1px solid #e5e7eb;
                    border-radius: 12px;
                    padding: 16px;
                    font-size: 16px;
                    color: #1f2937;
                    resize: vertical;
                    box-sizing: border-box;
                    word-wrap: break-word;
                }

                .edit-textarea:focus {
                    outline: none;
                    border-color: #7C3AED;
                }

                .edit-hashtags-section {
                    margin-bottom: 20px;
                    width: 100%;
                }

                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    flex-wrap: wrap;
                }

                .cancel-button {
                    padding: 10px 20px;
                    background: #f3f4f6;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    color: #4b5563;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    flex-shrink: 0;
                }

                .update-button {
                    padding: 10px 20px;
                    background: linear-gradient(135deg, #7C3AED, #3B82F6);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    opacity: 1;
                    font-size: 14px;
                    font-weight: 500;
                    flex-shrink: 0;
                }

                .update-button.disabled {
                    background: #e5e7eb;
                    cursor: not-allowed;
                    opacity: 0.5;
                }

                /* Posts section */
                .posts-section {
                    width: 100%;
                }

                .posts-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .posts-title {
                    font-size: 20px;
                    font-weight: 600;
                    color: #1f2937;
                    margin: 0;
                    word-wrap: break-word;
                }

                .refresh-button {
                    padding: 8px 16px;
                    background: #f3f4f6;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    color: #4b5563;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;
                }

                .refresh-icon {
                    width: 16px;
                    height: 16px;
                }

                /* Loading states */
                .loading-container {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%);
                }

                .spinner {
                    width: 48px;
                    height: 48px;
                    color: #7C3AED;
                    animation: spin 1s linear infinite;
                }

                .spinner-small {
                    width: 24px;
                    height: 24px;
                    color: #7C3AED;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 8px;
                }

                .loading-posts {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 60px 20px;
                    background: #ffffff;
                    border-radius: 16px;
                    border: 1px solid #e5e7eb;
                    width: 100%;
                }

                .loading-text {
                    color: #6b7280;
                    font-weight: 500;
                    margin-top: 16px;
                }

                .error-state, .empty-state {
                    text-align: center;
                    padding: 60px 20px;
                    color: #6b7280;
                    font-size: 16px;
                    background: #ffffff;
                    border-radius: 16px;
                    border: 1px solid #e5e7eb;
                    position: relative;
                    overflow: hidden;
                    width: 100%;
                }

                .error-content, .empty-content {
                    position: relative;
                    z-index: 1;
                }

                .error-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #ef4444;
                    margin-bottom: 8px;
                }

                .empty-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #4b5563;
                    margin-bottom: 8px;
                }

                .empty-hint {
                    font-size: 14px;
                    color: #9ca3af;
                    margin-top: 8px;
                }

                .retry-button {
                    margin-top: 16px;
                    padding: 10px 20px;
                    background: linear-gradient(135deg, #7C3AED, #3B82F6);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                }

                /* Posts grid */
                .posts-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    width: 100%;
                }

                .post-card {
                    background: #ffffff;
                    border-radius: 24px;
                    padding: 24px;
                    box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.05);
                    border: 1px solid rgba(0, 0, 0, 0.02);
                    position: relative;
                    width: 100%;
                    overflow: hidden;
                    animation: fadeIn 0.4s ease-out;
                    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                }

                .post-card:hover {
                    box-shadow: 0 20px 48px -12px rgba(0, 0, 0, 0.08);
                    transform: translateY(-2px);
                }

                .post-content-wrapper {
                    position: relative;
                }

                .post-content-wrapper:not(.expanded) .post-content {
                    display: -webkit-box;
                    -webkit-line-clamp: 9;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .read-more-button {
                    background: none;
                    border: none;
                    color: #7C3AED;
                    font-weight: 600;
                    font-size: 14px;
                    cursor: pointer;
                    padding: 4px 0;
                    margin-bottom: 16px;
                }
                
                .read-more-button:hover {
                    text-decoration: underline;
                }

                .post-actions-menu {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    display: flex;
                    gap: 8px;
                    z-index: 1;
                }

                .edit-post-button {
                    background: #f0f9ff;
                    color: #0369a1;
                    border: 1px solid #bae6fd;
                    border-radius: 8px;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 14px;
                    flex-shrink: 0;
                }

                .delete-post-button {
                    background: #fee2e2;
                    color: #ef4444;
                    border: 1px solid #fecaca;
                    border-radius: 8px;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justifyContent: center;
                    cursor: pointer;
                    font-size: 14px;
                    flex-shrink: 0;
                }

                .action-icon-small {
                    width: 16px;
                    height: 16px;
                }

                .post-header {
                    display: flex;
                    align-items: flex-start;
                    gap: 16px;
                    margin-bottom: 16px;
                }

                .post-avatar {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    overflow: hidden;
                    border: 1px solid #e5e7eb;
                    flex-shrink: 0;
                }

                .post-author-avatar {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .post-author-info {
                    flex: 1;
                    margin-right: 80px;
                    min-width: 0;
                }

                .author-details {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 6px;
                    flex-wrap: wrap;
                }

                .author-name {
                    font-size: 16px;
                    font-weight: 600;
                    color: #1f2937;
                    margin: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    max-width: 200px;
                }

                .private-icon {
                    width: 14px;
                    height: 14px;
                    color: #9ca3af;
                    flex-shrink: 0;
                }

                .post-date {
                    font-size: 14px;
                    color: #9ca3af;
                    flex-shrink: 0;
                }

                .post-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    margin-top: 8px;
                }

                .post-tag {
                    font-size: 12px;
                    padding: 4px 8px;
                    background: #f3f4f6;
                    color: #4b5563;
                    border-radius: 16px;
                    font-weight: 500;
                    word-break: break-word;
                }

                .post-content {
                    font-size: 16px;
                    color: #1f2937;
                    line-height: 1.6;
                    margin-bottom: 20px;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }

                .post-image-container {
                    margin-bottom: 20px;
                    border-radius: 12px;
                    overflow: hidden;
                }

                .post-image {
                    width: 100%;
                    max-height: 400px;
                    object-fit: cover;
                    border-radius: 12px;
                }

                /* Post interactions */
                .post-interactions {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 0;
                    border-top: 1px solid #e5e7eb;
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .interaction-buttons {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    flex-wrap: wrap;
                }

                .like-button, .comment-button {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 8px 12px;
                    border-radius: 10px;
                    transition: background 0.2s;
                }

                .like-button:hover, .comment-button:hover {
                    background: #f9fafb;
                }

                .heart-icon {
                    width: 20px;
                    height: 20px;
                    color: #9ca3af;
                }

                .heart-icon.liked {
                    color: #ef4444;
                    fill: #ef4444;
                }

                .comment-icon {
                    width: 20px;
                    height: 20px;
                    color: #9ca3af;
                }

                .interaction-count {
                    font-size: 14px;
                    font-weight: 600;
                    color: #1f2937;
                }

                .save-button {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 10px;
                    transition: background 0.2s;
                }

                .save-button:hover {
                    background: #f9fafb;
                }

                .bookmark-icon {
                    width: 20px;
                    height: 20px;
                    color: #9ca3af;
                }

                .bookmark-icon.saved {
                    color: #7C3AED;
                    fill: #7C3AED;
                }

                /* Comments section */
                .comments-section {
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid rgba(0,0,0,0.06);
                }

                .comments-list {
                    margin-bottom: 20px;
                }

                .comments-container {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .comment-item {
                    display: flex;
                    gap: 12px;
                    animation: fadeIn 0.3s ease-out;
                }

                .comment-avatar-wrapper {
                    flex-shrink: 0;
                }

                .comment-avatar {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    border: 1.5px solid #fff;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    object-fit: cover;
                }

                .comment-content {
                    flex: 1;
                    min-width: 0;
                }

                .comment-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 4px;
                }

                .comment-author-name {
                    font-size: 14px;
                    font-weight: 700;
                    color: #1f2937;
                }

                .comment-time {
                    font-size: 11px;
                    color: #9ca3af;
                    font-weight: 500;
                }

                .comment-text-body {
                    font-size: 14px;
                    line-height: 1.5;
                    color: #4b5563;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }

                .comment-actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 6px;
                }

                .comment-action-btn {
                    font-size: 12px;
                    font-weight: 600;
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0;
                    transition: all 0.2s;
                }

                .comment-action-btn.edit {
                    color: #3b82f6;
                }

                .comment-action-btn.delete {
                    color: #ef4444;
                }

                .comment-action-btn:hover {
                    text-decoration: underline;
                    opacity: 0.8;
                }

                /* Comment Form */
                .comment-form {
                    margin-top: 16px;
                }

                .comment-input-wrapper {
                    display: flex;
                    align-items: flex-end;
                    gap: 12px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 20px;
                    padding: 8px 12px;
                    transition: all 0.3s ease;
                }

                .comment-input-wrapper:focus-within {
                    border-color: #3b82f6;
                    background: #fff;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }

                .comment-textarea {
                    flex: 1;
                    border: none;
                    background: transparent;
                    resize: none;
                    font-family: inherit;
                    font-size: 14px;
                    padding: 6px 4px;
                    max-height: 120px;
                    color: #1f2937;
                    outline: none;
                    line-height: 1.5;
                }

                .comment-send-button {
                    background: #3b82f6;
                    color: white;
                    border: none;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    flex-shrink: 0;
                    margin-bottom: 2px;
                }

                .comment-send-button:hover:not(:disabled) {
                    background: #2563eb;
                    transform: scale(1.05);
                }

                .comment-send-button:disabled {
                    background: #cbd5e1;
                    cursor: not-allowed;
                }

                .no-comments {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    padding: 32px 0;
                    color: #94a3b8;
                    text-align: center;
                }

                .no-comments-icon {
                    width: 32px;
                    height: 32px;
                    opacity: 0.5;
                }

                .loading-more {
                    text-align: center;
                    padding: 32px;
                    color: #6b7280;
                    width: 100%;
                }



                /* Responsive design */
                @media (max-width: 768px) {
                    .main-container {
                        padding: 0 16px;
                    }

                    .page-header {
                        padding: 40px 0 30px 0;
                    }

                    .gradient-title {
                        font-size: 32px;
                    }

                    .create-post-card {
                        padding: 24px;
                    }

                    .post-textarea {
                        font-size: 16px;
                    }

                    .post-card {
                        padding: 16px;
                    }

                    .post-content {
                        font-size: 15px;
                    }

                    .author-details {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 4px;
                    }

                    .author-name {
                        max-width: 100%;
                    }

                    .comment-form {
                        flex-direction: column;
                        gap: 12px;
                    }

                    .comment-input {
                        min-width: 100%;
                    }
                }

                @media (max-width: 480px) {
                    .main-container {
                        padding: 0 12px;
                    }

                    .page-header {
                        padding: 30px 0 20px 0;
                    }

                    .header-top {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 16px;
                    }

                    .gradient-title {
                        font-size: 28px;
                    }

                    .description-box {
                        padding: 20px;
                    }

                    .description-text {
                        font-size: 16px;
                    }

                    .create-post-card {
                        padding: 20px;
                    }

                    .form-title {
                        font-size: 18px;
                    }

                    .post-input-section {
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .avatar-container {
                        margin-bottom: 12px;
                    }

                    .post-actions {
                        flex-direction: column;
                        align-items: stretch;
                    }

                    .action-buttons {
                        width: 100%;
                        justify-content: space-between;
                    }

                    .submit-button {
                        width: 100%;
                        justify-content: center;
                    }

                    .hashtag-input-group {
                        flex-direction: column;
                    }

                    .hashtag-input {
                        min-width: 100%;
                    }

                    .add-hashtag-button {
                        width: 100%;
                        justify-content: center;
                    }

                    .posts-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 12px;
                    }

                    .refresh-button {
                        align-self: flex-start;
                    }
                }
                @keyframes popIn {
                    0% { opacity: 0; transform: scale(0.5) translateY(40px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
                .post-thumbnail-pop:hover {
                    z-index: 20;
                }
            `}</style>
        </div>
    );
}