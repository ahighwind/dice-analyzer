import { buildCombinedHistogram, getSuccessChance } from './probability'
import { getDamageTypeOptions } from './damageTypes'
import { parseIntegerInput, parseRollExpression } from './rollExpression'
import type { AnalysisMode, CriticalDamageRule, OutcomeStatus } from './types'
import type {
  ActionAnalysis,
  ActionDefinition,
  ActionsAnalysis,
  DistributionOutcome,
  DamageTypeDistribution,
  EnemyDefinition,
  EnemySaveType,
} from './actionTypes'

const OUTCOME_STATUSES: OutcomeStatus[] = [
  'failure',
  'success',
  'criticalFailure',
  'criticalSuccess',
  'unclassified',
]

function toDistribution(entries: DistributionOutcome[]): DistributionOutcome[] {
  return entries
    .filter((entry) => entry.probability > 0)
    .sort((left, right) => left.value - right.value)
}

function convolve(
  left: DistributionOutcome[],
  right: DistributionOutcome[],
): DistributionOutcome[] {
  const combined = new Map<number, number>()

  for (const leftOutcome of left) {
    for (const rightOutcome of right) {
      const value = leftOutcome.value + rightOutcome.value
      combined.set(
        value,
        (combined.get(value) ?? 0) + leftOutcome.probability * rightOutcome.probability,
      )
    }
  }

  return toDistribution(Array.from(combined, ([value, probability]) => ({ value, probability })))
}

function buildDamageDistribution(
  expression: string,
  rerollOnes: boolean,
  diceCountMultiplier = 1,
): DistributionOutcome[] | null {
  const rollGroups = parseRollExpression(expression)
  if (!rollGroups || rollGroups.some((group) => !['d2', 'd4', 'd6', 'd8', 'd10', 'd12'].includes(group.dieType))) {
    return null
  }

  let outcomes: DistributionOutcome[] = [{ value: 0, probability: 1 }]

  for (const group of rollGroups) {
    const sides = Number.parseInt(group.dieType.slice(1), 10)
    const dieDistribution = Array.from({ length: sides }, (_, index) => {
      const face = index + 1
      const probability = rerollOnes
        ? (face === 1 ? 0 : 1 / sides) + 1 / (sides * sides)
        : 1 / sides
      return { value: face, probability }
    })
    let groupDistribution: DistributionOutcome[] = [{ value: 0, probability: 1 }]

    for (let die = 0; die < group.count * diceCountMultiplier; die += 1) {
      groupDistribution = convolve(groupDistribution, dieDistribution)
    }

    outcomes = convolve(
      outcomes,
      groupDistribution.map(({ value, probability }) => ({
        value: value + group.modifier,
        probability,
      })),
    )
  }

  const clamped = new Map<number, number>()

  for (const { value, probability } of outcomes) {
    const clampedValue = Math.max(0, value)
    clamped.set(clampedValue, (clamped.get(clampedValue) ?? 0) + probability)
  }

  return toDistribution(Array.from(clamped, ([value, probability]) => ({ value, probability })))
}

function buildCriticalDamageDistribution(
  damageRolls: ActionDefinition['damageRolls'],
  damageDistribution: DistributionOutcome[],
  mode: AnalysisMode,
  criticalDamageRule: CriticalDamageRule,
  rerollOnes: boolean,
): DistributionOutcome[] | null {
  if (mode === 'pf2') {
    return damageDistribution.map(({ value, probability }) => ({
      value: value * 2,
      probability,
    }))
  }

  if (criticalDamageRule === 'alternative') {
    const maximumDiceDamage = damageRolls.reduce((total, damageRoll) => {
      const groups = parseRollExpression(damageRoll.expression) ?? []
      return total + groups.reduce(
        (groupTotal, group) => groupTotal + group.count * Number.parseInt(group.dieType.slice(1), 10),
        0,
      )
    }, 0)
    return damageDistribution.map(({ value, probability }) => ({
      value: value + maximumDiceDamage,
      probability,
    }))
  }

  let distribution: DistributionOutcome[] = [{ value: 0, probability: 1 }]

  for (const damageRoll of damageRolls) {
    const rollDistribution = buildDamageDistribution(damageRoll.expression, rerollOnes, 2)
    if (rollDistribution === null) return null
    distribution = convolve(distribution, rollDistribution)
  }

  return distribution
}

function getDegreeProbabilities(
  outcomes: ActionAnalysis['testOutcomes'],
): Record<OutcomeStatus, number> {
  const probabilities: Record<OutcomeStatus, number> = {
    failure: 0,
    success: 0,
    criticalFailure: 0,
    criticalSuccess: 0,
    unclassified: 0,
  }

  for (const outcome of outcomes) {
    probabilities[outcome.status] += outcome.probability
  }

  return probabilities
}

