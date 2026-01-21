// components/Sidebar.tsx
import React from 'react';
// Assume Link is imported from 'next/link' or equivalent routing library
// import Link from 'next/link'; 

const navItems = [
  { name: 'Home', href: '/', icon: '🏠' },
  { name: 'Profile', href: '/profile/me', icon: '👤' },
  { name: 'Discovery', href: '/discover', icon: '🌟' }, // Highlighted Route
  { name: 'Messages', href: '/conversations', icon: '💬' },
];

const Sidebar: React.FC = () => {
  // Simple check for the active route (e.g., using useRouter().pathname in Next.js)
  const activeRoute = '/discover';

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-[200px] 
                 bg-white border-r border-light-gray p-6 shadow-lg z-10"
    >
      <h2 className="text-xl font-extrabold mb-8 text-soft-lavender">
        MatchSense
      </h2>

      <nav className="space-y-3">
        {navItems.map((item) => (
          // Link component would wrap the div/a tag here
          <div
            key={item.name}
            className={`flex items-center p-3 rounded-lg font-medium transition-colors cursor-pointer
              ${activeRoute === item.href
                ? 'bg-soft-lavender text-white shadow-md'
                : 'text-charcoal-gray hover:bg-pale-cream'}`
            }
          >
            <span className="mr-3">{item.icon}</span>
            {item.name}
          </div>
        ))}
      </nav>

      {/* User Profile Snippet (Bottom) */}
      <div className="absolute bottom-6 left-6 right-6 flex items-center p-3 bg-pale-cream rounded-xl">
        <div className="w-8 h-8 rounded-full bg-light-gray mr-3"></div>
        <span className="text-sm font-semibold">@User_Dev</span>
      </div>
    </aside>
  );
};

export default Sidebar;