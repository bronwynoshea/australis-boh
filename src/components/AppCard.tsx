import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppStatus, AppName } from '../types';
import { APP_PATHS } from '../constants';

interface AppCardProps {
  appName: AppName;
  title: string;
  subtitle: string;
  status: AppStatus;
  onRequestAccess?: () => void;
}

const AppCard: React.FC<AppCardProps> = ({ 
  appName, 
  title, 
  subtitle, 
  status,
  onRequestAccess 
}) => {
  const navigate = useNavigate();

  const getStatusText = () => {
    return status === 'granted' ? 'Access' : 'No Access';
  };

  const getButtonText = () => {
    if (status === 'pending') return 'Pending approval';
    if (status === 'granted') return 'Open';
    return 'Request access';
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (status === 'granted') {
      // Navigate to the app using React Router
      const path = APP_PATHS[appName];
      if (path) {
        navigate(path);
      }
      return;
    }
    if (status === 'pending') {
      return;
    }
    // Status is 'none' - request access
    if (onRequestAccess) {
      onRequestAccess();
    }
  };

  const cardId = appName === 'careerStudio' ? 'card-careerStudio' : `card-${appName}`;
  
  return (
    <div className="app-card" id={cardId}>
      <div className="card-header">
        <div>
          <div className="title">{title}</div>
          <div className="subtitle">{subtitle}</div>
        </div>
        <span className={`card-status status-${status === 'none' ? 'none' : status}`} data-app={appName}>
          {getStatusText()}
        </span>
      </div>
      <div className="card-footer">
        <button 
          type="button"
          className={`card-button ${status === 'pending' ? 'btn-disabled' : 'btn-primary'}`}
          data-app={appName}
          onClick={handleClick}
          disabled={status === 'pending'}
        >
          {getButtonText()}
        </button>
      </div>
    </div>
  );
};

export default AppCard;