function getDamageMultiplier(status: OutcomeStatus, action: ActionDefinition): number {
  if (action.isSave) {
    if (action.isBasicSave) {
      if (status === 'criticalFailure') return 2
      if (status === 'failure') return 1
      if (status === 'success') return 0.5
      return 0
    }
    return status === 'failure' || status === 'criticalFailure' ? 1 : 0
  }

  return status === 'success' || status === 'criticalSuccess' ? 1 : 0
}

function buildContributionDistribution(
  damageDistribution: DistributionOutcome[],
  criticalDamageDistribution: DistributionOutcome[],
  testOutcomes: ActionAnalysis['testOutcomes'],
  action: ActionDefinition,
): DistributionOutcome[] {
  const contribution = new Map<number, number>()

  for (const testOutcome of testOutcomes) {
    const multiplier = getDamageMultiplier(testOutcome.status, action)
    const outcomes = !action.isSave && testOutcome.status === 'criticalSuccess'
      ? criticalDamageDistribution
      : damageDistribution
    for (const damageOutcome of outcomes) {
      const appliedDamage = multiplier === 0.5
        ? Math.floor(damageOutcome.value / 2)
        : damageOutcome.value * multiplier
      contribution.set(
        appliedDamage,
        (contribution.get(appliedDamage) ?? 0)
          + testOutcome.probability * damageOutcome.probability,
      )
    }
  }

  return toDistribution(
    Array.from(contribution, ([value, probability]) => ({ value, probability })),
  )
}

function applyEnemyDamageRules(
  distribution: DistributionOutcome[],
  damageType: string,
  enemy: EnemyDefinition,
  mode: AnalysisMode,
): DistributionOutcome[] {
  const normalizeDamageType = (value: string) => value.trim().toLowerCase()
  const normalizedType = normalizeDamageType(damageType)
  const immunity = enemy.immunities.some((type) => normalizeDamageType(type) === normalizedType)
  if (immunity) return [{ value: 0, probability: 1 }]

  const resistanceType = Object.keys(enemy.resistances)
    .find((type) => normalizeDamageType(type) === normalizedType)
  const weaknessType = Object.keys(enemy.weaknesses)
    .find((type) => normalizeDamageType(type) === normalizedType)
  const resistanceValue = mode === 'pf2' && resistanceType
    ? parseIntegerInput(enemy.resistances[resistanceType]) ?? 0
    : 0
  const weaknessValue = mode === 'pf2' && weaknessType
    ? parseIntegerInput(enemy.weaknesses[weaknessType]) ?? 0
    : 0
  const hasResistance = resistanceType !== undefined
  const hasWeakness = weaknessType !== undefined
  const transformed = new Map<number, number>()

  for (const outcome of distribution) {
    let value = outcome.value
    const receivesDamage = value > 0
    if (mode === 'dnd' && hasResistance) value = Math.floor(value / 2)
    if (mode === 'pf2' && hasResistance) value = Math.max(0, value - resistanceValue)
    if (receivesDamage) {
      if (mode === 'dnd' && hasWeakness) value *= 2
      if (mode === 'pf2' && hasWeakness) value += weaknessValue
    }
    transformed.set(value, (transformed.get(value) ?? 0) + outcome.probability)
  }

  return toDistribution(Array.from(transformed, ([value, probability]) => ({ value, probability })))
}

function buildEnemyContributionDistribution(
  damageDistributionsByType: Map<string, {
    regular: DistributionOutcome[]
    critical: DistributionOutcome[]
  }>,
  testOutcomes: ActionAnalysis['testOutcomes'],
  action: ActionDefinition,
  enemy: EnemyDefinition,
  mode: AnalysisMode,
): DistributionOutcome[] {
  const contribution = new Map<number, number>()

  for (const testOutcome of testOutcomes) {
    const multiplier = getDamageMultiplier(testOutcome.status, action)
    let typedDamageDistribution: DistributionOutcome[] = [{ value: 0, probability: 1 }]

    for (const [damageType, typeDistributions] of damageDistributionsByType) {
      const isCriticalHit = !action.isSave && testOutcome.status === 'criticalSuccess'
      const typeDistribution = isCriticalHit
        ? typeDistributions.critical
        : typeDistributions.regular
      const adjustedForTest = toDistribution(typeDistribution.map(({ value, probability }) => ({
        value: multiplier === 0.5
          ? Math.floor(value / 2)
          : value * multiplier,
        probability,
      })))
      typedDamageDistribution = convolve(
        typedDamageDistribution,
        applyEnemyDamageRules(adjustedForTest, damageType, enemy, mode),
      )
    }

    for (const damageOutcome of typedDamageDistribution) {
      contribution.set(
        damageOutcome.value,
        (contribution.get(damageOutcome.value) ?? 0)
          + testOutcome.probability * damageOutcome.probability,
      )
    }
  }

  return toDistribution(
    Array.from(contribution, ([value, probability]) => ({ value, probability })),
  )
}

