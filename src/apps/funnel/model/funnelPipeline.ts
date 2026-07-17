import type {
  FunnelOpportunity,
  FunnelOpportunityStage,
  FunnelPipelineMetrics,
  FunnelStageGroup,
} from '../types';

export function effectiveProbability(
  opportunity: Pick<FunnelOpportunity, 'probability_override'>,
  stage: Pick<FunnelOpportunityStage, 'default_probability'>,
): number {
  return opportunity.probability_override ?? stage.default_probability;
}

export function groupOpportunitiesByStage(
  stages: FunnelOpportunityStage[],
  opportunities: FunnelOpportunity[],
): FunnelStageGroup[] {
  return [...stages]
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((stage) => {
      const stageOpportunities = opportunities.filter((opportunity) => opportunity.stage_id === stage.id);
      return {
        stage,
        opportunities: stageOpportunities,
        totalValue: stageOpportunities.reduce((total, opportunity) => total + Number(opportunity.value_amount), 0),
        weightedValue: stageOpportunities.reduce(
          (total, opportunity) => total + Number(opportunity.value_amount) * effectiveProbability(opportunity, stage) / 100,
          0,
        ),
      };
    });
}

export function calculatePipelineMetrics(
  stages: FunnelOpportunityStage[],
  opportunities: FunnelOpportunity[],
): FunnelPipelineMetrics {
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));

  return opportunities.reduce<FunnelPipelineMetrics>((metrics, opportunity) => {
    const stage = stageById.get(opportunity.stage_id);
    if (!stage) return metrics;

    const value = Number(opportunity.value_amount);
    if (stage.stage_type === 'won') {
      metrics.wonValue += value;
    } else if (stage.stage_type === 'lost') {
      metrics.lostValue += value;
    } else {
      metrics.openValue += value;
      metrics.weightedValue += value * effectiveProbability(opportunity, stage) / 100;
      metrics.openCount += 1;
    }

    return metrics;
  }, { openValue: 0, weightedValue: 0, wonValue: 0, lostValue: 0, openCount: 0 });
}

export function validateStageMove(
  targetStage: Pick<FunnelOpportunityStage, 'stage_type'>,
  lossReason: string | null | undefined,
): { valid: boolean; message: string | null } {
  if (targetStage.stage_type === 'lost' && !lossReason?.trim()) {
    return { valid: false, message: 'Closed Lost requires a loss reason.' };
  }

  return { valid: true, message: null };
}
