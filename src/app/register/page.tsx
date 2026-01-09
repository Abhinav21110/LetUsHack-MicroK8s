"use client";

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AuthLayout } from '../components/AuthLayout';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const user_id = formData.get('user_id') as string;
    const password = formData.get('password') as string;
    const confirm_password = formData.get('confirm_password') as string;
    const name = formData.get('name') as string;

    if (password !== confirm_password) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id, password, name }),
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
        throw new Error(data.message || 'Registration failed');
      } catch (jsonError) {
        // If we can't parse JSON, use status text
        throw new Error(res.statusText || 'Registration failed');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create CTF Account">
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
            minLength={8}
            className="w-full px-4 py-2 rounded bg-zinc-800 text-white border border-zinc-700 focus:border-red-500 focus:outline-none"
            placeholder="Choose a password (min. 8 characters)"
          />
        </div>

        <div>
          <label htmlFor="confirm_password" className="block text-gray-200 mb-1">
            Confirm Password
          </label>
          <input
            type="password"
            id="confirm_password"
            name="confirm_password"
            required
            minLength={8}
            className="w-full px-4 py-2 rounded bg-zinc-800 text-white border border-zinc-700 focus:border-red-500 focus:outline-none"
            placeholder="Confirm your password"
          />
        </div>

        <div>
          <label htmlFor="name" className="block text-gray-200 mb-1">
            Full Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            className="w-full px-4 py-2 rounded bg-zinc-800 text-white border border-zinc-700 focus:border-red-500 focus:outline-none"
            placeholder="Enter your full name (optional)"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-zinc-900 ${loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
        >
          {loading ? 'Creating Account...' : 'Register'}
        </button>
      </form>

      <p className="mt-4 text-gray-400 text-sm text-center">
        Already have an account?{' '}
        <a href="/login" className="text-red-400 hover:text-red-300">
          Login here
        </a>
      </p>
    </AuthLayout>
  );
}
