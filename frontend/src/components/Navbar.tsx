'use client';

import React, { useState, useEffect } from 'react';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api';
import {
  Home,
  Compass,
  Users,
  MessageSquare,
  Bell,
  User,
  LogOut,
  LogIn,
  Sparkles,
  Menu,
  X
} from 'lucide-react';

const navItems = [
  { name: 'Home', href: '/', icon: Home, color: '#3b82f6' },
  { name: 'Feed', href: '/feed', icon: Sparkles, color: '#f59e0b' },
  { name: 'Explore', href: '/explore', icon: Compass, color: '#10b981' },
  { name: 'Discover', href: '/discover', icon: Users, color: '#ec4899' },
  { name: 'Chat', href: '/conversations', icon: MessageSquare, color: '#8b5cf6' },
  { name: 'Notifications', href: '/notifications', icon: Bell, color: '#f43f5e' },
  { name: 'Profile', href: '/profile', icon: User, color: '#64748b' },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      try {
        const data = await apiClient.getNotificationUnreadCount();
        setUnreadCount(data.unread_count);
      } catch (error) {
        // Silently fail to not clutter console
      }
    };

    fetchUnreadCount();

    // Poll every 10 seconds
    const interval = setInterval(fetchUnreadCount, 10000);

    // Listen for updating events (e.g. from Notifications page)
    const handleUpdate = () => fetchUnreadCount();
    window.addEventListener('notificationUpdate', handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('notificationUpdate', handleUpdate);
    };
  }, [user]);

  const isLoggedIn = !!user;

  // Don't render navbar on auth pages
  const isAuthPage = pathname?.startsWith('/auth');
  if (isAuthPage) return null;

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
  };

  return (
    <>
      <nav style={styles.navbar}>
        <div style={styles.navbarContainer}>
          <div style={styles.navbarContent}>
            {/* Logo */}
            <Link href="/" style={styles.logoLink}>
              <div style={styles.logoContainer}>
                <div style={styles.logoIcon}>R</div>
                <div style={styles.logoTextContainer}>
                  <div style={styles.logoText}>RecoM</div>
                  <div style={styles.logoSubtitle}>Connect & Grow</div>
                </div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            {!isMobile && (
              <div style={styles.desktopNav}>
                {isLoggedIn && navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      style={{
                        ...styles.navLink,
                        ...(isActive ? styles.navLinkActive : {})
                      }}
                    >
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Icon size={20} style={{ ...styles.navIcon, color: isActive ? item.color : '#64748b' }} />
                        {item.name === 'Notifications' && unreadCount > 0 && (
                          <div style={styles.notificationBadge}>
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </div>
                        )}
                      </div>
                      <span style={styles.navLabel}>{item.name}</span>
                      {isActive && <div style={styles.activeIndicator} />}
                    </Link>
                  );
                })}

                {isLoggedIn ? (
                  <button onClick={handleLogout} style={styles.logoutButton}>
                    <LogOut size={20} style={styles.logoutIcon} />
                    <span style={styles.logoutLabel}>Logout</span>
                  </button>
                ) : (
                  <Link href="/auth/login" style={styles.loginButton}>
                    <LogIn size={20} style={styles.loginIcon} />
                    <span style={styles.loginLabel}>Login</span>
                  </Link>
                )}
              </div>
            )}

            {/* Mobile menu button */}
            {isMobile && (
              <button
                style={styles.mobileMenuButton}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobile && mobileMenuOpen && (
          <div style={styles.mobileMenu}>
            <div style={styles.mobileMenuContent}>
              {isLoggedIn && navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    style={{
                      ...styles.mobileNavLink,
                      ...(isActive ? styles.mobileNavLinkActive : {})
                    }}
                  >
                    <div style={styles.mobileNavLinkContent}>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Icon size={20} style={{ ...styles.mobileNavIcon, color: isActive ? item.color : '#5a4a3a' }} />
                        {item.name === 'Notifications' && unreadCount > 0 && (
                          <div style={styles.notificationBadgeMobile}>
                            {unreadCount}
                          </div>
                        )}
                      </div>
                      <span style={styles.mobileNavLabel}>{item.name}</span>
                    </div>
                    {isActive && <div style={styles.mobileActiveIndicator} />}
                  </Link>
                );
              })}

              {isLoggedIn ? (
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  style={styles.mobileLogoutButton}
                >
                  <LogOut size={20} style={styles.mobileLogoutIcon} />
                  <span style={styles.mobileLogoutLabel}>Logout</span>
                </button>
              ) : (
                <Link
                  href="/auth/login"
                  onClick={() => setMobileMenuOpen(false)}
                  style={styles.mobileLoginButton}
                >
                  <LogIn size={20} style={styles.mobileLoginIcon} />
                  <span style={styles.mobileLoginLabel}>Login</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Spacer */}
      <div style={styles.spacer} />
    </>
  );
}

