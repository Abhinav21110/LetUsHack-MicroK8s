'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from './components/Header';
import { ChallengeCard } from './components/ChallengeCard';

// AUTH_RESTRICTION_REENABLED
// Explanation: Dashboard and internal pages now require login.
// To disable again, comment out the auth checks in this file and middleware.ts.

interface Lab {
  lab_id: number;
  lab_name: string;
  lab_description: string;
  lab_tags: string[];
  level: number;
  max_score: number;
  created_at: string;
  updated_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<{ user_id: string; name?: string; role?: string } | null>(null);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use the auth check endpoint instead of manual cookie parsing
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/check');
        if (!res.ok) {
          throw new Error('Authentication check failed');
        }
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          router.replace('/login?from=/dashboard');
        }
      } catch (err) {
        console.error('Auth check error:', err);
        router.replace('/login?from=/dashboard');
      }
    }

    checkAuth();
  }, [router]);

  useEffect(() => {
    // Fetch labs from API
    async function fetchLabs() {
      try {
        const res = await fetch('/api/labs');
        const data = await res.json();
        if (data.success) {
          setLabs(data.labs);
        }
      } catch (err) {
        console.error('Error fetching labs:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchLabs();
  }, []);

  const filteredLabs = labs.filter(lab => {
    // Search filter - search in lab name, description, and tags
    const searchMatch = searchQuery === '' || 
      lab.lab_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lab.lab_description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lab.lab_tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return searchMatch;
  });

  return (
    <div className="min-h-screen bg-black">
      <Header 
        searchQuery={searchQuery} 
        onSearchChange={setSearchQuery}
        isAdmin={user?.role === 'admin'}
      />

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="text-white text-4xl font-bold mb-3">
            Welcome back, {user?.name ?? user?.user_id ?? 'User'}
          </h1>
          <p className="text-gray-400 text-lg">Ready to test your skills in the arena?</p>
        </div>

        <div className="mb-8">
          <h2 className="text-white text-2xl font-semibold">Available CTF Challenges</h2>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-xl">Loading challenges...</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLabs.map((lab) => (
                <ChallengeCard key={lab.lab_id} lab={lab} />
              ))}
            </div>

            {filteredLabs.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">🔍</div>
                <h3 className="text-white text-xl font-semibold mb-2">No challenges found</h3>
                <p className="text-gray-400">Try adjusting your search or check back later for new challenges.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}