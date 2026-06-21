import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import type { Page, Ticket, Agent, CounterAppArea, CounterAppOption, CounterTicketPriority } from './types';
import CounterBottomNav from './layouts/CounterBottomNav';
import { BOHShell, bohApps } from '../../../boh/navigation';
import MyTicketsPage from './pages/MyTicketsPage';
import AllTicketsPage from './pages/AllTicketsPage';
import TicketDetailPage from './pages/TicketDetailPage';
import NewTicketPage from './pages/NewTicketPage';
import CounterDashboardPage from './pages/CounterDashboardPage';
import CounterInboxPage from './pages/CounterInboxPage';
import AgentsPage from './pages/AgentsPage';
import SettingsPage from './pages/SettingsPage';
import { supabase } from '../../../lib/supabase';
import { useBohAccess } from '../../../shared/hooks/useBohAccess';
import { fetchCounterApps, fetchTicketLookups, fetchTicketsForView, updateTicket as apiUpdateTicket } from './api/counterTicketsApi';

interface CounterAppProps {
  // Theme is now detected automatically from document.documentElement.classList
}

// Helper component to get ticket from route params
const TicketDetailWrapper: React.FC<{ agents: Agent[], onUpdateTicket: (ticket: Ticket) => void }> = ({ agents, onUpdateTicket }) => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTicket = async () => {
      if (!ticketId) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const { fetchTicketById } = await import('./api/counterTicketsApi');
        const loadedTicket = await fetchTicketById(ticketId);
        setTicket(loadedTicket);
      } catch (error) {
        console.error('Error loading ticket:', error);
        setTicket(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadTicket();
  }, [ticketId]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-boh-text-sub-light dark:text-boh-text-sub">Loading ticket...</div>
      </div>
    );
  }

  if (!ticket) {
    return <Navigate to="/counter/dashboard" replace />;
  }

  const handleLocalUpdate = (updated: Ticket) => {
    setTicket(updated);
    onUpdateTicket(updated);
  };

  return (
    <TicketDetailPage
      ticket={ticket}
      agents={agents}
      onBack={() => navigate(-1)}
      onUpdateTicket={handleLocalUpdate}
    />
  );
};

