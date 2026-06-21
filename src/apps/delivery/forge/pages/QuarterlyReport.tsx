import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfQuarter, endOfQuarter, isWithinInterval } from 'date-fns';

interface QuarterlyMetrics {
  quarter: string;
  year: number;
  totalReleases: number;
  majorReleases: number;
  minorReleases: number;
  totalTickets: number;
  internalTickets: number;
  externalTickets: number;
  initiativesCompleted: number;
  initiativesInProgress: number;
  releaseVelocity: number;
  averageCycleTime: number;
}

interface Initiative {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on-hold';
  targetQuarter: string;
  targetYear: number;
  progress: number;
  owner_user_id: string;
  releases: string[];
  tickets: number;
}

interface Release {
  id: string;
  name: string;
  version: string;
  type: 'major' | 'minor' | 'patch';
  status: 'planned' | 'in-progress' | 'released' | 'deprecated';
  releaseDate: string;
  quarter: string;
  year: number;
  tickets: number;
  app?: string;
  environment: 'internal' | 'external';
  initiative?: string;
}

const QuarterlyReport: React.FC = () => {
  const [selectedQuarter, setSelectedQuarter] = useState<string>('Q1');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'json'>('pdf');

  // Mock data - replace with API calls
  const metrics: QuarterlyMetrics = {
    quarter: selectedQuarter,
    year: selectedYear,
    totalReleases: 12,
    majorReleases: 3,
    minorReleases: 9,
    totalTickets: 156,
    internalTickets: 42,
    externalTickets: 114,
    initiativesCompleted: 5,
    initiativesInProgress: 8,
    releaseVelocity: 2.3,
    averageCycleTime: 14.5,
  };

  const initiatives: Initiative[] = [
    {
      id: '1',
      name: 'Customer Portal Enhancement',
      description: 'Complete overhaul of the customer portal with modern UI and improved performance.',
      status: 'active',
      targetQuarter: selectedQuarter,
      targetYear: selectedYear,
      progress: 100,
      owner_user_id: 'demo-user-1',
      releases: ['Darjeeling v1.3.0', 'Earl Grey v1.3.1'],
      tickets: 24,
    },
    {
      id: '2',
      name: 'Mobile App Development',
      description: 'Native mobile applications for iOS and Android platforms.',
      status: 'active',
      targetQuarter: selectedQuarter,
      targetYear: selectedYear,
      progress: 75,
      owner_user_id: 'demo-user-2',
      releases: ['Oolong v2.1.0'],
      tickets: 18,
    },
    {
      id: '3',
      name: 'Backend API Refactoring',
      description: 'Comprehensive refactoring of the backend API for better scalability.',
      status: 'active',
      targetQuarter: selectedQuarter,
      targetYear: selectedYear,
      progress: 60,
      owner_user_id: 'demo-user-3',
      releases: [],
      tickets: 31,
    },
  ];

  const releases: Release[] = [
    {
      id: '1',
      name: 'Darjeeling',
      version: 'v1.3.0',
      type: 'major',
      status: 'released',
      releaseDate: '2026-01-15',
      quarter: selectedQuarter,
      year: selectedYear,
      tickets: 8,
      app: 'Loft',
      environment: 'internal',
      initiative: 'AI-Powered Matching System',
    },
    {
      id: '2',
      name: 'Earl Grey',
      version: 'v1.3.1',
      type: 'minor',
      status: 'released',
      releaseDate: '2026-01-28',
      quarter: selectedQuarter,
      year: selectedYear,
      tickets: 12,
      app: 'Loft',
      environment: 'internal',
      initiative: 'AI-Powered Matching System',
    },
    {
      id: '3',
      name: 'Oolong',
      version: 'v2.1.0',
      type: 'minor',
      status: 'released',
      releaseDate: '2026-02-10',
      quarter: selectedQuarter,
      year: selectedYear,
      tickets: 15,
      app: 'Tablez',
      environment: 'external',
      initiative: 'Enhanced Communication Suite',
    },
  ];

  const handleExport = () => {
    // Implementation for export functionality
    console.log(`Exporting ${selectedQuarter} ${selectedYear} report as ${exportFormat}`);
    
    switch (exportFormat) {
      case 'pdf':
        // Generate PDF report
        break;
      case 'csv':
        // Generate CSV report
        break;
      case 'json':
        // Generate JSON report
        break;
    }
  };

  return (
    <div className="min-h-screen bg-boh-bg-light dark:bg-boh-bg">
      {/* Header */}
      <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg p-6 w-full max-w-md border border-boh-border-light dark:border-boh-border shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Link
                  to="/forge"
                  className="text-sm text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-primary transition-colors"
                >
                  Forge
                </Link>
                <svg className="w-4 h-4 text-boh-text-sub-light dark:text-boh-text-sub" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-sm text-boh-text-light dark:text-boh-text font-medium">Quarterly Report</span>
              </div>
              <h1 className="text-4xl font-bold text-boh-text-light dark:text-boh-text mb-2">
                Quarterly Report
              </h1>
              <p className="text-boh-text-sub-light dark:text-boh-text-sub text-lg">
                Comprehensive analysis of product performance and release metrics
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'csv' | 'json')}
                className="px-4 py-2 text-sm font-medium text-boh-text-light dark:text-boh-text bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-lg hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors"
              >
                <option value="pdf">Export as PDF</option>
                <option value="csv">Export as CSV</option>
                <option value="json">Export as JSON</option>
              </select>
              
              <button
                onClick={handleExport}
                className="px-4 py-2 text-sm font-medium text-white bg-boh-primary border border-boh-primary rounded-lg hover:bg-boh-primary-dark transition-colors"
              >
                Export Report
              </button>
            </div>
          </div>

          {/* Quarter/Year Selector */}
          <div className="flex items-center gap-4">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full border border-boh-border-light dark:border-boh-border rounded-lg px-3 py-2 bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:ring-2 focus:ring-boh-primary focus:border-boh-primary"
            >
              <option value={2024}>2024</option>
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
            </select>

            <div className="flex items-center gap-2 bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-lg p-1">
              {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
                <button
                  key={q}
                  onClick={() => setSelectedQuarter(q)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    selectedQuarter === q
                      ? 'bg-boh-primary text-white'
                      : 'text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:hover:text-boh-text'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Executive Summary */}
        <div className="bg-boh-primary rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-8 text-white">
            <h2 className="text-2xl font-bold mb-4">
              {selectedQuarter} {selectedYear} Executive Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="text-indigo-100 text-sm mb-1">Total Releases</p>
                <p className="text-3xl font-bold">{metrics.totalReleases}</p>
                <p className="text-indigo-200 text-sm mt-1">
                  {metrics.majorReleases} major, {metrics.minorReleases} minor
                </p>
              </div>
              <div>
                <p className="text-indigo-100 text-sm mb-1">Total Tickets</p>
                <p className="text-3xl font-bold">{metrics.totalTickets}</p>
                <p className="text-indigo-200 text-sm mt-1">
                  {metrics.internalTickets} internal, {metrics.externalTickets} external
                </p>
              </div>
              <div>
                <p className="text-indigo-100 text-sm mb-1">Initiatives</p>
                <p className="text-3xl font-bold">{metrics.initiativesCompleted + metrics.initiativesInProgress}</p>
                <p className="text-indigo-200 text-sm mt-1">
                  {metrics.initiativesCompleted} completed, {metrics.initiativesInProgress} in progress
                </p>
              </div>
              <div>
                <p className="text-indigo-100 text-sm mb-1">Release Velocity</p>
                <p className="text-3xl font-bold">{metrics.releaseVelocity}</p>
                <p className="text-indigo-200 text-sm mt-1">
                  {metrics.averageCycleTime} days avg cycle time
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Release Velocity"
            value={metrics.releaseVelocity.toString()}
            subtitle="releases per week"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
            trend="+12%"
            trendColor="text-green-600"
          />

          <MetricCard
            title="Cycle Time"
            value={metrics.averageCycleTime.toString()}
            subtitle="days average"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            trend="-8%"
            trendColor="text-green-600"
          />

          <MetricCard
            title="Ticket Resolution"
            value="89%"
            subtitle="resolved this quarter"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            trend="+5%"
            trendColor="text-green-600"
          />

          <MetricCard
            title="Initiative Completion"
            value={`${Math.round((metrics.initiativesCompleted / (metrics.initiativesCompleted + metrics.initiativesInProgress)) * 100)}%`}
            subtitle="on track"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            trend="+15%"
            trendColor="text-green-600"
          />
        </div>

        {/* Initiatives Section */}
        <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl shadow-lg">
          <div className="px-6 py-4 border-b border-boh-border-light dark:border-boh-border">
            <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">
              Initiative Performance
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {initiatives.map((initiative) => (
                <InitiativeRow key={initiative.id} initiative={initiative} />
              ))}
            </div>
          </div>
        </div>

        {/* Releases Section */}
        <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl shadow-lg">
          <div className="px-6 py-4 border-b border-boh-border-light dark:border-boh-border">
            <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">
              Release Details
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {releases.map((release) => (
                <ReleaseRow key={release.id} release={release} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Supporting Components

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  trend: string;
  trendColor: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, icon, trend, trendColor }) => {
  return (
    <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-6 shadow-lg">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-xl bg-boh-primary text-white shadow-lg">
          {icon}
        </div>
        <span className={`text-sm font-medium ${trendColor}`}>
          {trend}
        </span>
      </div>
      <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-1">
        {title}
      </p>
      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-bold text-boh-text-light dark:text-boh-text">
          {value}
        </p>
      </div>
      <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-2">
        {subtitle}
      </p>
    </div>
  );
};

interface InitiativeRowProps {
  initiative: Initiative;
}

const InitiativeRow: React.FC<InitiativeRowProps> = ({ initiative }) => {
  const getStatusColor = (status: Initiative['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-boh-text-sub';
      case 'active':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'on-hold':
        return 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300';
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-boh-bg-light dark:bg-boh-bg rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <h4 className="font-semibold text-boh-text-light dark:text-boh-text">
            {initiative.name}
          </h4>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(initiative.status)}`}>
            {initiative.status}
          </span>
        </div>
        <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-2">
          {initiative.description}
        </p>
        <div className="flex items-center gap-4 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
          <span>Owner: {initiative.owner_user?.full_name || initiative.owner_user?.email || 'Unassigned'}</span>
          <span>{initiative.releases.length} releases</span>
          <span>{initiative.tickets} tickets</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-medium text-boh-text-light dark:text-boh-text">
            {initiative.progress}%
          </div>
          <div className="w-24 bg-boh-bg dark:bg-boh-surface rounded-full h-2">
            <div
              className={`h-2 rounded-full bg-boh-primary transition-all duration-500 shadow-sm`}
              style={{ width: `${initiative.progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

interface ReleaseRowProps {
  release: Release;
}

const ReleaseRow: React.FC<ReleaseRowProps> = ({ release }) => {
  const getTypeColor = (type: Release['type']) => {
    switch (type) {
      case 'major':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'minor':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'patch':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-boh-text-sub';
    }
  };

  const getEnvironmentColor = (environment: Release['environment']) => {
    switch (environment) {
      case 'internal':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'external':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-boh-bg-light dark:bg-boh-bg rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <h4 className="font-semibold text-boh-text-light dark:text-boh-text">
            {release.name}
          </h4>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(release.type)}`}>
            {release.type}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getEnvironmentColor(release.environment)}`}>
            {release.environment}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
          <span>Version: {release.version}</span>
          <span>Released: {format(new Date(release.releaseDate), 'MMM d, yyyy')}</span>
          {release.app && <span>App: {release.app}</span>}
          {release.initiative && <span>Initiative: {release.initiative}</span>}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-medium text-boh-text-light dark:text-boh-text">
            {release.tickets}
          </div>
          <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
            tickets
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuarterlyReport;
