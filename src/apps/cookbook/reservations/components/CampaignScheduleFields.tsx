import React from "react";
import BohDateTimePicker from "../../../../components/boh/BohDateTimePicker";
import type { BonusTierFormRow, CampaignScheduleForm, CampaignStatus } from "../types/reservations";

export interface CampaignScheduleFieldsProps {
  form: CampaignScheduleForm;
  updateField: <K extends keyof CampaignScheduleForm>(key: K, value: CampaignScheduleForm[K]) => void;
  bonusTiers: BonusTierFormRow[];
  updateTierAt: (index: number, patch: Partial<BonusTierFormRow>) => void;
  removeTierAt: (index: number) => void;
  handleGenerateTiersFromWindow: () => void;
}

const CampaignScheduleFields: React.FC<CampaignScheduleFieldsProps> = ({
  form,
  updateField,
  bonusTiers,
  updateTierAt,
  removeTierAt,
  handleGenerateTiersFromWindow,
}) => {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5" />
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-boh-text-light dark:text-boh-text-sub">Status</label>
          <select
            className="w-full rounded-md border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light dark:text-boh-text focus:border-primary focus:ring-primary dark:border-boh-border dark:bg-boh-surface dark:text-boh-text"
            value={form.status}
            onChange={(e) => updateField("status", e.target.value as CampaignStatus)}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BohDateTimePicker
          label="Starts at"
          value={form.starts_at}
          onChange={(next) => updateField("starts_at", next)}
        />
        <BohDateTimePicker
          label="Ends at"
          value={form.ends_at}
          onChange={(next) => updateField("ends_at", next)}
        />
      </div>

      {form.starts_at && form.ends_at && (
        <div className="mt-1 space-y-0.5 text-[11px] text-boh-text-sub-light dark:text-boh-text-sub">
          <div>
            <span className="font-medium">Australia/Sydney:</span>{" "}
            {new Date(form.starts_at).toLocaleString("en-AU", { timeZone: "Australia/Sydney" })}{" "}
            {new Date(form.ends_at).toLocaleString("en-AU", { timeZone: "Australia/Sydney" })}
          </div>
          <div>
            <span className="font-medium">New York (ET):</span>{" "}
            {new Date(form.starts_at).toLocaleString("en-US", { timeZone: "America/New_York" })}{" "}
            {new Date(form.ends_at).toLocaleString("en-US", { timeZone: "America/New_York" })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-2 text-xs text-boh-text-light dark:text-boh-text-sub">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface"
            style={{ accentColor: "#6563CC" }}
            checked={form.enabled}
            onChange={(e) => updateField("enabled", e.target.checked)}
          />
          Enabled
        </label>
        <p className="text-[11px] text-boh-text-sub-light dark:text-boh-text-sub">
          Active campaigns must also be enabled to be considered live.
        </p>
      </div>

      <section className="mt-8 border-t border-boh-border-light dark:border-boh-border pt-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">Daily bonus tiers</h3>
            <p className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
              For multi-day campaigns (e.g. Cyber Week, 12 Days of Momentum), each row represents the bonus for a
              specific calendar day.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerateTiersFromWindow}
            disabled={!form.starts_at || !form.ends_at}
            className="inline-flex items-center rounded-md border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface px-3 py-1.5 text-xs font-medium text-boh-text-light dark:text-boh-text shadow-sm hover:bg-boh-bg-light dark:hover:bg-boh-bg disabled:cursor-not-allowed disabled:opacity-60"
          >
            Generate days from campaign window
          </button>
        </div>

        {!form.starts_at || !form.ends_at ? (
          <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
            Set a start and end date for this campaign to generate daily tiers.
          </p>
        ) : bonusTiers.length === 0 ? (
          <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
            No daily bonus tiers yet. Generate days from the campaign window, then set a bonus percent for each day.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {bonusTiers.map((tier, index) => {
              const displayDate = new Date(tier.tier_date).toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              });
              return (
                <div
                  key={tier.tier_date}
                  className="flex items-center gap-3 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg px-3 py-2"
                >
                  <div className="w-32 text-xs font-medium text-boh-text-light dark:text-boh-text">{displayDate}</div>
                  <input
                    type="text"
                    className="flex-1 rounded-md border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface px-2 py-1 text-xs text-boh-text-light dark:text-boh-text shadow-sm focus:border-primary focus:ring-primary"
                    value={tier.label}
                    onChange={(e) => updateTierAt(index, { label: e.target.value })}
                  />
                  <div className="w-28 flex items-center gap-1">
                    <input
                      type="number"
                      className="w-full rounded-md border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface px-2 py-1 text-right text-xs text-boh-text-light dark:text-boh-text shadow-sm focus:border-primary focus:ring-primary dark:border-boh-border dark:bg-boh-surface dark:text-boh-text"
                      value={tier.bonus_percent ?? ""}
                      onChange={(e) =>
                        updateTierAt(index, {
                          bonus_percent: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      placeholder="e.g. 150"
                      min={0}
                    />
                    <span className="text-[11px] text-boh-text-sub-light dark:text-boh-text-sub">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTierAt(index)}
                    className="text-[11px] text-boh-text-sub-light dark:text-boh-text-sub hover:text-red-500 dark:text-boh-text-sub dark:hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
};

export default CampaignScheduleFields;