const CounterApp: React.FC<CounterAppProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSuperAdmin } = useBohAccess();

  // Lifted state for tickets and agents to allow for updates from child components.
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [appAreas, setAppAreas] = useState<CounterAppArea[]>([]);
  const [counterApps, setCounterApps] = useState<CounterAppOption[]>([]);
  const [priorityOptions, setPriorityOptions] = useState<CounterTicketPriority[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);

  // Load agents from BOH users so assignment & agent panels work
  const loadAgents = async () => {
    try {
      let query = await supabase
        .from('boh_user')
        .select('id, full_name, email, status, is_counter_agent');

      const hasCounterAgentFlag = query.error?.code !== '42703';

      if (query.error?.code === '42703') {
        query = await supabase
          .from('boh_user')
          .select('id, full_name, email, status');
      }

      const { data, error } = query;

      if (error) {
        console.error('Error loading agents (boh_user):', error);
        setAgents([]);
        return;
      }

      const mapped: Agent[] = (data || []).map((row: any) => {
        const isActive = row.status === 'active';
        return {
          id: row.id,
          bohUserId: row.id,
          name: row.full_name || row.email || 'Unknown user',
          email: row.email || '',
          role: 'Support',
          isActive,
          canReceiveTickets: isActive && (hasCounterAgentFlag ? row.is_counter_agent === true : true),
        } as Agent;
      });

      setAgents(mapped);
    } catch (err) {
      console.error('Unexpected error loading agents:', err);
      setAgents([]);
    }
  };

  const loadAppAreas = async () => {
    try {
      const { data, error } = await supabase
        .from('counter_app_area')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error loading Counter app areas:', error);
        setAppAreas([]);
        return;
      }

      setAppAreas((data || []) as CounterAppArea[]);
    } catch (err) {
      console.error('Unexpected error loading Counter app areas:', err);
      setAppAreas([]);
    }
  };

  const loadCounterApps = async () => {
    try {
      const apps = await fetchCounterApps();
      setCounterApps(apps);
    } catch (err) {
      console.error('Unexpected error loading Counter app lookup:', err);
      setCounterApps([]);
    }
  };

  const loadPriorityOptions = async () => {
    try {
      const lookups = await fetchTicketLookups();
      setPriorityOptions(lookups.priorities);
    } catch (err) {
      console.error('Unexpected error loading Counter priority lookup:', err);
      setPriorityOptions([]);
    }
  };

  // Check authentication on mount and when location changes
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const authenticated = session !== null;
      setIsAuthenticated(authenticated);
      
      if (!authenticated) {
        navigate('/boh/login');
      } else {
        // Fetch tickets and agents after authentication
        await Promise.all([loadTickets(), loadAgents(), loadAppAreas(), loadCounterApps(), loadPriorityOptions()]);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const authenticated = session !== null;
      setIsAuthenticated(authenticated);
      
      if (!authenticated) {
        navigate('/boh/login');
      } else {
        // Fetch tickets and agents after authentication
        Promise.all([loadTickets(), loadAgents(), loadAppAreas(), loadCounterApps(), loadPriorityOptions()]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  // Load tickets from API
  const loadTickets = async () => {
    try {
      setIsLoadingTickets(true);
      // Fetch all tickets for the dashboard and other views that need all tickets
      const { tickets: allTickets } = await fetchTicketsForView('all');
      setTickets(allTickets);
    } catch (error) {
      console.error('Error loading tickets:', error);
      // Set empty array on error
      setTickets([]);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  // Map route path to Page type for navigation highlighting
  // Remove /counter prefix from pathname for matching
  const getActivePageFromPath = (pathname: string): Page => {
    const path = pathname.replace(/^\/counter/, '') || '/';
    if (path === '/' || path === '/dashboard') return 'Dashboard';
    if (path === '/inbox') return 'Inbox';
    if (path === '/my') return 'My Tickets';
    if (path === '/all') return 'All Tickets';
    if (path === '/new') return 'New Ticket';
    if (path === '/agents') return 'Agents';
    if (path === '/settings') return 'Settings';
    // When viewing an individual ticket, keep the navigation context
    // in the tickets area. For now we treat ticket detail as part of
    // "My Tickets" so the sidebar highlight stays on My Tickets.
    if (path.startsWith('/tickets/')) {
      return 'My Tickets';
    }
    return 'Dashboard';
  };

  const activePage = getActivePageFromPath(location.pathname);
  // Hide bottom nav on the new ticket page (Sadie intake)
  const hideBottomNav = location.pathname === '/counter/new' || location.pathname.endsWith('/new');

  const navigateTo = (page: Page) => {
    const routeMap: Record<Page, string> = {
      'Dashboard': '/counter/dashboard',
      'Inbox': '/counter/inbox',
      'My Tickets': '/counter/my',
      'All Tickets': '/counter/all',
      'New Ticket': '/counter/new',
      'Agents': '/counter/agents',
      'Settings': '/counter/settings',
    };
    navigate(routeMap[page] || '/counter/dashboard');
  };

  const viewTicketDetail = (ticket: Ticket) => {
    navigate(`/counter/tickets/${ticket.id}`);
  };

  const handleUpdateTicket = async (updatedTicket: Ticket) => {
    try {
      const saved = await apiUpdateTicket(updatedTicket.id, updatedTicket);
      setTickets(currentTickets =>
        currentTickets.map(t => (t.id === saved.id ? saved : t))
      );
    } catch (error) {
      console.error('Error updating ticket:', error);
      // On error, reload tickets from server to avoid stale local state
      await loadTickets();
    }
  };
  
  const handleUpdateAgent = (updatedAgent: Agent) => {
    // TODO: This will later trigger a Supabase update for the agent.
    setAgents(currentAgents =>
      currentAgents.map(a => (a.id === updatedAgent.id ? updatedAgent : a))
    );
    console.log('Agent updated in state:', updatedAgent);
  };
  
  const handleAddAgent = (newAgent: Omit<Agent, 'id'>) => {
    // TODO: This will later trigger a Supabase insert and return the new agent with an ID.
    const agentWithId = { ...newAgent, id: `agent-${Date.now()}` };
    setAgents(currentAgents => [...currentAgents, agentWithId]);
    console.log('Agent added in state:', agentWithId);
  };

  const navigateToAllTicketsWithFilter = (filterType: string, value: any) => {
    const params = new URLSearchParams();
    if (filterType && value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(item => params.append(filterType, String(item)));
      } else {
        params.set(filterType, String(value));
      }
    }
    const query = params.toString();
    navigate(query ? `/counter/all?${query}` : '/counter/all');
  };

  // Mobile header component for Counter
  const CounterMobileHeader: React.FC = () => (
    <header className="lg:hidden flex items-center justify-between p-4 border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface">
      <div>
        <p className="text-xs uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">Support</p>
        <h1 className="text-2xl font-bold text-boh-text-light dark:text-boh-text">Counter</h1>
        <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Ticket management</p>
      </div>
      <Link
        to="/counter/new"
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-boh-primary text-white font-medium hover:bg-boh-primary-dark transition-colors shadow-sm"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className="text-sm">New</span>
      </Link>
    </header>
  );

  // Desktop page header for Counter
  const CounterPageHeader: React.FC = () => (
    <div className="hidden lg:block mb-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub mb-1">Support</p>
          <h1 className="text-3xl font-semibold text-boh-text-light dark:text-boh-text">Counter</h1>
          <p className="text-boh-text-sub-light dark:text-boh-text-sub mt-1">Ticket management</p>
        </div>
        <Link
          to="/counter/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-boh-primary text-white font-medium hover:bg-boh-primary-dark transition-colors shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Ticket
        </Link>
      </div>
    </div>
  );

  // Show nothing while checking authentication
  if (isAuthenticated === null) {
    return null;
  }

  // If not authenticated, the useEffect will redirect, but show nothing in the meantime
  if (!isAuthenticated) {
    return null;
  }

  return (
    <BOHShell apps={bohApps} isAdmin={isSuperAdmin} mobileHeader={<CounterMobileHeader />}>
      <CounterPageHeader />
      <Routes>
        <Route path="/" element={<Navigate to="/counter/dashboard" replace />} />
        <Route path="dashboard" element={<CounterDashboardPage tickets={tickets} appAreas={appAreas} counterApps={counterApps} priorityOptions={priorityOptions} onTicketSelect={viewTicketDetail} navigateToAllTicketsWithFilter={navigateToAllTicketsWithFilter} isLoading={isLoadingTickets} />} />
        <Route path="inbox" element={<CounterInboxPage tickets={tickets} agents={agents} onUpdateTicket={handleUpdateTicket} />} />
        <Route path="my" element={<MyTicketsPage agents={agents} onTicketSelect={viewTicketDetail} />} />
        <Route path="all" element={<AllTicketsPage agents={agents} onTicketSelect={viewTicketDetail} onUpdateTicket={handleUpdateTicket} />} />
        <Route path="new" element={<NewTicketPage />} />
        <Route path="tickets/:ticketId" element={<TicketDetailWrapper agents={agents} onUpdateTicket={handleUpdateTicket} />} />
        <Route path="agents" element={<AgentsPage agents={agents} onAddAgent={handleAddAgent} onUpdateAgent={handleUpdateAgent} />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/counter/dashboard" replace />} />
      </Routes>
      {/* Mobile nav - hidden on new ticket page */}
      {!hideBottomNav && <CounterBottomNav activePage={activePage} setActivePage={navigateTo} />}
    </BOHShell>
  );
};

export default CounterApp;
