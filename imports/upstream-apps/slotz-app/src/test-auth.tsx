import { useEffect, useState } from 'react';
import { supabase } from './services/supabaseClient';

export function TestAuth() {
  const [status, setStatus] = useState('Testing connection...');

  useEffect(() => {
    const test = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          setStatus(`❌ Error: ${error.message}`);
        } else {
          setStatus(`✅ Connected! User: ${data.session?.user?.email || 'Not logged in'}`);
        }
      } catch (err) {
        setStatus(`❌ Connection failed: ${err}`);
      }
    };
    test();
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>Slotz - Supabase Connection Test</h1>
      <p>{status}</p>
    </div>
  );
}
