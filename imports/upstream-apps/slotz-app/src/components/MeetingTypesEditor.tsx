import React, { useState, useEffect, useRef } from 'react';
import { supabaseDb } from '../services/supabaseDb';
import { SchedulingMeetingType, SchedulingStaffProfile } from '../types';
import { CopyIcon, PlusIcon, TrashIcon, MoreVerticalIcon, PowerIcon } from './Icons';
import ConfirmationModal from './ConfirmationModal';

interface MeetingCardProps {
    meetingType: SchedulingMeetingType;
    staffSlug: string;
    onUpdate: (id: string, field: keyof SchedulingMeetingType, value: any) => void;
    onDelete: (meetingType: SchedulingMeetingType) => void;
    onCopyLink: (slug: string) => void;
}

const MeetingCard: React.FC<MeetingCardProps> = ({ meetingType, staffSlug, onUpdate, onDelete, onCopyLink }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const [localSlug, setLocalSlug] = useState(meetingType.slug);
    const [hasCopied, setHasCopied] = useState(false);
    const [isEditingLink, setIsEditingLink] = useState(false);
    const bookingPathPreview = `.../${staffSlug}/${meetingType.slug}`;

    useEffect(() => {
        setLocalSlug(meetingType.slug);
    }, [meetingType.slug]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLocalSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSlug = e.target.value
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/--+/g, '-');
        setLocalSlug(newSlug);
    };
    
    const handleSlugBlur = () => {
        if (localSlug !== meetingType.slug) {
            onUpdate(meetingType.id, 'slug', localSlug);
        }
    };

    const handleCopyLink = () => {
        onCopyLink(meetingType.slug);
        setHasCopied(true);
        window.setTimeout(() => setHasCopied(false), 1800);
    };

    return (
        <div className={`slotz-settings-row relative p-3 transition-colors ${meetingType.is_active ? '' : 'opacity-70'}`}>
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex-1 pr-4">
                    <input
                        type="text"
                        value={meetingType.name}
                        onChange={e => onUpdate(meetingType.id, 'name', e.target.value)}
                        className="slotz-settings-editable w-full rounded-md bg-transparent p-1 -m-1 text-base font-semibold leading-tight text-[var(--text-secondary)] outline-none transition-colors dark:text-white"
                    />
                    <textarea
                        value={meetingType.description}
                        onChange={e => onUpdate(meetingType.id, 'description', e.target.value)}
                        className="slotz-settings-editable mt-1 h-auto w-full resize-none rounded-md bg-transparent p-1 -m-1 text-xs font-medium leading-snug text-primary-text-muted outline-none transition-colors dark:text-white/60"
                        placeholder="Add a description..."
                        rows={1}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] ${meetingType.is_active ? 'slotz-status-active' : 'slotz-status-inactive'}`}>
                        {meetingType.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <div className="relative" ref={menuRef}>
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label={`Open ${meetingType.name} actions`} className="slotz-settings-action rounded-lg p-2 transition-colors">
                            <MoreVerticalIcon className="w-4 h-4" />
                        </button>
                        {isMenuOpen && (
                            <div className="slotz-settings-menu absolute right-0 top-full z-10 mt-2 w-40 animate-fade-in overflow-hidden rounded-lg shadow-xl">
                                <button onClick={() => { onUpdate(meetingType.id, 'is_active', !meetingType.is_active); setIsMenuOpen(false); }} className="slotz-settings-menu-item flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold transition-colors">
                                    <PowerIcon className="w-4 h-4" />
                                    {meetingType.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                                <button onClick={() => { setIsEditingLink(true); setIsMenuOpen(false); }} className="slotz-settings-menu-item flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold transition-colors">
                                    <CopyIcon className="w-4 h-4" />
                                    Edit link
                                </button>
                                <div className="slotz-settings-divider my-1 h-px"></div>
                                <button onClick={() => { onDelete(meetingType); setIsMenuOpen(false); }} className="slotz-danger-action flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold transition-colors">
                                    <TrashIcon className="w-4 h-4" />
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                    <label className="slotz-settings-control rounded-lg px-3 py-1.5">
                        <span className="slotz-settings-label block text-[10px] font-semibold uppercase tracking-[0.16em]">Duration</span>
                        <span className="mt-1 flex items-baseline gap-1">
                            <input
                                type="number"
                                value={meetingType.duration_minutes}
                                onChange={e => onUpdate(meetingType.id, 'duration_minutes', parseInt(e.target.value) || 0)}
                                className="w-10 bg-transparent text-base font-semibold leading-none text-[var(--text-secondary)] outline-none dark:text-white"
                            />
                            <span className="text-xs font-semibold text-primary-text-muted">min</span>
                        </span>
                    </label>
                    <label className="slotz-settings-control rounded-lg px-3 py-1.5">
                        <span className="slotz-settings-label block text-[10px] font-semibold uppercase tracking-[0.16em]">Buffer after</span>
                        <span className="mt-1 flex items-baseline gap-1">
                            <input
                                type="number"
                                value={meetingType.buffer_minutes_after}
                                onChange={e => onUpdate(meetingType.id, 'buffer_minutes_after', parseInt(e.target.value) || 0)}
                                className="w-10 bg-transparent text-base font-semibold leading-none text-[var(--text-secondary)] outline-none dark:text-white"
                            />
                            <span className="text-xs font-semibold text-primary-text-muted">min</span>
                        </span>
                    </label>
                </div>

                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="slotz-settings-label text-[10px] font-semibold uppercase tracking-[0.16em]">Booking page</p>
                        <p className="slotz-public-link-font mt-0.5 truncate text-primary-text-muted dark:text-white/70">{bookingPathPreview}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <a
                            href={`#/${staffSlug}/${meetingType.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="slotz-settings-control flex min-h-9 items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors dark:text-white"
                        >
                            Test link
                        </a>
                        <button
                            onClick={handleCopyLink}
                            aria-label={`Copy ${meetingType.name} booking link`}
                            className="slotz-settings-control flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-primary transition-colors"
                        >
                            <CopyIcon className="w-4 h-4" />
                            <span>Copy link</span>
                        </button>
                    </div>
                </div>

                {isEditingLink && (
                    <div>
                        <label className="slotz-settings-label mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em]">Edit link slug</label>
                        <div className="flex items-center gap-2">
                             <div className="slotz-settings-control slotz-public-link-font flex min-w-0 flex-1 items-center overflow-hidden rounded-lg">
                                <span className="slotz-settings-link-prefix slotz-public-link-font whitespace-nowrap py-2.5 pl-3 pr-1">.../{staffSlug}/</span>
                                <input
                                    type="text"
                                    value={localSlug}
                                    onChange={handleLocalSlugChange}
                                    onBlur={handleSlugBlur}
                                    className="slotz-public-link-font min-w-0 flex-1 truncate bg-transparent py-2.5 pl-1 pr-2 text-primary-text-muted/85 outline-none dark:text-white/70"
                                />
                            </div>
                            <button
                                onClick={() => {
                                    handleSlugBlur();
                                    setIsEditingLink(false);
                                }}
                                className="slotz-settings-control min-h-10 rounded-lg px-3 text-xs font-semibold text-[var(--text-secondary)] dark:text-white"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )}

                {hasCopied && (
                    <p className="text-[11px] font-medium text-[var(--text-muted)]">Copied this meeting link.</p>
                )}
            </div>
        </div>
    );
};

