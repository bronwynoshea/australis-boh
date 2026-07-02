import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../../../lib/supabase";
import { getCurrentBohUserContext } from "../../../../boh/api/bohApi";

interface SoundbyteProfileRow {
  id?: string;
  owner_user_id?: string | null;
  app_context?: string | null;
  name: string;
  level: string;
  description: string;
  ppr_problem: string;
  ppr_product: string;
  ppr_result: string;
  peace_problem: string;
  peace_person: string;
  peace_emotion: string;
  peace_action: string;
  peace_change: string;
  peace_evidence: string;
  hole_we_own: string;
  core_soundbyte: string;
  notes: string;
  is_default: boolean;
}

const emptySoundbyte: SoundbyteProfileRow = {
  name: "",
  level: "brand",
  description: "",
  ppr_problem: "",
  ppr_product: "",
  ppr_result: "",
  peace_problem: "",
  peace_person: "",
  peace_emotion: "",
  peace_action: "",
  peace_change: "",
  peace_evidence: "",
  hole_we_own: "",
  core_soundbyte: "",
  notes: "",
  is_default: true,
};

const SoundbyteManagerPage: React.FC = () => {
  const { soundbyteId } = useParams<{ soundbyteId?: string }>();
  const [soundbyte, setSoundbyte] = useState<SoundbyteProfileRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadSoundbyte = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let row: any = null;
        const currentUser = await getCurrentBohUserContext();
        if (!currentUser?.id || !currentUser?.tenant_id) {
          setError("Unable to determine BOH tenant context.");
          if (mounted) {
            setSoundbyte({ ...emptySoundbyte, owner_user_id: null, app_context: "boh" });
          }
          return;
        }

        if (soundbyteId) {
          const { data, error: byIdError } = await supabase
            .from("soundbyte_profiles")
            .select("*")
            .eq("id", soundbyteId)
            .eq("tenant_id", currentUser.tenant_id)
            .eq("app_context", "boh")
            .maybeSingle();

          if (byIdError) {
            console.error("[SoundbyteManager] Failed to load soundbyte by id", byIdError);
            setError("Failed to load soundbyte profile.");
          } else if (!data) {
            setError("Soundbyte not found. You can create a new one below.");
          } else {
            row = data;
          }
        }

        if (!row) {
          const { data, error: fetchError } = await supabase
            .from("soundbyte_profiles")
            .select("*")
            .eq("tenant_id", currentUser.tenant_id)
            .eq("app_context", "boh")
            .eq("owner_user_id", currentUser.id)
            .order("created_at", { ascending: true });

          if (fetchError) {
            console.error("[SoundbyteManager] Failed to load soundbytes", fetchError);
            setError("Failed to load soundbyte profile.");
          } else if (data && data.length > 0) {
            row = data[0];
          } else {
            row = { ...emptySoundbyte, owner_user_id: currentUser.id, app_context: "boh" };
          }
        }

        if (mounted && row) {
          setSoundbyte({
            id: row.id,
            owner_user_id: row.owner_user_id,
            app_context: row.app_context,
            name: row.name ?? "",
            level: row.level ?? "brand",
            description: row.description ?? "",
            ppr_problem: row.ppr_problem ?? "",
            // Migration: legacy records store the "product" idea in ppr_person.
            ppr_product: (row as any).ppr_product ?? row.ppr_person ?? "",
            ppr_result: row.ppr_result ?? "",
            peace_problem: row.peace_problem ?? "",
            peace_person: row.peace_person ?? "",
            peace_emotion: row.peace_emotion ?? "",
            peace_action: row.peace_action ?? "",
            peace_change: row.peace_change ?? "",
            peace_evidence: row.peace_evidence ?? "",
            hole_we_own: row.hole_we_own ?? "",
            core_soundbyte: row.core_soundbyte ?? "",
            notes: row.notes ?? "",
            is_default: row.is_default ?? true,
          });
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadSoundbyte();

    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = (field: keyof SoundbyteProfileRow, value: string | boolean) => {
    if (!soundbyte) return;
    setSoundbyte({ ...soundbyte, [field]: value } as SoundbyteProfileRow);
  };

  const handleSave = async () => {
    if (!soundbyte) return;
    setIsSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      const currentUser = await getCurrentBohUserContext();
      if (!currentUser?.id || !currentUser?.tenant_id) {
        setError("Unable to determine BOH tenant context.");
        return;
      }

      const ownerId = soundbyte.owner_user_id ?? currentUser.id;

      const payload: any = {
        tenant_id: currentUser.tenant_id,
        owner_user_id: ownerId,
        app_context: soundbyte.app_context ?? "boh",
        name: soundbyte.name,
        level: soundbyte.level,
        description: soundbyte.description,
        ppr_problem: soundbyte.ppr_problem,
        // Persist product framing back into the legacy ppr_person column.
        ppr_person: soundbyte.ppr_product,
        ppr_result: soundbyte.ppr_result,
        peace_problem: soundbyte.peace_problem,
        peace_person: soundbyte.peace_person,
        peace_emotion: soundbyte.peace_emotion,
        peace_action: soundbyte.peace_action,
        peace_change: soundbyte.peace_change,
        peace_evidence: soundbyte.peace_evidence,
        hole_we_own: soundbyte.hole_we_own,
        core_soundbyte: soundbyte.core_soundbyte,
        notes: soundbyte.notes,
        is_default: soundbyte.is_default,
      };

      let result;
      if (soundbyte.id) {
        result = await supabase
          .from("soundbyte_profiles")
          .update(payload)
          .eq("id", soundbyte.id)
          .eq("tenant_id", currentUser.tenant_id)
          .select("*")
          .single();
      } else {
        result = await supabase
          .from("soundbyte_profiles")
          .insert(payload)
          .select("*")
          .single();
      }

      if (result.error) {
        console.error("[SoundbyteManager] Failed to save soundbyte", result.error);
        setError("Failed to save soundbyte.");
        return;
      }

      const row = result.data as any;
      setSoundbyte({
        id: row.id,
        owner_user_id: row.owner_user_id,
        app_context: row.app_context,
        name: row.name ?? "",
        level: row.level ?? "brand",
        description: row.description ?? "",
        ppr_problem: row.ppr_problem ?? "",
        // Migration on save response as well
        ppr_product: (row as any).ppr_product ?? row.ppr_person ?? "",
        ppr_result: row.ppr_result ?? "",
        peace_problem: row.peace_problem ?? "",
        peace_person: row.peace_person ?? "",
        peace_emotion: row.peace_emotion ?? "",
        peace_action: row.peace_action ?? "",
        peace_change: row.peace_change ?? "",
        peace_evidence: row.peace_evidence ?? "",
        hole_we_own: row.hole_we_own ?? "",
        core_soundbyte: row.core_soundbyte ?? "",
        notes: row.notes ?? "",
        is_default: row.is_default ?? true,
      });
      setSaveMessage("Soundbyte saved");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-full w-full px-4 py-6 lg:px-8 lg:py-8 space-y-6">
      <div>
        <Link
          to="/boh/cookbook/pantry"
          className="inline-flex items-center text-xs font-medium text-boh-text-sub-light hover:text-boh-text-light"
        >
          <span className="mr-1">←</span>
          Back to Pantry
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-boh-text-light dark:text-boh-text">
          Soundbyte Strategy
        </h1>
        <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
          Define the core message structure for Australis using the PPR and PEACE models.
        </p>
      </header>

      {isLoading && (
        <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Loading soundbyte...</div>
      )}

      {!isLoading && (
        <div className="space-y-6">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {saveMessage && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {saveMessage}
              </div>
            )}

            {soundbyte && (
            <>
            <section className="rounded-lg border border-boh-border-light/70 dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface/80 dark:bg-boh-bg p-4 space-y-4">
              <h2 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">Basics</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">
                    Name
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
                    value={soundbyte.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">
                    Level
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
                    value={soundbyte.level}
                    onChange={(e) => handleChange("level", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">
                  Description
                </label>
                <textarea
                  className="w-full rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
                  rows={3}
                  value={soundbyte.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                />
              </div>
            </section>

            <section className="rounded-lg border border-boh-border-light/70 dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface/80 dark:bg-boh-bg p-4 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">PPR (Problem / Product / Result)</h2>
                <p className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                  Define the problem the job seeker is facing, how the product solves it, and the result it creates.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">
                    Problem
                  </label>
                  <textarea
                    className="w-full rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
                    rows={4}
                    value={soundbyte.ppr_problem}
                    onChange={(e) => handleChange("ppr_problem", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">
                    Product
                  </label>
                  <textarea
                    className="w-full rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
                    rows={4}
                    value={soundbyte.ppr_product}
                    onChange={(e) => handleChange("ppr_product", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">
                    Result
                  </label>
                  <textarea
                    className="w-full rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
                    rows={4}
                    value={soundbyte.ppr_result}
                    onChange={(e) => handleChange("ppr_result", e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-boh-border-light/70 dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface/80 dark:bg-boh-bg p-4 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">PEACE (Problem / Empathy / Answer / Change / End result)</h2>
                <p className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                  Detailed storytelling frame used when drafting longer content.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">
                    Problem (PEACE)
                  </label>
                  <textarea
                    className="w-full rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
                    rows={4}
                    value={soundbyte.peace_problem}
                    onChange={(e) => handleChange("peace_problem", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">
                    Person
                  </label>
                  <textarea
                    className="w-full rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
                    rows={4}
                    value={soundbyte.peace_person}
                    onChange={(e) => handleChange("peace_person", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">
                    Empathy
                  </label>
                  <textarea
                    className="w-full rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
                    rows={4}
                    value={soundbyte.peace_emotion}
                    onChange={(e) => handleChange("peace_emotion", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">
                    Answer
                  </label>
                  <textarea
                    className="w-full rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
                    rows={4}
                    value={soundbyte.peace_action}
                    onChange={(e) => handleChange("peace_action", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">
                    Change
                  </label>
                  <textarea
                    className="w-full rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
                    rows={4}
                    value={soundbyte.peace_change}
                    onChange={(e) => handleChange("peace_change", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">
                    End result
                  </label>
                  <textarea
                    className="w-full rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
                    rows={4}
                    value={soundbyte.peace_evidence}
                    onChange={(e) => handleChange("peace_evidence", e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-boh-border-light/70 dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface/80 dark:bg-boh-bg p-4 space-y-4">
              <h2 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">Strategic positioning</h2>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">
                  Hole we own
                </label>
                <textarea
                  className="w-full rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
                  rows={3}
                  value={soundbyte.hole_we_own}
                  onChange={(e) => handleChange("hole_we_own", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">
                  Core soundbyte
                </label>
                <textarea
                  className="w-full rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
                  rows={2}
                  value={soundbyte.core_soundbyte}
                  onChange={(e) => handleChange("core_soundbyte", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">
                  Notes
                </label>
                <textarea
                  className="w-full rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
                  rows={3}
                  value={soundbyte.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-boh-border-light text-primary focus:ring-primary"
                    checked={soundbyte.is_default}
                    onChange={(e) => handleChange("is_default", e.target.checked)}
                  />
                  <span>Set as default soundbyte for this workspace</span>
                </label>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save soundbyte"}
                </button>
              </div>
            </section>
            </>
            )}
        </div>
      )}
    </div>
  );
};

export default SoundbyteManagerPage;
