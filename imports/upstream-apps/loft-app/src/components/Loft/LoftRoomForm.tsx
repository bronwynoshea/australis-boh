import React, { useState, useMemo } from 'react';
import { useSupabaseUser, callEdgeFunction } from '@/services/supabaseApi';
import { suggestLoftRoomTitleAndDescription } from '@/services/geminiService';
import { AppContext, CreateRoomPayload, LoftVisibility, LoftRoom } from '@/types';
import AnimatedBackgroundBlobs from './AnimatedBackgroundBlobs';
import { ArrowLeft, Sparkles, Users, X, Video, Shield, Loader2, Calendar as CalendarIcon, Search, ChevronLeft, ChevronRight, Clock, Repeat } from 'lucide-react';

interface LoftRoomFormProps {
  onNavigate: (path: string) => void;
  initialRoom?: LoftRoom;
}

const LoftRoomForm: React.FC<LoftRoomFormProps> = ({ onNavigate, initialRoom }) => {
  // Initialize form with initialRoom data if provided
  const [title, setTitle] = useState(initialRoom?.title || '');
  const [description, setDescription] = useState(initialRoom?.description || '');
  const [tagsText, setTagsText] = useState(initialRoom?.tags ? initialRoom.tags.join(', ') : '');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [isRecorded, setIsRecorded] = useState(initialRoom?.is_recorded || false);
  const [maxParticipants, setMaxParticipants] = useState(initialRoom?.max_participants || 10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  
  const [isScheduled, setIsScheduled] = useState(!!initialRoom?.scheduled_start_at);
  const [isRepeating, setIsRepeating] = useState(!!(initialRoom as any)?.recurrence_type);
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly'>((initialRoom as any)?.recurrence_type === 'daily' ? 'daily' : 'weekly');
  
  // Initialize date/time from initialRoom if provided
  const [selectedDate, setSelectedDate] = useState(() => {
    if (initialRoom?.scheduled_start_at) {
      const date = new Date(initialRoom.scheduled_start_at);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid scheduled_start_at:', initialRoom.scheduled_start_at);
        return new Date();
      }
      return date;
    }
    return new Date();
  });
  const [selectedHour, setSelectedHour] = useState(() => {
    if (initialRoom?.scheduled_start_at) {
      const date = new Date(initialRoom.scheduled_start_at);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid scheduled_start_at for hour:', initialRoom.scheduled_start_at);
        return '12';
      }
      let hour = date.getHours();
      if (hour > 12) hour -= 12;
      if (hour === 0) hour = 12;
      return hour.toString().padStart(2, '0');
    }
    return '12';
  });
  const [selectedMinute, setSelectedMinute] = useState(() => {
    if (initialRoom?.scheduled_start_at) {
      const date = new Date(initialRoom.scheduled_start_at);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid scheduled_start_at for minute:', initialRoom.scheduled_start_at);
        return '00';
      }
      return date.getMinutes().toString().padStart(2, '0');
    }
    return '00';
  });
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>(() => {
    if (initialRoom?.scheduled_start_at) {
      const date = new Date(initialRoom.scheduled_start_at);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid scheduled_start_at for period:', initialRoom.scheduled_start_at);
        return 'AM';
      }
      const hour = date.getHours();
      return hour >= 12 ? 'PM' : 'AM';
    }
    return 'AM';
  });
  
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(() => {
    if ((initialRoom as any)?.recurrence_end_date) {
      return new Date((initialRoom as any).recurrence_end_date);
    }
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d;
  });
  
  const [showRecurrencePreview, setShowRecurrencePreview] = useState(false);
  const [previewInstances, setPreviewInstances] = useState<Date[]>([]);

  const handleSuggest = async () => {
    if (!title) return;
    setIsSuggesting(true);
    try {
      const result = await suggestLoftRoomTitleAndDescription(title);
      setTitle(result.title);
      setDescription(result.description);
      setTagsText((result.tags || []).join(', '));
    } catch (error) {
      console.error("Suggestion failed", error);
    } finally {
      setIsSuggesting(false);
    }
  };

  const calculateRecurringInstances = () => {
    let hour = parseInt(selectedHour);
    if (selectedPeriod === 'PM' && hour !== 12) hour += 12;
    if (selectedPeriod === 'AM' && hour === 12) hour = 0;
    
    const startDate = new Date(selectedDate);
    startDate.setHours(hour, parseInt(selectedMinute), 0, 0);
    
    const endDate = new Date(recurrenceEndDate);
    const instances: Date[] = [];
    const increment = recurrenceType === 'daily' ? 1 : 7;
    
    let currentDate = new Date(startDate);
    let count = 0;
    
    while (currentDate <= endDate && count < 100) {
      instances.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + increment);
      count++;
    }
    
    return instances;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setSubmitError('Discussion topic is required.');
      return;
    }

    if (maxParticipants > 30) {
      setSubmitError('Maximum capacity is 30 users.');
      return;
    }
    
    // If recurring, show preview first
    if (isScheduled && isRepeating && !showRecurrencePreview) {
      const instances = calculateRecurringInstances();
      setPreviewInstances(instances);
      setShowRecurrencePreview(true);
      return;
    }
    
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      let hour = parseInt(selectedHour);
      if (selectedPeriod === 'PM' && hour !== 12) hour += 12;
      if (selectedPeriod === 'AM' && hour === 12) hour = 0;
      
      const finalDate = new Date(selectedDate);
      finalDate.setHours(hour, parseInt(selectedMinute), 0, 0);

      const tags = tagsText
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const payload: CreateRoomPayload = {
        title: title.trim(),
        description: description.trim(),
        visibility: LoftVisibility.PUBLIC,
        isRecorded,
        tags,
        appContext: AppContext.CAFE,
        maxParticipants,
        scheduledStartAt: isScheduled ? finalDate.toISOString() : new Date().toISOString(),
        ...(isRepeating && {
            recurrence: {
                type: recurrenceType,
                endDate: recurrenceEndDate.toISOString()
            }
        })
      };

      let result;
      if (initialRoom) {
        // Update existing room
        result = await callEdgeFunction<{id: string}>('loft-update-room', {
          loftRoomId: initialRoom.id,
          payload,
          appContext: payload.appContext,
        });
      } else {
        // Create new room
        result = await callEdgeFunction<{id: string}>('loft-create-room', {
          payload,
          appContext: payload.appContext,
        });
      }
      
      setShowRecurrencePreview(false);
      
      // Show success message and close modal
      setSubmitError(null);
      setSubmitSuccess(`Table ${initialRoom ? 'updated' : 'created'} successfully!`);
      setTimeout(() => {
        onNavigate('/'); // This will close the modal and return to lobby
      }, 1500);
    } catch (err) {
      console.error("Room operation error:", err);
      setSubmitError(`Failed to ${initialRoom ? 'update' : 'initialize'} table. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-0 sm:p-4 overflow-hidden sm:items-center">
      <div className="absolute inset-0 bg-transparent" />
      <AnimatedBackgroundBlobs />

      <div className="relative w-full h-full sm:h-auto sm:w-[80vw] md:w-[600px] lg:w-[700px] sm:max-h-[85vh] overflow-y-auto no-scrollbar rounded-none sm:rounded-2xl bg-transparent shadow-none sm:shadow-[0_40px_120px_rgba(0,0,0,0.5)] border-0 sm:border sm:border-black/5 sm:dark:border-white/10">
        
        <header className="flex-none px-4 py-4 sm:px-6 sm:py-6 md:px-10 md:py-8 border-b border-black/5 dark:border-white/10 flex items-center justify-between bg-transparent z-20 transition-colors duration-300">
            <button type="button" onClick={() => onNavigate('/')} className="hidden sm:inline-flex p-3 -ml-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl text-main transition-all active:scale-90" aria-label="Back">
                <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="text-[15px] sm:text-[18px] md:text-[22px] font-black uppercase tracking-[0.35em] sm:tracking-[0.45em] md:tracking-[0.6em] text-main">
            {initialRoom ? (isScheduled ? 'Update Table' : 'Edit Room') : 'Initialize Table'}
          </div>
            <button type="button" onClick={() => onNavigate('/')} className="p-3 -mr-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl text-main transition-all active:scale-90" aria-label="Close">
                <X className="w-6 h-6" />
            </button>
        </header>

        <div className="scroll-smooth">
          <form noValidate onSubmit={handleSubmit} className="p-4 sm:p-6 md:p-10 space-y-5 sm:space-y-8 relative">
              {submitError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-200 rounded-2xl px-4 py-3 flex items-start justify-between gap-4">
                  <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.25em] leading-relaxed">
                    {submitError}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubmitError(null)}
                    className="shrink-0 text-red-700/80 hover:text-red-800 dark:text-red-200/70 dark:hover:text-red-100 transition-colors text-[10px] font-bold uppercase tracking-[0.3em]"
                    aria-label="Dismiss error"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              
              {submitSuccess && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-200 rounded-2xl px-4 py-3 flex items-center justify-center gap-4">
                  <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.25em] leading-relaxed">
                    {submitSuccess}
                  </div>
                </div>
              )}
              
              {/* Card 1: Discussion Topic & Scope */}
              <div className="loft-card loft-card--flat rounded-[2rem] p-4 sm:p-6 md:p-10 space-y-8 sm:space-y-10 shadow-sm transition-colors duration-500">
                  <div className="space-y-4">
                      <div className="flex justify-between items-center px-1">
                          <label className="text-[11px] font-black text-main/30 dark:text-white/30 uppercase tracking-[0.3em]">Discussion Topic *</label>
                          <button type="button" onClick={handleSuggest} disabled={!title || isSuggesting} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#2563eb] dark:text-[#60A5FA] transition-all hover:brightness-110 disabled:opacity-30 group">
                              {isSuggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />}
                              Ask Sadie
                          </button>
                      </div>
                      <input 
                        type="text" 
                        value={title} 
                        onChange={(e) => setTitle(e.target.value)} 
                        placeholder="What are we talking about?" 
                        className="w-full loft-input rounded-2xl px-6 py-5 text-[17px] font-bold text-main outline-none transition-all shadow-sm" 
                      />
                  </div>

                  <div className="space-y-4">
                      <label className="block text-[11px] font-black text-main/30 dark:text-white/30 uppercase tracking-[0.3em] px-1">Scope Description</label>
                      <textarea 
                        rows={4} 
                        value={description} 
                        onChange={(e) => setDescription(e.target.value)} 
                        placeholder="Describe the discussion depth and goals..." 
                        className="w-full loft-input rounded-2xl px-6 py-5 text-[17px] font-semibold text-main outline-none transition-all leading-relaxed resize-none shadow-sm" 
                      />
                  </div>

                  <div className="space-y-4">
                      <label className="block text-[11px] font-black text-main/30 dark:text-white/30 uppercase tracking-[0.3em] px-1">Tags</label>
                      <input
                        type="text"
                        value={tagsText}
                        onChange={(e) => setTagsText(e.target.value)}
                        placeholder="e.g. interview, resume, mindset"
                        className="w-full loft-input rounded-2xl px-6 py-5 text-[15px] font-semibold text-main outline-none transition-all shadow-sm"
                      />
                  </div>
              </div>

              {/* Card 2: Configuration */}
              <div className="loft-card loft-card--flat rounded-[2rem] p-4 sm:p-6 md:p-10 shadow-sm transition-colors duration-500">
                  <div className="grid grid-cols-2 md:grid-cols-2 gap-4 sm:gap-10">
                      <div className="space-y-3 sm:space-y-4">
                          <label className="text-[11px] font-black text-main/30 dark:text-white/30 uppercase tracking-[0.3em] px-1 flex items-center gap-3"><Users className="w-4 h-4 text-cafe" /> Capacity</label>
                          <div className="flex items-center gap-3 sm:gap-6 loft-input rounded-2xl p-2 pr-3 sm:pr-6 shadow-sm min-h-[64px] sm:min-h-[80px]">
                              <input
                                type="number"
                                min="2"
                                max="30"
                                value={maxParticipants}
                                onChange={(e) => {
                                  const next = Number(e.target.value);
                                  if (!Number.isFinite(next)) return;

                                  if (next > 30) {
                                    setMaxParticipants(30);
                                    setSubmitError('Maximum capacity is 30 users.');
                                    return;
                                  }

                                  if (next < 2) {
                                    setMaxParticipants(2);
                                    return;
                                  }

                                  setMaxParticipants(next);
                                }}
                                className="w-full bg-transparent px-2 sm:px-4 py-3 sm:py-4 text-xl sm:text-2xl font-black text-main outline-none text-center"
                              />
                              <span className="text-[10px] font-black text-main/50 uppercase tracking-[0.3em]">Users</span>
                          </div>
                      </div>

                      <div className="space-y-3 sm:space-y-4">
                          <label className="text-[11px] font-black text-main/30 dark:text-white/30 uppercase tracking-[0.3em] px-1 flex items-center gap-3"><Video className="w-4 h-4 text-cafe" /> Persistence</label>
                          <div className="flex flex-col justify-center loft-input rounded-2xl p-4 sm:p-6 transition-all shadow-sm min-h-[64px] sm:min-h-[80px]">
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 sm:gap-4">
                                      <span className="text-[11px] font-black text-main uppercase tracking-widest">Record Feed</span>
                                  </div>
                                  <label className="relative inline-flex items-center cursor-pointer active:scale-95 transition-transform">
                                      <input type="checkbox" checked={isRecorded} onChange={(e) => setIsRecorded(e.target.checked)} className="sr-only peer" />
                                      <div className="w-12 h-7 sm:w-14 sm:h-8 bg-black/10 dark:bg-white/10 rounded-full peer peer-checked:bg-red-500 after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-5 after:w-5 sm:after:h-6 sm:after:w-6 after:transition-all peer-checked:after:translate-x-5 sm:peer-checked:after:translate-x-6 shadow-inner"></div>
                                  </label>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Card 3: Scheduling */}
              <div className="loft-card loft-card--flat rounded-[2rem] p-4 sm:p-6 md:p-10 space-y-6 sm:space-y-10 shadow-sm transition-colors duration-500">
                  <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-3 sm:gap-4">
                          <CalendarIcon className="w-5 h-5 text-cafe" />
                          <span className="text-[12px] sm:text-[14px] font-black uppercase tracking-[0.25em] sm:tracking-[0.3em] text-main">
                          {initialRoom ? (isScheduled ? 'Update Schedule' : 'Update Room') : (isScheduled ? 'Schedule Table' : 'Initialize Table')}
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer active:scale-95 transition-transform">
                          <input type="checkbox" checked={isScheduled} onChange={(e) => setIsScheduled(e.target.checked)} className="sr-only peer" />
                          <div className="w-12 h-7 sm:w-14 sm:h-8 bg-black/10 dark:bg-white/10 rounded-full peer peer-checked:bg-cafe after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-5 after:w-5 sm:after:h-6 sm:after:w-6 after:transition-all peer-checked:after:translate-x-5 sm:peer-checked:after:translate-x-6 shadow-inner"></div>
                      </label>
                  </div>

                  {isScheduled && (
                      <div className="grid grid-cols-1 gap-10 animate-in fade-in slide-in-from-top-4 duration-700">
                          <div className="space-y-4">
                              <label className="text-[10px] font-black text-main/30 dark:text-white/30 uppercase tracking-[0.4em] px-1 text-center block">Select Date</label>
                              <ModernCalendar selectedDate={selectedDate} onSelect={setSelectedDate} />
                          </div>

                          <div className="space-y-4">
                              <label className="text-[10px] font-black text-main/30 dark:text-white/30 uppercase tracking-[0.4em] px-1 text-center block">Time Selection</label>
                              <ModernTimePicker 
                                  hour={selectedHour} 
                                  minute={selectedMinute} 
                                  period={selectedPeriod}
                                  onSetHour={setSelectedHour}
                                  onSetMinute={setSelectedMinute}
                                  onSetPeriod={setSelectedPeriod}
                              />
                          </div>

                          <div className="flex items-center justify-between px-1 pt-6 border-t border-[var(--loft-border)]">
                              <div className="flex items-center gap-4">
                                  <Repeat className="w-5 h-5 text-cafe" />
                                  <span className="text-[14px] font-black uppercase tracking-[0.3em] text-main">Set Recurrence</span>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer active:scale-95 transition-transform">
                                  <input type="checkbox" checked={isRepeating} onChange={(e) => setIsRepeating(e.target.checked)} className="sr-only peer" />
                                  <div className="w-12 h-7 sm:w-14 sm:h-8 bg-black/10 dark:bg-white/10 rounded-full peer peer-checked:bg-cafe after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-5 after:w-5 sm:after:h-6 sm:after:w-6 after:transition-all peer-checked:after:translate-x-5 sm:peer-checked:after:translate-x-6 shadow-inner"></div>
                              </label>
                          </div>
                      </div>
                  )}
              </div>

              {/* Card 4: Recurrence Settings */}
              {isScheduled && isRepeating && (
                  <div className="loft-card loft-card--flat rounded-[2rem] p-6 md:p-10 space-y-10 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                      <div className="space-y-6">
                          <div className="space-y-4 text-center">
                              <label className="text-[10px] font-black text-main/20 uppercase tracking-[0.4em]">Frequency</label>
                              <div className="flex gap-4">
                                  {(['daily', 'weekly'] as const).map(type => (
                                      <button
                                          key={type}
                                          type="button"
                                          onClick={() => setRecurrenceType(type)}
                                          className={`flex-1 py-5 rounded-2xl text-[12px] font-black uppercase tracking-[0.3em] transition-all active:scale-95 ${recurrenceType === type ? 'bg-cafe text-white shadow-2xl shadow-cafe/40' : 'loft-hover text-main/60'}`}
                                      >
                                          {type}
                                      </button>
                                  ))}
                              </div>
                          </div>
                          
                          <div className="space-y-4">
                              <label className="text-[10px] font-black text-main/20 uppercase tracking-[0.4em] text-center block">Repeat Until</label>
                              <ModernCalendar selectedDate={recurrenceEndDate} onSelect={setRecurrenceEndDate} />
                          </div>
                      </div>
                  </div>
              )}

              {/* Card 5: Final Step */}
              <div className="loft-card loft-card--flat rounded-[2rem] p-4 sm:p-6 md:p-10 shadow-sm space-y-6 sm:space-y-8 pb-8 sm:pb-10 transition-colors duration-500">
                  <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-cafe text-white font-black py-4 sm:py-5 md:py-7 rounded-[1.25rem] sm:rounded-[1.5rem] md:rounded-[2rem] text-[12px] sm:text-[14px] md:text-[18px] uppercase tracking-[0.28em] sm:tracking-[0.35em] md:tracking-[0.5em] shadow-2xl transition-all duration-300 hover:brightness-110 active:scale-95 disabled:opacity-50 border border-white/10"
                  >
                      {isSubmitting ? (initialRoom ? 'Updating room...' : 'Creating room...') : isScheduled ? (initialRoom ? 'Update Table' : 'Schedule Table') : (initialRoom ? 'Update Room' : 'Open Table Now')}
                  </button>
                  <div className="flex items-center justify-center gap-4 text-main/20">
                      <Shield className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">End-to-End Encrypted</span>
                  </div>
              </div>

              <div className="h-4" />
          </form>
        </div>
      </div>
      
      {/* Recurring Instances Preview Modal */}
      {showRecurrencePreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="loft-card max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-black/5 dark:border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black uppercase tracking-wider text-main dark:text-white">
                  Review Recurring Sessions
                </h3>
                <button
                  onClick={() => setShowRecurrencePreview(false)}
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="mt-2 text-sm text-main/60 dark:text-white/60">
                {previewInstances.length} session{previewInstances.length !== 1 ? 's' : ''} will be created
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {previewInstances.map((date, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 bg-cafe/10 text-cafe rounded-xl font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-bold text-main dark:text-white">
                        {date.toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </div>
                      <div className="text-sm text-main/60 dark:text-white/60">
                        {date.toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit',
                          hour12: true 
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-6 border-t border-black/5 dark:border-white/10 flex gap-3">
              <button
                onClick={() => setShowRecurrencePreview(false)}
                className="flex-1 py-3 px-6 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-main dark:text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-black/10 dark:hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3 px-6 bg-cafe text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-cafe/90 transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Confirm & Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Modern Calendar Component ---

const ModernCalendar = ({ selectedDate, onSelect }: { selectedDate: Date, onSelect: (d: Date) => void }) => {
    const [viewDate, setViewDate] = useState(new Date(selectedDate));
    const daysInMonth = useMemo(() => new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate(), [viewDate]);
    const firstDayIndex = useMemo(() => new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay(), [viewDate]);
    const monthName = viewDate.toLocaleString('default', { month: 'long' });

    const changeMonth = (offset: number) => {
        const next = new Date(viewDate);
        next.setMonth(viewDate.getMonth() + offset);
        setViewDate(next);
    };

    const isSelected = (day: number) => {
        return selectedDate.getDate() === day && 
               selectedDate.getMonth() === viewDate.getMonth() && 
               selectedDate.getFullYear() === viewDate.getFullYear();
    };

    return (
        <div className="loft-card loft-card--flat rounded-[2.5rem] overflow-hidden p-6 md:p-10 shadow-sm relative z-10 transition-colors duration-500">
            <div className="flex items-center justify-between mb-8 px-2">
                <div className="flex flex-col">
                    <h3 className="text-main dark:text-white font-black uppercase tracking-[0.2em] text-base leading-none">{monthName}</h3>
                    <span className="text-[10px] font-black text-main/30 dark:text-white/30 uppercase tracking-[0.3em] mt-2">{viewDate.getFullYear()}</span>
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={() => changeMonth(-1)} className="p-3.5 loft-hover rounded-2xl text-main dark:text-white transition-all active:scale-90 shadow-sm"><ChevronLeft className="w-4 h-4" /></button>
                    <button type="button" onClick={() => changeMonth(1)} className="p-3.5 loft-hover rounded-2xl text-main dark:text-white transition-all active:scale-90 shadow-sm"><ChevronRight className="w-4 h-4" /></button>
                </div>
            </div>
            
            <div className="grid grid-cols-7 gap-2 md:gap-4">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                    <div key={d} className="text-center text-[10px] font-black text-main/20 dark:text-white/20 uppercase tracking-[0.2em] mb-4">{d}</div>
                ))}
                {Array(firstDayIndex).fill(0).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                    <button
                        key={day}
                        type="button"
                        onClick={() => onSelect(new Date(viewDate.getFullYear(), viewDate.getMonth(), day))}
                        className={`aspect-square flex items-center justify-center rounded-2xl text-[14px] font-black transition-all active:scale-90 relative ${
                            isSelected(day) 
                            ? 'bg-cafe text-white shadow-2xl shadow-cafe/40 scale-105' 
                            : 'text-main/60 dark:text-white/60 loft-hover'
                        }`}
                    >
                        {day}
                    </button>
                ))}
            </div>
            
            <div className="mt-8 pt-8 border-t border-black/5 dark:border-white/5 flex justify-center">
                <button 
                  type="button" 
                  onClick={() => {
                      const now = new Date();
                      setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
                      onSelect(now);
                  }}
                  className="text-[10px] font-black text-cafe uppercase tracking-[0.4em] hover:opacity-70 transition-opacity"
                >
                    Jump to Today
                </button>
            </div>
        </div>
    );
};

// --- Modern Time Picker Component ---

const ModernTimePicker = ({ hour, minute, period, onSetHour, onSetMinute, onSetPeriod }: any) => {
    const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
    const minutes = ['00', '15', '30', '45'];

    return (
        <div className="bg-[var(--loft-surface-2)] border border-[var(--loft-border)] rounded-[2.5rem] p-6 md:p-10 shadow-sm relative z-10 transition-colors duration-500">
            <div className="grid grid-cols-3 gap-6 md:gap-10">
                <div className="space-y-4 text-center">
                    <div className="text-[10px] font-black text-[var(--loft-text-muted)] uppercase tracking-[0.2em]">Hour</div>
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto no-scrollbar pr-1 scroll-smooth">
                        {hours.map(h => (
                            <button key={h} type="button" onClick={() => onSetHour(h)} className={`py-4 px-4 rounded-2xl text-[14px] font-black transition-all ${hour === h ? 'bg-cafe text-white shadow-2xl shadow-cafe/40 scale-105' : 'text-[var(--loft-text-muted)] hover:bg-[var(--loft-surface-3)] hover:text-[var(--loft-text)]'}`}>
                                {h}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-4 text-center">
                    <div className="text-[10px] font-black text-[var(--loft-text-muted)] uppercase tracking-[0.2em]">Minute</div>
                    <div className="flex flex-col gap-2">
                        {minutes.map(m => (
                            <button key={m} type="button" onClick={() => onSetMinute(m)} className={`py-4 px-4 rounded-2xl text-[14px] font-black transition-all ${minute === m ? 'bg-cafe text-white shadow-2xl shadow-cafe/40 scale-105' : 'text-[var(--loft-text-muted)] hover:bg-[var(--loft-surface-3)] hover:text-[var(--loft-text)]'}`}>
                                {m}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-4 text-center">
                    <div className="text-[10px] font-black text-[var(--loft-text-muted)] uppercase tracking-[0.2em]">Period</div>
                    <div className="flex flex-col gap-2">
                        {['AM', 'PM'].map(p => (
                            <button key={p} type="button" onClick={() => onSetPeriod(p)} className={`py-4 px-4 rounded-2xl text-[14px] font-black transition-all ${period === p ? 'bg-cafe text-white shadow-2xl shadow-cafe/40 scale-105' : 'text-[var(--loft-text-muted)] hover:bg-[var(--loft-surface-3)] hover:text-[var(--loft-text)]'}`}>
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="mt-10 pt-10 border-t border-[var(--loft-border)] flex flex-col items-center gap-4">
                <div className="flex items-center gap-4 bg-[var(--loft-surface-3)] px-8 py-5 rounded-2xl border border-[var(--loft-border)] shadow-inner">
                    <Clock className="w-5 h-5 text-cafe" />
                    <span className="text-[18px] font-black text-[var(--loft-text)] tracking-[0.3em] uppercase">{hour}:{minute} {period}</span>
                </div>
                <p className="text-[9px] font-black text-[var(--loft-text-muted)] uppercase tracking-[0.4em]">Time in your local timezone</p>
            </div>
        </div>
    );
};

export default LoftRoomForm;