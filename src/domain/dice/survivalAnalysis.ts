import type { DistributionOutcome } from './actionTypes'

export const SURVIVAL_ANALYSIS_TURNS = 10

export interface EnemyHitPointQuantiles {
  turn: number
  d1: number
  q1: number
  median: number
  q3: number
  d9: number
}

export interface EnemySurvivalAnalysis {
  survivalProbabilities: Array<{ turn: number; probability: number }>
  hitPointQuantiles: EnemyHitPointQuantiles[]
}

export function getEnemySurvivalAnalysis(
  damagePerTurn: DistributionOutcome[],
  hitPoints: number,
  maxTurns = SURVIVAL_ANALYSIS_TURNS,
): EnemySurvivalAnalysis {
  if (
    damagePerTurn.length === 0
    || !Number.isSafeInteger(hitPoints)
    || hitPoints <= 0
    || !Number.isSafeInteger(maxTurns)
    || maxTurns <= 0
  ) {
    return { survivalProbabilities: [], hitPointQuantiles: [] }
  }

  let remainingHitPointDistribution = new Map<number, number>([[hitPoints, 1]])
  const survivalProbabilities: Array<{ turn: number; probability: number }> = []
  const hitPointQuantiles: EnemyHitPointQuantiles[] = []

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    const nextDistribution = new Map<number, number>()

    for (const [remainingHitPoints, currentProbability] of remainingHitPointDistribution) {
      for (const outcome of damagePerTurn) {
        const nextHitPoints = Math.max(0, remainingHitPoints - outcome.value)

        nextDistribution.set(
          nextHitPoints,
          (nextDistribution.get(nextHitPoints) ?? 0) + currentProbability * outcome.probability,
        )
      }
    }

    remainingHitPointDistribution = nextDistribution
    const probability = Array.from(remainingHitPointDistribution)
      .reduce((total, [remainingHitPoints, outcomeProbability]) =>
        total + (remainingHitPoints > 0 ? outcomeProbability : 0), 0)
    survivalProbabilities.push({ turn, probability })

    const orderedOutcomes = Array.from(remainingHitPointDistribution)
      .sort(([leftHitPoints], [rightHitPoints]) => leftHitPoints - rightHitPoints)
    const quantile = (threshold: number) => {
      let cumulativeProbability = 0
      for (const [remainingHitPoints, outcomeProbability] of orderedOutcomes) {
        cumulativeProbability += outcomeProbability
        if (cumulativeProbability >= threshold) return remainingHitPoints
      }
      return orderedOutcomes.at(-1)?.[0] ?? 0
    }
    const statistics = {
      d1: quantile(0.1),
      q1: quantile(0.25),
      median: quantile(0.5),
      q3: quantile(0.75),
      d9: quantile(0.9),
    }
    hitPointQuantiles.push({ turn, ...statistics })
  }

  return { survivalProbabilities, hitPointQuantiles }
}

export function getEnemySurvivalProbabilities(
  damagePerTurn: DistributionOutcome[],
  hitPoints: number,
  maxTurns = SURVIVAL_ANALYSIS_TURNS,
): Array<{ turn: number; probability: number }> {
  return getEnemySurvivalAnalysis(damagePerTurn, hitPoints, maxTurns).survivalProbabilities
}
