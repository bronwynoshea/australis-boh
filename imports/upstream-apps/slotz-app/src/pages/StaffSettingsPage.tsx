import React from 'react';
import { Page, SettingsPage } from '../App';
import { ChevronLeft, ClockIcon, TagIcon, Share2Icon, CalendarOffIcon } from '../components/Icons';
import IntegratedFooter from '../components/IntegratedFooter';
import AvailabilityEditor from '../components/AvailabilityEditor';
import MeetingTypesEditor from '../components/MeetingTypesEditor';
import IntegrationsView from '../components/IntegrationsView';
import BlackoutDatesEditor from '../components/BlackoutDatesEditor';

interface StaffSettingsPageProps {
    navigate: (page: Page) => void;
    setFeedback: (message: string) => void;
    initialTab: SettingsPage;
    setInitialTab: (tab: SettingsPage) => void;
    integrationMessage?: string | null;
}

const StaffSettingsPage: React.FC<StaffSettingsPageProps> = ({ navigate, setFeedback, initialTab, setInitialTab, integrationMessage }) => {
    const tabs: { id: SettingsPage, label: string, icon: React.JSX.Element }[] = [
        { id: 'availability', label: 'Availability', icon: <ClockIcon className="w-5 h-5" /> },
        { id: 'meetingTypes', label: 'Meetings', icon: <TagIcon className="w-5 h-5" /> },
        { id: 'blackouts', label: 'Time Off', icon: <CalendarOffIcon className="w-5 h-5" /> },
        { id: 'integrations', label: 'Integrations', icon: <Share2Icon className="w-5 h-5" /> },
    ];

    const activeTab = initialTab;
    const setActiveTab = setInitialTab;

    return (
        <div className="hidden w-full flex-grow animate-fade-in flex-col px-4 md:flex md:h-[calc(100vh-4.5rem)] md:px-8 md:pb-4 md:pt-5">
            <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-none text-[var(--text-secondary)] dark:text-white">Settings</h1>
                    <button onClick={() => navigate('staff-dashboard')} className="min-h-10 inline-flex items-center text-primary-text-muted hover:text-primary dark:text-white/70 dark:hover:text-white font-semibold uppercase tracking-[0.18em] text-[10px] self-start md:self-center">
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        Back to Calendar
                    </button>
                </div>

                <div className="border-b border-primary-border dark:border-white/10">
                    <nav className="-mb-px flex space-x-1 md:space-x-4" aria-label="Tabs">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`${
                                    activeTab === tab.id
                                    ? 'border-primary text-primary dark:text-white'
                                    : 'border-transparent text-[var(--text-secondary)] hover:border-primary-border hover:text-primary dark:text-white/70 dark:hover:border-primary/30 dark:hover:text-white'
                                } whitespace-nowrap rounded-t-lg py-3 px-2 md:px-3 border-b-2 font-semibold text-xs md:text-sm uppercase tracking-wider flex items-center gap-2 transition-colors`}
                            >
                                {React.cloneElement(tab.icon, { className: 'w-4 h-4' })}
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto pt-4 pr-2 transition-all duration-300">
                    {activeTab === 'availability' && <AvailabilityEditor />}
                    {activeTab === 'meetingTypes' && <MeetingTypesEditor setFeedback={setFeedback} />}
                    {activeTab === 'blackouts' && <BlackoutDatesEditor setFeedback={setFeedback} />}
                    {activeTab === 'integrations' && <IntegrationsView setFeedback={setFeedback} initialStatusMessage={integrationMessage} />}
                </div>
            </div>
            <IntegratedFooter className="mt-4 shrink-0 pb-1" />
        </div>
    );
};

export default StaffSettingsPage;
