import React, { useEffect, useState } from "react";
import CampaignScheduleFields from "./CampaignScheduleFields";
import type { BonusTierFormRow, CampaignBanner, CampaignScheduleForm } from "../types/reservations";
import { listBonusTiers, listReservations } from "../services/reservationsApi";
import { updateScheduleAndTiers } from "../services/campaignScheduleApi";

const CampaignScheduleEditor: React.FC = () => {
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignBanner | null>(null);
  const [scheduleForm, setScheduleForm] = useState<CampaignScheduleForm>({
    id: undefined,
    enabled: true,
    status: "draft",
    starts_at: null,
    ends_at: null,
  });

  const [bonusTiers, setBonusTiers] = useState<BonusTierFormRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const campaigns = await listReservations();
        if (campaigns.length === 0) {
          setSelectedCampaign(null);
          setBonusTiers([]);
          return;
        }

        const active = campaigns.find((c) => c.status === "active" && c.enabled) ?? campaigns[0];
        setSelectedCampaign(active);

        setScheduleForm({
          id: active.id,
          enabled: active.enabled,
          status: active.status,
          starts_at: active.starts_at,
          ends_at: active.ends_at,
        });

        const tiers = await listBonusTiers();
        setBonusTiers(
          tiers
            .filter((t) => t.campaign_id === active.id)
            .map((t) => ({
              id: t.id,
              label: t.label,
              tier_date: t.tier_date,
              bonus_percent: t.bonus_percent,
              tier_order: t.tier_order ?? 0,
              type: t.type ?? null,
            })),
        );
      } catch (err) {
        console.error("[CampaignScheduleEditor] Error loading schedule data", err);
        setError("Unable to load schedule data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateField = <K extends keyof CampaignScheduleForm>(
    key: K,
    value: CampaignScheduleForm[K],
  ) => {
    setScheduleForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateTierAt = (index: number, patch: Partial<BonusTierFormRow>) => {
    setBonusTiers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch } as BonusTierFormRow;
      return next;
    });
  };

  const removeTierAt = (index: number) => {
    setBonusTiers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerateTiersFromWindow = () => {
    if (!scheduleForm.starts_at || !scheduleForm.ends_at) return;

    const startDate = new Date(scheduleForm.starts_at.split("T")[0]);
    const endDate = new Date(scheduleForm.ends_at.split("T")[0]);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return;
    if (endDate < startDate) return;

    const days: BonusTierFormRow[] = [];
    const cursor = new Date(startDate);
    let order = 1;
    while (cursor <= endDate) {
      const iso = cursor.toISOString().split("T")[0];
      const display = cursor.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      days.push({
        tier_date: iso,
        label: display,
        bonus_percent: null,
        tier_order: order,
        type: null,
      });
      order += 1;
      cursor.setDate(cursor.getDate() + 1);
    }

    setBonusTiers(days);
  };

  const handleSave = async () => {
    if (!scheduleForm.id) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateScheduleAndTiers(
        {
          id: scheduleForm.id,
          enabled: scheduleForm.enabled,
          status: scheduleForm.status,
          starts_at: scheduleForm.starts_at,
          ends_at: scheduleForm.ends_at,
        },
        bonusTiers,
      );
      setSuccess("Schedule updated.");
    } catch (err) {
      console.error("[CampaignScheduleEditor] Error saving schedule", err);
      setError("Unable to save schedule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-boh-border-light/70 dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface/80 dark:bg-boh-bg p-4 space-y-4">
      <h3 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">Schedule editor</h3>
      <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
        Adjust when an existing campaign runs and the daily bonus tiers. Reservations owns schedule; Recipes owns the
        content.
      </p>

      {loading ? (
        <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">Loading scheduleccc</p>
      ) : !selectedCampaign ? (
        <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">No campaigns available.</p>
      ) : (
        <>
          <p className="text-[11px] text-boh-text-sub-light dark:text-boh-text-sub">
            Editing schedule for <span className="font-semibold">{selectedCampaign.headline ?? selectedCampaign.slug}</span>
            
            
            ({selectedCampaign.location}).
          </p>

          {error && (
            <div className="rounded-md border border-red-500/60 bg-red-950/60 px-3 py-1.5 text-[11px] text-red-100">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md border border-emerald-300/70 bg-emerald-50 px-3 py-1.5 text-[11px] text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-900/40 dark:text-emerald-50">
              {success}
            </div>
          )}

          <CampaignScheduleFields
            form={scheduleForm}
            updateField={updateField}
            bonusTiers={bonusTiers}
            updateTierAt={updateTierAt}
            removeTierAt={removeTierAt}
            handleGenerateTiersFromWindow={handleGenerateTiersFromWindow}
          />

          <div className="flex justify-end pt-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !scheduleForm.id}
              className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary/80 disabled:opacity-60"
            >
              {saving ? "Saving scheduleccc" : "Save schedule"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CampaignScheduleEditor;
