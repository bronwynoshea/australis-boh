import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { acceptBohInvite } from '../../../boh/api/bohApi';

const AcceptInvitePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid invite link. No token provided.');
      return;
    }

    async function acceptInvite() {
      try {
        await acceptBohInvite({ token });
        setStatus('success');
        setMessage('Invite accepted! Redirecting to dashboard...');
        // Redirect after a short delay
        setTimeout(() => {
          navigate('/boh');
        }, 2000);
      } catch (error) {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Failed to accept invite');
      }
    }

    acceptInvite();
  }, [token, navigate]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      textAlign: 'center'
    }}>
      {status === 'loading' && (
        <>
          <h1>Accepting invite...</h1>
          <p>Please wait while we set up your access.</p>
        </>
      )}
      
      {status === 'success' && (
        <>
          <h1 style={{ color: 'var(--success-color, green)' }}>✓ Invite Accepted</h1>
          <p>{message}</p>
        </>
      )}
      
      {status === 'error' && (
        <>
          <h1 style={{ color: 'var(--error-color, red)' }}>✗ Error</h1>
          <p>{message}</p>
          <button 
            className="btn btn-primary" 
            onClick={() => navigate('/boh/login')}
            style={{ marginTop: '1rem' }}
          >
            Go to Login
          </button>
        </>
      )}
    </div>
  );
};

export default AcceptInvitePage;


