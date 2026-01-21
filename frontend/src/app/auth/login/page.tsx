'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Lock, User, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { login } = useAuth();

    const [formData, setFormData] = useState({ username: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (searchParams.get('registered') === 'true') {
            setSuccess('Registration successful! Please sign in to continue.');

            // Auto-hide the success message after 5 seconds
            const timer = setTimeout(() => {
                setSuccess('');
                // Optionally remove the query param from the URL
                const url = new URL(window.location.href);
                url.searchParams.delete('registered');
                window.history.replaceState({}, '', url.pathname + url.search);
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrors([]);
        setFieldErrors({});
        setSuccess('');

        try {
            const response = await login(formData.username, formData.password);

            console.log('Login response:', response); // Debug log

            // Check if login was successful
            // Your API returns { ok: true, user: {...}, redirect: '...' } on success
            // or { ok: false, error: '...', form_errors: {...} } on failure
            if (response && (response as any).ok === true) {
                const nextParam = searchParams.get('next');
                const redirectUrl = nextParam || (response as any).redirect || '/feed';
                router.push(redirectUrl);
                router.refresh();
                return;
            }

            // If ok is false or undefined, handle the error
            if ((response as any).ok === false) {
                handleLoginError(response);
            } else {
                // Handle unexpected response format
                handleLoginError({ error: 'Unexpected response from server' });
            }

        } catch (err: any) {
            // Handle thrown errors (shouldn't happen based on your API client, but just in case)
            console.error('Caught error:', err);
            handleLoginError(err);
        } finally {
            setLoading(false);
        }
    };

    const handleLoginError = (err: any) => {
        console.log('=== Error Handler Debug ===');
        console.log('Error object:', err);
        console.log('Error type:', typeof err);
        console.log('Has form_errors:', !!err.form_errors);
        console.log('Has error:', !!err.error);
        console.log('Has detail:', !!err.detail);
        console.log('Has status:', !!err.status);
        console.log('==========================');

        const errorMessages: string[] = [];
        const formErrors: Record<string, string[]> = {};

        // ============ CASE 1: Django form_errors (most detailed) ============
        if (err.form_errors) {
            // Handle __all__ errors (general form errors)
            if (err.form_errors.__all__) {
                err.form_errors.__all__.forEach((msg: string) => {
                    // Check for specific error patterns and provide friendly messages
                    const lowerMsg = msg.toLowerCase();

                    if (lowerMsg.includes('correct username and password') ||
                        lowerMsg.includes('case-sensitive')) {
                        errorMessages.push('Invalid username or password. Please check your credentials (both fields are case-sensitive).');
                    } else if (lowerMsg.includes('password') && lowerMsg.includes('match')) {
                        errorMessages.push('Passwords do not match. Please make sure both password fields are identical.');
                    } else {
                        errorMessages.push(msg);
                    }
                });
            }

            // Handle field-specific errors
            Object.keys(err.form_errors).forEach(field => {
                if (field !== '__all__' && Array.isArray(err.form_errors[field])) {
                    formErrors[field] = err.form_errors[field];

                    err.form_errors[field].forEach((msg: string) => {
                        const lowerMsg = msg.toLowerCase();

                        // Username-specific errors
                        if (field === 'username') {
                            if (lowerMsg.includes('does not exist') || lowerMsg.includes('not found')) {
                                errorMessages.push('Username does not exist. Please check your username or sign up for a new account.');
                            } else if (lowerMsg.includes('required')) {
                                errorMessages.push('Username is required.');
                            } else if (lowerMsg.includes('invalid')) {
                                errorMessages.push('Invalid username format.');
                            } else {
                                errorMessages.push(`Username: ${msg}`);
                            }
                        }
                        // Password-specific errors
                        else if (field === 'password' || field === 'password1' || field === 'password2') {
                            if (lowerMsg.includes('incorrect') || lowerMsg.includes('wrong')) {
                                errorMessages.push('Incorrect password. Please try again.');
                            } else if (lowerMsg.includes('required')) {
                                errorMessages.push('Password is required.');
                            } else if (lowerMsg.includes('too short')) {
                                errorMessages.push('Password is too short. Must be at least 8 characters.');
                            } else if (lowerMsg.includes('too common')) {
                                errorMessages.push('Password is too common. Please choose a stronger password.');
                            } else if (lowerMsg.includes('numeric')) {
                                errorMessages.push('Password cannot be entirely numeric.');
                            } else if (lowerMsg.includes('match')) {
                                errorMessages.push('Passwords do not match.');
                            } else {
                                errorMessages.push(`Password: ${msg}`);
                            }
                        }
                        // Other field errors
                        else {
                            errorMessages.push(`${field}: ${msg}`);
                        }
                    });
                }
            });
        }

        // ============ CASE 2: Simple error message ============
        if (err.error && !errorMessages.length) {
            const lowerError = err.error.toLowerCase();

            if (lowerError.includes('invalid username or password') ||
                lowerError.includes('invalid credentials')) {
                errorMessages.push('Invalid username or password. Please check your credentials and try again.');
            } else if (lowerError.includes('username') && lowerError.includes('not') && lowerError.includes('exist')) {
                errorMessages.push('Username does not exist. Please sign up for a new account.');
            } else if (lowerError.includes('password') && lowerError.includes('incorrect')) {
                errorMessages.push('Incorrect password. Please try again.');
            } else if (lowerError.includes('account') && lowerError.includes('disabled')) {
                errorMessages.push('Your account has been disabled. Please contact support.');
            } else if (lowerError.includes('account') && lowerError.includes('locked')) {
                errorMessages.push('Your account has been locked due to multiple failed login attempts. Please try again later.');
            } else {
                errorMessages.push(err.error);
            }
        }

        // ============ CASE 3: Django REST Framework detail field ============
        if (err.detail && !errorMessages.length) {
            const lowerDetail = err.detail.toLowerCase();

            if (lowerDetail === "authentication credentials were not provided.") {
                errorMessages.push('Authentication required. Please enter your username and password.');
            } else if (lowerDetail.includes('no active account') ||
                lowerDetail.includes('unable to log in')) {
                errorMessages.push('Invalid username or password. Please check your credentials.');
            } else if (lowerDetail.includes('not found')) {
                errorMessages.push('User account not found. Please check your username or sign up.');
            } else if (lowerDetail.includes('inactive')) {
                errorMessages.push('Your account is inactive. Please contact support to reactivate.');
            } else if (lowerDetail.includes('verification')) {
                errorMessages.push('Please verify your email address before logging in.');
            } else {
                errorMessages.push(err.detail);
            }
        }

        // ============ CASE 4: HTTP Status-based errors ============
        if (!errorMessages.length && err.status) {
            switch (err.status) {
                case 400:
                    errorMessages.push('Invalid request. Please check your username and password.');
                    break;
                case 401:
                    errorMessages.push('Invalid username or password. Please try again.');
                    break;
                case 403:
                    errorMessages.push('Access denied. Your account may be inactive or suspended.');
                    break;
                case 404:
                    errorMessages.push('Login service not found. Please contact support.');
                    break;
                case 429:
                    errorMessages.push('Too many login attempts. Please wait a few minutes and try again.');
                    break;
                case 500:
                    errorMessages.push('Server error. Please try again later or contact support.');
                    break;
                case 502:
                    errorMessages.push('Server is temporarily unavailable. Please try again in a moment.');
                    break;
                case 503:
                    errorMessages.push('Service temporarily unavailable. Please try again later.');
                    break;
                default:
                    errorMessages.push(`Connection error (${err.status}). Please try again.`);
            }
        }

        // ============ CASE 5: Network/Connection errors ============
        if (!errorMessages.length) {
            if (err.name === 'NetworkError' ||
                err.message?.includes('fetch') ||
                err.message?.includes('network') ||
                err.message?.includes('Failed to fetch')) {
                errorMessages.push('Cannot connect to server. Please check your internet connection and try again.');
            }
        }

        // ============ CASE 6: ApiError with code ============
        if (err.code && !errorMessages.length) {
            switch (err.code) {
                case 'AUTH_REQUIRED':
                    errorMessages.push('Authentication required. Please enter your credentials.');
                    break;
                case 'ACCESS_DENIED':
                    errorMessages.push('Access denied. Please check your credentials.');
                    break;
                case 'DATABASE_ERROR':
                    errorMessages.push('Database error occurred. Please contact support.');
                    break;
                case 'DJANGO_HTML_ERROR':
                    errorMessages.push('Server configuration error. Please contact support.');
                    break;
                case 'VALIDATION_ERROR':
                    errorMessages.push('Please check your username and password format.');
                    break;
                case 'NOT_FOUND':
                    errorMessages.push('Login endpoint not found. Please contact support.');
                    break;
                case 'SERVER_ERROR':
                    errorMessages.push('Internal server error. Please try again later.');
                    break;
                case 'TIMEOUT':
                    errorMessages.push('Request timed out. Please check your connection and try again.');
                    break;
                default:
                    errorMessages.push('An error occurred. Please try again.');
            }
        }

        // ============ CASE 7: String error messages ============
        if (!errorMessages.length && typeof err === 'string') {
            const lowerErr = err.toLowerCase();

            if (lowerErr.includes('username') && lowerErr.includes('not') && lowerErr.includes('exist')) {
                errorMessages.push('Username does not exist. Please sign up for a new account.');
            } else if (lowerErr.includes('password') && (lowerErr.includes('incorrect') || lowerErr.includes('wrong'))) {
                errorMessages.push('Incorrect password. Please try again.');
            } else if (lowerErr.includes('invalid')) {
                errorMessages.push('Invalid username or password. Please check your credentials.');
            } else {
                errorMessages.push(err);
            }
        }

        // ============ CASE 8: Unexpected error object ============
        if (!errorMessages.length && err.message) {
            errorMessages.push(err.message);
        }

        // ============ CASE 9: Generic fallback (last resort) ============
        if (!errorMessages.length) {
            errorMessages.push('Login failed. Please check your credentials and try again.');
        }

        // Set errors to state
        setErrors(errorMessages);
        setFieldErrors(formErrors);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });

        // Clear errors when user starts typing
        if (errors.length > 0) setErrors([]);
        if (Object.keys(fieldErrors).length > 0) setFieldErrors({});
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <div className="icon-wrapper">
                        <Sparkles size={32} color="white" />
                    </div>
                    <h1>Welcome Back</h1>
                    <p>Sign in to continue your journey</p>
                </div>

                {/* Display all error messages */}
                {errors.length > 0 && (
                    <div className="alert-container">
                        {errors.map((error, index) => (
                            <div key={index} className="alert alert-error">
                                <AlertCircle size={16} />
                                <span>{error}</span>
                            </div>
                        ))}
                    </div>
                )}

                {success && (
                    <div className="alert alert-success">
                        <span>{success}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="login-form" autoComplete="off">
                    <div className="input-group">
                        <label>
                            <User size={16} /> Username
                        </label>
                        <input
                            type="text"
                            name="username"
                            autoComplete="username"
                            value={formData.username}
                            onChange={handleChange}
                            placeholder="Enter your username"
                            required
                            className={fieldErrors.username ? 'error' : ''}
                        />
                        {fieldErrors.username && (
                            <div className="field-error">
                                {fieldErrors.username.map((err, i) => (
                                    <div key={i}>• {err}</div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="input-group">
                        <label>
                            <Lock size={16} /> Password
                        </label>
                        <div className="password-wrapper">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                autoComplete="current-password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Enter your password"
                                required
                                className={fieldErrors.password ? 'error' : ''}
                            />
                            <button
                                type="button"
                                className="toggle-password"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                            <Link href="/auth/forgot-password" style={{ fontSize: '0.8rem', color: '#92400e', fontWeight: '600', textDecoration: 'none' }}>
                                Forgot Password?
                            </Link>
                        </div>
                        {fieldErrors.password && (
                            <div className="field-error">
                                {fieldErrors.password.map((err, i) => (
                                    <div key={i}>• {err}</div>
                                ))}
                            </div>
                        )}
                    </div>

                    <button type="submit" className="submit-btn" disabled={loading}>
                        {loading ? <Loader2 className="spinner" size={20} /> : 'Sign In'}
                    </button>
                </form>

                <div className="divider">
                    <span>or</span>
                </div>

                <div className="register-link">
                    Don't have an account? <Link href="/auth/register">Create one now</Link>
                </div>

            </div>

            <style jsx>{`
                .login-container {
                    min-height: 100vh;
                    display: flex;
                    color: #1a1a1a;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%);
                    padding: 20px;
                    position: relative;
                    font-family: 'Inter', system-ui, sans-serif;
                }

                .login-card {
                    position: relative;
                    z-index: 10;
                    background: rgba(255, 255, 255, 0.72);
                    backdrop-filter: blur(20px);
                    width: 100%;
                    max-width: 420px;
                    padding: 40px;
                    border-radius: 28px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.5);
                }

                .login-header { text-align: center; margin-bottom: 32px; }
                .icon-wrapper {
                    background: linear-gradient(135deg, #7c3aed, #4f46e5);
                    width: 60px;
                    height: 60px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 16px;
                    margin: 0 auto 20px;
                    box-shadow: 0 10px 15px -3px rgba(124, 58, 237, 0.3);
                }
                .login-header h1 { font-size: 26px; color: #1e1b4b; margin: 0; font-weight: 800; }
                .login-header p { color: #4338ca; opacity: 0.7; margin-top: 8px; font-size: 15px; }

                .alert-container {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 20px;
                }

                .alert { 
                    padding: 12px 16px; 
                    border-radius: 12px; 
                    font-weight: 500; 
                    font-size: 14px;
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    animation: slideIn 0.3s ease-out;
                    line-height: 1.5;
                }
                
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .alert-error { 
                    background: #fee2e2; 
                    color: #991b1b; 
                    border: 1px solid #fecaca; 
                }
                .alert-success { 
                    background: #d1fae5; 
                    color: #065f46; 
                    border: 1px solid #a7f3d0; 
                }

                .login-form { display: flex; flex-direction: column; gap: 20px; }
                .input-group { display: flex; flex-direction: column; gap: 8px; }
                .input-group label { 
                    font-size: 11px; 
                    font-weight: 700; 
                    color: #4338ca; 
                    text-transform: uppercase; 
                    letter-spacing: 0.05em; 
                    display: flex; 
                    align-items: center; 
                    gap: 6px; 
                }
                
                input {
                    padding: 12px 16px;
                    border-radius: 12px;
                    border: 2px solid #e2e8f0;
                    background: rgba(255, 255, 255, 0.8);
                    font-size: 16px;
                    transition: all 0.2s;
                    color: #1a1a1a;
                }
                input:focus { 
                    outline: none; 
                    border-color: #7c3aed; 
                    background: white;
                    box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.1); 
                }
                input.error {
                    border-color: #f87171;
                }
                input.error:focus {
                    box-shadow: 0 0 0 4px #fee2e2;
                }

                .field-error {
                    color: #991b1b;
                    font-size: 13px;
                    margin-top: 4px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .password-wrapper { position: relative; }
                .password-wrapper input { width: 100%; box-sizing: border-box; }
                .toggle-password { 
                    position: absolute; 
                    right: 12px; 
                    top: 50%; 
                    transform: translateY(-50%); 
                    background: none; 
                    border: none; 
                    color: #7c3aed; 
                    cursor: pointer; 
                }

                .submit-btn {
                    margin-top: 10px;
                    background: linear-gradient(to right, #7c3aed, #4f46e5);
                    color: white;
                    padding: 14px;
                    border: none;
                    border-radius: 12px;
                    font-size: 16px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .submit-btn:hover { 
                    transform: translateY(-1px); 
                    box-shadow: 0 10px 15px -3px rgba(124, 58, 237, 0.3); 
                }
                .submit-btn:active { transform: translateY(0); }
                .submit-btn:disabled { 
                    opacity: 0.7; 
                    cursor: not-allowed; 
                    transform: none; 
                }

                .divider { 
                    position: relative; 
                    text-align: center; 
                    margin: 24px 0; 
                }
                .divider::before { 
                    content: ""; 
                    position: absolute; 
                    top: 50%; 
                    left: 0; 
                    right: 0; 
                    height: 1px; 
                    background: #e2e8f0; 
                }
                .divider span { 
                    position: relative; 
                    background: #fbfbfd; 
                    padding: 0 12px; 
                    color: #64748b; 
                    font-size: 13px; 
                    text-transform: uppercase; 
                }

                .register-link { 
                    text-align: center; 
                    color: #64748b; 
                    font-weight: 500; 
                    font-size: 14px;
                }
                .register-link a { 
                    color: #7c3aed; 
                    font-weight: 700; 
                    text-decoration: none; 
                }
                .register-link a:hover { text-decoration: underline; }


                .spinner { animation: rotate 1s linear infinite; }
                @keyframes rotate { 
                    from { transform: rotate(0deg); } 
                    to { transform: rotate(360deg); } 
                }

                @media (max-width: 480px) {
                    .login-card { padding: 32px 24px; border-radius: 20px; }
                    .login-header h1 { font-size: 24px; }
                }
            `}</style>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen w-full items-center justify-center bg-amber-50">
                <Loader2 className="animate-spin text-amber-600" size={40} />
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}