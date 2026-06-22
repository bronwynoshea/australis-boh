
import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Home, User, CircleUser, Plus, LayoutGrid, Sun, Moon, ChevronLeft, ChevronRight, LogOut, UserPlus, Video, Shield, Clock, CheckCircle, Sparkles, Menu, X } from 'lucide-react';
import { supabase } from './services/supabaseClient';
import { isMobile, isStandalonePwa } from './src/utils/pwa';
import { useSupabaseUser } from './services/supabaseApi';

const LoftLobbyPage = lazy(() => import('./src/components/Loft/LoftLobbyPage'));
const LoftLandingPage = lazy(() => import('./src/components/Loft/LoftLandingPage'));
const LoftRoomForm = lazy(() => import('./src/components/Loft/LoftRoomForm'));
const LoftRoomPage = lazy(() => import('./src/components/Loft/LoftRoomPage'));
import PersonalRoomLandingPage from './src/components/Loft/PersonalRoomPage/components/PersonalRoomLandingPage';
import PersonalRoomHostGate from './src/components/Loft/PersonalRoomPage/components/PersonalRoomHostGate';
import PersonalRoomGuestGate from './src/components/Loft/PersonalRoomPage/components/PersonalRoomGuestGate';
import PersonalRoomPage from './src/components/Loft/PersonalRoomPage';
const MyLoftPage = lazy(() => import('./src/components/Loft/MyLoftPage'));
const LoftProfilePage = lazy(() => import('./src/components/Loft/LoftProfilePage'));
const AdminHostApplications = lazy(() => import('./src/components/Loft/AdminHostApplications'));
const AdminPersonalTables = lazy(() => import('./src/components/Loft/AdminPersonalTables'));
const HostApplicationForm = lazy(() => import('./src/components/Loft/HostApplicationForm'));
const LoftLoginPage = lazy(() => import('./src/pages/LoftLogin'));
const GuestThankYouPage = lazy(() => import('./src/components/Loft/GuestThankYouPage'));
const AnimatedBackgroundBlobs = lazy(() => import('./src/components/Loft/AnimatedBackgroundBlobs'));
// DailyRedirect component removed - using direct navigation instead

const LoftIcon = ({ className = "w-5 h-5" }: { className?: string }) => {
  return (
    <>
      <img src="/brand/loft-icon-signal-final-light.svg" alt="Loft" className={`${className} dark:hidden`} />
      <img src="/brand/loft-icon-signal-final-dark.svg" alt="Loft" className={`${className} hidden dark:block`} />
    </>
  );
};

