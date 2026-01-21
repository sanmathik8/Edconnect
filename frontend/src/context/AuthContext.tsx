'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, AuthUser } from '@/lib/api';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes

interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    login: (username: string, password: string) => Promise<any>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    updateUser: (newUser: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const logout = async () => {
        try {
            await apiClient.logout();
        } catch (err) {
            console.error('Logout failed', err);
        } finally {
            setUser(null);
            localStorage.removeItem('user');
            router.push('/auth/login');
            router.refresh();
        }
    };

    const updateUser = (newUser: Partial<AuthUser>) => {
        setUser(prev => {
            const updated = prev ? { ...prev, ...newUser } : null;
            if (updated) {
                localStorage.setItem('user', JSON.stringify(updated));
            }
            return updated;
        });
    };

    const refreshUser = async () => {
        try {
            const profile = await apiClient.getCurrentUser();
            if (!profile) {
                setUser(null);
                localStorage.removeItem('user');
                return;
            }
            const authUser: AuthUser = {
                id: profile.user.id,
                username: profile.user.username,
                avatar: profile.avatar || profile.default_avatar_url,
                profile_id: profile.id,
                bio: profile.bio
            };
            setUser(authUser);
            localStorage.setItem('user', JSON.stringify(authUser));
        } catch (err) {
            // Silently fail - user is not authenticated
            setUser(null);
            localStorage.removeItem('user');
        } finally {
            setLoading(false);
        }
    };

    // Helper to check if there's a session cookie
    const hasSessionCookie = () => {
        if (typeof document === 'undefined') return false;
        return document.cookie.split('; ').some(cookie => cookie.startsWith('sessionid='));
    };

    const lastActivityRef = useRef<number>(Date.now());

    useEffect(() => {
        if (!user) return;

        const handleActivity = () => {
            lastActivityRef.current = Date.now();
        };

        const checkInactivity = () => {
            if (Date.now() - lastActivityRef.current > INACTIVITY_TIMEOUT) {
                console.log('Session timed out due to inactivity');
                logout();
            }
        };

        const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
        activityEvents.forEach(event => window.addEventListener(event, handleActivity));

        const intervalId = setInterval(checkInactivity, 60000); // Check every minute

        return () => {
            activityEvents.forEach(event => window.removeEventListener(event, handleActivity));
            clearInterval(intervalId);
        };
    }, [user, logout]);

    useEffect(() => {
        // Initial check
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                localStorage.removeItem('user');
            }
        }

        // Only refresh user if there's evidence of a session
        // This prevents unnecessary 403 errors on the landing page
        if (storedUser || hasSessionCookie()) {
            refreshUser();
        } else {
            // No session detected, just set loading to false
            setLoading(false);
        }
    }, []);

    const login = async (username: string, password: string) => {
        try {
            const response = await apiClient.login(username, password);
            if (response.user) {
                setUser(response.user);
                localStorage.setItem('user', JSON.stringify(response.user));
            } else {
                // Fallback if user object is not in response but response is ok
                await refreshUser();
            }
            return response;
        } catch (err) {
            throw err;
        }
    };


    return (
        <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
