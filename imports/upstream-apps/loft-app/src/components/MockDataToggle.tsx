import React, { useState, useEffect } from 'react';
import { 
  Beaker, 
  Users, 
  Eye, 
  EyeOff, 
  ChevronDown,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { 
  isMockModeEnabled, 
  setMockMode, 
  MOCK_SCENARIOS 
} from '../utils/mockParticipants';
import { useSupabaseUser } from '@/services/supabaseApi';

const MockDataToggle: React.FC = () => {
  const { profile } = useSupabaseUser();
  const [isEnabled, setIsEnabled] = useState(isMockModeEnabled());
  const [selectedScenario, setSelectedScenario] = useState(
    localStorage.getItem('LOFT_MOCK_SCENARIO') || 'medium'
  );
  const [isExpanded, setIsExpanded] = useState(false);

  // Only show in development AND for super users
  const isSuperUser = (profile as any)?.user_type_id === 5;
  if (!import.meta.env.DEV || !isSuperUser) {
    return null;
  }

  const toggleMockMode = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    setMockMode(newState);
    
    if (newState) {
      // Reload to apply mock data
      window.location.reload();
    }
  };

  const changeScenario = (scenario: string) => {
    localStorage.setItem('LOFT_MOCK_SCENARIO', scenario);
    setSelectedScenario(scenario);
    window.location.reload();
  };

  return (
    <div className="fixed bottom-4 left-4 z-[9999]">
      <div className="bg-slate-800 rounded-xl border-2 border-purple-500/50 shadow-2xl overflow-hidden">
        {/* Toggle Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-700 transition-all"
        >
          <Beaker className="w-5 h-5 text-purple-400" />
          <div className="flex-1 text-left">
            <div className="text-sm font-bold text-white">Mock Data</div>
            <div className="text-xs text-white/60">
              {isEnabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>
          <ChevronDown 
            className={`w-5 h-5 text-white/60 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`} 
          />
        </button>

        {/* Expanded Panel */}
        {isExpanded && (
          <div className="border-t border-white/10 p-4 space-y-4">
            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">
                Mock Mode
              </span>
              <button
                onClick={toggleMockMode}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
                  isEnabled
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-700 text-white/60'
                }`}
              >
                {isEnabled ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    ON
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <XCircle className="w-4 h-4" />
                    OFF
                  </span>
                )}
              </button>
            </div>

            {/* Scenario Selector */}
            {isEnabled && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/60 uppercase tracking-wider">
                  Scenario
                </label>
                <select
                  value={selectedScenario}
                  onChange={(e) => changeScenario(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-white/10 rounded-lg text-sm text-white focus:border-purple-500 focus:outline-none"
                >
                  {Object.keys(MOCK_SCENARIOS).map((scenario) => (
                    <option key={scenario} value={scenario}>
                      {scenario.charAt(0).toUpperCase() + scenario.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Info */}
            <div className="text-xs text-white/60 space-y-1">
              <p>• Toggle ON to see mock participants</p>
              <p>• Choose scenario to test layouts</p>
              <p>• Auto-refreshes on change</p>
            </div>

            {/* Quick Actions */}
            <div className="pt-2 border-t border-white/10 space-y-2">
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="w-full px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
              >
                Clear All & Reload
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MockDataToggle;