const App = () => {
  // ✅ FIXED - Only get profile once, with proper memoization
  const { user, profile: rawProfile, isLoading: isUserLoading } = useSupabaseUser();
  const profile = useMemo(() => {
    // Only return profile when it's fully loaded
    if (!rawProfile?.id) return rawProfile;
    return rawProfile;
  }, [rawProfile]);
  const [currentPath, setCurrentPath] = useState('/');
  
  // 🔥 DEBUG: Track profile changes and path changes (commented out for production)
  // useEffect(() => {
  //   if (profile?.id) { // Only log when profile is actually loaded
  //     console.log('🔥🔥🔥 APP - Profile changed:', {
  //       id: profile?.id,
  //       name: profile?.name,
  //       timestamp: Date.now()
  //     });
  //   }
  // }, [profile]);
  
  // useEffect(() => {
  //   console.log('🔥🔥🔥 APP - Path changed:', {
  //     currentPath,
  //     timestamp: Date.now()
  //   });
  // }, [currentPath]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [showHostApplication, setShowHostApplication] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('loft-theme');
    return saved ? saved === 'dark' : true; 
  });
  const getProfileFlag = (camelKey: string, snakeKey: string) =>
    !!((profile as any)?.[camelKey] ?? (profile as any)?.[snakeKey]);
  const getProfileString = (camelKey: string, snakeKey: string) => {
    const value = (profile as any)?.[camelKey] ?? (profile as any)?.[snakeKey];
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
  };

  const canHost = profile?.can_host_loft ?? false;
  const isLoadingProfile = isUserLoading;
  const canUsePersonalRoom =
    getProfileFlag('canUsePersonalRoom', 'can_use_personal_room') ||
    !!getProfileString('personalRoomSlug', 'personal_room_slug') ||
    !!getProfileString('personalRoomId', 'personal_room_id');
  const isLoftAdmin = !!profile?.is_loft_admin;
  const isSuperAdmin = Number(profile?.user_type_id) === 5;
  
  // Fetch application status for non-hosts
  useEffect(() => {
    const fetchApplicationStatus = async () => {
      if (!profile?.id || canHost) return;
      try {
        const { data, error } = await supabase.rpc('get_my_host_application_status');
        if (error) throw error;
        const nextStatus =
          data === 'pending' || data === 'approved' || data === 'rejected' ? data : 'none';
        setApplicationStatus(nextStatus);
      } catch (err) {
        console.error('Failed to fetch application status:', err);
      }
    };

    fetchApplicationStatus();
  }, [profile?.id, canHost]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Failed to sign out', err);
    } finally {
      try {
        sessionStorage.removeItem('loft.next');
      } catch {
        // ignore
      }
      navigate('/join');
    }
  };

  const appReturnTo = useState(() => {
    try {
      const allowedPrefixes = ['https://app.jobzcafe.com', 'https://jobzcafe.com'];
      const fromSearch = new URLSearchParams(window.location.search).get('returnTo');
      const candidate = decodeURIComponent((fromSearch || '').trim());
      if (candidate && allowedPrefixes.some(prefix => candidate.startsWith(prefix))) {
        return candidate;
      }
    } catch {
      // ignore
    }
    return 'https://app.jobzcafe.com';
  })[0];

  const hideExternalExit = useMemo(() => {
    try {
      return isStandalonePwa() && isMobile();
    } catch {
      return false;
    }
  }, []);

  const parseInternalTargetFromLocation = (): string | null => {
    try {
      // iOS debugging
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        console.log('[iOS Debug] Full URL:', window.location.href);
        console.log('[iOS Debug] Hash:', window.location.hash);
        console.log('[iOS Debug] Search:', window.location.search);
        console.log('[iOS Debug] Pathname:', window.location.pathname);
      }

      const fromHash = window.location.hash.replace('#', '') || '';
      const hashPath = fromHash.split('?')[0] || '';
      const hashQuery = fromHash.includes('?') ? fromHash.slice(fromHash.indexOf('?') + 1) : '';

      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(hashQuery);

      const room = (searchParams.get('room') || hashParams.get('room') || '').trim();
      const code = (searchParams.get('code') || hashParams.get('code') || '').trim();

      const returnToRaw = (searchParams.get('returnTo') || hashParams.get('returnTo') || '').trim();
      const nextRaw = (searchParams.get('next') || hashParams.get('next') || '').trim();

      const internalReturnTo = returnToRaw && returnToRaw.startsWith('/') ? returnToRaw : '';
      const internalNext = nextRaw && nextRaw.startsWith('/') ? nextRaw : '';

      const pathFromRoom = room ? `/room/${encodeURIComponent(room)}` : '';
      const pathFromCode = !pathFromRoom && code ? `/room/${encodeURIComponent(code)}` : '';

      const fromPathname = (window.location.pathname || '').trim();
      const pathFromPathname = fromPathname.startsWith('/room/') ? fromPathname : '';

      // Prefer explicit intent (next/returnTo/room/code). Otherwise fall back to actual URL path.
      return internalNext || internalReturnTo || pathFromRoom || pathFromCode || (hashPath.startsWith('/room/') ? hashPath : '') || pathFromPathname || null;
    } catch {
      return null;
    }
  };

  const exitToCafe = () => {
    if (hideExternalExit) {
      navigate('/lobby');
      return;
    }
    try {
      if (appReturnTo) {
        window.location.assign(appReturnTo);
        return;
      }
    } catch {
      // ignore
    }
    window.location.assign('https://app.jobzcafe.com');
  };

  const persistValidReturnTo = () => {
    try {
      const allowedPrefixes = ['https://app.jobzcafe.com', 'https://jobzcafe.com'];

      const fromSearch = new URLSearchParams(window.location.search).get('returnTo');

      const hash = window.location.hash || '';
      const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
      const fromHashQuery = hashQuery ? new URLSearchParams(hashQuery).get('returnTo') : null;

      const candidate = (fromSearch || fromHashQuery || '').trim();
      if (!candidate) return;

      if (!allowedPrefixes.some(prefix => candidate.startsWith(prefix))) return;

      sessionStorage.setItem('loft.returnTo', candidate);
    } catch {
      // Ignore parsing/storage issues (e.g., blocked storage)
    }
  };

  useEffect(() => {
    const syncPath = () => {
      const fromHash = window.location.hash.replace('#', '');
      const fromPathname = window.location.pathname;
      const next = fromHash || fromPathname || '/';
      setCurrentPath(next);
    };

    if (!window.location.hash && window.location.pathname && window.location.pathname !== '/') {
      window.location.hash = window.location.pathname;
    }

    const onPopState = () => syncPath();
    const onHashChange = () => syncPath();
    window.addEventListener('popstate', onPopState);
    window.addEventListener('hashchange', onHashChange);
    syncPath();
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  useEffect(() => {
    if ((import.meta as any).env?.DEV) {
      supabase.auth.getSession().then(({ data }) => {
        const shouldDebugSSO = (() => {
          try {
            return window.localStorage?.getItem('loft_debug_sso') === '1';
          } catch {
            return false;
          }
        })();
        if (!shouldDebugSSO) return;
        const email = data?.session?.user?.email || '';
        const masked = email
          ? email.replace(/^(.).*(.@).*(\..+)$/, '$1***$2***$3')
          : '';
        // eslint-disable-next-line no-console
        console.debug('[SSO][LOFT] Session on load', {
          hasSession: !!data?.session,
          user: masked || undefined,
        });
      });
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('loft-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('loft-theme', 'light');
    }
  }, [isDarkMode]);

  const navigate = (path: string) => {
    window.location.hash = path;
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  const RootGateRoute = () => {
    const [isChecking, setIsChecking] = useState(true);
    const [isAuthed, setIsAuthed] = useState(false);

    useEffect(() => {
      let isMounted = true;

      const maybePersistNext = () => {
        try {
          const nextTarget = parseInternalTargetFromLocation();
          if (!nextTarget) return;
          sessionStorage.setItem('loft.next', nextTarget);
        } catch {
          // ignore
        }
      };

      const run = async () => {
        persistValidReturnTo();
        setIsChecking(true);
        const { data } = await supabase.auth.getSession();
        if (!isMounted) return;
        const authed = !!data?.session;
        setIsAuthed(authed);
        setIsChecking(false);

        const target = parseInternalTargetFromLocation();
        if (authed) {
          navigate(target || '/lobby');
        } else {
          if (target) {
            maybePersistNext();
            navigate(`/join?next=${encodeURIComponent(target)}`);
          }
        }
      };
      run();

      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN') {
          try {
            const next = sessionStorage.getItem('loft.next');
            if (next && next.startsWith('/')) {
              sessionStorage.removeItem('loft.next');
              navigate(next);
              return;
            }
          } catch {
            // ignore
          }
          const target = parseInternalTargetFromLocation();
          navigate(target || '/lobby');
        }
      });

      return () => {
        isMounted = false;
        try { sub?.subscription?.unsubscribe(); } catch { /* ignore */ }
      };
    }, []);

    const handleBackToCafe = () => {
      exitToCafe();
    };

    if (isChecking) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center px-6 py-16 relative z-10">
          <div className="text-center">
            <div className="text-[10px] font-bold uppercase tracking-[0.4em]">Loading…</div>
          </div>
        </div>
      );
    }

    if (isAuthed) return null;

    return <LoftLandingPage onBackToCafe={handleBackToCafe} />;
  };

  const memberRoutesRequireAuth =
    currentPath === '/lobby' ||
    currentPath === '/mine' ||
    currentPath === '/profile' ||
    currentPath === '/create' ||
    currentPath === '/personal-room' ||
    currentPath === '/personal-room/host' ||
    currentPath === '/personal-room/create' ||
    currentPath === '/admin/host-applications' ||
    currentPath === '/admin/personal-tables' ||
    currentPath.startsWith('/room/');
  const shouldShowMemberLogin = memberRoutesRequireAuth && !isLoadingProfile && !user;

  // Profile is now considered a full screen page to remove nav/sidebar
  const isFullScreenPage =
    shouldShowMemberLogin ||
    currentPath === '/' ||
    currentPath.startsWith('/room/') ||
    currentPath.startsWith('/personal-room/') ||
    currentPath === '/create' ||
    currentPath === '/join' ||
    currentPath.startsWith('/join?') ||
    currentPath === '/thanks' ||
    currentPath.startsWith('/personal/') ||
    currentPath === '/loft/login' ||
    currentPath.startsWith('/loft/login?');

  let content;
  if (shouldShowMemberLogin) {
    content = <LoftLoginPage />;
  } else if (currentPath === '/') {
    content = <RootGateRoute />;
  } else if (currentPath === '/join' || currentPath.startsWith('/join?')) {
    content = <LoftLandingPage onBackToCafe={exitToCafe} />;
  } else if (currentPath === '/thanks') {
    content = <GuestThankYouPage />;
  } else if (currentPath === '/lobby') {
    content = <LoftLobbyPage onNavigate={navigate} />;
  } else if (currentPath === '/create') {
    content = <LoftRoomForm onNavigate={navigate} />;
  } else if (currentPath === '/personal-room') {
    content = <PersonalRoomLandingPage onNavigate={navigate} />;
  } else if (currentPath === '/personal-room/host') {
    content = <PersonalRoomLandingPage onNavigate={navigate} />;
  } else if (currentPath === '/personal-room/create') {
    content = <PersonalRoomLandingPage onNavigate={navigate} />;
  } else if (currentPath === '/mine') {
    content = <MyLoftPage onNavigate={navigate} />;
  } else if (currentPath === '/profile') {
    content = <LoftProfilePage onNavigate={navigate} />;
  } else if (currentPath === '/admin/host-applications') {
    content = <AdminHostApplications />;
  } else if (currentPath === '/admin/personal-tables') {
    content = <AdminPersonalTables />;
  } else if (currentPath === '/loft/login' || currentPath.startsWith('/loft/login?')) {
    content = <LoftLoginPage />;
  } else if (currentPath.startsWith('/personal/')) {
    const slug = currentPath.split('/personal/')[1].split('?')[0];
    content = <PersonalRoomGuestGate slug={slug} onNavigate={navigate} />;
  } else if (currentPath.startsWith('/personal-room/live/')) {
    const roomId = currentPath.split('/personal-room/live/')[1].split('?')[0];
    content = (
      <PersonalRoomPage 
        roomId={roomId} 
        onLeave={(path) => navigate(path || '/personal-room')} 
      />
    );
  } else if (currentPath.startsWith('/personal-room/')) {
    const roomId = currentPath.split('/personal-room/')[1].split('?')[0];
    
    // Show loading while auth state is being determined
    if (profile === undefined) {
      content = (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white">Loading...</div>
        </div>
      );
    } else {
      content = <PersonalRoomHostGate roomId={roomId} onNavigate={navigate} />;
    }
  } else if (currentPath.startsWith('/room/')) {
  const roomId = currentPath.split('/room/')[1].split('?')[0];
  
  console.log('Room routing:', { roomId, profile, isAuthenticated: !!profile });
  
  // Use LoftRoomPage for normal authenticated rooms
  content = React.createElement(LoftRoomPage as any, { 
    roomId, 
    onLeave: () => navigate('/lobby') 
  });
      
  } else {
    // Unknown route - show 404
    content = (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="loft-card p-8 text-center space-y-4">
          <h2 className="text-2xl font-bold text-main dark:text-white">Page Not Found</h2>
          <p className="text-main/70 dark:text-white/70">The page you're looking for doesn't exist.</p>
          <button 
            onClick={() => navigate('/lobby')} 
            className="px-6 py-3 bg-cafe text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-cafe/90 transition-all"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-[var(--loft-bg)] text-main dark:text-white text-xs tracking-[0.4em] uppercase">
          Loading…
        </div>
      }
    >
    <div className="loft-shell loft-scope h-full w-full flex flex-col md:flex-row overflow-hidden relative">
      {/* Persistent Background Blobs */}
      <AnimatedBackgroundBlobs />

      {!isFullScreenPage && (
        <>
          {/* Desktop Sidebar */}
          <aside 
            className={`hidden md:flex flex-col loft-sidebar-surface border-r h-full fixed inset-y-0 left-0 z-40 transition-all duration-300 ease-in-out backdrop-blur-3xl ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}
          >
            <div className={`p-6 flex ${isSidebarCollapsed ? 'items-center justify-center' : 'items-start justify-between gap-3'}`}>
               <div className={`flex ${isSidebarCollapsed ? 'items-center justify-center' : 'flex-col items-start gap-0.5'}`}>
                 <div className="flex items-center gap-3">
                  <LoftIcon className="w-10 h-10 text-cafe shrink-0" />
                  {!isSidebarCollapsed && (
                    <span className="text-[18px] font-black text-cafe uppercase tracking-[0.18em] leading-none">Loft</span>
                  )}
                 </div>
                 {!isSidebarCollapsed && (
                  <p className="pl-[52px] -mt-0.5 text-[9px] font-black uppercase tracking-[0.18em] leading-snug text-muted">
                    Talk. Learn.<br />
                    Move Forward.
                  </p>
                 )}
               </div>
               <button 
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className="p-1.5 hover:bg-cafe/10 rounded-lg text-cafe hidden lg:block transition-colors"
                  aria-label="Toggle Sidebar"
               >
                  {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
               </button>
            </div>

            <nav className="flex-1 space-y-1 mt-4">
               <SidebarItem icon={<LayoutGrid className="w-5 h-5" />} label="Lobby" active={currentPath === '/lobby'} onClick={() => navigate('/lobby')} collapsed={isSidebarCollapsed} />
               <SidebarItem icon={<User className="w-5 h-5" />} label="Activity" active={currentPath === '/mine'} onClick={() => navigate('/mine')} collapsed={isSidebarCollapsed} />
               <SidebarItem icon={<CircleUser className="w-5 h-5" />} label="Profile" active={currentPath === '/profile'} onClick={() => navigate('/profile')} collapsed={isSidebarCollapsed} />
               
               {!canHost && applicationStatus === 'pending' && (
                 <div className="mx-6 mt-2 mb-4">
                   <div className="flex items-center gap-2 px-3 py-2 bg-cafe/10 border border-cafe/30 rounded-lg">
                     <Clock className="w-4 h-4 text-cafe shrink-0" />
                     {!isSidebarCollapsed && (
                       <span className="text-[9px] font-bold uppercase tracking-widest text-cafe">Host App Pending</span>
                     )}
                   </div>
                 </div>
               )}
               
               {!canHost && applicationStatus === 'approved' && (
                 <div className="mx-6 mt-2 mb-4">
                   <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                     <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                     {!isSidebarCollapsed && (
                       <span className="text-[9px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400">Can Host Tables</span>
                     )}
                   </div>
                 </div>
               )}
               
               {canUsePersonalRoom && (
                <div className="pt-4">
                  <SidebarItem icon={<Video className="w-5 h-5" />} label="Personal Table" active={currentPath === '/personal-room'} onClick={() => navigate('/personal-room')} collapsed={isSidebarCollapsed} />
                </div>
              )}
              
              {!isLoadingProfile && canHost && (
                <div className="pt-4">
                   <SidebarItem icon={<Plus className="w-5 h-5" />} label="Host Table" active={currentPath === '/create'} onClick={() => navigate('/create')} collapsed={isSidebarCollapsed} />
                </div>
              )}

               {(isLoftAdmin || isSuperAdmin) && (
                <>
                  <div className="pt-4">
                    <SidebarItem icon={<Shield className="w-5 h-5" />} label="Host Applications" active={currentPath === '/admin/host-applications'} onClick={() => navigate('/admin/host-applications')} collapsed={isSidebarCollapsed} />
                  </div>
                </>
              )}

              {isSuperAdmin && (
                <div className="pt-1">
                  <SidebarItem icon={<UserPlus className="w-5 h-5" />} label="Personal Tables" active={currentPath === '/admin/personal-tables'} onClick={() => navigate('/admin/personal-tables')} collapsed={isSidebarCollapsed} />
                </div>
              )}

            </nav>

            <div className="p-4 border-t border-black/5 dark:border-white/5 space-y-1">
              <button
                onClick={handleLogout}
                className={`w-full flex items-center gap-3 px-2 py-3 text-muted hover:text-cafe transition-all active:scale-95 group ${isSidebarCollapsed ? 'justify-center' : ''}`}
                aria-label="Log out"
              >
                <LogOut className="w-5 h-5" />
                {!isSidebarCollapsed && (
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Log Out
                  </span>
                )}
              </button>
              <button
                onClick={toggleTheme}
                className={`w-full flex items-center gap-3 px-2 py-3 text-muted hover:text-cafe transition-all active:scale-95 group ${isSidebarCollapsed ? 'justify-center' : ''}`}
              >
                <div className="flex items-center justify-center">
                  {isDarkMode ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-blue-600" />}
                </div>
                {!isSidebarCollapsed && (
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {isDarkMode ? 'Brighter' : 'Darker'}
                  </span>
                )}
              </button>
            </div>
          </aside>

          {/* Mobile Footer Bar with Menu Button */}
          <div className="fixed bottom-0 left-0 right-0 bg-[var(--loft-surface-2)] border-t border-[var(--loft-border)] z-50 md:hidden safe-area-bottom backdrop-blur-3xl">
            <div className="flex items-center justify-center pt-2 pb-3">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="w-12 h-12 flex items-center justify-center active:scale-95 transition-transform"
                aria-label="Open Menu"
              >
                <LoftIcon className="w-full h-full" />
              </button>
            </div>
          </div>

          {/* Mobile Bottom Sheet Menu */}
          {isMobileMenuOpen && (
            <>
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden animate-in fade-in duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <div className="fixed bottom-0 left-0 right-0 loft-glass-strong border-t border-[var(--loft-border)] rounded-t-[2rem] z-[70] md:hidden animate-in slide-in-from-bottom duration-300 safe-area-bottom max-h-[80vh] overflow-y-auto">
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center">
                        <LoftIcon className="w-full h-full" />
                      </div>
                      <span className="text-xl font-bold text-cafe uppercase tracking-widest text-[11px]">Menu</span>
                    </div>
                    <button
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-muted hover:text-cafe transition-colors"
                      aria-label="Close Menu"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <nav className="space-y-2">
                    <MobileSheetItem icon={<LayoutGrid className="w-5 h-5" />} label="Lobby" active={currentPath === '/lobby'} onClick={() => { navigate('/lobby'); setIsMobileMenuOpen(false); }} />
                    <MobileSheetItem icon={<User className="w-5 h-5" />} label="Activity" active={currentPath === '/mine'} onClick={() => { navigate('/mine'); setIsMobileMenuOpen(false); }} />
                    <MobileSheetItem icon={<CircleUser className="w-5 h-5" />} label="Profile" active={currentPath === '/profile'} onClick={() => { navigate('/profile'); setIsMobileMenuOpen(false); }} />
                    
                    {!canHost && applicationStatus === 'pending' && (
                      <div className="px-4 py-3">
                        <div className="flex items-center gap-2 px-3 py-2 bg-cafe/10 border border-cafe/30 rounded-lg">
                          <Clock className="w-4 h-4 text-cafe shrink-0" />
                          <span className="text-[9px] font-bold uppercase tracking-widest text-cafe">Host App Pending</span>
                        </div>
                      </div>
                    )}
                    
                    {!canHost && applicationStatus === 'approved' && (
                      <div className="px-4 py-3">
                        <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                          <span className="text-[9px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400">Can Host Tables</span>
                        </div>
                      </div>
                    )}
                    
                    {canUsePersonalRoom && (
                      <div className="pt-2">
                        <MobileSheetItem icon={<Video className="w-5 h-5" />} label="Personal Table" active={currentPath === '/personal-room'} onClick={() => { navigate('/personal-room'); setIsMobileMenuOpen(false); }} />
                      </div>
                    )}
                    
                    {!isLoadingProfile && canHost && (
                      <div className="pt-2">
                        <MobileSheetItem icon={<Plus className="w-5 h-5" />} label="Host Table" active={currentPath === '/create'} onClick={() => { navigate('/create'); setIsMobileMenuOpen(false); }} />
                      </div>
                    )}

                    {(isLoftAdmin || isSuperAdmin) && (
                      <div className="pt-2">
                        <MobileSheetItem icon={<Shield className="w-5 h-5" />} label="Host Applications" active={currentPath === '/admin/host-applications'} onClick={() => { navigate('/admin/host-applications'); setIsMobileMenuOpen(false); }} />
                      </div>
                    )}

                    {isSuperAdmin && (
                      <div className="pt-2">
                        <MobileSheetItem icon={<UserPlus className="w-5 h-5" />} label="Personal Tables" active={currentPath === '/admin/personal-tables'} onClick={() => { navigate('/admin/personal-tables'); setIsMobileMenuOpen(false); }} />
                      </div>
                    )}

                  </nav>

                  <div className="pt-4 border-t border-[var(--loft-border)] space-y-2">
                    <button
                      onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-muted hover:text-cafe hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all active:scale-95"
                    >
                      <LogOut className="w-5 h-5" />
                      <span className="text-[11px] font-bold uppercase tracking-widest">
                        Log Out
                      </span>
                    </button>
                    <button
                      onClick={toggleTheme}
                      className="w-full flex items-center gap-3 px-4 py-3 text-muted hover:text-cafe hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all active:scale-95"
                    >
                      <div className="flex items-center justify-center">
                        {isDarkMode ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-blue-600" />}
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-widest">
                        {isDarkMode ? 'Brighter' : 'Darker'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <main className={`loft-shell loft-scope flex-1 h-full overflow-y-auto no-scrollbar transition-all duration-300 relative z-10 ${!isFullScreenPage ? (isSidebarCollapsed ? 'md:ml-20 pb-20 md:pb-0' : 'md:ml-64 pb-20 md:pb-0') : 'w-full ml-0'}`}>
        {content}
      </main>
      
      {showHostApplication && (
        <HostApplicationForm
          onClose={() => setShowHostApplication(false)}
          onSuccess={() => {
            setShowHostApplication(false);
            // Optionally refresh profile to update canHostLoft status
            window.location.reload();
          }}
        />
      )}
    </div>
    </Suspense>
  );
};

const SidebarItem = ({ icon, label, active, onClick, collapsed, indicator }: any) => (
    <button 
        onClick={onClick} 
        className={`group relative w-full flex items-center gap-4 px-6 py-4 transition-all duration-200 ${active ? 'text-cafe font-bold' : 'text-muted hover:text-cafe'} ${collapsed ? 'justify-center px-0' : ''}`}
    >
        <div className={`absolute left-0 top-1 bottom-1 w-[4px] transition-all duration-300 rounded-r-full shadow-[2px_0_10px_rgba(100,120,242,0.35)] ${active ? 'bg-cafe' : 'bg-transparent group-hover:bg-cafe/40'}`} />
        <span className="shrink-0 transition-transform group-hover:scale-110">{icon}</span>
        {!collapsed && <span className="text-[11px] font-bold uppercase tracking-widest truncate">{label}</span>}
        {indicator && <span className={`absolute w-1.5 h-1.5 rounded-full bg-cafe animate-pulse ${collapsed ? 'top-3 right-6' : 'right-6'}`}></span>}
    </button>
);

const MobileSheetItem = ({ icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`group relative w-full flex items-center gap-4 px-4 py-3 transition-all duration-200 ${active ? 'text-cafe font-bold' : 'text-muted hover:text-cafe'}`}
  >
    <div className={`absolute left-0 top-1 bottom-1 w-[4px] transition-all duration-300 rounded-r-full ${active ? 'bg-cafe shadow-[2px_0_10px_rgba(100,120,242,0.35)]' : 'bg-transparent group-hover:bg-cafe/40'}`} />
    <span className="shrink-0">{icon}</span>
    <span className="text-[11px] font-bold uppercase tracking-widest truncate">{label}</span>
  </button>
);

export default App;
