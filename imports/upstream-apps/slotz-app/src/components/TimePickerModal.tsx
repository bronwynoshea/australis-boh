import React, { useMemo, useRef, useEffect } from 'react';
import { XIcon } from './Icons';

interface TimePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectTime: (time: string) => void;
    selectedValue: string;
}

const TimePickerModal: React.FC<TimePickerModalProps> = ({ isOpen, onClose, onSelectTime, selectedValue }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    const timeOptions = useMemo(() => {
        const options = [];
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 15) {
                const hour = h.toString().padStart(2, '0');
                const minute = m.toString().padStart(2, '0');
                const time = `${hour}:${minute}:00`;
                const ampm = h >= 12 ? 'PM' : 'AM';
                const displayHour = h % 12 === 0 ? 12 : h % 12;
                const displayTime = `${displayHour}:${minute} ${ampm}`;
                options.push({ value: time, label: displayTime });
            }
        }
        return options;
    }, []);

    useEffect(() => {
        if (isOpen && scrollRef.current) {
            const selectedElement = scrollRef.current.querySelector(`[data-value="${selectedValue}"]`);
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'center', behavior: 'auto' });
            }
        }
    }, [isOpen, selectedValue]);
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[102] flex flex-col animate-fade-in md:items-stretch md:justify-end" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
            <div className="relative z-10 mt-auto flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl border border-primary-border bg-white shadow-xl animate-slide-in-up dark:border-white/10 dark:bg-darkcard md:ml-auto md:mt-0 md:h-full md:max-h-none md:w-[24rem] md:!rounded-none md:animate-fade-in" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-primary-border dark:border-white/5">
                    <h3 className="text-lg font-semibold text-[var(--text-secondary)] dark:text-white">Select a time</h3>
                    <button type="button" onClick={onClose} aria-label="Close time picker" className="p-2 rounded-full hover:bg-primary-light dark:hover:bg-white/5">
                        <XIcon className="w-5 h-5" />
                    </button>
                </header>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-2">
                    {timeOptions.map(opt => {
                        const isSelected = selectedValue === opt.value;
                        return (
                            <button
                                type="button"
                                key={opt.value}
                                data-value={opt.value}
                                onClick={() => onSelectTime(opt.value)}
                                className={`w-full text-center p-3 rounded-lg text-lg font-semibold my-1 transition-colors ${isSelected ? 'bg-primary text-white' : 'text-[var(--text-secondary)] hover:bg-primary-light dark:text-white dark:hover:bg-white/5'}`}
                            >
                                {opt.label}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};

export default TimePickerModal;
