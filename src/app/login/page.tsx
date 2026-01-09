'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthLayout } from '../components/AuthLayout';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const user_id = formData.get('user_id') as string;
    const password = formData.get('password') as string;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id, password }),
      });

      if (res.ok) {
        if (res.redirected) {
          // Follow the redirect from the server
          window.location.href = res.url;
        } else {
          // If no redirect, go to dashboard
          window.location.href = '/dashboard';
        }
        return;
      }

      // Try to parse error message from JSON response
      try {
        const data = await res.json();
        throw new Error(data.message || 'Login failed');
      } catch (jsonError) {
        // If we can't parse JSON, use status text
        throw new Error(res.statusText || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Login to Let Us Hack Platform">
      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="user_id" className="block text-gray-200 mb-1">
            User ID
          </label>
          <input
            type="text"
            id="user_id"
            name="user_id"
            required
            className="w-full px-4 py-2 rounded bg-zinc-800 text-white border border-zinc-700 focus:border-red-500 focus:outline-none"
            placeholder="Enter your user ID"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-gray-200 mb-1">
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            required
            className="w-full px-4 py-2 rounded bg-zinc-800 text-white border border-zinc-700 focus:border-red-500 focus:outline-none"
            placeholder="Enter your password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-zinc-900 ${loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <p className="mt-4 text-gray-400 text-sm text-center">
        Don&apos;t have an account? To register, please contact the administrator.
      </p>
    </AuthLayout>
  );
}