import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Circle, Settings, Users, Video, Grid3x3, User, ChevronDown, Monitor } from 'lucide-react';

type LayoutMode = 'grid' | 'spotlight' | 'sidebar' | 'screenShare';

interface PersonalRoomHeaderProps {
  roomTitle?: string;
  participantCount: number;
  isRecorded: boolean;
  isRecordingActive?: boolean;
  isHost?: boolean;

  onOpenSetup: () => void;
  onOpenSidebar: () => void;
  onToggleRecording?: () => void;
  onScenarioChange?: (scenario: string) => void;
  currentScenario?: string;
  onLayoutChange?: (layout: LayoutMode, e?: React.MouseEvent) => void;
  currentLayout?: LayoutMode;
  pendingRequestCount?: number;
  isScreenSharing?: boolean;
}

const PersonalRoomHeader: React.FC<PersonalRoomHeaderProps> = ({
  roomTitle,
  participantCount,
  isRecorded,
  isRecordingActive = false,
  isHost = false,
  onOpenSetup,
  onOpenSidebar,
  onToggleRecording,
  onScenarioChange,
  currentScenario = 'none',
  onLayoutChange,
  currentLayout = 'grid',
  pendingRequestCount = 0,
  isScreenSharing = false,
}) => {

  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showScenarioMenu, setShowScenarioMenu] = useState(false);
  const layoutMenuRef = useRef<HTMLDivElement>(null);
  const scenarioMenuRef = useRef<HTMLDivElement>(null);
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  });

  const handleOpenSetup = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpenSetup();
  }, [onOpenSetup]);

  const handleOpenSidebar = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpenSidebar();
  }, [onOpenSidebar]);

  const handleToggleRecording = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggleRecording) {
      onToggleRecording();
    }
  }, [onToggleRecording]);

  const handleLayoutChange = useCallback((layout: LayoutMode, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onLayoutChange) {
      onLayoutChange(layout, e);
    }
    setShowLayoutMenu(false);
  }, [onLayoutChange]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(event.target as Node)) {
        setShowLayoutMenu(false);
      }
      if (scenarioMenuRef.current && !scenarioMenuRef.current.contains(event.target as Node)) {
        setShowScenarioMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const updateThemeFlag = () => {
      setIsDarkTheme(document.documentElement.classList.contains('dark'));
    };
    updateThemeFlag();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          updateThemeFlag();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const layoutOptions: { value: LayoutMode; label: string; icon: typeof Grid3x3 }[] = [
    { value: 'grid', label: 'Grid', icon: Grid3x3 },
    { value: 'spotlight', label: 'Spotlight', icon: User },
    { value: 'sidebar', label: 'Sidebar', icon: Users },
  ];
  const scenarioOptions = [
    { value: 'none', label: 'Live only' },
    { value: 'mock-4', label: 'Preview 4' },
    { value: 'mock-9', label: 'Preview 9' },
    { value: 'mock-16', label: 'Preview 16' },
    { value: 'mock-20', label: 'Preview 20' },
  ];

  const currentLayoutOption = layoutOptions.find(opt => opt.value === currentLayout) || layoutOptions[0];
  const CurrentIcon = currentLayoutOption.icon;
  const currentScenarioOption = scenarioOptions.find(opt => opt.value === currentScenario) || scenarioOptions[0];

  const layoutMenuClasses = isDarkTheme
    ? 'bg-[var(--loft-glass-strong)] border border-[var(--loft-border)] shadow-2xl shadow-black/40'
    : 'bg-[var(--loft-glass-strong)] border border-[var(--loft-border)] shadow-2xl shadow-black/20';
  const headerIconButtonClass = 'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--loft-border)] bg-[var(--loft-surface-2)] text-[var(--loft-text)] shadow-lg shadow-black/10 transition-colors hover:bg-[var(--loft-surface-strong)]';
  const headerDropdownButtonClass = 'flex h-10 flex-shrink-0 items-center gap-2 rounded-xl border border-[var(--loft-border)] bg-[var(--loft-surface-2)] px-2 text-[var(--loft-text)] shadow-lg shadow-black/10 transition-all hover:border-cafe/35 hover:bg-[var(--loft-surface-strong)] sm:px-3';
  const menuItemClass = 'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all';

  return (
    <header 
      className="px-3 md:px-6 py-4 flex items-center justify-between border-b border-[var(--loft-border)] backdrop-blur-3xl bg-transparent relative z-[100]" 
      style={{ 
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        WebkitTapHighlightColor: 'transparent', 
        WebkitUserSelect: 'none', 
        userSelect: 'none', 
        touchAction: 'manipulation' 
      }}
    >
      <div className="flex flex-col min-w-0">
        <h1 className="text-md md:text-2xl font-bold uppercase tracking-tighter text-[var(--loft-text)] truncate max-w-[200px] md:max-w-md">
          {roomTitle || 'Personal Table'}
        </h1>
        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-2 text-muted text-[9px] md:text-[10px] font-bold uppercase tracking-widest">
            <Users className="w-3 h-3" /> {participantCount} Active
          </div>
          {/* 🔥 FIX: Screen sharing indicator */}
          {isScreenSharing && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[8px] md:text-[9px] font-bold uppercase tracking-widest bg-cafe/10 text-cafe border-cafe/25 animate-pulse">
              <Monitor className="w-2 h-2" />
              Sharing
            </div>
          )}
          {isRecordingActive && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[8px] md:text-[9px] font-black uppercase tracking-widest bg-red-600 text-white border-red-500 shadow-lg shadow-red-500/25"
              role="status"
              aria-live="polite"
              aria-label="Recording is active"
            >
              <Circle className="w-2 h-2 fill-current animate-pulse" />
              Recording now
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {onLayoutChange && (
          <div className="relative" ref={layoutMenuRef}>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowLayoutMenu(!showLayoutMenu);
              }}
              className={headerDropdownButtonClass}
              type="button"
              aria-label={`Change layout: ${currentLayoutOption.label}`}
              data-loft-tooltip={`Layout: ${currentLayoutOption.label}`}
              data-loft-tooltip-placement="bottom"
            >
              <CurrentIcon className="w-4 h-4" />
              <span className="hidden text-[10px] font-black uppercase tracking-[0.18em] sm:inline">
                {currentLayoutOption.label}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${showLayoutMenu ? 'rotate-180' : ''}`} />
            </button>

            {showLayoutMenu && (
              <div className={`absolute right-0 mt-2 w-52 rounded-2xl p-1.5 z-[200] backdrop-blur-2xl ${layoutMenuClasses}`}>
                {layoutOptions.map((option) => {
                  const OptionIcon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={(e) => handleLayoutChange(option.value, e)}
                      className={`${menuItemClass} ${
                        currentLayout === option.value
                          ? 'bg-cafe/15 text-[var(--loft-text)] shadow-inner shadow-cafe/15'
                          : 'text-muted hover:bg-[var(--loft-surface-2)] hover:text-[var(--loft-text)]'
                      }`}
                      type="button"
                    >
                      <OptionIcon className="w-4 h-4" />
                      <span className="text-[11px] font-bold uppercase tracking-widest">
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {isHost && onToggleRecording && (
          <button
            onClick={handleToggleRecording}
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border transition-colors ${
              isRecordingActive
                ? 'bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20'
                : 'bg-[var(--loft-surface-2)] border-[var(--loft-border)] text-[var(--loft-text)] hover:bg-[var(--loft-surface-strong)]'
            }`}
            type="button"
            aria-label={isRecordingActive ? 'Stop recording' : 'Start recording'}
            data-loft-tooltip={isRecordingActive ? 'Stop recording' : 'Start recording'}
            data-loft-tooltip-placement="bottom"
          >
            <Video className="w-4 h-4" />
          </button>
        )}

        {onScenarioChange && (
          <div className="relative" ref={scenarioMenuRef}>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowScenarioMenu(!showScenarioMenu);
              }}
              className={headerDropdownButtonClass}
              type="button"
              aria-label="Preview participants"
              data-loft-tooltip="Preview participants"
              data-loft-tooltip-placement="bottom"
            >
              <Users className="w-4 h-4" />
              <span className="hidden text-[10px] font-black uppercase tracking-[0.18em] sm:inline">
                {currentScenario === 'none' ? 'Preview' : currentScenarioOption.label.replace('Preview ', '')}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${showScenarioMenu ? 'rotate-180' : ''}`} />
            </button>

            {showScenarioMenu && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl p-1.5 z-[200] backdrop-blur-2xl bg-[var(--loft-glass-strong)] border border-[var(--loft-border)] shadow-2xl shadow-black/30">
                {scenarioOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onScenarioChange(option.value);
                      setShowScenarioMenu(false);
                    }}
                    className={`${menuItemClass} ${
                      currentScenario === option.value
                        ? 'bg-cafe/15 text-[var(--loft-text)] shadow-inner shadow-cafe/15'
                        : 'text-muted hover:bg-[var(--loft-surface-2)] hover:text-[var(--loft-text)]'
                    }`}
                    type="button"
                  >
                    <Users className="w-4 h-4" />
                    <span className="text-[11px] font-bold uppercase tracking-widest">
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {isHost && (
          <div className="relative">
            <button
              onClick={handleOpenSidebar}
              className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-all duration-300 ${
                pendingRequestCount > 0
                  ? 'bg-cafe/20 text-cafe border-2 border-cafe/50 hover:bg-cafe/30 shadow-lg shadow-cafe/20'
                  : 'bg-[var(--loft-surface-2)] text-[var(--loft-text)] border border-[var(--loft-border)] hover:bg-[var(--loft-surface-strong)]'
              }`}
              type="button"
              aria-label={pendingRequestCount > 0 ? `Host Controls - ${pendingRequestCount} pending` : 'Host Controls'}
              data-loft-tooltip={pendingRequestCount > 0 ? `${pendingRequestCount} pending request${pendingRequestCount !== 1 ? 's' : ''}` : 'Host controls'}
              data-loft-tooltip-placement="bottom"
            >
              <Users className={`w-4 h-4 ${pendingRequestCount > 0 ? 'animate-bounce' : ''}`} />
            </button>
            {/* 🔥 FIX: Enhanced prominent notification badge with count and pulsing ring */}
            {pendingRequestCount > 0 && (
              <>
                {/* Count badge */}
                <div className="absolute -top-2.5 -right-2.5 min-w-[24px] h-6 bg-cafe rounded-full flex items-center justify-center text-[var(--loft-accent-contrast)] text-[11px] font-bold shadow-lg shadow-cafe/30 border-2 border-[var(--loft-bg)] z-10 animate-pulse">
                  {pendingRequestCount > 99 ? '99+' : pendingRequestCount}
                </div>
                {/* Pulsing ring effect */}
                <div className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-cafe/40 animate-ping"></div>
                {/* Secondary slower pulse */}
                <div className="absolute -top-3 -right-3 w-7 h-7 rounded-full border-2 border-cafe/25 animate-pulse"></div>
              </>
            )}
          </div>
        )}

        <button
          onClick={handleOpenSetup}
          className={headerIconButtonClass}
          type="button"
          aria-label="Settings"
          data-loft-tooltip="Settings"
          data-loft-tooltip-placement="bottom"
        >
          <Settings className="w-4 h-4 text-[var(--loft-text)]" />
        </button>
      </div>
    </header>
  );
};

export default PersonalRoomHeader;
