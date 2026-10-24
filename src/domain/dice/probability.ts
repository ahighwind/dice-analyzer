import type {
  AnalysisMode,
  D20Outcome,
  D20Statistics,
  OutcomeStatus,
  RollCondition,
  RollGroupDefinition,
} from './types'

function buildSingleGroupDistribution(group: RollGroupDefinition): Map<number, number> {
  const sides = Number.parseInt(group.dieType.replace('d', ''), 10)
  let distribution = new Array(sides + 1).fill(0)
  for (let face = 1; face <= sides; face += 1) {
    distribution[face] = 1 / sides
  }

  for (let dieIndex = 2; dieIndex <= group.count; dieIndex += 1) {
    const nextDistribution = new Array(sides * dieIndex + 1).fill(0)

    for (let currentSum = dieIndex - 1; currentSum <= sides * (dieIndex - 1); currentSum += 1) {
      const currentProbability = distribution[currentSum]
      if (currentProbability === 0) {
        continue
      }

      for (let face = 1; face <= sides; face += 1) {
        nextDistribution[currentSum + face] += currentProbability * (1 / sides)
      }
    }

    distribution = nextDistribution
  }

  const adjustedDistribution = new Map<number, number>()
  for (let totalValue = group.count; totalValue <= sides * group.count; totalValue += 1) {
    const probability = distribution[totalValue] ?? 0
    if (probability > 0) {
      const adjustedValue = totalValue + group.modifier
      adjustedDistribution.set(adjustedValue, (adjustedDistribution.get(adjustedValue) ?? 0) + probability)
    }
  }

  return adjustedDistribution
}

function isSingleD20Roll(rollGroups: RollGroupDefinition[]): boolean {
  return rollGroups.length === 1 && rollGroups[0].count === 1 && rollGroups[0].dieType === 'd20'
}

function applyBestOfRolls(distribution: Map<number, number>, rollCount: number): Map<number, number> {
  if (rollCount === 1) {
    return distribution
  }

  const outcomes = Array.from(distribution.entries()).sort((left, right) => left[0] - right[0])
  const bestDistribution = new Map<number, number>()
  let cumulativeProbability = 0

  for (const [value, probability] of outcomes) {
    const probabilityAtOrBelow = cumulativeProbability + probability
    let probabilityOfBestValue = 0

    for (let exponent = 0; exponent < rollCount; exponent += 1) {
      probabilityOfBestValue += probabilityAtOrBelow ** (rollCount - 1 - exponent)
        * cumulativeProbability ** exponent
    }

    bestDistribution.set(value, probability * probabilityOfBestValue)
    cumulativeProbability = probabilityAtOrBelow
  }

  return bestDistribution
}

function applyRollCondition(
  distribution: Map<number, number>,
  condition: RollCondition,
  additionalRolls: number,
): Map<number, number> {
  if (!Number.isInteger(additionalRolls) || additionalRolls < 0 || additionalRolls > 3) {
    throw new RangeError('Additional rolls must be an integer from 0 to 3.')
  }

  if (condition === 'disadvantage') {
    const outcomes = Array.from(distribution.entries()).sort((left, right) => left[0] - right[0])
    const disadvantagedDistribution = new Map<number, number>()
    let probabilityAbove = 0

    for (let index = outcomes.length - 1; index >= 0; index -= 1) {
      const [value, probability] = outcomes[index]
      disadvantagedDistribution.set(value, probability * (2 * probabilityAbove + probability))
      probabilityAbove += probability
    }

    return disadvantagedDistribution
  }

  const rollCount = (condition === 'advantage' ? 2 : 1) + additionalRolls
  return applyBestOfRolls(distribution, rollCount)
}

