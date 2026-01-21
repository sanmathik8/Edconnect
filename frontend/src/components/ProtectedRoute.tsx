'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';

interface ProtectedRouteProps {
    children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { user, loading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    const isAuthPage = pathname?.startsWith('/auth');

    useEffect(() => {
        if (!loading && !user && !isAuthPage && pathname !== '/') {
            router.push('/auth/login');
        }
    }, [loading, user, isAuthPage, pathname, router]);

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-amber-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-amber-800 font-medium">Loading session...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
