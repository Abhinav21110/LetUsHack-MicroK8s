"use client";

import Brand from '@/app/components/Brand';

// Use plain img for static asset in /public; simpler and avoids image optimization issues in dev
// UI_UNIFIED_WITH_DASHBOARD
// ROLLBACK_NOTE: To revert to old login/register look, remove shared layout import.

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function AuthLayout({ children, title }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-black">
      <header className="bg-black border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* Use shared Brand component for consistent branding */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <Brand href="/landing" />
        </div>
      </header>

      <main className="flex items-center justify-center min-h-[calc(100vh-80px)]">
        <div className="max-w-md w-full mx-4">
          <div className="bg-zinc-900/80 backdrop-blur-sm p-8 rounded-lg shadow-2xl border border-gray-800/50">
            <h1 className="text-white text-2xl font-bold mb-6">{title}</h1>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}