function buildDamageTypeContributionDistribution(
  damageDistributions: { regular: DistributionOutcome[]; critical: DistributionOutcome[] },
  testOutcomes: ActionAnalysis['testOutcomes'],
  action: ActionDefinition,
  damageType: string,
  enemy: EnemyDefinition | null,
  mode: AnalysisMode,
): DistributionOutcome[] {
  const contribution = new Map<number, number>()

  for (const testOutcome of testOutcomes) {
    const multiplier = getDamageMultiplier(testOutcome.status, action)
    const isCriticalHit = !action.isSave && testOutcome.status === 'criticalSuccess'
    const damageDistribution = isCriticalHit
      ? damageDistributions.critical
      : damageDistributions.regular
    const adjustedDistribution = toDistribution(damageDistribution.map(({ value, probability }) => ({
      value: multiplier === 0.5 ? Math.floor(value / 2) : value * multiplier,
      probability,
    })))
    const appliedDistribution = enemy
      ? applyEnemyDamageRules(adjustedDistribution, damageType, enemy, mode)
      : adjustedDistribution

    for (const outcome of appliedDistribution) {
      contribution.set(
        outcome.value,
        (contribution.get(outcome.value) ?? 0) + testOutcome.probability * outcome.probability,
      )
    }
  }

  return toDistribution(
    Array.from(contribution, ([value, probability]) => ({ value, probability })),
  )
}

function buildActionAnalysis(
  action: ActionDefinition,
  mode: AnalysisMode,
  criticalDamageRule: CriticalDamageRule,
  enemy: EnemyDefinition | null,
): ActionAnalysis {
  const modeSaveTypes: EnemySaveType[] = mode === 'pf2'
    ? ['for', 'ref', 'wil']
    : ['str', 'dex', 'con', 'cha', 'wis', 'int']
  const enemySaveType = modeSaveTypes.includes(action.saveType)
    ? action.saveType
    : modeSaveTypes[0]
  const enemySaveInput = enemy?.saves[enemySaveType]
  const enemySaveModifier = enemySaveInput === undefined ? null : parseIntegerInput(enemySaveInput)
  const testModifier = enemy !== null && action.isSave
    ? enemySaveModifier ?? 0
    : action.testModifier
  const dcInput = enemy === null || action.isSave ? action.dcInput : enemy.acInput
  const parsedDc = parseIntegerInput(dcInput)
  const dc = enemy !== null && action.isSave && enemySaveModifier === null
    ? null
    : parsedDc
  const targetLabel = enemy === null
    ? 'DC'
    : action.isSave ? `Action DC (Save ${enemySaveType.toUpperCase()})` : 'AC'
  const condition = mode === 'dnd' ? action.rollCondition : 'normal'
  const testOutcomes = buildCombinedHistogram(
    [{ count: 1, dieType: 'd20', modifier: testModifier }],
    dc,
    mode,
    condition,
    0,
  )

  const damageRolls = action.damageRolls.map((definition) => ({
    definition,
    distribution: buildDamageDistribution(definition.expression, action.rerollDamageOnes),
  }))
  const hasInvalidDamageExpression = damageRolls.some((roll) => roll.distribution === null)
  const damageDistribution = hasInvalidDamageExpression
    ? null
    : damageRolls.reduce(
      (distribution, roll) => convolve(distribution, roll.distribution ?? []),
      [{ value: 0, probability: 1 }],
    )
  const degreeProbabilities = getDegreeProbabilities(testOutcomes)
  const successProbability = dc === null ? null : getSuccessChance(testOutcomes) / 100
  const damageDistributionsByType = new Map<string, {
    regular: DistributionOutcome[]
    critical: DistributionOutcome[]
    type: string
    color: string
  }>()
  for (const damageRoll of action.damageRolls) {
    const regularDistribution = damageRolls.find((roll) => roll.definition.id === damageRoll.id)?.distribution
    if (regularDistribution === null || regularDistribution === undefined) continue
    const normalizedDamageType = damageRoll.type.trim().toLowerCase()
    const existing = damageDistributionsByType.get(normalizedDamageType)
    const regular = convolve(existing?.regular ?? [{ value: 0, probability: 1 }], regularDistribution)
    damageDistributionsByType.set(normalizedDamageType, {
      regular,
      critical: [],
      type: existing?.type ?? damageRoll.type.trim(),
      color: existing?.color ?? damageRoll.color,
    })
  }

  const damageTypeDistributions: DamageTypeDistribution[] = []
  for (const [damageType, typeDistribution] of damageDistributionsByType) {
    const typeRolls = action.damageRolls.filter((roll) => roll.type.trim().toLowerCase() === damageType)
    const critical = buildCriticalDamageDistribution(
      typeRolls,
      typeDistribution.regular,
      mode,
      criticalDamageRule,
      action.rerollDamageOnes,
    )
    const criticalDistribution = critical ?? []
    damageDistributionsByType.set(damageType, {
      ...typeDistribution,
      critical: criticalDistribution,
    })
    damageTypeDistributions.push({
      type: typeDistribution.type,
      color: typeDistribution.color,
      distribution: buildDamageTypeContributionDistribution(
        { regular: typeDistribution.regular, critical: criticalDistribution },
        testOutcomes,
        action,
        damageType,
        enemy,
        mode,
      ),
    })
  }
  const criticalDamageDistribution = damageDistribution === null
    ? null
    : buildCriticalDamageDistribution(
      action.damageRolls,
      damageDistribution,
      mode,
      criticalDamageRule,
      action.rerollDamageOnes,
    )
  let contributionDistribution = damageDistribution

  if (
    successProbability !== null
    && damageDistribution !== null
    && criticalDamageDistribution !== null
  ) {
    if (enemy === null) {
      contributionDistribution = buildContributionDistribution(
        damageDistribution,
        criticalDamageDistribution,
        testOutcomes,
        action,
      )
    } else {
      contributionDistribution = buildEnemyContributionDistribution(
        damageDistributionsByType,
        testOutcomes,
        action,
        enemy,
        mode,
      )
    }
  }

  return {
    action,
    dc,
    testModifier,
    targetLabel,
    testOutcomes,
    successProbability,
    degreeProbabilities,
    damageRolls,
    damageDistribution,
    contributionDistribution,
    damageTypeDistributions,
    hasInvalidDamageExpression,
  }
}

