import React, { useState, useEffect } from 'react';
import { supabaseDb } from '../services/supabaseDb';
import { SchedulingMeetingType, SchedulingStaffProfile } from '../types';
import { getBookingColors } from '../constants/index';
import { TagIcon, GlobeIcon } from './Icons';
import { getTimezoneName } from '../utils/dateUtils';

const Legend: React.FC = () => {
    const [meetingTypes, setMeetingTypes] = useState<SchedulingMeetingType[]>([]);
    const [staffProfile, setStaffProfile] = useState<SchedulingStaffProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [types, profile] = await Promise.all([
                    supabaseDb.getMeetingTypes(),
                    supabaseDb.getStaffProfile()
                ]);
                setMeetingTypes(types);
                setStaffProfile(profile);
            } catch (error) {
                console.error('Error loading legend data:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    if (isLoading) {
        return null;
    }

    const timezoneName = staffProfile?.timezone 
        ? getTimezoneName(staffProfile.timezone)
        : 'UTC';

    return (
        <div className="mt-8">
            <h3 className="text-[10px] font-medium text-[var(--text-secondary)] dark:text-white/72 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <TagIcon className="w-4 h-4" />
                Legend
            </h3>
            <div className="space-y-2">
                {meetingTypes.map(mt => {
                    // Use the same color logic as the calendar
                    const colors = getBookingColors({ meeting_type_id: mt.id }, meetingTypes);
                    
                    return (
                        <div key={mt.id} className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${colors.bg} ${colors.darkBg} border-2 ${colors.border} ${colors.darkBorder}`}></div>
                            <span className="text-xs sm:text-sm font-normal text-[var(--text-secondary)] dark:text-white/82">{mt.name}</span>
                        </div>
                    );
                })}
                <div className="flex items-center gap-3">
                    <div className="slotz-external-legend-dot h-3 w-3 rounded-full border-2 bg-transparent"></div>
                    <span className="text-xs sm:text-sm font-normal text-[var(--text-secondary)] dark:text-white/82">External Booking</span>
                </div>
            </div>

            {/* Timezone Indicator */}
            {staffProfile?.timezone && (
                <div className="mt-6 pt-4 border-t border-primary-border/30 dark:border-white/10">
                    <div className="flex items-start gap-3">
                        <GlobeIcon className="w-5 h-5 text-[var(--text-secondary)] dark:text-white/70 mt-1" />
                        <div className="flex-1">
                            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--text-secondary)] dark:text-white/72 mb-1">Timezone</p>
                            <p className="text-base font-semibold text-[var(--text-secondary)] dark:text-white">{timezoneName}</p>
                            <p className="text-xs text-[var(--text-secondary)] dark:text-white/76 mt-1">{staffProfile.timezone}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Legend;
