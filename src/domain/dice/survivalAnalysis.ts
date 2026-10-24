import type { DistributionOutcome } from './actionTypes'

export const SURVIVAL_ANALYSIS_TURNS = 10

export function getEnemySurvivalProbabilities(
  damagePerTurn: DistributionOutcome[],
  hitPoints: number,
  maxTurns = SURVIVAL_ANALYSIS_TURNS,
): Array<{ turn: number; probability: number }> {
  if (
    damagePerTurn.length === 0
    || !Number.isSafeInteger(hitPoints)
    || hitPoints <= 0
    || !Number.isSafeInteger(maxTurns)
    || maxTurns <= 0
  ) {
    return []
  }

  let damageDistribution = new Map<number, number>([[0, 1]])
  const survivalProbabilities: Array<{ turn: number; probability: number }> = []

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    const nextDistribution = new Map<number, number>()

    for (const [damageTaken, currentProbability] of damageDistribution) {
      for (const outcome of damagePerTurn) {
        const totalDamage = damageTaken + outcome.value
        if (totalDamage >= hitPoints) continue

        nextDistribution.set(
          totalDamage,
          (nextDistribution.get(totalDamage) ?? 0) + currentProbability * outcome.probability,
        )
      }
    }

    damageDistribution = nextDistribution
    const probability = Array.from(damageDistribution.values())
      .reduce((total, outcomeProbability) => total + outcomeProbability, 0)
    survivalProbabilities.push({ turn, probability })
  }

  return survivalProbabilities
}
