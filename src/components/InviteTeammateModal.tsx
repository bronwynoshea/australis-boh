import React, { useState, useEffect } from 'react';
import type { BohUser } from '../types';
import { fetchBohApps } from '../boh/api/bohApi';
import type { BohApp } from '../boh/api/bohApi';

interface InviteTeammateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string, role: BohUser['role'], apps: string[]) => void;
  canManageApps?: boolean; // Whether user can select apps (super_admin or admin)
}

const InviteTeammateModal: React.FC<InviteTeammateModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit,
  canManageApps = true 
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<BohUser['role'] | ''>('');
  const [emailValidation, setEmailValidation] = useState('');
  const [roleValidation, setRoleValidation] = useState('');
  const [availableApps, setAvailableApps] = useState<BohApp[]>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>([]); // Will be set from database
  const [isLoadingApps, setIsLoadingApps] = useState(false);

  const roles: BohUser['role'][] = ['Admin', 'Support', 'Viewer'];

  // Load available apps when modal opens
  useEffect(() => {
    if (isOpen && canManageApps) {
      setIsLoadingApps(true);
      fetchBohApps()
        .then((apps) => {
          setAvailableApps(apps);
          // Select all available apps by default for new invites
          const allAppSlugs = apps.map(app => app.slug);
          setSelectedApps(allAppSlugs);
        })
        .catch((err) => {
          console.error('Error loading apps:', err);
        })
        .finally(() => {
          setIsLoadingApps(false);
        });
    }
  }, [isOpen, canManageApps]);

  const validateForm = () => {
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isRoleSelected = !!role;
    const hasAppsSelected = !canManageApps || selectedApps.length > 0;

    setEmailValidation(isEmailValid ? '' : 'Please enter a valid email');
    setRoleValidation(isRoleSelected ? '' : 'Please select a role');

    return isEmailValid && isRoleSelected && hasAppsSelected;
  };

  const handleToggleApp = (appSlug: string) => {
    setSelectedApps((prev) =>
      prev.includes(appSlug)
        ? prev.filter((slug) => slug !== appSlug)
        : [...prev, appSlug]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm() && role) {
      onSubmit(email, role, selectedApps);
      setEmail('');
      setRole('');
      setSelectedApps([]);
      setEmailValidation('');
      setRoleValidation('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className={`modal-backdrop ${isOpen ? 'visible' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header" style={{ textAlign: 'left' }}>
            <h3>Invite a teammate</h3>
            <p>Invite a new user to Back of House.</p>
          </div>
          <div className="modal-body" style={{ gap: 0 }}>
            <div className="form-group">
              <label htmlFor="invite-email">Email</label>
              <input 
                type="email" 
                id="invite-email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailValidation('');
                }}
                required
              />
              <div className="validation-message">{emailValidation}</div>
            </div>
            <div className="form-group">
              <label>Role</label>
              <div className="role-selector">
                {roles.map(r => (
                  <div
                    key={r}
                    className={`role-option ${role === r ? 'selected' : ''}`}
                    onClick={() => {
                      setRole(r);
                      setRoleValidation('');
                    }}
                  >
                    {r}
                  </div>
                ))}
              </div>
              <input type="hidden" value={role} required />
              <div className="validation-message">{roleValidation}</div>
            </div>
            
            {canManageApps && (
              <div className="form-group">
                <label>Initial App Access</label>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Select which apps this user will have access to when they accept the invite.
                </p>
                {isLoadingApps ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Loading apps...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {availableApps.map((app) => (
                      <label
                        key={app.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          cursor: 'pointer',
                          padding: '0.5rem',
                          borderRadius: '4px',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedApps.includes(app.slug)}
                          onChange={() => handleToggleApp(app.slug)}
                          style={{ cursor: 'pointer' }}
                        />
                        <span>{app.name || app.slug}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <p className="form-group note" style={{ marginTop: 0 }}>
              We'll send them an email with a secure link to set up their BOH access.
            </p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Send Invite</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InviteTeammateModal;

