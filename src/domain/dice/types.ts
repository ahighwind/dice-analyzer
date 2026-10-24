export const DIE_TYPES = ['d2', 'd4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as const

export type DieType = typeof DIE_TYPES[number]
export type AnalysisMode = 'default' | 'dnd' | 'pf2'
export type CriticalDamageRule = 'raw' | 'alternative'
export type RollCondition = 'normal' | 'advantage' | 'disadvantage'
export type OutcomeStatus = 'failure' | 'success' | 'criticalFailure' | 'criticalSuccess' | 'unclassified'

export interface RollGroupDefinition {
  count: number
  dieType: DieType
  modifier: number
}

export interface D20Outcome {
  label: string
  adjustedValue: number
  status: OutcomeStatus
  probability: number
}

export interface D20Statistics {
  mean: number
  median: number
  standardDeviation: number
  minimum: number
  maximum: number
  successProbability: number
  simpleSuccessProbability: number
  simpleFailureProbability: number
  criticalSuccessProbability: number
  criticalFailureProbability: number
}