export function analyzeActions(
  actions: ActionDefinition[],
  mode: AnalysisMode,
  criticalDamageRule: CriticalDamageRule = 'raw',
  enemy: EnemyDefinition | null = null,
): ActionsAnalysis {
  const analyzedActions = actions.map((action) =>
    buildActionAnalysis(action, mode, criticalDamageRule, enemy),
  )
  const hasInvalidDamageExpression = analyzedActions.some((action) => action.hasInvalidDamageExpression)
  const activeDamageTypes = new Set(
    getDamageTypeOptions(mode).map((option) => option.label.toLowerCase()),
  )
  const activeTraitValues = (traits: Record<string, string>) =>
    Object.entries(traits)
      .filter(([type]) => activeDamageTypes.has(type.trim().toLowerCase()))
      .map(([, value]) => value)
  const hasInvalidEnemyDamageTraits = mode === 'pf2' && enemy !== null && [
    ...activeTraitValues(enemy.resistances),
    ...activeTraitValues(enemy.weaknesses),
  ].some((value) => {
    const parsedValue = parseIntegerInput(value)
    return parsedValue === null || !Number.isSafeInteger(parsedValue) || parsedValue < 0
  })
  const hasMissingDC = analyzedActions.some((action) => action.dc === null)
  const totalDamageDistribution = hasMissingDC || hasInvalidDamageExpression || hasInvalidEnemyDamageTraits
    ? null
    : analyzedActions.reduce(
      (distribution, action) => convolve(distribution, action.contributionDistribution ?? []),
      [{ value: 0, probability: 1 }],
    )
  const damageTypeDistributions = new Map<string, DamageTypeDistribution>()

  if (totalDamageDistribution !== null) {
    for (const action of analyzedActions) {
      for (const damageType of action.damageTypeDistributions) {
        const key = damageType.type.toLowerCase()
        const existing = damageTypeDistributions.get(key)
        damageTypeDistributions.set(key, {
          type: existing?.type ?? damageType.type,
          color: existing?.color ?? damageType.color,
          distribution: convolve(
            existing?.distribution ?? [{ value: 0, probability: 1 }],
            damageType.distribution,
          ),
        })
      }
    }
  }

  return {
    actions: analyzedActions,
    totalDamageDistribution: hasInvalidDamageExpression ? null : totalDamageDistribution,
    damageTypeDistributions: [...damageTypeDistributions.values()],
    hasInvalidDamageExpression,
    hasInvalidEnemyDamageTraits,
    hasMissingDC,
    mode,
  }
}

export function getStatusProbabilities(
  analysis: ActionAnalysis,
): Array<{ status: OutcomeStatus; probability: number }> {
  return OUTCOME_STATUSES
    .map((status) => ({ status, probability: analysis.degreeProbabilities[status] }))
    .filter((entry) => entry.probability > 0)
}
