import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface BohUser {
  id: string;
  auth_user_id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  status: string;
  primary_role_hint: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  app_context: string;
}

interface CrewStats {
  total: number;
  active: number;
  pending: number;
  inactive: number;
}

const CrewPage: React.FC = () => {
  const [crew, setCrew] = useState<BohUser[]>([]);
  const [stats, setStats] = useState<CrewStats>({ total: 0, active: 0, pending: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<BohUser | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'directory' | 'structure'>('overview');

  useEffect(() => {
    loadCrewData();
  }, []);

  const loadCrewData = async () => {
    try {
      setLoading(true);
      
      // Load all BOH users
      const { data: users, error } = await supabase
        .from('boh_user')
        .select('*')
        .eq('app_context', 'boh')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const crewData = users || [];
      setCrew(crewData);

      // Calculate stats
      const newStats: CrewStats = {
        total: crewData.length,
        active: crewData.filter(u => u.status === 'active').length,
        pending: crewData.filter(u => u.status === 'pending').length,
        inactive: crewData.filter(u => u.status === 'inactive').length,
      };
      setStats(newStats);

    } catch (error) {
      console.error('Error loading crew data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDisplayName = (user: BohUser) => {
    return user.display_name || user.full_name || user.email || 'Unknown';
  };

  const filteredCrew = crew.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    const displayName = getDisplayName(user).toLowerCase();
    const email = (user.email || '').toLowerCase();
    const role = (user.primary_role_hint || '').toLowerCase();
    
    return displayName.includes(searchLower) || email.includes(searchLower) || role.includes(searchLower);
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-boh-bg dark:text-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200';
      case 'inactive': return 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text dark:bg-boh-surface dark:text-boh-text-sub';
      default: return 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text dark:bg-boh-surface dark:text-boh-text-sub';
    }
  };

  const groupedByStatus = {
    active: filteredCrew.filter(u => u.status === 'active'),
    pending: filteredCrew.filter(u => u.status === 'pending'),
    inactive: filteredCrew.filter(u => u.status === 'inactive'),
  };

  const groupedByRole = filteredCrew.reduce((acc, user) => {
    const role = user.primary_role_hint || 'No Role';
    if (!acc[role]) acc[role] = [];
    acc[role].push(user);
    return acc;
  }, {} as Record<string, BohUser[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text">
        <div className="text-center py-8">
          <div className="text-boh-text-sub-light dark:text-boh-text-sub">Loading crew data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text">
      {/* Header */}
      <div className="bg-boh-surface-light dark:bg-boh-surface border-b border-boh-border-light dark:border-boh-border shadow-sm">
        <div className="w-full px-8 py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 text-boh-text-sub-light dark:text-boh-text">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">Crew</span>
              </div>
              <h1 className="text-3xl font-bold text-boh-text-light dark:text-boh-text mb-2">Crew</h1>
              <p className="text-boh-text-sub-light dark:text-boh-text-sub">People, roles, and internal team visibility</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-boh-surface-light dark:bg-boh-surface border-b border-boh-border-light dark:border-boh-border">
        <div className="w-full px-8">
          <div className="flex space-x-8">
            {['overview', 'directory', 'structure'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-boh-primary text-boh-primary'
                    : 'border-transparent text-boh-text-sub-light hover:text-boh-text-sub hover:border-boh-border'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-8 py-8">
        {activeTab === 'overview' && (
          <div className="max-w-6xl mx-auto">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div 
                className="bg-purple-600 text-white rounded-xl p-6"
                style={{ backgroundColor: '#9333ea !important', color: 'white !important' }}
              >
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm mt-1 opacity-90">Total Crew</div>
              </div>
              <div 
                className="bg-emerald-600 text-white rounded-xl p-6"
                style={{ backgroundColor: '#059669 !important', color: 'white !important' }}
              >
                <div className="text-2xl font-bold">{stats.active}</div>
                <div className="text-sm mt-1 opacity-90">Active</div>
              </div>
              <div 
                className="bg-amber-600 text-white rounded-xl p-6"
                style={{ backgroundColor: '#d97706 !important', color: 'white !important' }}
              >
                <div className="text-2xl font-bold">{stats.pending}</div>
                <div className="text-sm mt-1 opacity-90">Pending</div>
              </div>
              <div 
                className="bg-slate-600 text-white rounded-xl p-6"
                style={{ backgroundColor: '#475569 !important', color: 'white !important' }}
              >
                <div className="text-2xl font-bold">{stats.inactive}</div>
                <div className="text-sm mt-1 opacity-90">Inactive</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'directory' && (
          <div className="max-w-6xl mx-auto">
            {/* Search */}
            <div className="mb-6">
              <input
                type="text"
                placeholder="Search by name, email, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text"
              />
            </div>

            {/* Directory List */}
            <div className="space-y-4">
              {filteredCrew.map((user) => (
                <div
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-lg p-4 hover:shadow-sm transition-shadow cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={getDisplayName(user)} className="w-12 h-12 rounded-full" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-boh-primary text-white flex items-center justify-center font-semibold">
                          {getDisplayName(user).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-boh-text-light dark:text-boh-text">
                          {getDisplayName(user)}
                        </div>
                        <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                          {user.email}
                        </div>
                        {user.primary_role_hint && (
                          <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                            {user.primary_role_hint}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(user.status)}`}>
                        {user.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'structure' && (
          <div className="max-w-6xl mx-auto space-y-8">
            {/* By Status */}
            <div>
              <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text mb-4">By Status</h3>
              <div className="space-y-4">
                {Object.entries(groupedByStatus).map(([status, users]) => (
                  <div key={status} className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-lg p-4">
                    <h4 className="font-medium text-boh-text-light dark:text-boh-text mb-2 capitalize">{status} ({users.length})</h4>
                    <div className="space-y-2">
                      {users.map((user) => (
                        <div key={user.id} className="flex items-center space-x-3 text-sm">
                          <div className="w-8 h-8 rounded-full bg-boh-primary text-white flex items-center justify-center text-xs font-semibold">
                            {getDisplayName(user).charAt(0).toUpperCase()}
                          </div>
                          <span className="text-boh-text-light dark:text-boh-text">{getDisplayName(user)}</span>
                          {user.primary_role_hint && (
                            <span className="text-boh-text-sub-light dark:text-boh-text-sub">• {user.primary_role_hint}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By Role */}
            <div>
              <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text mb-4">By Role</h3>
              <div className="space-y-4">
                {Object.entries(groupedByRole).map(([role, users]: [string, BohUser[]]) => (
                  <div key={role} className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-lg p-4">
                    <h4 className="font-medium text-boh-text-light dark:text-boh-text mb-2">{role} ({users.length})</h4>
                    <div className="space-y-2">
                      {users.map((user) => (
                        <div key={user.id} className="flex items-center space-x-3 text-sm">
                          <div className="w-8 h-8 rounded-full bg-boh-primary text-white flex items-center justify-center text-xs font-semibold">
                            {getDisplayName(user).charAt(0).toUpperCase()}
                          </div>
                          <span className="text-boh-text-light dark:text-boh-text">{getDisplayName(user)}</span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(user.status)}`}>
                            {user.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Profile Modal/Drawer */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-boh-border-light dark:border-boh-border">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-boh-text-light dark:text-boh-text">Crew Profile</h2>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-boh-text-sub-light hover:text-boh-text"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center space-x-4 mb-6">
                {selectedUser.avatar_url ? (
                  <img src={selectedUser.avatar_url} alt={getDisplayName(selectedUser)} className="w-20 h-20 rounded-full" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-boh-primary text-white flex items-center justify-center font-semibold text-2xl">
                    {getDisplayName(selectedUser).charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-semibold text-boh-text-light dark:text-boh-text">
                    {getDisplayName(selectedUser)}
                  </h3>
                  <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedUser.status)}`}>
                    {selectedUser.status}
                  </span>
                </div>
              </div>
              
              <div className="space-y-4">
                {selectedUser.email && (
                  <div>
                    <label className="block text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-1">Email</label>
                    <div className="text-boh-text-light dark:text-boh-text">{selectedUser.email}</div>
                  </div>
                )}
                
                {selectedUser.first_name && (
                  <div>
                    <label className="block text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-1">First Name</label>
                    <div className="text-boh-text-light dark:text-boh-text">{selectedUser.first_name}</div>
                  </div>
                )}
                
                {selectedUser.last_name && (
                  <div>
                    <label className="block text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-1">Last Name</label>
                    <div className="text-boh-text-light dark:text-boh-text">{selectedUser.last_name}</div>
                  </div>
                )}
                
                {selectedUser.primary_role_hint && (
                  <div>
                    <label className="block text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-1">Primary Role</label>
                    <div className="text-boh-text-light dark:text-boh-text">{selectedUser.primary_role_hint}</div>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-1">Joined</label>
                  <div className="text-boh-text-light dark:text-boh-text">
                    {new Date(selectedUser.created_at).toLocaleDateString()}
                  </div>
                </div>
                
                {selectedUser.updated_at && selectedUser.updated_at !== selectedUser.created_at && (
                  <div>
                    <label className="block text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-1">Last Updated</label>
                    <div className="text-boh-text-light dark:text-boh-text">
                      {new Date(selectedUser.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrewPage;
