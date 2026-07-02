import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { getUSPublicHolidays } from '../utils/holidayUtils';
import { SchedulingBlackoutDate } from '../types';
import { formatDate } from '../utils/dateUtils';
import { XIcon } from './Icons';

interface PublicHoliday {
    name: string;
    date: Date;
}

interface PublicHolidaysModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddHolidays: (dates: Date[]) => void;
    year: number;
    existingBlackoutDates: SchedulingBlackoutDate[];
}

const PublicHolidaysModal: React.FC<PublicHolidaysModalProps> = ({ isOpen, onClose, onAddHolidays, year, existingBlackoutDates }) => {
    const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
    const [selectedHolidays, setSelectedHolidays] = useState<Date[]>([]);
    
    useEffect(() => {
        if (isOpen) {
            const allHolidays = getUSPublicHolidays(year);
            const existingDates = existingBlackoutDates.map(bd => new Date(bd.date + 'T00:00:00').toDateString());
            
            const availableHolidays = allHolidays.filter(h => !existingDates.includes(h.date.toDateString()));
            setHolidays(availableHolidays);
            setSelectedHolidays([]); // Reset selection when opening
        }
    }, [isOpen, year, existingBlackoutDates]);

    const handleToggleHoliday = (date: Date) => {
        setSelectedHolidays(prev => 
            prev.some(d => d.getTime() === date.getTime())
                ? prev.filter(d => d.getTime() !== date.getTime())
                : [...prev, date]
        );
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedHolidays(holidays.map(h => h.date));
        } else {
            setSelectedHolidays([]);
        }
    };
    
    const handleSubmit = () => {
        onAddHolidays(selectedHolidays);
        onClose();
    };

    if (!isOpen) return null;
    
    const areAllSelected = holidays.length > 0 && selectedHolidays.length === holidays.length;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[102] flex items-end md:items-stretch md:justify-end animate-fade-in">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl border border-primary-border bg-white shadow-xl dark:border-white/10 dark:bg-darkcard md:h-full md:max-h-none md:w-[34rem] md:!rounded-none">
                <div className="p-6 border-b border-primary-border dark:border-white/5 flex justify-between items-center">
                    <h2 className="text-xl font-semibold tracking-tight text-[var(--text-secondary)] dark:text-white">Add US Public Holidays ({year})</h2>
                    <button type="button" onClick={onClose} aria-label="Close public holidays" className="p-2 rounded-full hover:bg-primary-light dark:hover:bg-white/5">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {holidays.length > 0 ? (
                        <div className="space-y-3">
                            <div className="slotz-settings-control flex items-center rounded-lg px-3 py-2.5">
                                <input
                                    type="checkbox"
                                    id="select-all"
                                    checked={areAllSelected}
                                    onChange={handleSelectAll}
                                    className="h-5 w-5 appearance-none rounded-md border border-primary/30 bg-transparent transition-colors checked:border-primary checked:bg-primary checked:bg-[linear-gradient(135deg,transparent_42%,white_42%,white_58%,transparent_58%),linear-gradient(45deg,transparent_50%,white_50%,white_66%,transparent_66%)] checked:bg-[length:55%_55%,70%_70%] checked:bg-[position:35%_56%,58%_50%] checked:bg-no-repeat focus:outline-none focus:ring-4 focus:ring-primary/15 dark:border-primary/35"
                                />
                                <label htmlFor="select-all" className="ml-3 font-semibold text-sm text-[var(--text-secondary)] dark:text-white">
                                    Select All ({holidays.length} available)
                                </label>
                            </div>
                            {holidays.map(holiday => {
                                const isSelected = selectedHolidays.some(d => d.getTime() === holiday.date.getTime());
                                return (
                                    <div key={holiday.name} className="flex items-center rounded-lg px-3 py-2.5 transition-colors hover:bg-primary-light/40 dark:hover:bg-primary/10">
                                        <input
                                            type="checkbox"
                                            id={holiday.name}
                                            checked={isSelected}
                                            onChange={() => handleToggleHoliday(holiday.date)}
                                            className="h-5 w-5 appearance-none rounded-md border border-primary/30 bg-transparent transition-colors checked:border-primary checked:bg-primary checked:bg-[linear-gradient(135deg,transparent_42%,white_42%,white_58%,transparent_58%),linear-gradient(45deg,transparent_50%,white_50%,white_66%,transparent_66%)] checked:bg-[length:55%_55%,70%_70%] checked:bg-[position:35%_56%,58%_50%] checked:bg-no-repeat focus:outline-none focus:ring-4 focus:ring-primary/15 dark:border-primary/35"
                                        />
                                        <label htmlFor={holiday.name} className="ml-3 flex-1 flex justify-between items-center cursor-pointer">
                                            <span className="font-semibold text-sm text-primary-text-muted dark:text-white/80">{holiday.name}</span>
                                            <span className="text-sm font-medium text-[var(--text-muted)] dark:text-white/68">{formatDate(holiday.date)}</span>
                                        </label>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-primary-text-muted dark:text-white/50">
                            <p className="font-semibold">All public holidays for {year} have already been added.</p>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-primary-light/50 dark:bg-white/[0.02] border-t border-primary-border dark:border-white/5 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-3 rounded-xl bg-white dark:bg-darkcard border border-primary-border dark:border-white/10 font-semibold text-sm text-[var(--text-secondary)] dark:text-white hover:bg-primary-light dark:hover:bg-white/5">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={selectedHolidays.length === 0}
                        className="px-5 py-3 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-50 hover:bg-primary-dark"
                    >
                        Add {selectedHolidays.length > 0 ? `(${selectedHolidays.length})` : ''} Day(s)
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PublicHolidaysModal;