const MeetingTypesEditor: React.FC<{
    setFeedback: (message: string) => void;
}> = ({ setFeedback }) => {
    const [meetingTypes, setMeetingTypes] = useState<SchedulingMeetingType[]>([]);
    const [staffProfile, setStaffProfile] = useState<SchedulingStaffProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [meetingToDelete, setMeetingToDelete] = useState<SchedulingMeetingType | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [profile, types] = await Promise.all([
                    supabaseDb.getStaffProfile(),
                    supabaseDb.getMeetingTypes(false)
                ]);
                setStaffProfile(profile);
                setMeetingTypes(types);
            } catch (error) {
                console.error('Error loading meeting types:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    const handleUpdate = async (id: string, field: keyof SchedulingMeetingType, value: any) => {
        let finalUpdates = { [field]: value };
        
        if (field === 'slug' && value.trim() !== '') {
            const conflictingMeeting = meetingTypes.find(mt => mt.is_active && mt.slug === value && mt.id !== id);
            if (conflictingMeeting) {
                const newSlug = `${value}-${Math.random().toString(36).substr(2, 4)}`;
                finalUpdates = { slug: newSlug };
                setFeedback(`Link was not unique. Renamed to: ${newSlug}`);
            }
        }

        const updatedTypes = meetingTypes.map(mt => mt.id === id ? { ...mt, ...finalUpdates } : mt);
        setMeetingTypes(updatedTypes);
        await supabaseDb.updateMeetingType(id, finalUpdates);
    };

    const handleAddMeeting = async () => {
        if (!staffProfile) return;

        const newMeeting = {
            staff_id: staffProfile.id,
            name: 'New Meeting',
            slug: `meeting-${Math.random().toString(36).substr(2, 5)}`,
            description: 'A newly created meeting type.',
            duration_minutes: 30,
            buffer_minutes_after: 5,
            is_active: false,
        };
        
        const addedMeeting = await supabaseDb.addMeetingType(newMeeting);
        if (addedMeeting) {
            setMeetingTypes([addedMeeting, ...meetingTypes]);
        }
    };

    const handleDelete = (meeting: SchedulingMeetingType) => {
        setMeetingToDelete(meeting);
    };

    const confirmDelete = async () => {
        if (meetingToDelete) {
            await supabaseDb.deleteMeetingType(meetingToDelete.id);
            setMeetingTypes(meetingTypes.filter(mt => mt.id !== meetingToDelete.id));
            setMeetingToDelete(null);
            setFeedback("Meeting type deleted.");
        }
    };

    const handleCopyToClipboard = (slug: string) => {
        if (!staffProfile) return;
        const url = `${window.location.origin}/#/${staffProfile.slug}/${slug}`;
        navigator.clipboard.writeText(url);
        setFeedback("Booking link copied to clipboard!");
    };

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-darkcard p-8 rounded-xl border border-primary-border dark:border-white/10 shadow-lg text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-sm text-primary-text-muted">Loading meeting types...</p>
            </div>
        );
    }

    if (!staffProfile) {
        return (
            <div className="bg-white dark:bg-darkcard p-8 rounded-xl border border-primary-border dark:border-white/10 shadow-lg text-center">
                <div role="alert" className="slotz-notice slotz-notice-error px-4 py-3 text-sm font-medium">
                    Staff profile could not be found.
                </div>
            </div>
        );
    }

    return (
        <>
            <ConfirmationModal
                isOpen={!!meetingToDelete}
                onClose={() => setMeetingToDelete(null)}
                onConfirm={confirmDelete}
                title={`Delete "${meetingToDelete?.name}"?`}
                message="Are you sure you want to permanently delete this meeting type? This action cannot be undone."
                confirmText="Yes, Delete"
            />
            <div className="flex h-full min-h-0 animate-fade-in flex-col overflow-hidden rounded-xl border border-primary-border bg-white shadow-lg dark:border-primary/20 dark:bg-darkcard">
                <div className="flex flex-col justify-between gap-4 border-b border-primary-border/70 px-5 py-4 dark:border-primary/15 md:flex-row md:items-center">
                    <div>
                        <h3 className="text-xl font-semibold tracking-tight leading-none text-[var(--text-secondary)] dark:text-white">Meetings</h3>
                        <p className="mt-2 text-sm font-medium text-[var(--text-muted)]">Define the services and appointments clients can book.</p>
                    </div>
                    <button onClick={handleAddMeeting} className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark active:scale-95 md:self-center">
                        <PlusIcon className="w-4 h-4" />
                        Add Meeting
                    </button>
                </div>
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 overflow-y-auto p-3 md:p-4 lg:grid-cols-2">
                    {meetingTypes.map(mt => (
                        <MeetingCard
                            key={mt.id}
                            meetingType={mt}
                            staffSlug={staffProfile.slug}
                            onUpdate={handleUpdate}
                            onDelete={handleDelete}
                            onCopyLink={handleCopyToClipboard}
                        />
                    ))}
                </div>
            </div>
        </>
    );
};

export default MeetingTypesEditor;
