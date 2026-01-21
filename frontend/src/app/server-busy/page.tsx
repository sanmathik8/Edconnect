'use client';

import React from 'react';
import { RefreshCw, ServerOff, WifiOff } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ServerBusyPage() {
    const router = useRouter();

    const handleRetry = () => {
        // Try to go back to home or reload the page
        window.location.href = '/';
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%)',
            padding: '20px',
            fontFamily: "'Inter', sans-serif"
        }}>
            <div style={{
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(12px)',
                padding: '48px',
                borderRadius: '24px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                textAlign: 'center',
                maxWidth: '480px',
                width: '100%',
                border: '1px solid rgba(255, 255, 255, 0.5)'
            }}>
                <div style={{
                    width: '80px',
                    height: '80px',
                    background: '#fee2e2',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px'
                }}>
                    <ServerOff size={40} color="#ef4444" />
                </div>

                <h1 style={{
                    fontSize: '2rem',
                    fontWeight: '800',
                    color: '#1f2937',
                    marginBottom: '16px'
                }}>
                    Server is Busy
                </h1>

                <p style={{
                    color: '#6b7280',
                    fontSize: '1.1rem',
                    marginBottom: '32px',
                    lineHeight: '1.6'
                }}>
                    We are currently experiencing high traffic or maintenance. Please try again in a few moments.
                </p>

                <button
                    onClick={handleRetry}
                    style={{
                        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                        color: 'white',
                        border: 'none',
                        padding: '12px 32px',
                        borderRadius: '12px',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        width: '100%',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
                    }}
                >
                    <RefreshCw size={18} />
                    Retry Connection
                </button>
            </div>
        </div>
    );
}
