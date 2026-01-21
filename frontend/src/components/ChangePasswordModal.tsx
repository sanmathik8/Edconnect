import React, { useState } from 'react';
import { Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    username: string;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, username }) => {
    const [step, setStep] = useState(1); // 1: Verify Clue, 2: New Password
    const [clue, setClue] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const validatePassword = (pass: string) => {
        return {
            minLength: pass.length >= 8,
            hasUpperCase: /[A-Z]/.test(pass),
            hasLowerCase: /[a-z]/.test(pass),
            hasNumber: /[0-9]/.test(pass),
            hasSpecial: /[^a-zA-Z0-9]/.test(pass),
        };
    };

    const requirements = validatePassword(newPassword);
    const isPasswordValid = Object.values(requirements).every(Boolean);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (!isPasswordValid) {
            setError('Password does not meet requirements');
            return;
        }

        setLoading(true);
        try {
            const response = await apiClient.resetPasswordWithClue({
                username: username,
                clue: clue,
                new_password: newPassword
            });

            if (response.ok) {
                alert('Password changed successfully');
                onClose();
                setClue('');
                setNewPassword('');
                setConfirmPassword('');
                setStep(1);
            } else {
                setError(response.error || 'Failed to change password. check clue');
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
        }} onClick={onClose}>
            <div style={{
                background: 'white', padding: '2rem', borderRadius: '1rem', width: '100%', maxWidth: '440px',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
            }} onClick={e => e.stopPropagation()}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '1.5rem', color: '#111827' }}>Change Password</h2>

                {error && (
                    <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem' }}>
                            Security Clue Answer
                        </label>
                        <input
                            type="text"
                            value={clue}
                            onChange={(e) => setClue(e.target.value)}
                            placeholder="Your secret answer"
                            required
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                        />
                        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>Verify it's you by entering your clue.</p>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem' }}>
                            New Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="New secure password"
                                required
                                style={{ width: '100%', padding: '0.75rem', paddingRight: '2.5rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>

                        {/* Password Requirements Checklist */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', background: requirements.minLength ? '#dcfce7' : '#f3f4f6', color: requirements.minLength ? '#166534' : '#6b7280' }}>8+ chars</span>
                            <span style={{ fontSize: '0.75rem', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', background: requirements.hasUpperCase ? '#dcfce7' : '#f3f4f6', color: requirements.hasUpperCase ? '#166534' : '#6b7280' }}>A-Z</span>
                            <span style={{ fontSize: '0.75rem', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', background: requirements.hasLowerCase ? '#dcfce7' : '#f3f4f6', color: requirements.hasLowerCase ? '#166534' : '#6b7280' }}>a-z</span>
                            <span style={{ fontSize: '0.75rem', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', background: requirements.hasNumber ? '#dcfce7' : '#f3f4f6', color: requirements.hasNumber ? '#166534' : '#6b7280' }}>0-9</span>
                            <span style={{ fontSize: '0.75rem', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', background: requirements.hasSpecial ? '#dcfce7' : '#f3f4f6', color: requirements.hasSpecial ? '#166534' : '#6b7280' }}>!@#</span>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem' }}>
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repeat password"
                            required
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', background: 'white', color: '#374151', cursor: 'pointer', fontWeight: '600' }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !isPasswordValid || !clue}
                            style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: (loading || !isPasswordValid) ? 0.7 : 1 }}
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <>Update <ShieldCheck size={20} /></>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