const styles: Record<string, any> = {
  navbar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.03)'
  },

  navbarContainer: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '0 clamp(16px, 5vw, 32px)'
  },

  navbarContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '72px'
  },

  logoLink: {
    display: 'flex',
    alignItems: 'center',
    textDecoration: 'none',
    color: 'inherit'
  },

  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px'
  },

  logoIcon: {
    width: '42px',
    height: '42px',
    background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: '800',
    fontSize: '20px',
    boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)'
  },

  logoTextContainer: {
    display: 'flex',
    flexDirection: 'column'
  },

  logoText: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: '-0.5px'
  },

  logoSubtitle: {
    fontSize: '12px',
    color: '#9ca3af',
    fontWeight: '600',
    letterSpacing: '0.5px'
  },

  desktopNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },

  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 20px',
    borderRadius: '12px',
    textDecoration: 'none',
    color: '#64748b',
    fontWeight: '600',
    fontSize: '15px',
    transition: 'all 0.3s ease',
    position: 'relative',
    background: 'transparent'
  },

  navLinkActive: {
    color: '#0f172a',
    background: 'rgba(0, 0, 0, 0.03)',
    boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.05)'
  },

  navIcon: {
    color: 'inherit'
  },

  navLabel: {
    whiteSpace: 'nowrap'
  },

  activeIndicator: {
    position: 'absolute',
    bottom: '-21px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '32px',
    height: '4px',
    background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
    borderRadius: '2px'
  },
  notificationBadge: {
    position: 'absolute',
    top: '-8px',
    right: '-8px',
    background: '#ef4444',
    color: 'white',
    fontSize: '10px',
    fontWeight: '700',
    minWidth: '18px',
    height: '18px',
    borderRadius: '9px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid white',
    padding: '0 4px'
  },
  notificationBadgeMobile: {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    background: '#ef4444',
    color: 'white',
    fontSize: '10px',
    fontWeight: '700',
    minWidth: '16px',
    height: '16px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #0a0a0a'
  },

  logoutButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 20px',
    borderRadius: '12px',
    border: '2px solid rgba(207, 171, 141, 0.3)',
    background: 'transparent',
    color: '#5a4a3a',
    fontWeight: '600',
    fontSize: '15px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: 'inherit',
    marginLeft: '10px'
  },

  logoutIcon: {
    color: 'inherit'
  },

  logoutLabel: {
    whiteSpace: 'nowrap'
  },

  loginButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 24px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #CFAB8D, #D9C4B0)',
    color: '#2c2416',
    fontWeight: '700',
    fontSize: '15px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: 'inherit',
    marginLeft: '10px',
    boxShadow: '0 4px 15px rgba(207, 171, 141, 0.3)'
  },

  loginIcon: {
    color: '#2c2416'
  },

  loginLabel: {
    whiteSpace: 'nowrap'
  },

  mobileMenuButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    border: '2px solid rgba(207, 171, 141, 0.3)',
    background: 'rgba(255, 255, 255, 0.8)',
    cursor: 'pointer',
    color: '#2c2416',
    transition: 'all 0.3s ease'
  },

  mobileMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(30px)',
    WebkitBackdropFilter: 'blur(30px)',
    borderTop: '2px solid rgba(207, 171, 141, 0.2)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)'
  },

  mobileMenuContent: {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },

  mobileNavLink: {
    display: 'block',
    padding: '14px 18px',
    textDecoration: 'none',
    color: '#5a4a3a',
    borderRadius: '12px',
    transition: 'all 0.3s ease',
    position: 'relative'
  },

  mobileNavLinkActive: {
    color: '#2c2416',
    background: 'rgba(207, 171, 141, 0.15)',
    boxShadow: '0 2px 10px rgba(207, 171, 141, 0.2)'
  },

  mobileNavLinkContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px'
  },

  mobileNavIcon: {
    color: 'inherit'
  },

  mobileNavLabel: {
    fontSize: '16px',
    fontWeight: '600'
  },

  mobileActiveIndicator: {
    position: 'absolute',
    left: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    width: '4px',
    height: '24px',
    background: 'linear-gradient(135deg, #CFAB8D, #D9C4B0)',
    borderRadius: '2px'
  },

  mobileLogoutButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 18px',
    borderRadius: '12px',
    border: '2px solid rgba(0, 0, 0, 0.05)',
    background: 'transparent',
    color: '#64748b',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: 'inherit',
    textAlign: 'left',
    width: '100%',
    marginTop: '8px'
  },

  mobileLogoutIcon: {
    color: '#5a4a3a'
  },

  mobileLogoutLabel: {
    fontSize: '16px'
  },

  mobileLoginButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 18px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #CFAB8D, #D9C4B0)',
    color: '#2c2416',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: 'inherit',
    textAlign: 'left',
    width: '100%',
    marginTop: '8px',
    boxShadow: '0 4px 15px rgba(207, 171, 141, 0.3)'
  },

  mobileLoginIcon: {
    color: '#2c2416'
  },

  mobileLoginLabel: {
    fontSize: '16px'
  },

  spacer: {
    height: '72px'
  }
};
