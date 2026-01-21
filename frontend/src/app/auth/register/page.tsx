'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, User, Loader2, XCircle, UserPlus, ArrowRight } from 'lucide-react';
import { apiClient } from '@/lib/api';

function RegisterContent() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        username: '',
        password1: '',
        password2: '',
        clue: ''
    });
    const [showPassword1, setShowPassword1] = useState(false);
    const [showPassword2, setShowPassword2] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<any>({});
    const [showPasswordHints, setShowPasswordHints] = useState(false);

    const passwordRequirements = {
        minLength: formData.password1.length >= 8,
        hasUpperCase: /[A-Z]/.test(formData.password1),
        hasLowerCase: /[a-z]/.test(formData.password1),
        hasNumber: /[0-9]/.test(formData.password1),
        hasSpecial: /[^a-zA-Z0-9]/.test(formData.password1),
    };

    const allRequirementsMet = Object.values(passwordRequirements).every(Boolean);

    const passwordStrength = (password: string) => {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
        if (password.match(/[0-9]/)) strength++;
        if (password.match(/[^a-zA-Z0-9]/)) strength++;
        return strength;
    };

    const getStrengthColor = (strength: number) => {
        if (strength <= 1) return '#e2725b'; // Terra Cotta
        if (strength === 2) return '#e9a96e'; // Sandy Brown
        if (strength === 3) return '#8da399'; // Sage Green
        return '#4a5d4e'; // Deep Forest
    };

    const getStrengthText = (strength: number) => {
        if (strength <= 1) return 'Weak';
        if (strength === 2) return 'Fair';
        if (strength === 3) return 'Good';
        return 'Strong';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setFieldErrors({});

        if (formData.password1 !== formData.password2) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        if (!formData.clue.trim()) {
            setError('Security clue is mandatory for password recovery');
            setLoading(false);
            return;
        }

        try {
            const response = await apiClient.register({
                username: formData.username,
                password1: formData.password1,
                password2: formData.password2,
                clue: formData.clue
            });

            if (response.ok) {
                // Short delay to show success state on button before redirecting
                setLoading(false);
                setError('');
                // We'll use the 'registration-success' class for a green button
                const btn = document.querySelector('.submit-btn') as HTMLButtonElement;
                if (btn) {
                    btn.classList.add('success');
                    btn.innerHTML = 'Success! Redirecting...';
                    btn.style.background = '#16a34a'; // Green
                }

                setTimeout(() => {
                    router.push('/auth/login?registered=true');
                }, 800);
            } else {
                // Handle form errors with user-friendly messages
                if (response.form_errors) {
                    const errors = response.form_errors;
                    const friendlyErrors: any = {};

                    // Convert technical errors to friendly messages
                    Object.keys(errors).forEach(field => {
                        const errorMessages = errors[field];
                        if (errorMessages && errorMessages.length > 0) {
                            const originalError = errorMessages[0].toLowerCase();

                            // Password similarity error
                            if (originalError.includes('too similar')) {
                                friendlyErrors[field] = ['Try a password that\'s different from your username'];
                            }
                            // Password too short
                            else if (originalError.includes('at least') || originalError.includes('too short')) {
                                friendlyErrors[field] = ['Password must be at least 8 characters long'];
                            }
                            // Password too common
                            else if (originalError.includes('common')) {
                                friendlyErrors[field] = ['This password is too common. Try something more unique!'];
                            }
                            // Numeric password
                            else if (originalError.includes('numeric') || originalError.includes('entirely')) {
                                friendlyErrors[field] = ['Password can\'t be entirely numbers. Mix in some letters!'];
                            }
                            // Username already exists
                            else if (originalError.includes('already exists') || originalError.includes('taken')) {
                                friendlyErrors[field] = ['This username is already taken. Try another one!'];
                            }
                            // Default: show original error
                            else {
                                friendlyErrors[field] = errorMessages;
                            }
                        }
                    });

                    setFieldErrors(friendlyErrors);
                    setError('Please fix the errors below');
                } else {
                    setError(response.error || 'Registration failed. Please check your details.');
                }
            }
        } catch (err: any) {
            console.error('Registration error:', err);
            // Don't show technical network errors to user unless necessary
            setError('We couldn\'t create your account. Please check your internet connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
        setFieldErrors({});
    };

    // Prevent copy/paste on password fields
    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        return false;
    };

    const strength = passwordStrength(formData.password1);

    return (
        <div className="register-page">
            <div className="card">
                <header className="card-header">
                    <div className="icon-box">
                        <UserPlus size={32} color="white" />
                    </div>
                    <h1>Create Account</h1>
                    <p>Password must include <b>uppercase, lowercase, number, and special character</b>.</p>
                </header>

                {error && <div className="alert-error">{error}</div>}

                <form onSubmit={handleSubmit} className="form-stack">
                    <div className="field">
                        <label><User size={14} /> Username</label>
                        <input
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            placeholder="Choose a username"
                            required
                        />
                        {fieldErrors.username && (
                            <span className="field-error"><XCircle size={12} /> {fieldErrors.username[0]}</span>
                        )}
                    </div>

                    <div className="field">
                        <label>
                            <Lock size={14} /> Password
                            <button
                                type="button"
                                className="info-btn"
                                onClick={() => setShowPasswordHints(!showPasswordHints)}
                                title="Show password requirements"
                            >
                                ℹ️
                            </button>
                        </label>

                        {showPasswordHints && (
                            <div className="password-hints">
                                <p className="hints-title">🔒 Password Requirements:</p>
                                <ul>
                                    <li className={passwordRequirements.minLength ? 'met' : ''}>
                                        {passwordRequirements.minLength ? '✓' : '○'} At least 8 characters
                                    </li>
                                    <li className={passwordRequirements.hasUpperCase ? 'met' : ''}>
                                        {passwordRequirements.hasUpperCase ? '✓' : '○'} One uppercase letter (A-Z)
                                    </li>
                                    <li className={passwordRequirements.hasLowerCase ? 'met' : ''}>
                                        {passwordRequirements.hasLowerCase ? '✓' : '○'} One lowercase letter (a-z)
                                    </li>
                                    <li className={passwordRequirements.hasNumber ? 'met' : ''}>
                                        {passwordRequirements.hasNumber ? '✓' : '○'} One number (0-9)
                                    </li>
                                    <li className={passwordRequirements.hasSpecial ? 'met' : ''}>
                                        {passwordRequirements.hasSpecial ? '✓' : '○'} One special character (!@#$%^&*)
                                    </li>
                                </ul>
                                <p className="security-note">⚠️ Copy/paste is disabled for security</p>
                            </div>
                        )}

                        <div className="input-with-icon">
                            <input
                                type={showPassword1 ? 'text' : 'password'}
                                name="password1"
                                value={formData.password1}
                                onChange={handleChange}
                                onPaste={handlePaste}
                                onCopy={handlePaste}
                                placeholder="Min. 8 chars (A, a, 1, #)"
                                required
                            />
                            <button type="button" onClick={() => setShowPassword1(!showPassword1)}>
                                {showPassword1 ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        <p className="password-instruction">Password must be at least 8 characters long and include: <b>Uppercase (A-Z), Lowercase (a-z), Number (0-9), and a Special Character (@$!%*?&).</b></p>
                        {formData.password1 && (
                            <div className="strength-meter">
                                <div className="bars">
                                    {[1, 2, 3, 4].map(l => (
                                        <div key={l} style={{
                                            backgroundColor: l <= strength ? getStrengthColor(strength) : '#e5e7eb'
                                        }} className="bar"></div>
                                    ))}
                                </div>
                                <span style={{ color: getStrengthColor(strength) }}>{getStrengthText(strength)}</span>
                            </div>
                        )}
                    </div>

                    <div className="field">
                        <label><Lock size={14} /> Confirm Password</label>
                        <div className="input-with-icon">
                            <input
                                type={showPassword2 ? 'text' : 'password'}
                                name="password2"
                                value={formData.password2}
                                onChange={handleChange}
                                onPaste={handlePaste}
                                onCopy={handlePaste}
                                placeholder="Repeat your password"
                                required
                            />
                            <button type="button" onClick={() => setShowPassword2(!showPassword2)}>
                                {showPassword2 ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {fieldErrors.password2 && (
                            <span className="field-error"><XCircle size={12} /> {fieldErrors.password2[0]}</span>
                        )}
                        {fieldErrors.password1 && (
                            <span className="field-error"><XCircle size={12} /> {fieldErrors.password1[0]}</span>
                        )}
                    </div>

                    <div className="field">
                        <label>🤔 Security Clue (Mandatory)</label>
                        <input
                            type="text"
                            name="clue"
                            value={formData.clue}
                            onChange={handleChange}
                            placeholder="e.g. My first pet's name"
                            required
                        />
                        <p className="clue-hint">This will be used to reset your password if you forget it. Keep it memorable but hard to guess!</p>
                        {fieldErrors.clue && (
                            <span className="field-error"><XCircle size={12} /> {fieldErrors.clue[0]}</span>
                        )}
                    </div>

                    <button type="submit" className="submit-btn" disabled={loading || formData.password1 !== formData.password2}>
                        {loading ? <Loader2 className="spin" /> : <>Get Started <ArrowRight size={18} /></>}
                    </button>
                </form>

                <div className="separator"><span>or</span></div>

                <p className="footer-link">
                    Already have an account? <Link href="/auth/login">Sign in instead</Link>
                </p>

            </div>

            <style jsx>{`
                .register-page {
                    min-height: 100vh;
                    background: linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%);
                    display: flex;
                    color: black;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    position: relative;
                    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
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
                }

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
                    padding: 12px; border-radius: 12px; margin-bottom: 20px; font-size: 13px; font-weight: 600;
                }

                .form-stack { display: flex; flex-direction: column; gap: 16px; }
                .field { display: flex; flex-direction: column; gap: 5px; }
                .field label { font-size: 11px; font-weight: 700; color: #4338ca; text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
                
                input {
                    padding: 11px 16px; border-radius: 12px; border: 2px solid #e2e8f0;
                    background: rgba(255, 255, 255, 0.8); font-size: 15px; transition: 0.2s;
                    color: #1a1a1a;
                }
                input:focus { outline: none; border-color: #7c3aed; background: white; box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.1); }

                .input-with-icon { position: relative; }
                .input-with-icon input { width: 100%; box-sizing: border-box; }
                .input-with-icon button { 
                    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
                    background: none; border: none; color: #7c3aed; cursor: pointer; 
                }

                .strength-meter { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
                .bars { display: flex; gap: 4px; height: 4px; }
                .bar { flex: 1; border-radius: 10px; transition: 0.4s; }
                .strength-meter span { font-size: 10px; font-weight: 800; text-align: right; text-transform: uppercase; }

                .password-instruction { font-size: 10px; color: #64748b; margin-top: 4px; line-height: 1.4; border-left: 2px solid #7c3aed; padding-left: 8px; }
                .clue-hint { font-size: 11px; color: #64748b; font-style: italic; margin-top: 2px; }
                .field-error { color: #dc2626; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px; margin-top: 4px; }

                .info-btn {
                    background: none; border: none; cursor: pointer; margin-left: 8px;
                    font-size: 14px; opacity: 0.7; transition: 0.2s;
                }
                .info-btn:hover { opacity: 1; transform: scale(1.1); }

                .password-hints {
                    background: #f8fafc;
                    border: 2px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 12px;
                    margin-bottom: 8px;
                }
                .hints-title {
                    font-size: 12px;
                    font-weight: 700;
                    color: #1e293b;
                    margin: 0 0 6px 0;
                }
                .password-hints ul {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                .password-hints li {
                    font-size: 11px;
                    color: #64748b;
                    padding: 3px 0;
                }
                .password-hints li.met {
                    color: #16a34a;
                    font-weight: 600;
                }

                .submit-btn {
                    margin-top: 8px; padding: 14px; border-radius: 12px; border: none;
                    background: linear-gradient(to right, #7c3aed, #4f46e5);
                    color: white; font-weight: 700; font-size: 16px; cursor: pointer;
                    display: flex; align-items: center; justify-content: center; gap: 10px;
                    transition: 0.2s;
                }
                .submit-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 20px rgba(124, 58, 237, 0.2); }
                .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
                .submit-btn.success { 
                    background: #16a34a !important; 
                    transform: scale(1.05);
                    box-shadow: 0 10px 20px rgba(22, 163, 74, 0.3);
                }

                .separator { text-align: center; position: relative; margin: 12px 0; }
                .separator::before { content: ""; position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: #e2e8f0; }
                .separator span { position: relative; background: #fdfdfd; padding: 0 15px; color: #94a3b8; font-size: 12px; }

                .footer-link { text-align: center; color: #64748b; font-size: 14px; }
                .footer-link a { color: #7c3aed; font-weight: 700; text-decoration: none; }


                .spin { animation: rotate 1s linear infinite; }
                @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                @media (max-width: 480px) {
                    .card { padding: 24px; border-radius: 20px; }
                    .card-header h1 { font-size: 22px; }
                }
            `}</style>
        </div >
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <RegisterContent />
        </Suspense>
    );
}