'use client';

import React, { useEffect, useRef, useState } from 'react';

interface DropdownProps {
    trigger: React.ReactNode;
    children: React.ReactNode;
    align?: 'left' | 'right';
    className?: string;
    onOpenChange?: (isOpen: boolean) => void;
}

export default function Dropdown({
    trigger,
    children,
    align = 'right',
    className = '',
    onOpenChange
}: DropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside as any);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside as any);
        };
    }, [isOpen]);

    // Handle escape key to close dropdown
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    // Notify parent of state changes
    useEffect(() => {
        onOpenChange?.(isOpen);
    }, [isOpen, onOpenChange]);

    const toggleDropdown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(!isOpen);
    };

    const closeDropdown = () => {
        setIsOpen(false);
    };

    return (
        <div
            ref={dropdownRef}
            style={{
                position: 'relative',
                display: 'inline-block'
            }}
            className={className}
        >
            {/* Trigger Button */}
            <div onClick={toggleDropdown}>
                {trigger}
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        top: '100%',
                        ...(align === 'right' ? { right: 0 } : { left: 0 }),
                        marginTop: '8px',
                        background: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                        border: '1px solid #E8E0D5',
                        overflow: 'hidden',
                        zIndex: 9999,
                        minWidth: '180px',
                        whiteSpace: 'nowrap',
                        maxWidth: 'calc(100vw - 40px)',
                        animation: 'dropdownFadeIn 0.15s ease-out'
                    }}
                >
                    <DropdownContext.Provider value={{ closeDropdown }}>
                        {children}
                    </DropdownContext.Provider>
                </div>
            )}

            <style jsx>{`
                @keyframes dropdownFadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(-8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
}

// Context to allow menu items to close the dropdown
export const DropdownContext = React.createContext<{ closeDropdown: () => void } | null>(null);

interface DropdownItemProps {
    onClick?: (e: React.MouseEvent) => void;
    icon?: React.ReactNode;
    children: React.ReactNode;
    variant?: 'default' | 'danger';
    disabled?: boolean;
    closeOnClick?: boolean;
}

export function DropdownItem({
    onClick,
    icon,
    children,
    variant = 'default',
    disabled = false,
    closeOnClick = true
}: DropdownItemProps) {
    const context = React.useContext(DropdownContext);

    const handleClick = (e: React.MouseEvent) => {
        if (disabled) return;

        e.preventDefault();
        e.stopPropagation();

        onClick?.(e);

        if (closeOnClick && context) {
            // Small delay to allow the click action to complete
            setTimeout(() => {
                context.closeDropdown();
            }, 50);
        }
    };

    const colors = {
        default: {
            text: '#3E2723',
            hover: '#F5F1ED'
        },
        danger: {
            text: '#d32f2f',
            hover: '#FFF5F5'
        }
    };

    const currentColors = colors[variant];

    return (
        <button
            onClick={handleClick}
            disabled={disabled}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                background: 'transparent',
                cursor: disabled ? 'not-allowed' : 'pointer',
                color: disabled ? '#ccc' : currentColors.text,
                fontSize: '14px',
                textAlign: 'left',
                opacity: disabled ? 0.5 : 1,
                transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => {
                if (!disabled) {
                    e.currentTarget.style.background = currentColors.hover;
                }
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
            }}
        >
            {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
            {children}
        </button>
    );
}

interface DropdownDividerProps {
    style?: React.CSSProperties;
}

export function DropdownDivider({ style }: DropdownDividerProps) {
    return (
        <div
            style={{
                height: '1px',
                background: '#E8E0D5',
                margin: '4px 0',
                ...style
            }}
        />
    );
}
