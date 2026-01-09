"use client";

import { useState } from 'react';
import { Search, LogOut, Menu, X, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
// Use plain img for simple static asset from /public to avoid dev image optimization issues
import { NotificationDropdown } from './NotificationDropdown';
import Brand from '@/app/components/Brand';
/* AUTH_DISABLED_TEMPORARILY (Supabase/StackAuth)
   REASON: Temporarily disabling remote auth for local testing.
   ROLLBACK_INSTRUCTIONS:
     - Remove surrounding comment markers on UserButton import and JSX usage.
     - Restore env vars and provider wrappers.
*/
// import { UserButton } from '@stackframe/stack';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isAdmin?: boolean;
}

export function Header({ searchQuery, onSearchChange, isAdmin = false }: HeaderProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is handled in real-time via onSearchChange
  };

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      // Some servers respond with a redirect (303) which may not
      // set `res.ok` (res.ok is only true for 2xx). Regardless of
      // the exact response status, if logout completed we should
      // navigate the user to the login page. Prefer client-side
      // navigation so it works consistently when logout is called
      // via fetch.
      try {
        router.replace('/login');
      } catch (navErr) {
        // Fallback: set location directly if router navigation fails
        // (very rare in Next.js client components)
        // eslint-disable-next-line no-restricted-globals
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className="bg-black border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 md:gap-12">
            <Brand href="/dashboard" />

            {/* Desktop nav: hidden on small screens */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="/leaderboard" className="text-white hover:text-gray-300 transition-colors">Leaderboard</a>
              <a href="#" className="text-white hover:text-gray-300 transition-colors">Courses</a>
              <a href="#" className="text-white hover:text-gray-300 transition-colors">Challenges</a>
              <a href="#" className="text-white hover:text-gray-300 transition-colors">Community</a>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search challenges..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="bg-gray-900 text-white border border-gray-700 rounded-lg pl-12 pr-4 py-2.5 w-40 sm:w-56 md:w-64 focus:outline-none focus:border-gray-600 transition-colors"
              />
            </form>

            <NotificationDropdown />

            {/* Admin Panel Button - Only for admin users */}
            {isAdmin && (
              <button
                onClick={() => router.push('/admin/panel')}
                className="hidden md:flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
                title="Admin Panel"
              >
                <Shield className="w-5 h-5" />
              </button>
            )}

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileOpen((s) => !s)}
              className="md:hidden p-2 rounded bg-transparent text-white hover:bg-gray-900"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-white hover:bg-gray-900 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>

            {/* AUTH_DISABLED_TEMPORARILY: User menu hidden in guest mode. ROLLBACK: Uncomment UserButton below. */}
            {/**
            <div className="flex items-center">
              <UserButton />
            </div>
            */}
          </div>
        </div>
      </div>
      {/* Mobile nav dropdown */}
      {mobileOpen && (
        <div className="md:hidden bg-black border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-6 py-3 flex flex-col gap-2">
            <a href="/leaderboard" className="text-white hover:text-gray-300">Leaderboard</a>
            <a href="#" className="text-white hover:text-gray-300">Courses</a>
            <a href="#" className="text-white hover:text-gray-300">Challenges</a>
            <a href="#" className="text-white hover:text-gray-300">Community</a>
            {isAdmin && (
              <button
                onClick={() => router.push('/admin/panel')}
                className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
              >
                <Shield className="w-5 h-5" />
                <span>Admin Panel</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}