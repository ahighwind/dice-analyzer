export { parseIntegerInput, parseRollExpression } from '../domain/dice/rollExpression'
import {
  buildCombinedHistogram,
  getStatistics,
  getSuccessChance,
} from '../domain/dice/probability'
import type {
  AnalysisMode,
  D20Statistics,
  RollCondition,
  RollGroupDefinition,
} from '../domain/dice/types'

export { buildCombinedHistogram, getStatistics, getSuccessChance }
export type {
  AnalysisMode,
  CriticalDamageRule,
  D20Outcome,
  D20Statistics,
  DieType,
  OutcomeStatus,
  RollCondition,
  RollGroupDefinition,
} from '../domain/dice/types'

export function getCombinedSuccessChance(
  rollGroups: RollGroupDefinition[],
  dc: number,
  mode: AnalysisMode = 'default',
  condition: RollCondition = 'normal',
  additionalRolls = 0,
): number {
  return getSuccessChance(buildCombinedHistogram(rollGroups, dc, mode, condition, additionalRolls))
}

export function getCombinedStatistics(
  rollGroups: RollGroupDefinition[],
  dc: number | null,
  mode: AnalysisMode = 'default',
  condition: RollCondition = 'normal',
  additionalRolls = 0,
): D20Statistics {
  const statistics = getStatistics(
    buildCombinedHistogram(rollGroups, dc, mode, condition, additionalRolls),
    dc,
  )

  if (statistics === null) {
    throw new RangeError('At least one roll group is required to calculate statistics.')
  }

  return statistics
}
