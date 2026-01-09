'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Brand from '@/app/components/Brand';
import { Home, Users, Beaker, Settings, LayoutDashboard } from 'lucide-react';

interface User {
  id: number;
  user_id: string;
  name: string;
  role: string;
  created_at: string;
  last_activity: string;
}

interface Lab {
  id: number;
  lab_name: string;
  category: string;
  difficulty: string;
  is_enabled: boolean;
  max_concurrent_users: number;
}

interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalLabs: number;
  activePods: number;
  totalPoints: number;
}

interface ActivityData {
  hour: string;
  users: number;
  labs: number;
}

interface LabUsage {
  lab_name: string;
  usage_count: number;
}

export default function AdminPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [labUsage, setLabUsage] = useState<LabUsage[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'labs' | 'settings'>('dashboard');
  const [settings, setSettings] = useState({
    maxLabsPerUser: '3',
    maxOSPerUser: '1',
    labTimeout: '60'
  });
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    fetchSettings();
    
    // Poll for real-time updates every 30 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings({
          maxLabsPerUser: data.settings.max_labs_per_user || '3',
          maxOSPerUser: data.settings.max_os_per_user || '1',
          labTimeout: data.settings.lab_timeout_minutes || '60'
        });
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      setSettingsError(null);
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            max_labs_per_user: settings.maxLabsPerUser,
            max_os_per_user: settings.maxOSPerUser,
            lab_timeout_minutes: settings.labTimeout
          }
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 3000);
      } else {
        setSettingsError(data.error || 'Failed to save settings');
        setTimeout(() => setSettingsError(null), 5000);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSettingsError('Network error: Failed to save settings');
      setTimeout(() => setSettingsError(null), 5000);
    }
  };

  const fetchData = async () => {
    try {
      const [usersRes, labsRes, statsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/labs'),
        fetch('/api/admin/stats'),
      ]);

      const usersData = await usersRes.json();
      const labsData = await labsRes.json();
      const statsData = await statsRes.json();

      if (usersData.success) setUsers(usersData.data);
      if (labsData.success) {
        setLabs(labsData.data);
        // Generate lab usage data
        const usage = labsData.data.map((lab: Lab) => ({
          lab_name: lab.lab_name,
          usage_count: Math.floor(Math.random() * 100) // Replace with real data
        })).sort((a: LabUsage, b: LabUsage) => b.usage_count - a.usage_count).slice(0, 5);
        setLabUsage(usage);
      }
      if (statsData.success) {
        setStats(statsData.data);
        // Generate activity data (last 24 hours)
        const hours = [];
        for (let i = 23; i >= 0; i--) {
          const hour = new Date(Date.now() - i * 60 * 60 * 1000);
          hours.push({
            hour: hour.getHours().toString().padStart(2, '0') + ':00',
            users: Math.floor(Math.random() * statsData.data.activeUsers) + 1,
            labs: Math.floor(Math.random() * statsData.data.activePods) + 1
          });
        }
        setActivityData(hours);
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, role: string) => {
    try {
      const res = await fetch('/api/admin/users/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      });

      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const toggleLabStatus = async (labId: number, isEnabled: boolean) => {
    try {
      const res = await fetch('/api/admin/labs/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labId, isEnabled }),
      });

      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to toggle lab:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-xl">Loading Admin Panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header matching main site */}
      <header className="bg-black border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Brand href="/dashboard" />
              <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-600/20 border border-purple-600/50 rounded-lg">
                <LayoutDashboard className="w-4 h-4 text-purple-400" />
                <span className="text-purple-400 text-sm font-medium">Admin Panel</span>
              </div>
            </div>
            
            {/* Navigation tabs */}
            <nav className="hidden md:flex items-center gap-2">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { id: 'users', label: 'Users', icon: Users },
                { id: 'labs', label: 'Labs', icon: Beaker },
                { id: 'settings', label: 'Settings', icon: Settings }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <Link
                href="/admin/k8s-dashboard"
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                ☸️ K8s Dashboard
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <Home className="w-4 h-4" />
                <span className="hidden md:inline">Back to Site</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && stats && (
          <div className="space-y-6">
            <h2 className="text-white text-4xl font-bold mb-8">System Overview</h2>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-blue-500/50 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-blue-500/10">
                <div className="text-gray-400 text-sm mb-2 font-medium">Total Users</div>
                <div className="text-4xl font-bold text-blue-400">{stats.totalUsers}</div>
              </div>
              <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-green-500/50 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-green-500/10">
                <div className="text-gray-400 text-sm mb-2 font-medium">Active Users</div>
                <div className="text-4xl font-bold text-green-400">{stats.activeUsers}</div>
              </div>
              <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-purple-500/50 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-purple-500/10">
                <div className="text-gray-400 text-sm mb-2 font-medium">Total Labs</div>
                <div className="text-4xl font-bold text-purple-400">{stats.totalLabs}</div>
              </div>
              <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-yellow-500/50 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-yellow-500/10">
                <div className="text-gray-400 text-sm mb-2 font-medium">Active Pods</div>
                <div className="text-4xl font-bold text-yellow-400">{stats.activePods}</div>
              </div>
            </div>

            {/* Live Activity Chart */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white text-2xl font-bold">Live Activity (Last 24 Hours)</h3>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                  <span>Auto-refreshing</span>
                </div>
              </div>
              <div className="h-64 relative">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-gray-400">
                  <span>{Math.max(...activityData.map(d => Math.max(d.users, d.labs)))}</span>
                  <span>{Math.floor(Math.max(...activityData.map(d => Math.max(d.users, d.labs))) / 2)}</span>
                  <span>0</span>
                </div>
                {/* Chart area */}
                <div className="ml-14 h-full pb-8 flex items-end gap-1">
                  {activityData.map((data, index) => {
                    const maxValue = Math.max(...activityData.map(d => Math.max(d.users, d.labs)));
                    const userHeight = maxValue > 0 ? (data.users / maxValue) * 100 : 0;
                    const labHeight = maxValue > 0 ? (data.labs / maxValue) * 100 : 0;
                    return (
                      <div key={index} className="flex-1 flex items-end gap-0.5 group relative">
                        <div 
                          className="flex-1 bg-gradient-to-t from-cyan-500 to-cyan-400 rounded-t transition-all duration-300 hover:from-cyan-400 hover:to-cyan-300 cursor-pointer"
                          style={{ height: `${userHeight}%`, minHeight: '2px' }}
                        >
                          <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-10">
                            {data.hour} - {data.users} users
                          </div>
                        </div>
                        <div 
                          className="flex-1 bg-gradient-to-t from-purple-500 to-purple-400 rounded-t transition-all duration-300 hover:from-purple-400 hover:to-purple-300 cursor-pointer"
                          style={{ height: `${labHeight}%`, minHeight: '2px' }}
                        >
                          <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-10">
                            {data.hour} - {data.labs} labs
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* X-axis labels */}
                <div className="ml-14 flex justify-between text-xs text-gray-400">
                  {activityData.filter((_, i) => i % 4 === 0).map((data, index) => (
                    <span key={index}>{data.hour}</span>
                  ))}
                </div>
              </div>
              <div className="flex justify-center gap-6 mt-6 pt-4 border-t border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-t from-cyan-500 to-cyan-400 rounded"></div>
                  <span className="text-sm text-gray-400">Active Users</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gradient-to-t from-purple-500 to-purple-400 rounded"></div>
                  <span className="text-sm text-gray-400">Active Labs</span>
                </div>
              </div>
            </div>

            {/* Most Popular Labs */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-2xl p-6 shadow-lg">
              <h3 className="text-white text-2xl font-bold mb-6">Most Popular Labs</h3>
              <div className="space-y-5">
                {labUsage.map((lab, index) => {
                  const maxUsage = Math.max(...labUsage.map(l => l.usage_count));
                  const percentage = (lab.usage_count / maxUsage) * 100;
                  const colors = ['from-blue-500 to-cyan-500', 'from-purple-500 to-pink-500', 'from-green-500 to-emerald-500', 'from-orange-500 to-red-500', 'from-yellow-500 to-amber-500'];
                  return (
                    <div key={index} className="group">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold text-gray-600">#{index + 1}</span>
                          <span className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">{lab.lab_name}</span>
                        </div>
                        <span className="text-sm font-semibold text-cyan-400">{lab.usage_count} uses</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden shadow-inner">
                        <div 
                          className={`bg-gradient-to-r ${colors[index % colors.length]} h-full rounded-full transition-all duration-700 ease-out shadow-lg`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-2xl p-6 shadow-lg">
              <h3 className="text-white text-2xl font-bold mb-6">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => setActiveTab('users')}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 p-5 rounded-xl text-left transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-blue-500/20 active:scale-95 group"
                >
                  <div className="text-white font-bold mb-1 text-lg group-hover:text-blue-100">Manage Users</div>
                  <div className="text-sm text-blue-100/80">View and edit user roles</div>
                </button>
                <button
                  onClick={() => setActiveTab('labs')}
                  className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 p-5 rounded-xl text-left transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-purple-500/20 active:scale-95 group"
                >
                  <div className="text-white font-bold mb-1 text-lg group-hover:text-purple-100">Manage Labs</div>
                  <div className="text-sm text-purple-100/80">Enable/disable labs</div>
                </button>
                <Link
                  href="/admin/k8s-dashboard"
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 p-5 rounded-xl text-left block transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-green-500/20 active:scale-95 group"
                >
                  <div className="text-white font-bold mb-1 text-lg group-hover:text-green-100">K8s Dashboard</div>
                  <div className="text-sm text-green-100/80">Monitor cluster status</div>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <h2 className="text-white text-4xl font-bold mb-8">User Management</h2>
            
            <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900/50 border-b border-gray-800">
                    <tr>
                      <th className="px-6 py-4 text-left text-gray-400 font-semibold">User ID</th>
                      <th className="px-6 py-4 text-left text-gray-400 font-semibold">Name</th>
                      <th className="px-6 py-4 text-left text-gray-400 font-semibold">Role</th>
                      <th className="px-6 py-4 text-left text-gray-400 font-semibold">Last Activity</th>
                      <th className="px-6 py-4 text-left text-gray-400 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-6 py-4 text-white font-medium">{user.user_id}</td>
                        <td className="px-6 py-4 text-white">{user.name || 'N/A'}</td>
                        <td className="px-6 py-4">
                          <select
                            value={user.role}
                            onChange={(e) => updateUserRole(user.user_id, e.target.value)}
                            className="bg-gray-900 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 transition-colors"
                          >
                            <option value="student">Student</option>
                            <option value="instructor">Instructor</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 text-gray-400 text-sm">
                          {user.last_activity ? new Date(user.last_activity).toLocaleString() : 'Never'}
                        </td>
                        <td className="px-6 py-4">
                          <button className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors">
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Labs Tab */}
        {activeTab === 'labs' && (
          <div className="space-y-6">
            <h2 className="text-white text-4xl font-bold mb-8">Lab Management</h2>
            
            <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900/50 border-b border-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-gray-400 font-semibold">Lab Name</th>
                      <th className="px-6 py-3 text-left text-gray-400 font-semibold">Category</th>
                      <th className="px-6 py-3 text-left text-gray-400 font-semibold">Difficulty</th>
                      <th className="px-6 py-3 text-left text-gray-400 font-semibold">Status</th>
                      <th className="px-6 py-3 text-left text-gray-400 font-semibold">Max Users</th>
                      <th className="px-6 py-3 text-left text-gray-400 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {labs.map((lab) => (
                      <tr key={lab.id} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-white">{lab.lab_name}</td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-sm border border-blue-600/30">
                            {lab.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-sm border ${
                            lab.difficulty === 'easy' ? 'bg-green-600/20 text-green-400 border-green-600/30' :
                            lab.difficulty === 'medium' ? 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30' :
                            'bg-red-600/20 text-red-400 border-red-600/30'
                          }`}>
                            {lab.difficulty}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => toggleLabStatus(lab.id, !lab.is_enabled)}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 shadow-md active:scale-95 ${
                              lab.is_enabled
                                ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white hover:shadow-lg hover:shadow-green-500/20'
                                : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white hover:shadow-lg hover:shadow-red-500/20'
                            }`}
                          >
                            {lab.is_enabled ? '✓ Enabled' : '✗ Disabled'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-white font-medium">{lab.max_concurrent_users}</td>
                        <td className="px-6 py-4">
                          <button className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors">
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-white text-4xl font-bold mb-8">System Settings</h2>
            
            {settingsSaved && (
              <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-xl mb-4 flex items-center gap-3 shadow-lg">
                <span className="text-xl">✓</span>
                <span className="font-medium">Settings saved successfully!</span>
              </div>
            )}
            
            {settingsError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-4 flex items-center gap-3 shadow-lg">
                <span className="text-xl">✗</span>
                <span className="font-medium">{settingsError}</span>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 p-6 rounded-2xl shadow-lg">
                <h3 className="text-white text-2xl font-bold mb-6">Resource Limits</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2 font-medium">Max Labs Per User</label>
                    <input
                      type="number"
                      value={settings.maxLabsPerUser}
                      onChange={(e) => setSettings({...settings, maxLabsPerUser: e.target.value})}
                      className="w-full bg-gray-900 text-white border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2 font-medium">Max OS Containers Per User</label>
                    <input
                      type="number"
                      value={settings.maxOSPerUser}
                      onChange={(e) => setSettings({...settings, maxOSPerUser: e.target.value})}
                      className="w-full bg-gray-900 text-white border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2 font-medium">Lab Timeout (minutes)</label>
                    <input
                      type="number"
                      value={settings.labTimeout}
                      onChange={(e) => setSettings({...settings, labTimeout: e.target.value})}
                      className="w-full bg-gray-900 text-white border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 transition-colors"
                    />
                  </div>
                  <button 
                    onClick={saveSettings}
                    className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white py-3 rounded-xl font-semibold transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-red-500/20 active:scale-95">
                    Save Changes
                  </button>
                </div>
              </div>

              <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 p-6 rounded-2xl shadow-lg">
                <h3 className="text-white text-2xl font-bold mb-6">System Control</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-900/50 border border-gray-700 rounded-xl">
                    <div>
                      <div className="font-semibold text-white">Maintenance Mode</div>
                      <div className="text-sm text-gray-400">Disable user access</div>
                    </div>
                    <label className="relative inline-block w-12 h-6">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-full h-full bg-gray-700 peer-checked:bg-red-600 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>
                  <button className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white py-3 rounded-xl font-semibold transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-red-500/20 active:scale-95">
                    Clear All Active Pods
                  </button>
                  <button className="w-full bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white py-3 rounded-xl font-semibold transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-yellow-500/20 active:scale-95">
                    Restart All Services
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
