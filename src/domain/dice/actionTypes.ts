import type { AnalysisMode, D20Outcome, OutcomeStatus, RollCondition } from './types'

export type DamageDieType = 'd2' | 'd4' | 'd6' | 'd8' | 'd10' | 'd12'
export type EnemySaveType = 'str' | 'dex' | 'cha' | 'con' | 'wis' | 'int' | 'for' | 'ref' | 'wil'

export interface EnemyDefinition {
  acInput: string
  saves: Record<EnemySaveType, string>
  hpInput: string
  resistances: Record<string, string>
  weaknesses: Record<string, string>
  immunities: string[]
}

export interface DamageRollDefinition {
  id: string
  expression: string
  type: string
  color: string
}

export interface ActionDefinition {
  id: string
  name: string
  dcInput: string
  testModifier: number
  rollCondition: RollCondition
  isSave: boolean
  saveType: EnemySaveType
  isBasicSave: boolean
  rerollDamageOnes: boolean
  damageRolls: DamageRollDefinition[]
}

export interface DistributionOutcome {
  value: number
  probability: number
}

export interface DamageTypeDistribution {
  type: string
  color: string
  distribution: DistributionOutcome[]
}

export interface DamageRollAnalysis {
  definition: DamageRollDefinition
  distribution: DistributionOutcome[] | null
}

export interface ActionAnalysis {
  action: ActionDefinition
  dc: number | null
  testModifier: number
  targetLabel: string
  testOutcomes: D20Outcome[]
  successProbability: number | null
  degreeProbabilities: Record<OutcomeStatus, number>
  damageRolls: DamageRollAnalysis[]
  damageDistribution: DistributionOutcome[] | null
  contributionDistribution: DistributionOutcome[] | null
  damageTypeDistributions: DamageTypeDistribution[]
  hasInvalidDamageExpression: boolean
}

export interface ActionsAnalysis {
  actions: ActionAnalysis[]
  totalDamageDistribution: DistributionOutcome[] | null
  damageTypeDistributions: DamageTypeDistribution[]
  hasInvalidDamageExpression: boolean
  hasInvalidEnemyDamageTraits: boolean
  hasMissingDC: boolean
  mode: AnalysisMode
}
