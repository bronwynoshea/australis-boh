import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BOHShell, bohApps } from '../../../boh/navigation';
import { useBohAccess } from '../../../shared/hooks/useBohAccess';

interface ExternalWorkspaceAppPageProps {
  isAdmin?: boolean;
}

const normalizeSlug = (value?: string | null) => value?.trim().toLowerCase() || '';

const ExternalWorkspaceAppPage: React.FC<ExternalWorkspaceAppPageProps> = ({ isAdmin = false }) => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { appsWithAccess, isLoading, error } = useBohAccess();
  const normalizedSlug = normalizeSlug(slug);

  const app = useMemo(() => {
    return appsWithAccess.find((candidate) => (
      normalizeSlug(candidate.slug) === normalizedSlug &&
      (candidate.app_kind === 'external' || candidate.type === 'external_app')
    ));
  }, [appsWithAccess, normalizedSlug]);

  const title = app?.name || 'External app';
  const externalUrl = app?.external_url || '';

  return (
    <BOHShell apps={bohApps} isAdmin={isAdmin} showContextualSidebar={false} flushContent>
      <div className="boh-external-app-shell">
        <header className="boh-external-app-header">
          <div>
            <p>Connected surface</p>
            <h1>{title}</h1>
          </div>
          <div className="boh-external-app-actions">
            <button type="button" className="boh-external-secondary-button" onClick={() => navigate('/boh')}>
              Back to BOH
            </button>
            {externalUrl && (
              <a className="boh-external-primary-button" href={externalUrl} target="_blank" rel="noopener noreferrer">
                Open fallback
              </a>
            )}
          </div>
        </header>

        <div className="boh-external-app-frame-wrap">
          {isLoading ? (
            <div className="boh-external-app-state">Loading workspace link…</div>
          ) : externalUrl ? (
            <iframe
              title={title}
              src={externalUrl}
              className="boh-external-app-frame"
              referrerPolicy="no-referrer-when-downgrade"
              sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-downloads"
            />
          ) : (
            <div className="boh-external-app-state">
              <h2>Workspace link unavailable</h2>
              <p>{error || 'This external app is not available for the current workspace.'}</p>
            </div>
          )}
        </div>
      </div>
    </BOHShell>
  );
};

export default ExternalWorkspaceAppPage;
