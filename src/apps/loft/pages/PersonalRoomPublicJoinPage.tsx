import React from 'react';
import { useParams } from 'react-router-dom';
import PersonalRoomGuestGate from '../../../../imports/upstream-apps/loft-app/src/components/Loft/PersonalRoomPage/components/PersonalRoomGuestGate';
import '../../../../imports/upstream-apps/loft-app/index.css';

const PersonalRoomPublicJoinPage: React.FC = () => {
  const { tenantSlug = '', slug = '' } = useParams();
  const normalizedTenantSlug = tenantSlug.toLowerCase().replace(/[^a-z0-9-_]/g, '');
  const normalizedSlug = slug.toLowerCase().replace(/[^a-z0-9-_]/g, '');

  const handleNavigate = (path: string) => {
    const nextPath = path.startsWith('/') ? path : `/${path}`;
    window.location.hash = nextPath;
  };

  return (
    <div className="loft-shell loft-scope min-h-screen w-full overflow-hidden bg-[var(--loft-bg)] text-main dark:text-white">
      <PersonalRoomGuestGate onNavigate={handleNavigate} slug={normalizedSlug} tenantSlug={normalizedTenantSlug} />
    </div>
  );
};

export default PersonalRoomPublicJoinPage;
