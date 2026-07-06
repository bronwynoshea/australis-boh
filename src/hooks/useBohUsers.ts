import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentBohUserContext } from '../boh/api/bohApi';

export interface BohUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string;
}

export function useBohUsers() {
  const [users, setUsers] = useState<BohUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoading(true);
        const context = await getCurrentBohUserContext();
        if (!context?.tenant_id) {
          setUsers([]);
          setError('No BOH tenant matched the current session.');
          return;
        }

        const { data, error } = await supabase
          .from('boh_user')
          .select('id, first_name, last_name, email, status')
          .eq('tenant_id', context.tenant_id)
          .eq('app_context', 'boh')
          .eq('status', 'active')
          .order('first_name')
          .order('last_name');

        if (error) {
          console.error('Error loading BOH users:', error);
          setError(error.message);
          return;
        }

        setUsers(data || []);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error('Error loading BOH users:', err);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  return { users, isLoading, error };
}
