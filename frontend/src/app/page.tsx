'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';

const slideData = [
    {
        id: 1,
        image: 'https://images.rawpixel.com/image_800/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIzLTA4L2ZyZWVpbWFnZXNjb21wYW55X21pbmltYWxfZmxhdF92ZWN0b3JfYWVzdGhldGljX2lsbHVzdHJhdGlvbl9vZl80MjU1NWY5My00MGQ1LTRmZGMtOWI2MS03ZjJmMDQxYWNhMDBfMy5qcGc.jpg',
        quote: '"Alone we can do so little; together we can do so much."',
        author: 'Helen Keller',
        color: '#667eea',
    },
    {
        id: 2,
        image: 'https://img.freepik.com/free-photo/friends-enjoying-sunset_23-2151987397.jpg?semt=ais_hybrid&w=740&q=80',
        quote: '"Connection is why we\'re here; it gives purpose and meaning to our lives."',
        author: 'Brené Brown',
        color: '#f5576c',
    },
    {
        id: 3,
        image: 'https://img.freepik.com/free-vector/flat-design-youth-day-celebration_23-2148593998.jpg?semt=ais_hybrid&w=740&q=80',
        quote: '"We rise by lifting others."',
        author: 'Robert Ingersoll',
        color: '#00d4ff',
    },
    {
        id: 4,
        image: 'https://img.freepik.com/free-vector/laughs-people-flat-composition-with-outdoor-landscape-group-laughing-friends-with-smiling-doodle-characters-illustration_1284-61970.jpg',
        quote: '"Growth happens when you learn with people who inspire you."',
        author: 'Anonymous',
        color: '#4ade80',
    },
];

const PERSPECTIVE = '1200px';
const SLIDE_TRANSITION_DURATION = '0.8s';
const ROTATION_ANGLE = 12;

