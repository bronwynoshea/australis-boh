import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const MenuPage: React.FC = () => {
  // Get Menu app ID
  const { data: menuApp } = useQuery({
    queryKey: ['menu-app'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('boh_app')
        .select('id')
        .eq('slug', 'menu')
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  // Load initiatives owned by Menu
  const { data: initiatives, isLoading, error } = useQuery({
    queryKey: ['menu-initiatives'],
    queryFn: async () => {
      // For now, return empty array if menu app not found
      const { data: menuAppData, error: menuAppError } = await supabase
        .from('boh_app')
        .select('id')
        .eq('slug', 'menu')
        .single();
      
      if (menuAppError) {
        console.warn('Menu app not found, using fallback');
        return [];
      }
      
      const { data, error } = await supabase
        .from('boh_initiative')
        .select(`
          *,
          owner_user:boh_user!boh_initiative_owner_user_id_fkey(
            id,
            full_name,
            email
          )
        `)
        .eq('app_id', menuAppData.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text dark:bg-boh-surface dark:text-boh-text';
      case 'in progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200';
      case 'blocked': return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200';
      case 'done': return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200';
      case 'cancelled': return 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-sub-light dark:text-boh-text-sub dark:bg-boh-surface dark:text-boh-text-sub';
      default: return 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text dark:bg-boh-surface dark:text-boh-text';
    }
  };

  return (
    <div className="min-h-screen bg-boh-bg-light dark:bg-boh-bg">
      {/* Header */}
      <div className="bg-boh-surface-light dark:bg-boh-surface border-b border-boh-border-light dark:border-boh-border shadow-sm">
        <div className="w-full px-8 py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 text-boh-text-sub-light dark:text-boh-text">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">Menu</span>
              </div>
              <h1 className="text-3xl font-bold text-boh-text-light dark:text-boh-text mb-2">Menu</h1>
              <p className="text-boh-text-sub-light dark:text-boh-text-sub">Strategy & Offerings</p>
            </div>
            
            <Link
              to="/menu/initiatives/new"
              className="px-4 py-2 bg-boh-primary text-white rounded-lg hover:bg-boh-primary/90 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Initiative
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Initiatives Section */}
          <div className="bg-boh-surface-light dark:bg-boh-surface border-boh-border-light dark:border-boh-border rounded-xl">
            <div className="p-6 border-b border-boh-border-light dark:border-boh-border">
              <h2 className="text-xl font-semibold text-boh-text-light dark:text-boh-text">
                Strategic Initiatives
              </h2>
              <p className="text-boh-text-sub-light dark:text-boh-text-sub mt-1">
                Define and manage strategic initiatives and business offerings
              </p>
            </div>

            <div className="p-6">
              {error ? (
                <div className="text-center py-8">
                  <div className="text-red-500 dark:text-red-400 mb-4">Error loading initiatives</div>
                  <button 
                    onClick={() => window.location.reload()} 
                    className="px-4 py-2 bg-boh-primary text-white rounded-lg hover:bg-boh-primary/90"
                  >
                    Retry
                  </button>
                </div>
              ) : isLoading ? (
                <div className="text-center py-8">
                  <div className="text-boh-text-sub-light dark:text-boh-text-sub">Loading initiatives...</div>
                </div>
              ) : initiatives && initiatives.length > 0 ? (
                <div className="space-y-4">
                  {initiatives.map((initiative) => (
                    <div
                      key={initiative.id}
                      className="border-boh-border-light dark:border-boh-border rounded-lg p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-medium text-boh-text-light dark:text-boh-text">
                              {initiative.title}
                            </h3>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(initiative.status)}`}>
                              {initiative.status}
                            </span>
                          </div>
                          
                          {initiative.description && (
                            <p className="text-boh-text-sub-light dark:text-boh-text-sub mb-3">
                              {initiative.description}
                            </p>
                          )}

                          <div className="flex items-center gap-4 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                            {initiative.target_quarter && initiative.target_year && (
                              <span>{initiative.target_quarter} {initiative.target_year}</span>
                            )}
                            {initiative.owner_user?.full_name && (
                              <span>Owner: {initiative.owner_user.full_name}</span>
                            )}
                            {initiative.progress !== undefined && (
                              <div className="flex items-center gap-2">
                                <span>Progress:</span>
                                <div className="w-24 h-2 bg-boh-surface-light dark:bg-boh-bg rounded-full">
                                  <div
                                    className="h-2 bg-boh-primary rounded-full"
                                    style={{ width: `${initiative.progress}%` }}
                                  />
                                </div>
                                <span>{initiative.progress}%</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          <Link
                            to={`/menu/initiatives/${initiative.id}/edit`}
                            className="px-3 py-1 text-sm border-boh-border-light dark:border-boh-border text-boh-text-light dark:text-boh-text rounded hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors"
                          >
                            Edit
                          </Link>
                          <Link
                            to={`/forge/workstreams/${initiative.id}`}
                            className="px-3 py-1 text-sm bg-boh-primary text-white rounded hover:bg-boh-primary/90 transition-colors"
                          >
                            View in Forge
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 text-boh-text-sub-light dark:text-boh-text-sub">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-boh-text-light dark:text-boh-text mb-2">
                    No Initiatives Yet
                  </h3>
                  <p className="text-boh-text-sub-light dark:text-boh-text-sub mb-6">
                    Start by creating your first strategic initiative to define what the business offers.
                  </p>
                  <Link
                    to="/menu/initiatives/new"
                    className="inline-flex items-center px-4 py-2 bg-boh-primary text-white rounded-lg hover:bg-boh-primary/90 transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Initiative
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuPage;
