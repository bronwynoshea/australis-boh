import React, { useState } from 'react';
import { X, Sparkles, Loader2, CheckCircle } from 'lucide-react';
import { callEdgeFunction } from '@/services/supabaseApi';

interface HostApplicationFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const HostApplicationForm: React.FC<HostApplicationFormProps> = ({ onClose, onSuccess }) => {
  const [applicationReason, setApplicationReason] = useState('');
  const [experienceDescription, setExperienceDescription] = useState('');
  const [topicsToHost, setTopicsToHost] = useState('');
  const [applicantPersona, setApplicantPersona] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (applicationReason.trim().length < 20) {
      setError('Please provide at least 20 characters explaining why you want to become a host');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await callEdgeFunction('submit_host_application', {
        applicationReason: applicationReason.trim(),
        experienceDescription: experienceDescription.trim() || null,
        topicsToHost: topicsToHost.trim() || null,
        applicantPersona: applicantPersona || null,
        requestedHostScope: 'user_generated',
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
        <div className="loft-card w-full max-w-md rounded-2xl p-8 text-center space-y-6 animate-in zoom-in-95 duration-300">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-green-500/10">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black uppercase tracking-tight text-main dark:text-white">
              Application Submitted!
            </h3>
            <p className="text-sm text-main/70 dark:text-white/70">
              Your application has been submitted successfully. You'll be notified once it's reviewed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="loft-card w-full max-w-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-[var(--loft-border)] flex justify-between items-center bg-[var(--loft-surface-2)]">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-cafe" />
            <h3 className="text-xl font-black uppercase tracking-tight text-main dark:text-white">
              Apply to Become a Host
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all"
            aria-label="Close"
          >
            <X className="w-6 h-6 text-main/60 dark:text-white/60" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-main/70 dark:text-white/70">
              As a host, you'll be able to create and manage your own Clubhouse-style Loft rooms. This does not create a Personal Room; Personal Rooms are separately granted to JOBZCAFE® staff and recruiters.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-main/60 dark:text-white/60">
                Why do you want to become a host? *
              </label>
              <textarea
                value={applicationReason}
                onChange={(e) => setApplicationReason(e.target.value)}
                placeholder="Tell us why you'd like to host discussions and what you hope to achieve..."
                className="w-full px-4 py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-sm text-main dark:text-white resize-none focus:ring-2 focus:ring-cafe/30 outline-none min-h-[120px]"
                required
              />
              <p className="text-xs text-main/50 dark:text-white/50">
                {applicationReason.length}/20 characters minimum
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-main/60 dark:text-white/60">
                Your Experience & Expertise
              </label>
              <textarea
                value={experienceDescription}
                onChange={(e) => setExperienceDescription(e.target.value)}
                placeholder="Share your background, qualifications, or relevant experience..."
                className="w-full px-4 py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-sm text-main dark:text-white resize-none focus:ring-2 focus:ring-cafe/30 outline-none min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-main/60 dark:text-white/60">
                I am applying as
              </label>
              <select
                value={applicantPersona}
                onChange={(e) => setApplicantPersona(e.target.value)}
                className="w-full px-4 py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-sm text-main dark:text-white focus:ring-2 focus:ring-cafe/30 outline-none"
              >
                <option value="">Select one…</option>
                <option value="recruiter">Recruiter</option>
                <option value="job_seeker">Job seeker</option>
                <option value="jobzcafe_staff">JOBZCAFE® staff</option>
                <option value="community_member">Community member</option>
              </select>
              <p className="text-xs text-main/50 dark:text-white/50">
                Recruiters and job seekers can apply to host public/community rooms. Personal Rooms remain a separate staff/recruiter permission.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-main/60 dark:text-white/60">
                Topics You'd Like to Host
              </label>
              <input
                type="text"
                value={topicsToHost}
                onChange={(e) => setTopicsToHost(e.target.value)}
                placeholder="e.g., Career Development, Technology, Wellness..."
                className="w-full px-4 py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-sm text-main dark:text-white focus:ring-2 focus:ring-cafe/30 outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-6 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-main dark:text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-black/10 dark:hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || applicationReason.trim().length < 20}
              className="flex-1 py-3 px-6 bg-cafe text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-cafe/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Application'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HostApplicationForm;
