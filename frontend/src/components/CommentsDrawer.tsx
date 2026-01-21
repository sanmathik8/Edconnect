'use client';
import { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, MessageCircle, Trash2, Edit2, AlertCircle, CornerDownRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface Comment {
    id: number;
    content: string;
    created_at: string;
    author: {
        id: number;
        user: { username: string; };
        avatar: string | null;
    };
}

interface CommentsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    comments: Comment[];
    commentsCount: number;
    loading: boolean;
    onAddComment: (text: string) => Promise<void>;
    onEditComment?: (commentId: number, text: string) => Promise<void>;
    onDeleteComment?: (commentId: number) => Promise<void>;
    isSending: boolean;
    isInline?: boolean;
}

export default function CommentsDrawer({
    isOpen, onClose, comments, commentsCount, loading,
    onAddComment, onEditComment, onDeleteComment, isSending, isInline = false
}: CommentsDrawerProps) {
    const [commentText, setCommentText] = useState('');
    const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { user } = useAuth();

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleStartEdit = (comment: Comment) => {
        setEditingCommentId(comment.id);
        setCommentText(comment.content);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const handleCancelEdit = () => {
        setEditingCommentId(null);
        setCommentText('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim()) return;
        if (editingCommentId && onEditComment) {
            await onEditComment(editingCommentId, commentText);
            handleCancelEdit();
        } else {
            await onAddComment(commentText);
            setCommentText('');
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return 'Just now';
        const date = new Date(dateString);
        const diff = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    };

    if (!isOpen) return null;

    const drawerContent = (
        <div style={{
            display: 'flex', flexDirection: 'column', height: '100%',
            backgroundColor: '#ffffff', fontFamily: 'inherit', overflow: 'hidden'
        }}>
            {/* --- HEADER --- */}
            <div style={{
                padding: isMobile ? '20px' : '24px 30px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                color: 'white', position: 'relative'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>Community</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.9, fontSize: '13px', marginTop: '4px' }}>
                            <span style={{ padding: '2px 8px', background: 'rgba(255,255,255,0.2)', borderRadius: '10px' }}>
                                {commentsCount} Thought{commentsCount !== 1 && 's'}
                            </span>
                        </div>
                    </div>
                    {!isInline && (
                        <button onClick={onClose} style={{
                            width: '40px', height: '40px', borderRadius: '12px', border: 'none',
                            background: 'rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)'
                        }}><X size={20} /></button>
                    )}
                </div>
            </div>

            {/* --- COMMENTS LIST --- */}
            <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '24px' }} className="hide-scrollbar">
                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6366f1' }}>
                        <Loader2 className="animate-spin" size={32} />
                    </div>
                ) : comments.length > 0 ? (
                    comments.map((comment, idx) => {
                        const isOwn = user && (String(comment.author.id) === String(user.profile_id) || String(comment.author.id) === String(user.id));
                        const isBeingDeleted = confirmDeleteId === comment.id;

                        return (
                            <div key={comment.id} style={{
                                marginBottom: '20px', animation: `slideUp 0.4s ease-out ${idx * 0.05}s both`,
                                position: 'relative'
                            }}>
                                <div style={{
                                    padding: '16px', borderRadius: '20px', border: '1px solid #f1f5f9',
                                    backgroundColor: isBeingDeleted ? '#fff1f2' : '#ffffff',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    transform: isBeingDeleted ? 'scale(0.98)' : 'scale(1)'
                                }}>
                                    {isBeingDeleted ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'fadeIn 0.2s' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#e11d48' }}>
                                                <AlertCircle size={18} />
                                                <span style={{ fontWeight: 600, fontSize: '14px' }}>Delete this comment?</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={() => setConfirmDeleteId(null)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #fda4af', background: 'white', color: '#e11d48', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                                                <button onClick={() => { onDeleteComment?.(comment.id); setConfirmDeleteId(null); }} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#e11d48', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Delete</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                {comment.author.avatar ? (
                                                    <img src={comment.author.avatar} alt={comment.author.user.username} style={{ width: '42px', height: '42px', borderRadius: '14px', objectFit: 'cover' }} />
                                                ) : (
                                                    <div style={{ width: '42px', height: '42px', borderRadius: '14px', background: 'linear-gradient(45deg, #6366f1, #ec4899)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px' }}>
                                                        {comment.author.user.username[0].toUpperCase()}
                                                    </div>
                                                )}
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                        <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>{comment.author.user.username}</span>
                                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>{formatDate(comment.created_at)}</span>
                                                    </div>
                                                    <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: 0 }}>{comment.content}</p>
                                                </div>
                                            </div>
                                            {isOwn && (
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '12px', borderTop: '1px solid #f8fafc', paddingTop: '10px' }}>
                                                    <button onClick={() => handleStartEdit(comment)} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                                                        <Edit2 size={13} /> Edit
                                                    </button>
                                                    <button onClick={() => setConfirmDeleteId(comment.id)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Trash2 size={13} /> Delete
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                        <MessageCircle size={64} />
                        <p>No conversations yet</p>
                    </div>
                )}
            </div>

            {/* --- INPUT FOOTER --- */}
            <div style={{ padding: '20px', borderTop: '1px solid #f1f5f9', background: '#fff' }}>
                {editingCommentId && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#6366f1', fontSize: '12px', fontWeight: 600, animation: 'fadeIn 0.3s' }}>
                        <CornerDownRight size={14} /> Editing your thought...
                        <span onClick={handleCancelEdit} style={{ marginLeft: 'auto', cursor: 'pointer', textDecoration: 'underline', color: '#94a3b8' }}>Cancel</span>
                    </div>
                )}
                <div style={{ position: 'relative', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                    <textarea
                        ref={inputRef}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Write a comment..."
                        style={{
                            flex: 1, minHeight: '56px', maxHeight: '150px', padding: '15px 20px', borderRadius: '20px',
                            border: '1.5px solid #e2e8f0', background: '#f8fafc', outline: 'none', fontSize: '14px',
                            resize: 'none', transition: 'all 0.2s'
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={!commentText.trim() || isSending}
                        style={{
                            width: '56px', height: '56px', borderRadius: '20px', border: 'none',
                            background: commentText.trim() ? '#6366f1' : '#e2e8f0',
                            color: 'white', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transform: commentText.trim() ? 'scale(1)' : 'scale(0.9)',
                            boxShadow: commentText.trim() ? '0 8px 20px rgba(99, 102, 241, 0.3)' : 'none'
                        }}
                    >
                        {isSending ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 1s linear infinite; }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                textarea:focus { border-color: #6366f1 !important; background: white !important; box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1); }
            `}</style>
        </div>
    );

    if (isInline) return <div style={{ height: '100%', borderRadius: '24px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>{drawerContent}</div>;

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.4s' }} onClick={onClose} />
            <div style={{
                position: 'relative', height: '100%', width: isMobile ? '100%' : '440px',
                background: 'white', boxShadow: '-20px 0 50px rgba(0,0,0,0.1)',
                animation: isMobile ? 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)' : 'slideRight 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                {drawerContent}
            </div>
            <style>{`
                @keyframes slideRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
            `}</style>
        </div>
    );
}