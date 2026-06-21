import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface BohUser {
  id: string;
  full_name: string | null;
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
        const { data, error } = await supabase
          .from('boh_user')
          .select('id, full_name, email, status')
          .eq('status', 'active')
          .order('full_name');

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
