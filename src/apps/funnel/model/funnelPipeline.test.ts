import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculatePipelineMetrics,
  effectiveProbability,
  groupOpportunitiesByStage,
  validateStageMove,
} from './funnelPipeline.ts';
import type { FunnelOpportunity, FunnelOpportunityStage } from '../types.ts';

const stages: FunnelOpportunityStage[] = [
  {
    id: 'lead', tenant_id: 'tenant', funnel_id: 'funnel', stage_key: 'lead_identified',
    label: 'Lead Identified', reportable_milestone: 'ICP fit', exit_criteria: 'Fits ICP',
    default_probability: 2, sort_order: 10, stage_type: 'open', is_optional: false, is_active: true,
    created_at: '', updated_at: '',
  },
  {
    id: 'won', tenant_id: 'tenant', funnel_id: 'funnel', stage_key: 'closed_won',
    label: 'Closed Won', reportable_milestone: 'Purchased', exit_criteria: 'Contract complete',
    default_probability: 100, sort_order: 90, stage_type: 'won', is_optional: false, is_active: true,
    created_at: '', updated_at: '',
  },
  {
    id: 'lost', tenant_id: 'tenant', funnel_id: 'funnel', stage_key: 'closed_lost',
    label: 'Closed Lost', reportable_milestone: 'Lost', exit_criteria: 'Reason recorded',
    default_probability: 0, sort_order: 100, stage_type: 'lost', is_optional: false, is_active: true,
    created_at: '', updated_at: '',
  },
];

const opportunities: FunnelOpportunity[] = [
  {
    id: 'one', tenant_id: 'tenant', funnel_id: 'funnel', stage_id: 'lead', name: 'First',
    value_amount: 10000, currency: 'AUD', probability_override: null, owner_id: null,
    primary_organisation_id: null, expected_close_date: null, next_action: null,
    next_action_due_at: null, source: null, status: 'open', outcome_reason: null,
    competitor_name: null, reentry_date: null, created_by: null, updated_by: null,
    created_at: '', updated_at: '', organisation: null,
  },
  {
    id: 'two', tenant_id: 'tenant', funnel_id: 'funnel', stage_id: 'won', name: 'Second',
    value_amount: 5000, currency: 'AUD', probability_override: null, owner_id: null,
    primary_organisation_id: null, expected_close_date: null, next_action: null,
    next_action_due_at: null, source: null, status: 'won', outcome_reason: null,
    competitor_name: null, reentry_date: null, created_by: null, updated_by: null,
    created_at: '', updated_at: '', organisation: null,
  },
];

test('groups every stage and keeps empty stages visible', () => {
  const grouped = groupOpportunitiesByStage(stages, opportunities);
  assert.deepEqual(grouped.map((group) => [group.stage.id, group.opportunities.length]), [
    ['lead', 1], ['won', 1], ['lost', 0],
  ]);
});

test('calculates open, weighted, won and lost pipeline values', () => {
  const metrics = calculatePipelineMetrics(stages, opportunities);
  assert.deepEqual(metrics, {
    openValue: 10000,
    weightedValue: 200,
    wonValue: 5000,
    lostValue: 0,
    openCount: 1,
  });
});

test('uses an Opportunity override without changing the stage default', () => {
  assert.equal(effectiveProbability({ ...opportunities[0], probability_override: 40 }, stages[0]), 40);
  assert.equal(stages[0].default_probability, 2);
});

test('requires a loss reason before moving to Closed Lost', () => {
  assert.deepEqual(validateStageMove(stages[2], ''), { valid: false, message: 'Closed Lost requires a loss reason.' });
  assert.deepEqual(validateStageMove(stages[2], 'No budget'), { valid: true, message: null });
  assert.deepEqual(validateStageMove(stages[1], ''), { valid: true, message: null });
});
