import React, { useState } from 'react';

interface SetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (roles: string[], apps: string[]) => void;
}

const SetupWizardModal: React.FC<SetupWizardModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [step, setStep] = useState(1);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);

  const roles = ['Support', 'Advisor', 'Operations', 'Marketing'];
  const apps = [
    { value: 'counter', label: 'Counter' },
    { value: 'menu', label: 'Menu' },
    { value: 'patron', label: 'Patron' }
  ];

  const handleRoleToggle = (role: string) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleAppToggle = (app: string) => {
    setSelectedApps(prev => 
      prev.includes(app) 
        ? prev.filter(a => a !== app)
        : [...prev, app]
    );
  };

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = () => {
    onSubmit(selectedRoles, selectedApps);
    onClose();
    setStep(1);
    setSelectedRoles([]);
    setSelectedApps([]);
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
        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="modal-step active">
            <h2>Welcome to Back of House</h2>
            <p>We'll help you choose your internal role and which apps you need access to.</p>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={handleNext}>Start setup</button>
            </div>
          </div>
        )}

        {/* Step 2: Roles */}
        {step === 2 && (
          <div className="modal-step active">
            <h2>Which internal roles apply to you?</h2>
            <div className="checkbox-group">
              {roles.map(role => (
                <label key={role} className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={selectedRoles.includes(role)}
                    onChange={() => handleRoleToggle(role)}
                  />
                  {role}
                </label>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handlePrev}>Back</button>
              <button className="btn btn-primary" onClick={handleNext}>Next</button>
            </div>
          </div>
        )}

        {/* Step 3: Apps */}
        {step === 3 && (
          <div className="modal-step active">
            <h2>Which apps do you need access to?</h2>
            <div className="checkbox-group">
              {apps.map(app => (
                <label key={app.value} className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={selectedApps.includes(app.value)}
                    onChange={() => handleAppToggle(app.value)}
                  />
                  {app.label}
                </label>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handlePrev}>Back</button>
              <button className="btn btn-primary" onClick={handleNext}>Next</button>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="modal-step active">
            <h2>Review your selections</h2>
            <div className="review-section">
              <h4>Selected Roles</h4>
              <ul className="review-list">
                {selectedRoles.length > 0 ? (
                  selectedRoles.map(role => <li key={role}>{role}</li>)
                ) : (
                  <li>No roles selected</li>
                )}
              </ul>
            </div>
            <div className="review-section">
              <h4>Selected Apps</h4>
              <ul className="review-list">
                {selectedApps.length > 0 ? (
                  selectedApps.map(app => {
                    const appLabel = apps.find(a => a.value === app)?.label || app;
                    return <li key={app}>{appLabel}</li>;
                  })
                ) : (
                  <li>No apps selected</li>
                )}
              </ul>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handlePrev}>Back</button>
              <button className="btn btn-primary" onClick={handleSubmit}>Submit for approval</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupWizardModal;