function getOutcomeStatus(
  rollGroups: RollGroupDefinition[],
  adjustedValue: number,
  dc: number | null,
  mode: AnalysisMode,
): OutcomeStatus {
  if (dc === null) {
    return 'unclassified'
  }

  if (mode === 'default') {
    return adjustedValue >= dc ? 'success' : 'failure'
  }

  if (mode === 'dnd') {
    if (isSingleD20Roll(rollGroups)) {
      const singleGroup = rollGroups[0]
      if (adjustedValue === 1 + singleGroup.modifier) {
        return 'criticalFailure'
      }
      if (adjustedValue === 20 + singleGroup.modifier) {
        return 'criticalSuccess'
      }
    }

    return adjustedValue >= dc ? 'success' : 'failure'
  }

  if (mode === 'pf2') {
    const difference = adjustedValue - dc
    let degree: OutcomeStatus

    if (difference <= -10) {
      degree = 'criticalFailure'
    } else if (difference >= 10) {
      degree = 'criticalSuccess'
    } else if (difference >= 0) {
      degree = 'success'
    } else {
      degree = 'failure'
    }

    if (!isSingleD20Roll(rollGroups)) {
      return degree
    }

    const singleGroup = rollGroups[0]
    const degreeOrder: OutcomeStatus[] = ['criticalFailure', 'failure', 'success', 'criticalSuccess']
    const degreeIndex = degreeOrder.indexOf(degree)
    const naturalFace = adjustedValue - singleGroup.modifier

    if (naturalFace === 1) {
      return degreeOrder[Math.max(0, degreeIndex - 1)]
    }
    if (naturalFace === 20) {
      return degreeOrder[Math.min(degreeOrder.length - 1, degreeIndex + 1)]
    }

    return degree
  }

  return adjustedValue >= dc ? 'success' : 'failure'
}

export function buildCombinedHistogram(
  rollGroups: RollGroupDefinition[],
  dc: number | null,
  mode: AnalysisMode = 'default',
  condition: RollCondition = 'normal',
  additionalRolls = 0,
): D20Outcome[] {
  if (rollGroups.length === 0) {
    return []
  }

  let combinedDistribution = new Map<number, number>([[0, 1]])

  for (const group of rollGroups) {
    const groupDistribution = buildSingleGroupDistribution(group)
    const nextDistribution = new Map<number, number>()

    for (const [currentValue, currentProbability] of combinedDistribution.entries()) {
      for (const [groupValue, groupProbability] of groupDistribution.entries()) {
        const nextValue = currentValue + groupValue
        nextDistribution.set(
          nextValue,
          (nextDistribution.get(nextValue) ?? 0) + currentProbability * groupProbability,
        )
      }
    }

    combinedDistribution = nextDistribution
  }

  combinedDistribution = applyRollCondition(combinedDistribution, condition, additionalRolls)

  return Array.from(combinedDistribution.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([adjustedValue, probability]) => ({
      label: String(adjustedValue),
      adjustedValue,
      status: getOutcomeStatus(rollGroups, adjustedValue, dc, mode),
      probability,
    }))
}

export function getSuccessChance(histogram: D20Outcome[]): number {
  const successfulProbability = histogram.reduce(
    (total, entry) => total + ((entry.status === 'success' || entry.status === 'criticalSuccess') ? entry.probability : 0),
    0,
  )

  return successfulProbability * 100
}

export function getStatistics(histogram: D20Outcome[], dc: number | null): D20Statistics | null {
  if (histogram.length === 0) {
    return null
  }

  const probabilities = histogram.map((entry) => entry.probability)
  const values = histogram.map((entry) => entry.adjustedValue)
  const mean = values.reduce((sum, value, index) => sum + value * probabilities[index], 0)

  let cumulativeProbability = 0
  let median = values[0]
  for (let index = 0; index < values.length; index += 1) {
    cumulativeProbability += probabilities[index]
    if (cumulativeProbability >= 0.5) {
      median = values[index]
      break
    }
  }

  const variance = values.reduce((sum, value, index) => sum + ((value - mean) ** 2) * probabilities[index], 0)
  const standardDeviation = Math.sqrt(variance)
  const sumProbabilityFor = (status: OutcomeStatus) =>
    histogram.reduce((total, entry) => total + (entry.status === status ? entry.probability : 0), 0)

  return {
    mean,
    median,
    standardDeviation,
    minimum: values[0],
    maximum: values[values.length - 1],
    successProbability: dc === null ? 0 : getSuccessChance(histogram) / 100,
    simpleSuccessProbability: sumProbabilityFor('success'),
    simpleFailureProbability: sumProbabilityFor('failure'),
    criticalSuccessProbability: sumProbabilityFor('criticalSuccess'),
    criticalFailureProbability: sumProbabilityFor('criticalFailure'),
  }
}
