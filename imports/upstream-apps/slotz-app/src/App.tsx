import React, { useState, useEffect } from 'react';
import { supabaseDb } from './services/supabaseDb';
import { supabase } from './services/supabaseClient';
import { invokeStaffFunction } from './services/slotzFunctions';
import { outlook } from './services/outlookService';
import { SchedulingBooking, SchedulingMeetingType } from './types';
import { SettingsIcon, EyeIcon, LogOutIcon, ClockIcon, TagIcon, Share2Icon, MoonIcon, SunIcon } from './components/Icons';
import { getDocumentTheme, setTheme, syncSlotzThemeTokens, type SlotzTheme } from './theme';
import AngledLogo from './components/AngledLogo';
import HomePage from './pages/HomePage';
import BookingPage from './pages/BookingPage';
import ConfirmationPage from './pages/ConfirmationPage';
import StaffDashboardPage from './pages/StaffDashboardPage';
import StaffSettingsPage from './pages/StaffSettingsPage';
import ManageBookingPage from './pages/ManageBookingPage';
import SettingsView from './components/SettingsView';
import { CalendarOffIcon } from './components/Icons';

export type Page = 'home' | 'book' | 'confirm' | 'staff-dashboard' | 'staff-settings' | 'manage-booking';
export type SettingsPage = 'availability' | 'meetingTypes' | 'integrations' | 'blackouts';

const formatOutlookError = (message?: string | null) => {
  if (!message) return 'Outlook connection failed. Please try again.';
  const reasonMessages: Record<string, string> = {
    state: 'Outlook connection link expired. Please click Reconnect Outlook again.',
    token_exchange: 'Outlook could not exchange the authorization code. Please check the Azure client secret and redirect URI.',
    missing_refresh_token: 'Microsoft did not return a refresh token. Please reconnect and approve offline access.',
    profile: 'Outlook connected, but Microsoft profile lookup failed.',
    token_save: 'Outlook connected, but SLOTZ could not save the token.',
    sync_save: 'Outlook connected, but SLOTZ could not enable calendar sync.',
    missing_secret: 'Outlook setup is missing a SLOTZ Supabase secret.',
    callback: 'Outlook callback failed. Please check the Supabase function logs.',
  };
  if (reasonMessages[message]) return reasonMessages[message];
  if (message.includes('AADSTS9002325') || message.toLowerCase().includes('proof key for code exchange')) {
    return 'Outlook needs a fresh connection link. Please click Reconnect Outlook again.';
  }
  if (message.toLowerCase().includes('invalid or expired')) {
    return 'The Outlook connection link expired. Please click Reconnect Outlook again.';
  }
  return 'Outlook connection failed. Please try again.';
};

const formatGoogleError = (message?: string | null) => {
  if (!message) return 'Google Calendar connection failed. Please try again.';
  const reasonMessages: Record<string, string> = {
    state: 'Google Calendar connection link expired. Please click Connect Google again.',
    token_exchange: 'Google could not exchange the authorization code. Please check the Google client secret and redirect URI.',
    missing_refresh_token: 'Google did not return a refresh token. Please reconnect and approve offline access.',
    profile: 'Google Calendar connected, but Google profile lookup failed.',
    token_save: 'Google Calendar connected, but SLOTZ could not save the token.',
    sync_save: 'Google Calendar connected, but SLOTZ could not enable calendar sync.',
    missing_secret: 'Google Calendar setup is missing a SLOTZ Supabase secret.',
    callback: 'Google Calendar callback failed. Please check the Supabase function logs.',
  };
  if (reasonMessages[message]) return reasonMessages[message];
  return 'Google Calendar connection failed. Please try again.';
};

