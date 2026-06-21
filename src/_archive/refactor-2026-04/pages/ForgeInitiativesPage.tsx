import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface Initiative {
  id: string;
  title: string;
  description: string;
  status: 'planned' | 'in progress' | 'blocked' | 'done' | 'cancelled';
  major_release_id?: string;
  owner_user_id?: string;
  target_start_date?: string;
  target_end_date?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  priority_id?: string;
  app_id: string;
  ticket_count?: number;
  release_count?: number;
  owner_name?: string;
  app_name?: string;
  priority_label?: string;
  major_release_label?: string;
}

interface App {
  id: string;
  name: string;
  slug: string;
}

const ProductInitiativesPage: React.FC = () => {
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load apps
      const { data: appsData, error: appsError } = await supabase
        .from('boh_app')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name');

      if (appsError) throw appsError;

      // Load initiatives with related data
      const { data: initiativesData, error: initiativesError } = await supabase
        .from('boh_initiative')
        .select(`
          id,
          title,
          description,
          status,
          major_release_id,
          owner_user_id,
          target_start_date,
          target_end_date,
          tags,
          created_at,
          updated_at,
          priority_id,
          app_id,
          counter_ticket(count),
          boh_release_version!boh_initiative_major_release_id_fkey(count),
          boh_user!boh_initiative_owner_user_id_fkey(full_name),
          boh_app!boh_initiative_app_id_fkey(name),
          counter_ticket_priority!boh_initiative_priority_id_fkey(label)
        `)
        .order('created_at', { ascending: false });

      if (initiativesError) throw initiativesError;

      // Get major release labels
      const majorReleaseIds = initiativesData
        .map(i => i.major_release_id)
        .filter(Boolean);

      let majorReleaseLabels: Record<string, string> = {};
      if (majorReleaseIds.length > 0) {
        const { data: releasesData } = await supabase
          .from('boh_release_version')
          .select('id, version_label')
          .in('id', majorReleaseIds);

        majorReleaseLabels = (releasesData || []).reduce((acc, release) => {
          acc[release.id] = release.version_label;
          return acc;
        }, {} as Record<string, string>);
      }

      // Process initiatives
      const processedInitiatives = (initiativesData || []).map((initiative: any) => ({
        ...initiative,
        ticket_count: initiative.counter_ticket?.[0]?.count || 0,
        release_count: initiative.boh_release_version?.[0]?.count || 0,
        owner_name: initiative.boh_user?.full_name || 'Unassigned',
        app_name: initiative.boh_app?.name || 'Unknown',
        priority_label: initiative.counter_ticket_priority?.label || 'No Priority',
        major_release_label: initiative.major_release_id ? majorReleaseLabels[initiative.major_release_id] : undefined,
      }));

      setApps(appsData || []);
      setInitiatives(processedInitiatives);
    } catch (error) {
      console.error('Error loading initiatives:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'done':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'in progress':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'planned':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'blocked':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'cancelled':
        return 'text-boh-text-sub-light dark:text-boh-text-sub bg-boh-bg-light dark:bg-boh-bg border-boh-border-light dark:border-boh-border';
      default:
        return 'text-boh-text-sub-light dark:text-boh-text-sub bg-boh-bg-light dark:bg-boh-bg border-boh-border-light dark:border-boh-border';
    }
  };

  const filteredInitiatives = initiatives.filter(initiative => {
    const matchesFilter = filter === 'all' || initiative.status === filter;
    const matchesSearch = searchTerm === '' || 
      initiative.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      initiative.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      initiative.app_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-boh-bg-light dark:bg-boh-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cafe mx-auto"></div>
          <p className="mt-4 text-boh-text-sub-light dark:text-boh-text-sub">Loading Initiatives...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-boh-bg-light dark:bg-boh-bg">
      {/* Header */}
      <div className="bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-surface border-b border-boh-border-light dark:border-boh-border">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link to="/forge" className="text-sm text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-primary">
                  Forge
                </Link>
                <svg className="w-4 h-4 text-boh-text-sub-light dark:text-boh-text-sub" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-sm text-boh-text-light dark:text-boh-text font-medium">Initiatives</span>
              </div>
              <h1 className="text-3xl font-bold text-boh-text-light dark:text-boh-text">
                Product Initiatives
              </h1>
              <p className="text-boh-text-sub-light dark:text-boh-text-sub mt-2">
                Manage major release initiatives and track their progress
              </p>
            </div>
            <button className="px-4 py-2 bg-cafe text-white rounded-lg hover:bg-cafe-dark transition-colors">
              Create Initiative
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Filters and Search */}
        <div className="bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-surface rounded-lg shadow-md p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search initiatives..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg focus:ring-2 focus:ring-cafe focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              {['all', 'planned', 'in progress', 'blocked', 'done', 'cancelled'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    filter === status
                      ? 'bg-cafe text-white'
                      : 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text hover:bg-boh-surface-light dark:bg-boh-surface'
                  }`}
                >
                  {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Initiative Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredInitiatives.map((initiative) => (
            <div key={initiative.id} className="bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-surface rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text mb-2">
                      {initiative.title}
                    </h3>
                    <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub line-clamp-3">{initiative.description}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(initiative.status)}`}>
                    {initiative.status}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-boh-text-sub-light dark:text-boh-text-sub">Application:</span>
                    <span className="font-medium">{initiative.app_name}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-boh-text-sub-light dark:text-boh-text-sub">Owner:</span>
                    <span className="font-medium">{initiative.owner_name}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-boh-text-sub-light dark:text-boh-text-sub">Priority:</span>
                    <span className="font-medium">{initiative.priority_label}</span>
                  </div>

                  {initiative.major_release_label && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-boh-text-sub-light dark:text-boh-text-sub">Major Release:</span>
                      <span className="font-medium">{initiative.major_release_label}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-boh-text-sub-light dark:text-boh-text-sub">Tickets:</span>
                    <span className="font-medium">{initiative.ticket_count}</span>
                  </div>

                  {initiative.target_start_date && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-boh-text-sub-light dark:text-boh-text-sub">Target Start:</span>
                      <span className="font-medium">{new Date(initiative.target_start_date).toLocaleDateString()}</span>
                    </div>
                  )}

                  {initiative.target_end_date && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-boh-text-sub-light dark:text-boh-text-sub">Target End:</span>
                      <span className="font-medium">{new Date(initiative.target_end_date).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-boh-border-light dark:border-boh-border">
                  <div className="flex gap-2">
                    <button className="flex-1 px-3 py-2 text-sm border border-boh-border-light dark:border-boh-border rounded hover:bg-boh-bg-light dark:hover:bg-boh-bg dark:hover:bg-boh-bg transition-colors">
                      View Details
                    </button>
                    <button className="flex-1 px-3 py-2 text-sm bg-cafe text-white rounded hover:bg-cafe-dark transition-colors">
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredInitiatives.length === 0 && (
          <div className="bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-surface rounded-lg shadow-md p-12 text-center">
            <div className="w-16 h-16 bg-boh-surface-light dark:bg-boh-surface rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-boh-text-light dark:text-boh-text mb-2">No initiatives found</h3>
            <p className="text-boh-text-sub-light dark:text-boh-text-sub">
              {searchTerm || filter !== 'all' 
                ? 'Try adjusting your filters or search terms'
                : 'Create your first initiative to get started'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductInitiativesPage;
