import React from 'react';
import { SettingsPage } from '../App';
import { XIcon } from './Icons';
import AvailabilityEditor from './AvailabilityEditor';
import MeetingTypesEditor from './MeetingTypesEditor';
import IntegrationsView from './IntegrationsView';
import BlackoutDatesEditor from './BlackoutDatesEditor';

interface SettingsViewProps {
    view: SettingsPage;
    onClose: () => void;
    setFeedback: (message: string) => void;
    integrationMessage?: string | null;
}

const SettingsView: React.FC<SettingsViewProps> = ({ view, onClose, setFeedback, integrationMessage }) => {
    
    const titles: Record<SettingsPage, string> = {
        availability: 'Availability',
        meetingTypes: 'Meeting Types',
        integrations: 'Integrations',
        blackouts: 'Time Off'
    };

    const renderContent = () => {
        switch (view) {
            case 'availability':
                return <AvailabilityEditor />;
            case 'meetingTypes':
                return <MeetingTypesEditor setFeedback={setFeedback} />;
            case 'integrations':
                return <IntegrationsView setFeedback={setFeedback} initialStatusMessage={integrationMessage} />;
            case 'blackouts':
                return <BlackoutDatesEditor setFeedback={setFeedback} />;
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-[101] bg-white dark:bg-darkbg flex flex-col animate-fade-in md:hidden">
            <header className="flex items-center justify-between p-4 border-b border-primary-border dark:border-white/10 flex-shrink-0">
                <h2 className="text-lg font-semibold text-[var(--text-secondary)] dark:text-white">{titles[view]}</h2>
                <button onClick={onClose} aria-label="Close settings" className="min-h-10 p-2 rounded-lg hover:bg-primary-light dark:hover:bg-white/5">
                    <XIcon className="w-5 h-5" />
                </button>
            </header>
            <main className="flex-grow overflow-y-auto p-4">
                {renderContent()}
            </main>
        </div>
    );
};

export default SettingsView;
