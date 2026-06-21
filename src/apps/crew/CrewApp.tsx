import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { BOHShell, bohApps } from '../../boh/navigation';
import CrewPage from './pages/CrewPage';

interface CrewAppProps {
  isAdmin?: boolean;
}

interface CrewErrorBoundaryProps {
  children?: React.ReactNode;
}

interface CrewErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class CrewErrorBoundary extends React.Component<CrewErrorBoundaryProps, CrewErrorBoundaryState> {
  declare props: Readonly<CrewErrorBoundaryProps>;

  state: CrewErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): CrewErrorBoundaryState {
    return {
      hasError: true,
      message: error.message,
    };
  }

  componentDidCatch(error: Error) {
    console.error('[CrewApp] Route render failed', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-12 text-center">
        <h3 className="text-xl font-semibold text-boh-text-light dark:text-boh-text mb-3">Crew is not ready yet</h3>
        <p className="text-boh-text-sub-light dark:text-boh-text-sub max-w-md mx-auto">
          The BOH shell is still active, but the Crew workspace could not render.
        </p>
        {this.state.message && (
          <p className="mt-4 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
            {this.state.message}
          </p>
        )}
      </div>
    );
  }
}

// Mobile header component for Crew
const CrewMobileHeader: React.FC = () => (
  <header className="lg:hidden flex items-center justify-between p-4 border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface">
    <div>
      <p className="text-xs uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">People</p>
      <h1 className="text-2xl font-bold text-boh-text-light dark:text-boh-text">Crew</h1>
      <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Team directory and skills</p>
    </div>
  </header>
);

// Desktop page header for Crew
const CrewPageHeader: React.FC = () => (
  <div className="hidden lg:block mb-6">
    <div>
      <p className="text-xs uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub mb-1">People</p>
      <h1 className="text-3xl font-semibold text-boh-text-light dark:text-boh-text">Crew</h1>
      <p className="text-boh-text-sub-light dark:text-boh-text-sub mt-1">Team directory and skills</p>
    </div>
  </div>
);

// Placeholder pages for Crew sub-routes
const TeamsPage: React.FC = () => (
  <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-12 text-center">
    <div className="w-16 h-16 mx-auto mb-6 text-boh-text-sub-light dark:text-boh-text-sub">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    </div>
    <h3 className="text-xl font-semibold text-boh-text-light dark:text-boh-text mb-3">Teams</h3>
    <p className="text-boh-text-sub-light dark:text-boh-text-sub max-w-md mx-auto">
      Team organization and structure will appear here.
    </p>
  </div>
);

const SchedulePage: React.FC = () => (
  <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-12 text-center">
    <div className="w-16 h-16 mx-auto mb-6 text-boh-text-sub-light dark:text-boh-text-sub">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
    <h3 className="text-xl font-semibold text-boh-text-light dark:text-boh-text mb-3">Schedule</h3>
    <p className="text-boh-text-sub-light dark:text-boh-text-sub max-w-md mx-auto">
      Team scheduling and availability will appear here.
    </p>
  </div>
);

const SkillsPage: React.FC = () => (
  <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-12 text-center">
    <div className="w-16 h-16 mx-auto mb-6 text-boh-text-sub-light dark:text-boh-text-sub">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    </div>
    <h3 className="text-xl font-semibold text-boh-text-light dark:text-boh-text mb-3">Skills</h3>
    <p className="text-boh-text-sub-light dark:text-boh-text-sub max-w-md mx-auto">
      Skills matrix and competency tracking will appear here.
    </p>
  </div>
);

const CrewApp: React.FC<CrewAppProps> = ({ isAdmin = false }) => {
  return (
    <BOHShell apps={bohApps} isAdmin={isAdmin} mobileHeader={<CrewMobileHeader />}>
      <CrewErrorBoundary>
        <CrewPageHeader />
        <Routes>
          <Route index element={<CrewPage />} />
          <Route path="directory" element={<CrewPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="skills" element={<SkillsPage />} />
          <Route path="*" element={<Navigate to="/crew" replace />} />
        </Routes>
      </CrewErrorBoundary>
    </BOHShell>
  );
};

export default CrewApp;
