import type { DamageRollAnalysis, DistributionOutcome } from './actionTypes'

export interface DamageTypeContribution {
  type: string
  color: string
  value: number
}

export interface DamageContributionOutcome {
  value: number
  contributions: DamageTypeContribution[]
}

interface DamageContributionState {
  probability: number
  weightedContributions: number[]
}

export function getDamageContributionsByTotal(
  damageRolls: DamageRollAnalysis[],
  distribution: DistributionOutcome[],
): DamageContributionOutcome[] {
  const rolls = damageRolls.filter(
    (roll): roll is DamageRollAnalysis & { distribution: DistributionOutcome[] } =>
      roll.distribution !== null,
  )
  if (!rolls.length) return []

  let states = new Map<number, DamageContributionState>([
    [0, { probability: 1, weightedContributions: [] }],
  ])

  for (const [rollIndex, roll] of rolls.entries()) {
    const nextStates = new Map<number, DamageContributionState>()
    for (const [total, state] of states) {
      for (const outcome of roll.distribution) {
        const combinedTotal = total + outcome.value
        const probability = state.probability * outcome.probability
        const contribution = nextStates.get(combinedTotal) ?? {
          probability: 0,
          weightedContributions: new Array(rollIndex + 1).fill(0),
        }
        contribution.probability += probability
        for (let index = 0; index < rollIndex; index += 1) {
          contribution.weightedContributions[index] +=
            state.weightedContributions[index] * outcome.probability
        }
        contribution.weightedContributions[rollIndex] += probability * outcome.value
        nextStates.set(combinedTotal, contribution)
      }
    }
    states = nextStates
  }

  return distribution.map(({ value }) => {
    const state = states.get(value)
    const contributions = new Map<string, DamageTypeContribution>()

    rolls.forEach((roll, index) => {
      const key = `${roll.definition.type}\u0000${roll.definition.color}`
      const contribution = contributions.get(key) ?? {
        type: roll.definition.type,
        color: roll.definition.color,
        value: 0,
      }
      if (state && state.probability > 0) {
        contribution.value += state.weightedContributions[index] / state.probability
      }
      contributions.set(key, contribution)
    })

    return { value, contributions: [...contributions.values()] }
  })
}
