import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface ProductMetrics {
  totalInitiatives: number;
  activeInitiatives: number;
  totalReleases: number;
  activeReleases: number;
  internalTickets: number;
  externalTickets: number;
  completedThisQuarter: number;
  upcomingReleases: number;
}

interface Initiative {
  id: string;
  title: string;
  description: string;
  status: 'planned' | 'in progress' | 'blocked' | 'done' | 'cancelled';
  major_release_id?: string;
  target_start_date?: string;
  target_end_date?: string;
  ticket_count?: number;
  release_count?: number;
}

interface ReleaseSummary {
  id: string;
  version_label: string;
  release_tier: 'major' | 'minor';
  status: string;
  release_date: string;
  ticket_count: number;
  initiative_title?: string;
}

const ProductDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<ProductMetrics>({
    totalInitiatives: 0,
    activeInitiatives: 0,
    totalReleases: 0,
    activeReleases: 0,
    internalTickets: 0,
    externalTickets: 0,
    completedThisQuarter: 0,
    upcomingReleases: 0,
  });
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [releases, setReleases] = useState<ReleaseSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProductData();
  }, []);

  const loadProductData = async () => {
    try {
      setLoading(true);
      
      // Load initiatives with ticket counts
      const { data: initiativesData, error: initiativesError } = await supabase
        .from('boh_initiative')
        .select(`
          id,
          title,
          description,
          status,
          major_release_id,
          target_start_date,
          target_end_date,
          counter_ticket(count)
        `)
        .order('created_at', { ascending: false });

      if (initiativesError) throw initiativesError;

      // Load releases with ticket counts
      const { data: releasesData, error: releasesError } = await supabase
        .from('boh_release_version')
        .select(`
          id,
          version_label,
          release_tier,
          status,
          release_date,
          counter_ticket(count)
        `)
        .order('release_date', { ascending: false });

      if (releasesError) throw releasesError;

      // Load ticket counts by app context
      const { data: internalTickets, error: internalError } = await supabase
        .from('counter_ticket')
        .select('id', { count: 'exact' })
        .eq('app_context', 'boh');

      const { data: externalTickets, error: externalError } = await supabase
        .from('counter_ticket')
        .select('id', { count: 'exact' })
        .neq('app_context', 'boh');

      if (internalError || externalError) throw internalError || externalError;

      // Process data
      const processedInitiatives = (initiativesData || []).map((initiative: any) => ({
        ...initiative,
        ticket_count: initiative.counter_ticket?.[0]?.count || 0,
      }));

      const processedReleases = (releasesData || []).map((release: any) => ({
        ...release,
        ticket_count: release.counter_ticket?.[0]?.count || 0,
      }));

      // Calculate metrics
      const currentQuarter = Math.floor((new Date().getMonth() + 1) / 3);
      const currentYear = new Date().getFullYear();

      const calculatedMetrics: ProductMetrics = {
        totalInitiatives: processedInitiatives.length,
        activeInitiatives: processedInitiatives.filter(i => i.status === 'in progress').length,
        totalReleases: processedReleases.length,
        activeReleases: processedReleases.filter(r => r.status === 'in progress').length,
        internalTickets: internalTickets?.length || 0,
        externalTickets: externalTickets?.length || 0,
        completedThisQuarter: processedReleases.filter(r => {
          const releaseDate = new Date(r.release_date);
          return r.status === 'released' && 
                 releaseDate.getFullYear() === currentYear && 
                 Math.floor((releaseDate.getMonth() + 1) / 3) === currentQuarter;
        }).length,
        upcomingReleases: processedReleases.filter(r => 
          r.status === 'planned' && new Date(r.release_date) > new Date()
        ).length,
      };

      setMetrics(calculatedMetrics);
      setInitiatives(processedInitiatives);
      setReleases(processedReleases);
    } catch (error) {
      console.error('Error loading product data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'done':
      case 'released':
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

  const getTierColor = (tier: string) => {
    return tier === 'major' 
      ? 'text-purple-600 bg-purple-50 border-purple-200'
      : 'text-indigo-600 bg-indigo-50 border-indigo-200';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-boh-bg-light dark:bg-boh-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cafe mx-auto"></div>
          <p className="mt-4 text-boh-text-sub-light dark:text-boh-text-sub">Loading Product Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-boh-bg-light dark:bg-boh-bg">
      {/* Header */}
      <div className="bg-boh-surface-light dark:bg-boh-surface border-b border-boh-border-light dark:border-boh-border">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-boh-text-light dark:text-boh-text">
                Product Management
              </h1>
              <p className="text-boh-text-sub-light dark:text-boh-text-sub mt-2">
                Monitor initiatives, releases, and product rollout across all applications
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/releases?scope=external')}
                className="px-4 py-2 bg-cafe text-white rounded-lg hover:bg-cafe-dark transition-colors"
              >
                External Releases
              </button>
              <button
                onClick={() => navigate('/releases?scope=internal')}
                className="px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors"
              >
                Internal Releases
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub">Active Initiatives</h3>
            <p className="text-2xl font-bold text-boh-text-light dark:text-boh-text mt-2">
              {metrics.activeInitiatives}
            </p>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">of {metrics.totalInitiatives} total</p>
          </div>
          
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub">Active Releases</h3>
            <p className="text-2xl font-bold text-boh-text-light dark:text-boh-text mt-2">
              {metrics.activeReleases}
            </p>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">of {metrics.totalReleases} total</p>
          </div>
          
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub">Internal Tickets</h3>
            <p className="text-2xl font-bold text-blue-600 mt-2">{metrics.internalTickets}</p>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">BOH applications</p>
          </div>
          
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub">External Tickets</h3>
            <p className="text-2xl font-bold text-green-600 mt-2">{metrics.externalTickets}</p>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">Customer-facing</p>
          </div>
        </div>

        {/* Product Rollout Section */}
        <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg shadow-md">
          <div className="p-6 border-b border-boh-border-light dark:border-boh-border">
            <h2 className="text-xl font-semibold text-boh-text-light dark:text-boh-text">Product Rollout</h2>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">Initiatives driving major and minor releases</p>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Active Initiatives */}
              <div>
                <h3 className="text-lg font-medium text-boh-text-light dark:text-boh-text mb-4">Active Initiatives</h3>
                <div className="space-y-3">
                  {initiatives.filter(i => i.status === 'in progress').slice(0, 5).map((initiative) => (
                    <div key={initiative.id} className="border border-boh-border-light dark:border-boh-border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-boh-text-light dark:text-boh-text">{initiative.title}</h4>
                          <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1 line-clamp-2">{initiative.description}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(initiative.status)}`}>
                              {initiative.status}
                            </span>
                            <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">{initiative.ticket_count} tickets</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {initiatives.filter(i => i.status === 'in progress').length === 0 && (
                    <p className="text-boh-text-sub-light dark:text-boh-text-sub text-center py-8">No active initiatives</p>
                  )}
                </div>
              </div>

              {/* Recent Releases */}
              <div>
                <h3 className="text-lg font-medium text-boh-text-light dark:text-boh-text mb-4">Recent Releases</h3>
                <div className="space-y-3">
                  {releases.slice(0, 5).map((release) => (
                    <div key={release.id} className="border border-boh-border-light dark:border-boh-border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-boh-text-light dark:text-boh-text">{release.version_label}</h4>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getTierColor(release.release_tier)}`}>
                              {release.release_tier}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(release.status)}`}>
                              {release.status}
                            </span>
                            <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">{release.ticket_count} tickets</span>
                            <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">{new Date(release.release_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {releases.length === 0 && (
                    <p className="text-boh-text-sub-light dark:text-boh-text-sub text-center py-8">No releases found</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            to="/product/initiatives"
            className="bg-boh-surface-light dark:bg-boh-surface rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-boh-text-light dark:text-boh-text">All Initiatives</h3>
                <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">Manage major release initiatives</p>
              </div>
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          <Link
            to="/releases"
            className="bg-boh-surface-light dark:bg-boh-surface rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-boh-text-light dark:text-boh-text">Release Management</h3>
                <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">Plan and track releases</p>
              </div>
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          <Link
            to="/counter/dashboard"
            className="bg-boh-surface-light dark:bg-boh-surface rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-boh-text-light dark:text-boh-text">Ticket Overview</h3>
                <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">View all tickets by context</p>
              </div>
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProductDashboard;