export default function ParallaxCarousel() {
    const slides = useMemo(() => slideData, []);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    const nextSlide = useCallback(() => {
        setCurrentIndex(prev => (prev + 1) % slides.length);
        setIsAutoPlaying(false);
        setTimeout(() => setIsAutoPlaying(true), 10000);
    }, [slides.length]);

    const prevSlide = useCallback(() => {
        setCurrentIndex(prev => (prev - 1 + slides.length) % slides.length);
        setIsAutoPlaying(false);
        setTimeout(() => setIsAutoPlaying(true), 10000);
    }, [slides.length]);

    useEffect(() => {
        if (!hasMounted || !isAutoPlaying) return;
        const timer = setInterval(nextSlide, 8000);
        return () => clearInterval(timer);
    }, [hasMounted, isAutoPlaying, nextSlide]);

    const getSlideStyles = (i) => {
        const diff = i - currentIndex;

        if (diff === 0) {
            return {
                opacity: 1,
                pointerEvents: 'auto',
                transform: `translateZ(0) translateX(0) rotateY(0deg) scale(1)`,
                zIndex: 10,
                boxShadow: `0 40px 80px rgba(0, 0, 0, 0.15), 0 0 80px ${slides[i].color}30`,
            };
        }

        if (diff === 1 || (diff === -(slides.length - 1))) {
            return {
                opacity: 0.6,
                pointerEvents: 'none',
                transform: `translateZ(-250px) translateX(250px) rotateY(-${ROTATION_ANGLE}deg) scale(0.85)`,
                zIndex: 5,
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
            };
        }

        if (diff === -1 || (diff === (slides.length - 1))) {
            return {
                opacity: 0.6,
                pointerEvents: 'none',
                transform: `translateZ(-250px) translateX(-250px) rotateY(${ROTATION_ANGLE}deg) scale(0.85)`,
                zIndex: 5,
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
            };
        }

        return {
            opacity: 0,
            pointerEvents: 'none',
            transform: 'translateZ(-600px) scale(0.5)',
            zIndex: 1,
            boxShadow: 'none',
        };
    };

    if (!hasMounted) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #fef3c7 0%, #e0e7ff 50%, #ddd6fe 100%)',
                paddingBottom: '80px',
                color: '#4a5568',
                fontSize: '24px',
                fontWeight: '600',
                fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '20px'
                }}>
                    <div style={{
                        width: '50px',
                        height: '50px',
                        border: '4px solid rgba(102, 126, 234, 0.2)',
                        borderTop: '4px solid #667eea',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                    Loading Experience...
                </div>
            </div>
        );
    }

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #ffeef8 0%, #e0f2fe 50%, #f0f9ff 100%)',
                position: 'relative',
                overflow: 'hidden',
                padding: '40px 20px',
            }}
        >
            {/* Animated Background Elements - Pastel Colors */}
            <div style={{
                position: 'absolute',
                top: '10%',
                left: '10%',
                width: '400px',
                height: '400px',
                background: 'radial-gradient(circle, #ffd6f380 0%, transparent 70%)',
                borderRadius: '50%',
                filter: 'blur(80px)',
                animation: 'float 6s ease-in-out infinite'
            }} />
            <div style={{
                position: 'absolute',
                bottom: '10%',
                right: '10%',
                width: '500px',
                height: '500px',
                background: 'radial-gradient(circle, #c7d2fe80 0%, transparent 70%)',
                borderRadius: '50%',
                filter: 'blur(100px)',
                animation: 'float 8s ease-in-out infinite reverse'
            }} />
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '600px',
                height: '600px',
                background: 'radial-gradient(circle, #bfdbfe80 0%, transparent 70%)',
                borderRadius: '50%',
                filter: 'blur(120px)',
                animation: 'float 10s ease-in-out infinite'
            }} />
            <div style={{
                position: 'absolute',
                top: '30%',
                right: '20%',
                width: '350px',
                height: '350px',
                background: 'radial-gradient(circle, #fef3c780 0%, transparent 70%)',
                borderRadius: '50%',
                filter: 'blur(90px)',
                animation: 'float 7s ease-in-out infinite'
            }} />
            <div style={{
                position: 'absolute',
                bottom: '25%',
                left: '15%',
                width: '450px',
                height: '450px',
                background: 'radial-gradient(circle, #d9f99d80 0%, transparent 70%)',
                borderRadius: '50%',
                filter: 'blur(110px)',
                animation: 'float 9s ease-in-out infinite reverse'
            }} />

            {/* Carousel Stage */}
            <div
                style={{
                    width: '100%',
                    maxWidth: '1200px',
                    height: 'clamp(400px, 70vh, 550px)',
                    perspective: PERSPECTIVE,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    padding: '0 20px',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        width: 'min(500px, 90vw)',
                        height: 'min(500px, 90vw)',
                        maxHeight: '500px',
                        transformStyle: 'preserve-3d',
                        transition: `transform ${SLIDE_TRANSITION_DURATION} ease-in-out`,
                    }}
                >
                    {slides.map((slide, i) => (
                        <div
                            key={slide.id}
                            style={{
                                ...getSlideStyles(i),
                                position: 'absolute',
                                inset: '0',
                                width: '100%',
                                height: '100%',
                                borderRadius: '30px',
                                overflow: 'hidden',
                                backfaceVisibility: 'hidden',
                                transition: `all ${SLIDE_TRANSITION_DURATION} cubic-bezier(0.68, -0.55, 0.265, 1.55)`,
                                border: '2px solid rgba(255, 255, 255, 0.8)',
                            }}
                        >
                            <div
                                style={{
                                    height: '100%',
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(250,250,252,0.98) 100%)',
                                    backdropFilter: 'blur(20px)',
                                }}
                            >
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '55%',
                                        backgroundImage: `url(${slide.image})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        filter: 'brightness(1.05) saturate(1.1)',
                                    }}
                                >
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        height: '120px',
                                        background: `linear-gradient(to bottom, transparent, rgba(255,255,255,0.95))`
                                    }} />
                                </div>

                                <div
                                    style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '45%',
                                        padding: 'clamp(20px, 5vw, 40px)',
                                        textAlign: 'center',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        background: 'rgba(255,255,255,0.85)',
                                        backdropFilter: 'blur(20px)',
                                    }}
                                >
                                    <div style={{
                                        width: 'clamp(40px, 10vw, 60px)',
                                        height: '4px',
                                        background: `linear-gradient(90deg, ${slide.color}, ${slide.color}cc)`,
                                        margin: '0 auto clamp(15px, 3vw, 25px)',
                                        pointerEvents: 'none' as 'none',
                                        boxShadow: `0 2px 15px ${slide.color}40`
                                    }} />

                                    <blockquote
                                        style={{
                                            fontSize: 'clamp(16px, 3vw, 20px)',
                                            fontStyle: 'italic',
                                            color: '#374151',
                                            margin: '0 0 clamp(12px, 2vw, 20px) 0',
                                            lineHeight: '1.7',
                                            fontWeight: '500',
                                        }}
                                    >
                                        {slide.quote}
                                    </blockquote>
                                    <p
                                        style={{
                                            fontSize: 'clamp(11px, 2vw, 13px)',
                                            fontWeight: '700',
                                            color: slide.color,
                                            textTransform: 'uppercase',
                                            letterSpacing: '2px',
                                        }}
                                    >
                                        {slide.author}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Progress Dots */}
            <div style={{ display: 'flex', gap: '12px', marginTop: 'clamp(30px, 5vh, 40px)', zIndex: 20 }}>
                {slides.map((slide, i) => (
                    <div
                        key={slide.id}
                        onClick={() => {
                            setCurrentIndex(i);
                            setIsAutoPlaying(false);
                            setTimeout(() => setIsAutoPlaying(true), 10000);
                        }}
                        style={{
                            width: i === currentIndex ? '40px' : '12px',
                            height: '12px',
                            background: i === currentIndex
                                ? `linear-gradient(90deg, ${slides[currentIndex].color}, ${slides[currentIndex].color}dd)`
                                : '#d1d5db',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                            boxShadow: i === currentIndex ? `0 4px 20px ${slides[currentIndex].color}50` : 'none',
                            border: i === currentIndex ? '2px solid rgba(255,255,255,0.8)' : 'none',
                        }}
                        aria-label={`Go to slide ${i + 1}`}
                    />
                ))}
            </div>

            <style jsx global>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-30px); }
                }
                * { 
                    margin: 0; 
                    padding: 0; 
                    box-sizing: border-box; 
                }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif;
                    overflow-x: hidden;
                }
                button {
                    border: none;
                    cursor: pointer;
                    outline: none;
                }
            `}</style>
        </div>
    );
}