import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { BOHShell, bohApps } from '../../boh/navigation';
import { useBohAccess } from '../../shared/hooks/useBohAccess';
import KeepSidebar from './components/KeepSidebar';
import KeepBrowserPage from './pages/KeepBrowserPage';
import KeepAdminPage from './pages/KeepAdminPage';
import KeepWhiteboardPage from './pages/KeepWhiteboardPage';
import KeepReviewQueuePage from './pages/KeepReviewQueuePage';

interface KeepAppProps {
  isAdmin?: boolean;
}

// Wrapper for workspace/gold_library folder browsing
const FolderBrowserWrapper: React.FC<{
  area: 'workspace' | 'gold_library';
  areaLabel: string;
}> = ({ area, areaLabel }) => {
  const { folderId, folderName } = useParams<{ folderId: string; folderName: string }>();

  // If no folderId, show root folders (parentId = null)
  // Otherwise show the specific folder
  return (
    <KeepBrowserPage
      folderId={folderId || null}
      folderName={folderName ? decodeURIComponent(folderName) : areaLabel}
      area={area}
      areaLabel={areaLabel}
    />
  );
};

const KeepApp: React.FC<KeepAppProps> = ({ isAdmin = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSuperAdmin } = useBohAccess();

  // Parse current route to determine area and folder
  const pathParts = location.pathname.replace('/keep/', '').split('/').filter(Boolean);
  const pathArea = pathParts[0];
  const currentArea = pathArea === 'workspace'
    ? 'workspace'
    : pathArea === 'gold-library'
      ? 'gold_library'
      : pathArea === 'whiteboard'
        ? 'whiteboard'
        : null;
  const urlFolderId = pathParts[1] || null;

  // Track active root folder for sidebar highlighting
  const [activeRootFolderId, setActiveRootFolderId] = useState<string | null>(null);
  const currentFolderId = urlFolderId || activeRootFolderId;

  const handleNavigate = (area: 'workspace' | 'gold_library', folderId: string, folderName: string, rootFolderId?: string) => {
    const encodedName = encodeURIComponent(folderName);
    const routePath = area === 'gold_library' ? 'gold-library' : area;
    navigate(`/keep/${routePath}/${folderId}/${encodedName}`);
    // Track root folder for sidebar highlighting
    if (rootFolderId) {
      setActiveRootFolderId(rootFolderId);
    }
  };

  const handleAreaClick = (area: 'workspace' | 'gold_library' | 'whiteboard') => {
    const routePath = area === 'gold_library' ? 'gold-library' : area;
    navigate(`/keep/${routePath}`);
  };

  return (
    <BOHShell 
      apps={bohApps} 
      isAdmin={isAdmin}
      sidebar={
        <KeepSidebar
          currentArea={currentArea}
          currentFolderId={currentFolderId}
          activeRootFolderId={activeRootFolderId}
          onNavigate={handleNavigate}
          onAreaClick={handleAreaClick}
          isSuperAdmin={isSuperAdmin}
          onAdminClick={() => navigate('/keep/admin')}
        />
      }
    >
      <Routes>
        {/* Default route - redirect to workspace landing */}
        <Route
          path="/"
          element={<Navigate to="/keep/workspace" replace />}
        />
        
        {/* Workspace root browser (shows top-level folders) */}
        <Route
          path="/workspace"
          element={<FolderBrowserWrapper area="workspace" areaLabel="Workspace" />}
        />

        {/* Gold Library root browser (shows top-level folders) */}
        <Route
          path="/gold-library"
          element={<FolderBrowserWrapper area="gold_library" areaLabel="Gold Library" />}
        />

        {/* Workspace folder browser (specific folder) */}
        <Route
          path="/workspace/:folderId/:folderName?"
          element={<FolderBrowserWrapper area="workspace" areaLabel="Workspace" />}
        />

        {/* Gold Library folder browser (specific folder) */}
        <Route
          path="/gold-library/:folderId/:folderName?"
          element={<FolderBrowserWrapper area="gold_library" areaLabel="Gold Library" />}
        />

        {/* Whiteboard */}
        <Route
          path="/whiteboard"
          element={<KeepWhiteboardPage />}
        />

        {/* Review Queue */}
        <Route
          path="/review-queue"
          element={<KeepReviewQueuePage />}
        />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            isSuperAdmin ? (
              <KeepAdminPage />
            ) : (
              <Navigate to="/keep/workspace" replace />
            )
          }
        />
        
        {/* Legacy vault route - redirect to gold-library */}
        <Route path="/vault/*" element={<Navigate to="/keep/gold-library" replace />} />
        <Route path="/vault" element={<Navigate to="/keep/gold-library" replace />} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/keep/workspace" replace />} />
      </Routes>
    </BOHShell>
  );
};

export default KeepApp;