const syncCalendarNow = async (provider: 'outlook' | 'google') => {
  const { data, error } = await invokeStaffFunction<any>('slotz-calendar-sync');
  if (error || data?.success === false) {
    throw new Error(data?.error || error?.message || 'Calendar sync failed.');
  }

  const results = (Array.isArray(data?.results) ? data.results : [])
    .filter((result: any) => provider === 'outlook' ? !result.provider || result.provider === 'outlook' : result.provider === provider);
  const failedResult = results.find((result: any) => result.success === false);
  if (failedResult) {
    throw new Error(failedResult.error || 'Calendar sync failed.');
  }

  const syncedCount = results.reduce((total: number, result: any) => total + Number(result.events_synced || 0), 0);
  return syncedCount;
};

const App: React.FC = () => {
  // Check for public booking URL immediately to prevent login flash
  const getInitialPage = (): Page => {
    const hash = window.location.hash;
    if (hash.startsWith('#/')) {
      const pathParts = hash.substring(2).split('/');
      if (pathParts.length === 2) {
        return 'book'; // Show booking page directly for public URLs
      }
    }
    return 'home'; // Default to home for other cases
  };

  const [page, setPage] = useState<Page>(getInitialPage());
  const [isStaff, setIsStaff] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  
  const [managedBookingId, setManagedBookingId] = useState<string | null>(null);
  
  const [selectedMeetingType, setSelectedMeetingType] = useState<SchedulingMeetingType | null>(null);
  const [lastBooking, setLastBooking] = useState<SchedulingBooking | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<SchedulingBooking | null>(null);
  const [rescheduleSource, setRescheduleSource] = useState<'staff' | 'manage' | null>(null);
  const [lastBookingWasReschedule, setLastBookingWasReschedule] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);
  const [activeSettingsView, setActiveSettingsView] = useState<SettingsPage | null>(null);
  const [initialSettingsTab, setInitialSettingsTab] = useState<SettingsPage>('availability');
  const [integrationMessage, setIntegrationMessage] = useState<string | null>(null);
  const [theme, setThemeState] = useState<SlotzTheme>(() => syncSlotzThemeTokens(getDocumentTheme()));

  useEffect(() => {
    const applyCurrentDocumentTheme = () => {
      setThemeState(syncSlotzThemeTokens(getDocumentTheme()));
    };

    applyCurrentDocumentTheme();
    const observer = new MutationObserver(applyCurrentDocumentTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handleToggleTheme = () => {
    const nextTheme: SlotzTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    setThemeState(nextTheme);
  };

  useEffect(() => {
    console.log('🚀 App initialization starting...');
    
    // Force bootstrapping to complete after 3 seconds max
    const forceTimeout = setTimeout(() => {
      console.log('⚠️ Force timeout - setting bootstrapping to false');
      setIsBootstrapping(false);
    }, 3000);

    const initializeApp = async () => {
      console.log('🔧 initializeApp called');
      const showFeedback = (message: string) => {
        setFeedback(message);
        setTimeout(() => setFeedback(null), 4000);
      };
      
      // Add iPad detection
      const isIPad = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (isIPad) {
        console.log('📱 iPad: App initialization starting');
        
        // Test localStorage on iPad
        try {
          const testKey = 'ipad_test_' + Date.now();
          localStorage.setItem(testKey, 'test');
          const testValue = localStorage.getItem(testKey);
          localStorage.removeItem(testKey);
          
          if (testValue === 'test') {
            console.log('📱 iPad: localStorage working correctly');
          } else {
            console.error('📱 iPad: localStorage not working properly');
            showFeedback('Safari settings may be blocking local storage. Please check Settings > Safari > Privacy & Security.');
          }
        } catch (error) {
          console.error('📱 iPad: localStorage error:', error);
          showFeedback('Local storage is disabled. Please enable it in Safari settings.');
        }
      }
      
      try {
        const hash = window.location.hash;
        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.has('code') && urlParams.has('state')) {
          console.log('Outlook OAuth code detected, completing server-side SLOTZ connection');
          const code = urlParams.get('code');
          const state = urlParams.get('state');
          history.replaceState("", document.title, window.location.pathname + window.location.hash);

          const { data, error } = await supabase.functions.invoke('slotz-outlook-callback', {
            body: { code, state }
          });

          setIsStaff(true);
          setInitialSettingsTab('integrations');
          if (error || data?.error) {
            setIntegrationMessage(formatOutlookError(data?.error || error?.message));
          } else {
            try {
              const syncedCount = await syncCalendarNow('outlook');
              setIntegrationMessage(`Outlook calendar connected. First sync completed with ${syncedCount} external ${syncedCount === 1 ? 'booking' : 'bookings'}.`);
            } catch (syncError) {
              console.error('Initial Outlook sync failed:', syncError);
              setIntegrationMessage(`Outlook calendar connected, but first sync needs attention: ${syncError instanceof Error ? syncError.message : 'Calendar sync failed.'}`);
            }
          }
          setPage('staff-settings');
          clearTimeout(forceTimeout);
          setIsBootstrapping(false);
          return;
        }

        if (urlParams.has('error') && urlParams.has('state')) {
          console.error('Outlook OAuth returned error:', urlParams.get('error'), urlParams.get('error_description'));
          history.replaceState("", document.title, window.location.pathname + window.location.hash);
          setIsStaff(true);
          setInitialSettingsTab('integrations');
          setIntegrationMessage(formatOutlookError(urlParams.get('error_description')));
          setPage('staff-settings');
          clearTimeout(forceTimeout);
          setIsBootstrapping(false);
          return;
        }

        const outlookResult = urlParams.get('slotz_outlook');
        if (outlookResult === 'connected' || outlookResult === 'error') {
          const outlookReason = urlParams.get('reason');
          history.replaceState("", document.title, window.location.pathname + window.location.hash);

          if (outlookResult === 'connected') {
            setIsStaff(true);
            setInitialSettingsTab('integrations');
            setPage('staff-settings');

            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              const { data: profile, error: profileError } = await supabase
                .from('scheduling_staff_profiles')
                .select('id')
                .eq('user_id', session.user.id)
                .maybeSingle();

              if (!profileError && profile) {
                supabaseDb.setCurrentStaff(profile.id);
              }
            }

            try {
              const syncedCount = await syncCalendarNow('outlook');
              setIntegrationMessage(`Outlook calendar connected. First sync completed with ${syncedCount} external ${syncedCount === 1 ? 'booking' : 'bookings'}.`);
            } catch (syncError) {
              console.error('Initial Outlook sync failed:', syncError);
              setIntegrationMessage(`Outlook calendar connected, but first sync needs attention: ${syncError instanceof Error ? syncError.message : 'Calendar sync failed.'}`);
            }
            clearTimeout(forceTimeout);
            setIsBootstrapping(false);
            return;
          } else {
            setIsStaff(true);
            setInitialSettingsTab('integrations');
            setIntegrationMessage(formatOutlookError(outlookReason));
            setPage('staff-settings');
            clearTimeout(forceTimeout);
            setIsBootstrapping(false);
            return;
          }
        }

        const googleResult = urlParams.get('slotz_google');
        if (googleResult === 'connected' || googleResult === 'error') {
          const googleReason = urlParams.get('reason');
          history.replaceState("", document.title, window.location.pathname + window.location.hash);

          if (googleResult === 'connected') {
            setIsStaff(true);
            setInitialSettingsTab('integrations');
            setPage('staff-settings');

            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              const { data: profile, error: profileError } = await supabase
                .from('scheduling_staff_profiles')
                .select('id')
                .eq('user_id', session.user.id)
                .maybeSingle();

              if (!profileError && profile) {
                supabaseDb.setCurrentStaff(profile.id);
              }
            }

            try {
              const syncedCount = await syncCalendarNow('google');
              setIntegrationMessage(`Google Calendar connected. First sync completed with ${syncedCount} external ${syncedCount === 1 ? 'booking' : 'bookings'}.`);
            } catch (syncError) {
              console.error('Initial Google sync failed:', syncError);
              setIntegrationMessage(`Google Calendar connected, but first sync needs attention: ${syncError instanceof Error ? syncError.message : 'Calendar sync failed.'}`);
            }
            clearTimeout(forceTimeout);
            setIsBootstrapping(false);
            return;
          } else {
            setIsStaff(true);
            setInitialSettingsTab('integrations');
            setIntegrationMessage(formatGoogleError(googleReason));
            setPage('staff-settings');
            clearTimeout(forceTimeout);
            setIsBootstrapping(false);
            return;
          }
        }

        if (hash.startsWith('#manage-')) {
          const bookingId = hash.substring(8);
          if (bookingId) {
            console.log('📋 Manage booking detected:', bookingId);
            setManagedBookingId(bookingId);
            setPage('manage-booking');
            clearTimeout(forceTimeout);
            setIsBootstrapping(false);
            return;
          }
        }

        if (hash.startsWith('#/')) {
          const pathParts = hash.substring(2).split('/');
          console.log('🔗 Public booking URL parts:', pathParts);
          
          if (isIPad) {
            console.log('📱 iPad: Public booking URL detected');
          }
          
          if (pathParts.length === 2) {
            const staffSlug = pathParts[0];
            const meetingSlug = pathParts[1];
            
            console.log('👤 Looking up staff:', staffSlug);
            
            if (isIPad) {
              console.log('📱 iPad: Querying Supabase for staff profile...');
            }
            
            const { data: staffProfile, error: staffError } = await supabase
              .from('scheduling_staff_profiles')
              .select('*')
              .or(`slug.eq.${staffSlug},full_name.ilike.${staffSlug}`)
              .single();
            
            if (staffError || !staffProfile) {
              console.error('❌ Staff not found:', staffError);
              if (isIPad) {
                console.error('📱 iPad: Staff lookup failed', staffError);
              }
              showFeedback("Staff member not found.");
            } else {
              console.log('✅ Staff found:', staffProfile);
              if (isIPad) {
                console.log('📱 iPad: Staff found, setting current staff...');
              }
              
              supabaseDb.setCurrentStaff(staffProfile.id);
              
              if (isIPad) {
                console.log('📱 iPad: Getting meeting types...');
              }
              
              const meetingTypes = await supabaseDb.getMeetingTypes(false);
              const matchingType = meetingTypes.find(mt => mt.slug === meetingSlug);

              if (matchingType && matchingType.is_active) {
                console.log('✅ Meeting type found:', matchingType);
                if (isIPad) {
                  console.log('📱 iPad: Meeting type found, navigating to booking page');
                }
                setSelectedMeetingType(matchingType);
                setPage('book');
              } else {
                console.log('❌ Meeting type not found or inactive');
                if (isIPad) {
                  console.error('📱 iPad: Meeting type not found', { meetingSlug, availableTypes: meetingTypes.map(mt => mt.slug) });
                }
                showFeedback("This booking link is invalid.");
              }
            }
          } else {
            console.log('❌ Invalid public booking URL format');
            if (isIPad) {
              console.error('📱 iPad: Invalid URL format', pathParts);
            }
            showFeedback('Invalid booking link format.');
          }
        } else {
          console.log('🏠 Loading home page');
        }

        const pendingRedirect = localStorage.getItem('postOutlookRedirect');
        if (pendingRedirect) {
          console.log('🔄 Processing pending redirect:', pendingRedirect);
          localStorage.removeItem('postOutlookRedirect');
          if (pendingRedirect === 'settings-integrations') {
            setIsStaff(true);
            setInitialSettingsTab('integrations');
            setPage('staff-settings');
          }
        }
        
      } catch (error) {
        console.error('❌ Initialization error:', error);
        if (isIPad) {
          console.error('📱 iPad: Initialization failed', error);
        }
        showFeedback('App failed to load. Please refresh the page and check your internet connection.');
      } finally {
        console.log('✅ Initialization complete');
        if (isIPad) {
          console.log('📱 iPad: Initialization complete');
        }
        clearTimeout(forceTimeout);
        setIsBootstrapping(false);
      }
    };

    initializeApp();
  }, []);

  const navigate = (p: Page) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (page === 'manage-booking' && p !== 'book') {
      history.pushState("", document.title, window.location.pathname + window.location.search);
    }
    setPage(p);
  };
  
  const handleShowFeedback = (message: string) => {
    if (message.toLowerCase().includes('outlook')) return;
    setFeedback(message);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleBookAnother = async () => {
    try {
      // Only use current staff ID, don't check localStorage for public links
      const staffId = supabaseDb.getCurrentStaffId();
      
      if (staffId) {
        const types = await supabaseDb.getMeetingTypes();
        setSelectedMeetingType(types.length > 0 ? types[0] : null);
      }
      
      setLastBooking(null);
      setRescheduleBooking(null);
      setRescheduleSource(null);
      setLastBookingWasReschedule(false);
      navigate('book');
    } catch (error) {
      console.error('Error loading meeting types:', error);
      // Still navigate even if meeting types fail to load
      setLastBooking(null);
      setRescheduleBooking(null);
      setRescheduleSource(null);
      setLastBookingWasReschedule(false);
      navigate('book');
    }
  };

  const beginReschedule = (booking: SchedulingBooking, meetingType: SchedulingMeetingType | null, source: 'staff' | 'manage') => {
    supabaseDb.setCurrentStaff(booking.staff_id);
    setSelectedMeetingType(meetingType);
    setRescheduleBooking(booking);
    setRescheduleSource(source);
    setLastBookingWasReschedule(false);
    navigate('book');
  };

  const handleBeginStaffReschedule = (booking: SchedulingBooking, meetingType: SchedulingMeetingType | null) => {
    beginReschedule(booking, meetingType, 'staff');
  };

  const handleBeginManageReschedule = (booking: SchedulingBooking, meetingType: SchedulingMeetingType | null) => {
    beginReschedule(booking, meetingType, 'manage');
  };

  const handleCancelReschedule = () => {
    const targetPage: Page = rescheduleSource === 'manage' ? 'manage-booking' : 'staff-dashboard';
    setRescheduleBooking(null);
    setRescheduleSource(null);
    setLastBookingWasReschedule(false);
    navigate(targetPage);
  };

  const handleBookingComplete = (booking: SchedulingBooking, isReschedule = false) => {
    setLastBooking(booking);
    setLastBookingWasReschedule(isReschedule);
    if (isReschedule) {
      setRescheduleBooking(null);
      setRescheduleSource(null);
      history.pushState("", document.title, window.location.pathname + window.location.search);
    }
  };

  const openSettingsView = (view: SettingsPage) => {
    if (view !== 'integrations') setIntegrationMessage(null);
    setActiveSettingsView(view);
    setIsSettingsSheetOpen(false);
  };

  const showHeader = page !== 'home';

  const settingsTabs: { id: SettingsPage, label: string, icon: React.JSX.Element}[] = [
      { id: 'availability', label: 'Availability', icon: <ClockIcon className="w-5 h-5" /> },
      { id: 'meetingTypes', label: 'Meetings', icon: <TagIcon className="w-5 h-5" /> },
      { id: 'blackouts', label: 'Time Off', icon: <CalendarOffIcon className="w-5 h-5" /> },
      { id: 'integrations', label: 'Integrations', icon: <Share2Icon className="w-5 h-5" /> },
  ];

  const renderPage = () => {
    switch (page) {
      case 'home':
        return <HomePage navigate={navigate} setIsStaff={setIsStaff} />;
      case 'book':
        return <BookingPage 
                  navigate={navigate} 
                  selectedMeetingType={selectedMeetingType} 
                  setLastBooking={handleBookingComplete}
                  rescheduleBooking={rescheduleBooking}
                  onCancelReschedule={handleCancelReschedule}
                  allowRescheduleOverride={rescheduleSource === 'staff'}
                />;
      case 'confirm':
        return <ConfirmationPage 
                  lastBooking={lastBooking} 
                  handleBookAnother={handleBookAnother} 
                  isReschedule={lastBookingWasReschedule}
                />;
      case 'staff-dashboard':
        return <StaffDashboardPage setFeedback={handleShowFeedback} navigate={navigate} setInitialTab={setInitialSettingsTab} onRescheduleBooking={handleBeginStaffReschedule} />;
      case 'staff-settings':
        return <StaffSettingsPage navigate={navigate} setFeedback={handleShowFeedback} initialTab={initialSettingsTab} setInitialTab={setInitialSettingsTab} integrationMessage={integrationMessage} />;
      case 'manage-booking':
        return <ManageBookingPage bookingId={managedBookingId} navigate={navigate} setFeedback={handleShowFeedback} onReschedule={handleBeginManageReschedule} />;
      default:
        return <HomePage navigate={navigate} setIsStaff={setIsStaff} />;
    }
  };

  const handleViewPublic = async () => {
    try {
      const types = await supabaseDb.getMeetingTypes();
      setSelectedMeetingType(types[0]);
      navigate('book');
    } catch (error) {
      console.error('Error loading meeting types:', error);
      setFeedback("Error loading meeting types.");
    }
  };

  if (isBootstrapping) {
    // Check if this is a booking page to show appropriate message
    const hash = window.location.hash;
    const isBookingPage = hash.startsWith('#/');
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-darkbg">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
          <p className="text-primary-text-muted dark:text-white/72 font-medium">
            {isBookingPage ? 'Loading booking calendar...' : 'Loading your workspace...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen selection:bg-primary/20 selection:text-primary flex flex-col">
      {feedback && (
        <div className="slotz-notice slotz-feedback-notice fixed bottom-8 left-1/2 z-[100] max-w-[min(92vw,34rem)] -translate-x-1/2 px-5 py-3 text-sm font-normal shadow-lg shadow-black/20 backdrop-blur-md animate-fade-in">
          {feedback}
        </div>
      )}
      
      {activeSettingsView && (
          <SettingsView 
              view={activeSettingsView}
              onClose={() => setActiveSettingsView(null)}
              setFeedback={handleShowFeedback}
              integrationMessage={integrationMessage}
          />
      )}

      {isSettingsSheetOpen && (
          <div className="fixed inset-0 z-[100] md:hidden" onClick={() => setIsSettingsSheetOpen(false)}>
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
              <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl border border-primary/20 bg-white p-4 shadow-xl shadow-black/20 animate-slide-in-up dark:bg-darkcard" onClick={e => e.stopPropagation()}>
                  <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-primary-border dark:bg-primary/25"></div>
                  <div className="space-y-1">
                      {settingsTabs.map(tab => (
                      <button
                          type="button"
                          key={tab.id}
                          onClick={() => openSettingsView(tab.id)}
                          className="w-full flex items-center gap-4 rounded-xl p-4 text-left font-semibold transition-colors hover:bg-primary-light dark:hover:bg-primary/10"
                      >
                          {tab.icon}
                          <span>{tab.label}</span>
                      </button>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {showHeader && (
        <nav className="sticky top-0 z-50 border-b border-primary-border/50 bg-[var(--bg-secondary)]/90 py-3 backdrop-blur-xl dark:border-primary/20 dark:bg-[var(--bg-secondary)]/95">
          <div className="flex w-full items-center justify-between px-4 md:px-8">
            <button type="button" onClick={() => isStaff ? navigate('staff-dashboard') : navigate('book')} aria-label={isStaff ? 'Go to staff calendar' : 'Go to booking page'} className="flex cursor-pointer items-center gap-2 group rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
              <AngledLogo size="xs" />
              <span className="text-[2rem] font-semibold leading-none text-primary tracking-tight group-hover:text-primary-dark dark:group-hover:text-white transition-colors active:scale-95">SLOTZ</span>
            </button>

            <div className="flex items-center gap-1 md:gap-2">
              {isStaff && (
                <div className="mr-1 flex items-center gap-1 border-r border-primary-border/70 pr-2 dark:border-primary/20 md:mr-2 md:gap-2 md:pr-3">
                  {page === 'staff-dashboard' || page === 'staff-settings' ? (
                    <button 
                      type="button"
                      aria-label="Open public booking view"
                      onClick={handleViewPublic} 
                      className="min-h-10 p-2 md:px-3 md:py-2 flex items-center gap-2 bg-white/0 hover:bg-primary-light dark:hover:bg-primary/10 rounded-lg font-semibold text-[10px] uppercase tracking-[0.14em] transition-all text-primary-text-muted hover:text-[var(--text-secondary)] dark:!text-white/70 dark:hover:!text-white"
                    >
                      <EyeIcon className="w-5 h-5" />
                      <span className="hidden md:inline">Public</span>
                    </button>
                  ) : (
                    <button 
                      type="button"
                      aria-label="Return to staff calendar"
                      onClick={() => navigate('staff-dashboard')} 
                      className="min-h-10 p-2 md:px-3 md:py-2 flex items-center gap-2 bg-white/0 hover:bg-primary-light dark:hover:bg-primary/10 rounded-lg font-semibold text-[10px] uppercase tracking-[0.14em] transition-all text-primary-text-muted hover:text-[var(--text-secondary)] dark:!text-white/70 dark:hover:!text-white"
                    >
                      <ClockIcon className="w-5 h-5" />
                      <span className="hidden md:inline">Staff</span>
                    </button>
                  )}
                  <button type="button" onClick={handleToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} className="min-h-10 p-2 hover:bg-primary-light dark:hover:bg-primary/10 rounded-lg transition-all text-primary-text-muted hover:text-[var(--text-secondary)] dark:!text-white/70 dark:hover:!text-white">
                    {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                  </button>
                  <button type="button" onClick={() => setIsSettingsSheetOpen(true)} aria-label="Open settings" className="md:hidden min-h-10 p-2 hover:bg-primary-light dark:hover:bg-primary/10 rounded-lg transition-all text-primary-text-muted hover:text-[var(--text-secondary)] dark:!text-white/70 dark:hover:!text-white">
                    <SettingsIcon className="w-5 h-5" />
                  </button>
                  <button type="button" onClick={() => navigate('staff-settings')} aria-label="Open settings" className="hidden md:block min-h-10 p-2 hover:bg-primary-light dark:hover:bg-primary/10 rounded-lg transition-all text-primary-text-muted hover:text-[var(--text-secondary)] dark:!text-white/70 dark:hover:!text-white">
                    <SettingsIcon className="w-5 h-5" />
                  </button>
                  <button type="button" onClick={async () => {
                    try {
                      // Sign out from Supabase
                      await supabase.auth.signOut();
                      // Clear localStorage
                      localStorage.removeItem('staffEmail');
                      localStorage.removeItem('staffLoginTimestamp');
                      // Update app state
                      setIsStaff(false);
                      navigate('home');
                    } catch (error) {
                      console.error('Error during logout:', error);
                      // Still navigate to home even if logout fails
                      setIsStaff(false);
                      navigate('home');
                    }
                  }} aria-label="Sign out" className="slotz-danger-action min-h-10 p-2 rounded-lg transition-all">
                    <LogOutIcon className="w-5 h-5" />
                  </button>
                </div>
              )}
              {!isStaff && (
                <button type="button" onClick={handleToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} className="min-h-10 p-2 hover:bg-primary-light dark:hover:bg-primary/10 rounded-lg transition-all text-primary-text-muted hover:text-[var(--text-secondary)] dark:!text-white/70 dark:hover:!text-white">
                  {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                </button>
              )}
            </div>
          </div>
        </nav>
      )}

      <main className="flex-grow flex flex-col">
        {renderPage()}
      </main>
    </div>
  );
};

export default App;
