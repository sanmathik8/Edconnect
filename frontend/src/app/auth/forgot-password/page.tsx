'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    KeyRound,
    User,
    HelpCircle,
    Lock,
    Eye,
    EyeOff,
    Loader2,
    ArrowLeft,
    CheckCircle2,
    ShieldCheck,
    AlertCircle
} from 'lucide-react';
import { apiClient } from '@/lib/api';

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [step, setStep] = useState(1); // 1: Identify & Clue, 2: Success
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const [formData, setFormData] = useState({
        username: '',
        clue: '',
        new_password: '',
        confirm_password: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError(null);
    };

    const validatePassword = (pass: string) => {
        const requirements = {
            minLength: pass.length >= 8,
            hasUpperCase: /[A-Z]/.test(pass),
            hasLowerCase: /[a-z]/.test(pass),
            hasNumber: /[0-9]/.test(pass),
            hasSpecial: /[^a-zA-Z0-9]/.test(pass),
        };
        return requirements;
    };

    const requirements = validatePassword(formData.new_password);
    const isPasswordValid = Object.values(requirements).every(Boolean);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.new_password !== formData.confirm_password) {
            setError('Passwords do not match');
            return;
        }

        if (!isPasswordValid) {
            setError('Password does not meet requirements');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await apiClient.resetPasswordWithClue({
                username: formData.username,
                clue: formData.clue,
                new_password: formData.new_password
            });

            if (response.ok) {
                setStep(2);
            } else {
                setError(response.error || 'Reset failed. Please check your username and security clue.');
            }
        } catch (err: any) {
            console.error('Reset error:', err);
            setError('We encountered an error. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="reset-page">
            <div className="bg-bubbles">
                <div className="bubble bubble-1"></div>
                <div className="bubble bubble-2"></div>
                <div className="bubble bubble-3"></div>
            </div>

            <div className="card">
                <Link href="/auth/login" className="back-link" title="Back to Login">
                    <div className="back-icon">
                        <ArrowLeft size={16} />
                    </div>
                </Link>

                {step === 1 ? (
                    <>
                        <header className="card-header">
                            <div className="icon-box">
                                <KeyRound size={32} color="white" />
                            </div>
                            <h1>Reset Password</h1>
                            <p>Mandatory: <b>uppercase, lowercase, number, and special character</b>.</p>
                        </header>

                        {error && (
                            <div className="alert-error">
                                <AlertCircle size={18} />
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="form-stack">
                            <div className="field">
                                <label><User size={14} /> Username</label>
                                <input
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    placeholder="Enter your username"
                                    required
                                />
                            </div>

                            <div className="field">
                                <label><HelpCircle size={14} /> Security Clue</label>
                                <input
                                    type="text"
                                    name="clue"
                                    value={formData.clue}
                                    onChange={handleChange}
                                    placeholder="Your memorized clue"
                                    required
                                    autoComplete="off"
                                />
                                <p className="clue-tag">The memorable answer you set during registration.</p>
                            </div>

                            <div className="field">
                                <label><Lock size={14} /> New Password</label>
                                <div className="input-with-icon">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        name="new_password"
                                        value={formData.new_password}
                                        onChange={handleChange}
                                        placeholder="Min. 8 chars (A, a, 1, #)"
                                        required
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)}>
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                <p className="password-instruction">Password must be at least 8 characters long and include: <b>Uppercase (A-Z), Lowercase (a-z), Number (0-9), and a Special Character (@$!%*?&).</b></p>

                                <div className="password-checker">
                                    <div className={`check-item ${requirements.minLength ? 'valid' : ''}`}>8+ chars</div>
                                    <div className={`check-item ${requirements.hasUpperCase ? 'valid' : ''}`}>A-Z</div>
                                    <div className={`check-item ${requirements.hasLowerCase ? 'valid' : ''}`}>a-z</div>
                                    <div className={`check-item ${requirements.hasNumber ? 'valid' : ''}`}>0-9</div>
                                    <div className={`check-item ${requirements.hasSpecial ? 'valid' : ''}`}>!@#</div>
                                </div>
                            </div>

                            <div className="field">
                                <label><Lock size={14} /> Confirm New Password</label>
                                <input
                                    type="password"
                                    name="confirm_password"
                                    value={formData.confirm_password}
                                    onChange={handleChange}
                                    placeholder="Repeat new password"
                                    required
                                />
                            </div>

                            <button type="submit" className="submit-btn" disabled={loading || !isPasswordValid || !formData.clue}>
                                {loading ? <Loader2 className="spin" /> : <>Reset Password <ShieldCheck size={18} /></>}
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="success-state">
                        <div className="success-icon">
                            <CheckCircle2 size={64} color="#4a5d4e" />
                        </div>
                        <h2>Reset Successful!</h2>
                        <p>Your password has been securely updated. You can now access your account with your new credentials.</p>
                        <button onClick={() => router.push('/auth/login')} className="submit-btn">
                            Sign In Now
                        </button>
                    </div>
                )}

            </div>

            <style jsx>{`
                .reset-page {
                    min-height: 100vh;
                    background: linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    position: relative;
                    font-family: 'Inter', system-ui, sans-serif;
                }

                .card {
                    background: rgba(255, 255, 255, 0.75);
                    backdrop-filter: blur(20px);
                    padding: 32px;
                    border-radius: 28px;
                    width: 100%;
                    max-width: 440px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08);
                    border: 1px solid rgba(255, 255, 255, 0.5);
                    z-index: 10;
                    position: relative;
                }

                .back-link {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    color: #4338ca;
                    background: rgba(255, 255, 255, 0.6);
                    backdrop-filter: blur(10px);
                    border-radius: 12px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    margin-bottom: 24px;
                    border: 1px solid rgba(255, 255, 255, 0.5);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                    width: 40px;
                    height: 40px;
                }

                .back-icon {
                    background: white;
                    color: #7c3aed;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 10px;
                    box-shadow: 0 2px 4px rgba(124, 58, 237, 0.1);
                    transition: all 0.3s;
                }

                .back-link:hover {
                    background: white;
                    transform: translateX(-4px);
                    box-shadow: 0 10px 15px -3px rgba(124, 58, 237, 0.15);
                    color: #7c3aed;
                }

                .back-link:hover .back-icon {
                    background: #7c3aed;
                    color: white;
                    transform: scale(1.1);
                    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
                }

                .back-link:hover { color: #7c3aed; }

                .card-header { text-align: center; margin-bottom: 24px; }
                .icon-box { 
                    background: linear-gradient(135deg, #7c3aed, #4f46e5); 
                    width: 56px; height: 56px; margin: 0 auto 15px;
                    display: flex; align-items: center; justify-content: center;
                    border-radius: 16px; box-shadow: 0 8px 16px rgba(124, 58, 237, 0.2);
                }

                .card-header h1 { color: #1e1b4b; margin: 0; font-size: 24px; font-weight: 800; }
                .card-header p { color: #4338ca; font-size: 14px; margin-top: 5px; opacity: 0.8; }

                .alert-error { 
                    background: #fef2f2; border: 1px solid #fee2e2; color: #b91c1c;
                    padding: 12px 16px; border-radius: 12px; margin-bottom: 24px; 
                    font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 10px;
                }

                .form-stack { display: flex; flex-direction: column; gap: 16px; }
                .field { display: flex; flex-direction: column; gap: 5px; }
                .field label { font-size: 11px; font-weight: 700; color: #4338ca; text-transform: uppercase; display: flex; align-items: center; gap: 6px; }

                input {
                    padding: 11px 18px; border-radius: 12px; border: 2px solid #e2e8f0;
                    background: rgba(255, 255, 255, 0.8); font-size: 15px; transition: 0.2s;
                    color: #1a1a1a;
                }

                input:focus { outline: none; border-color: #7c3aed; background: white; box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.1); }

                .password-instruction { font-size: 10px; color: #64748b; margin-top: 4px; line-height: 1.4; border-left: 2px solid #7c3aed; padding-left: 8px; }
                .clue-tag { font-size: 11px; color: #64748b; font-style: italic; }

                .input-with-icon { position: relative; }
                .input-with-icon input { width: 100%; padding-right: 50px; }
                .input-with-icon button { 
                    position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
                    background: none; border: none; color: #7c3aed; cursor: pointer; display: flex;
                }

                .password-checker {
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    gap: 4px;
                    margin-top: 4px;
                }

                .check-item {
                    font-size: 9px;
                    padding: 3px;
                    background: #f1f5f9;
                    border-radius: 4px;
                    text-align: center;
                    font-weight: 700;
                    color: #94a3b8;
                    transition: 0.3s;
                }

                .check-item.valid {
                    background: #22c55e;
                    color: white;
                }

                .submit-btn {
                    margin-top: 8px; padding: 14px; border-radius: 12px; border: none;
                    background: linear-gradient(to right, #7c3aed, #4f46e5);
                    color: white; font-weight: 700; font-size: 16px; cursor: pointer;
                    display: flex; align-items: center; justify-content: center; gap: 10px;
                    transition: 0.3s;
                }

                .submit-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 20px rgba(124, 58, 237, 0.2); }
                .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }

                .success-state { text-align: center; padding: 10px 0; }
                .success-icon { margin-bottom: 20px; animation: scaleUp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
                .success-state h2 { color: #1e1b4b; font-size: 24px; font-weight: 800; margin-bottom: 12px; }
                .success-state p { color: #64748b; font-size: 15px; margin-bottom: 30px; line-height: 1.6; }


                .spin { animation: rotate 1s linear infinite; }
                @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes scaleUp { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }

                @media (max-width: 480px) {
                    .card { padding: 24px; border-radius: 20px; }
                    .card-header h1 { font-size: 22px; }
                }
            `}</style>
        </div>
    );
}
