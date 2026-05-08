import { calculate_emission_activity } from './calculate-emission-activity.js';

function nextVersion(activityId, previousCalculationResults) {
  const versions = previousCalculationResults
    .filter((row) => row.emission_activity_id === activityId)
    .map((row) => row.calc_version || 0);

  if (versions.length === 0) return 1;
  return Math.max(...versions) + 1;
}

export function recalculate_project({
  organization_id,
  project_id,
  activities,
  factors,
  previous_calculation_results = [],
  formula_version = 'v1.0.0',
}) {
  const calculation_results = [];

  let calculated_count = 0;
  let pending_factor_count = 0;
  let excluded_count = 0;
  let error_count = 0;

  for (const activity of activities) {
    const calculation = calculate_emission_activity({
      activity,
      factors,
      formula_version,
    });

    if (calculation.status === 'calculated') calculated_count += 1;
    if (calculation.status === 'pending_factor') pending_factor_count += 1;
    if (calculation.status === 'superseded') excluded_count += 1;
    if (calculation.status === 'error') error_count += 1;

    calculation_results.push({
      organization_id,
      project_id,
      emission_activity_id: activity.id,
      calc_version: nextVersion(activity.id, previous_calculation_results),
      ...calculation,
    });
  }

  return {
    project_id,
    processed_activities: activities.length,
    calculated_count,
    pending_factor_count,
    excluded_count,
    error_count,
    calculation_results,
  };
}
