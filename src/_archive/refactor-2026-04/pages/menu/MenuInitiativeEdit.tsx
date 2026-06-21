import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

interface Initiative {
  id: string;
  title: string;
  description: string;
  status: string;
  target_start_date?: string;
  target_end_date?: string;
  target_quarter?: string;
  target_year?: number;
  priority_id?: string;
  owner_user_id?: string;
  tags?: string[];
  progress?: number;
}

const MenuInitiativeEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<Initiative>>({
    title: '',
    description: '',
    status: 'planned',
    target_quarter: 'Q1',
    target_year: new Date().getFullYear(),
    tags: [],
    progress: 0
  });
  const [isLoading, setIsLoading] = useState(false);

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

  // Load existing initiative
  const { data: initiative, isLoading: loadingInitiative } = useQuery({
    queryKey: ['initiative', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('boh_initiative')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  useEffect(() => {
    if (initiative) {
      setFormData(initiative);
    }
  }, [initiative]);

  const saveInitiative = useMutation({
    mutationFn: async (data: Partial<Initiative>) => {
      if (!menuApp?.id) throw new Error('Menu app not found');
      
      const initiativeData = {
        ...data,
        app_id: menuApp.id,
        updated_at: new Date().toISOString()
      };

      if (id) {
        // Update existing initiative
        const { data: result, error } = await supabase
          .from('boh_initiative')
          .update(initiativeData)
          .eq('id', id)
          .select()
          .single();
        
        if (error) throw error;
        return result;
      } else {
        // Create new initiative
        const { data: result, error } = await supabase
          .from('boh_initiative')
          .insert({
            ...initiativeData,
            created_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (error) throw error;
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['initiatives'] });
      queryClient.invalidateQueries({ queryKey: ['initiative', id] });
      navigate('/menu');
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await saveInitiative.mutateAsync(formData);
    } catch (error) {
      console.error('Error saving initiative:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingInitiative) {
    return (
      <div className="min-h-screen bg-boh-bg-light dark:bg-boh-bg flex items-center justify-center">
        <div className="text-boh-text-light dark:text-boh-text">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-boh-bg-light dark:bg-boh-bg">
      {/* Header */}
      <div className="bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-surface border-b border-boh-border-light dark:border-boh-border shadow-sm">
        <div className="w-full px-8 py-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-4 h-4 text-boh-text-sub-light dark:text-boh-text">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">Menu</span>
          </div>
          <h1 className="text-3xl font-bold text-boh-text-light dark:text-boh-text mb-2">
            {id ? 'Edit Initiative' : 'New Initiative'}
          </h1>
          <p className="text-boh-text-sub-light dark:text-boh-text-sub">
            Define strategic initiatives and offerings
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="w-full px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-6">
              <h2 className="text-xl font-semibold text-boh-text-light dark:text-boh-text mb-4">
                Basic Information
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status || 'planned'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary"
                    >
                      <option value="planned">Planned</option>
                      <option value="in progress">In Progress</option>
                      <option value="blocked">Blocked</option>
                      <option value="done">Done</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
                      Progress
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={formData.progress || 0}
                        onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) })}
                        className="flex-1"
                      />
                      <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub w-12">
                        {formData.progress || 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-6">
              <h2 className="text-xl font-semibold text-boh-text-light dark:text-boh-text mb-4">
                Timeline
              </h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
                    Target Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.target_start_date || ''}
                    onChange={(e) => setFormData({ ...formData, target_start_date: e.target.value })}
                    className="w-full px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
                    Target End Date
                  </label>
                  <input
                    type="date"
                    value={formData.target_end_date || ''}
                    onChange={(e) => setFormData({ ...formData, target_end_date: e.target.value })}
                    className="w-full px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
                    Quarter
                  </label>
                  <select
                    value={formData.target_quarter || 'Q1'}
                    onChange={(e) => setFormData({ ...formData, target_quarter: e.target.value })}
                    className="w-full px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary"
                  >
                    <option value="Q1">Q1</option>
                    <option value="Q2">Q2</option>
                    <option value="Q3">Q3</option>
                    <option value="Q4">Q4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
                    Year
                  </label>
                  <input
                    type="number"
                    value={formData.target_year || new Date().getFullYear()}
                    onChange={(e) => setFormData({ ...formData, target_year: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 bg-boh-primary text-white rounded-lg hover:bg-boh-primary/90 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : (id ? 'Update Initiative' : 'Create Initiative')}
              </button>
              
              <button
                type="button"
                onClick={() => navigate('/menu')}
                className="px-6 py-2 border border-boh-border-light dark:border-boh-border text-boh-text-light dark:text-boh-text rounded-lg hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MenuInitiativeEdit;
