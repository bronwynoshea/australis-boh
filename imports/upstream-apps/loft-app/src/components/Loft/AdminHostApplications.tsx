import React, { useState, useEffect, useCallback } from 'react';
import { useSupabaseUser, callEdgeFunction } from '@/services/supabaseApi';
import { supabase } from '@/services/supabaseClient';
import { Shield, Clock, CheckCircle, XCircle, Loader2, User, Calendar, FileText } from 'lucide-react';

interface HostApplication {
  id: string;
  applicantBohUserId?: string | null;
  applicantPatronPersonId?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  application_reason: string;
  experience_description: string | null;
  topics_to_host: string | null;
  applicant_persona?: string | null;
  requested_host_scope?: string | null;
  requested_audience?: string | null;
  submitted_at: string;
  applicant_name?: string;
  applicant_email?: string;
}

const AdminHostApplications: React.FC = () => {
  const { profile } = useSupabaseUser();
  const [applications, setApplications] = useState<HostApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.rpc('get_host_applications', {
        filter_status: filter === 'pending' ? 'pending' : null
      });

      if (fetchError) throw fetchError;

      const formatted = (data || []).map((app: any) => ({
        id: app.id,
        applicantBohUserId: app.applicant_boh_user_id || null,
        applicantPatronPersonId: app.applicant_patron_person_id || null,
        status: app.status,
        application_reason: app.application_reason,
        experience_description: app.experience_description,
        topics_to_host: app.topics_to_host,
        applicant_persona: app.applicant_persona,
        requested_host_scope: app.requested_host_scope,
        requested_audience: app.requested_audience,
        submitted_at: app.submitted_at,
        applicant_name: app.applicant_name || app.applicant_email || 'Unknown User',
        applicant_email: app.applicant_email || undefined,
      }));

      setApplications(formatted);
    } catch (err) {
      console.error('Failed to fetch applications:', err);
      setError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleReview = async (applicationId: string, action: 'approve' | 'reject') => {
    setProcessingId(applicationId);
    setError(null);
    try {
      await callEdgeFunction('review_host_application', {
        applicationId,
        action,
      });
      await fetchApplications();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} application`);
    } finally {
      setProcessingId(null);
    }
  };

  const isAdmin = !!((profile as any)?.is_loft_admin || Number((profile as any)?.user_type_id) === 5);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="loft-card p-8 text-center space-y-4 max-w-md">
          <Shield className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-black uppercase tracking-tight text-main dark:text-white">
            Admin Access Required
          </h2>
          <p className="text-sm text-main/70 dark:text-white/70">
            You don't have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-12 pb-32">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="space-y-4">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-cafe" />
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-main dark:text-white">
              Host Applications
            </h1>
          </div>
          <p className="text-sm text-main/70 dark:text-white/70">
            Review and manage user applications to become hosts
          </p>
        </header>

        <div className="flex gap-8 border-b border-black/5 dark:border-white/10">
          <button
            onClick={() => setFilter('pending')}
            className={`pb-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative group ${
              filter === 'pending'
                ? 'text-cafe'
                : 'text-main/40 dark:text-white/30 hover:text-main/70 dark:hover:text-white/60'
            }`}
          >
            Pending ({applications.filter(a => a.status === 'pending').length})
            {filter === 'pending' ? (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-cafe rounded-t-full shadow-[0_-4px_10px_rgba(37,99,235,0.4)]" />
            ) : (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-cafe rounded-t-full opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`pb-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative group ${
              filter === 'all'
                ? 'text-cafe'
                : 'text-main/40 dark:text-white/30 hover:text-main/70 dark:hover:text-white/60'
            }`}
          >
            All Applications
            {filter === 'all' ? (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-cafe rounded-t-full shadow-[0_-4px_10px_rgba(37,99,235,0.4)]" />
            ) : (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-cafe rounded-t-full opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-cafe animate-spin" />
          </div>
        ) : applications.length === 0 ? (
          <div className="loft-card p-12 text-center">
            <p className="text-main/50 dark:text-white/50 font-bold uppercase tracking-widest text-sm">
              No {filter === 'pending' ? 'pending' : ''} applications found
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => (
              <div
                key={app.id}
                className="loft-card p-6 md:p-8 space-y-6 hover:shadow-xl transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-cafe/10 flex items-center justify-center">
                      <User className="w-6 h-6 text-cafe" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-tight text-main dark:text-white">
                        {app.applicant_name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-main/50 dark:text-white/50 font-bold uppercase tracking-widest mt-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(app.submitted_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {app.status === 'pending' && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-cafe/10 text-cafe border border-cafe/30 rounded-lg text-xs font-bold uppercase tracking-widest">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    )}
                    {app.status === 'approved' && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30 rounded-lg text-xs font-bold uppercase tracking-widest">
                        <CheckCircle className="w-3 h-3" />
                        Approved
                      </span>
                    )}
                    {app.status === 'rejected' && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 rounded-lg text-xs font-bold uppercase tracking-widest">
                        <XCircle className="w-3 h-3" />
                        Rejected
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    {app.applicant_persona && (
                      <div className="rounded-xl bg-black/5 p-3 text-xs dark:bg-white/5">
                        <div className="font-bold uppercase tracking-widest text-main/50 dark:text-white/50">Applicant</div>
                        <div className="mt-1 font-semibold text-main dark:text-white">{app.applicant_persona.replace(/_/g, ' ')}</div>
                      </div>
                    )}
                    {app.requested_host_scope && (
                      <div className="rounded-xl bg-black/5 p-3 text-xs dark:bg-white/5">
                        <div className="font-bold uppercase tracking-widest text-main/50 dark:text-white/50">Scope</div>
                        <div className="mt-1 font-semibold text-main dark:text-white">{app.requested_host_scope.replace(/_/g, ' ')}</div>
                      </div>
                    )}
                    <div className="rounded-xl bg-black/5 p-3 text-xs dark:bg-white/5">
                      <div className="font-bold uppercase tracking-widest text-main/50 dark:text-white/50">Personal Room</div>
                      <div className="mt-1 font-semibold text-main dark:text-white">Not granted by host approval</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-main/60 dark:text-white/60">
                      <FileText className="w-3 h-3" />
                      Why They Want to Host
                    </label>
                    <p className="text-sm text-main dark:text-white bg-black/5 dark:bg-white/5 p-4 rounded-xl leading-relaxed">
                      {app.application_reason}
                    </p>
                  </div>

                  {app.experience_description && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-main/60 dark:text-white/60">
                        Experience & Expertise
                      </label>
                      <p className="text-sm text-main dark:text-white bg-black/5 dark:bg-white/5 p-4 rounded-xl leading-relaxed">
                        {app.experience_description}
                      </p>
                    </div>
                  )}

                  {app.topics_to_host && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-main/60 dark:text-white/60">
                        Topics to Host
                      </label>
                      <p className="text-sm text-main dark:text-white bg-black/5 dark:bg-white/5 p-4 rounded-xl">
                        {app.topics_to_host}
                      </p>
                    </div>
                  )}
                </div>

                {app.status === 'pending' && (
                  <div className="flex gap-3 pt-4 border-t border-[var(--loft-border)]">
                    <button
                      onClick={() => handleReview(app.id, 'reject')}
                      disabled={processingId === app.id}
                      className="flex-1 py-3 px-6 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {processingId === app.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <XCircle className="w-4 h-4" />
                          Reject
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleReview(app.id, 'approve')}
                      disabled={processingId === app.id}
                      className="flex-1 py-3 px-6 bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-green-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {processingId === app.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Approve
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminHostApplications;
