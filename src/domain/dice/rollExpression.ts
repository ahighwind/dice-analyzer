import { DIE_TYPES, type DieType, type RollGroupDefinition } from './types'

function isDieType(value: string): value is DieType {
  return DIE_TYPES.some((dieType) => dieType === value)
}

export function parseIntegerInput(value: string): number | null {
  const trimmedValue = value.trim()

  if (!/^-?\d+$/.test(trimmedValue)) {
    return null
  }

  return Number.parseInt(trimmedValue, 10)
}

export function parseRollExpression(expression: string): RollGroupDefinition[] | null {
  const normalizedExpression = expression.replace(/\s+/g, '').toLowerCase()
  const rollGroups: RollGroupDefinition[] = []
  let modifier = 0
  let position = 0

  while (position < normalizedExpression.length) {
    const remainingExpression = normalizedExpression.slice(position)
    const match = /^([+-]?)(?:(\d*)d(\d+)|(\d+))/.exec(remainingExpression)

    if (!match || (position > 0 && match[1] === '')) {
      return null
    }

    const [, sign, countInput, sidesInput, modifierInput] = match
    const signValue = sign === '-' ? -1 : 1

    if (sidesInput !== undefined) {
      const count = countInput === '' ? 1 : Number.parseInt(countInput, 10)
      const dieType = `d${sidesInput}`

      if (signValue < 0 || !isDieType(dieType) || count < 1 || count > 100) {
        return null
      }

      rollGroups.push({ count, dieType, modifier: 0 })
    } else if (modifierInput !== undefined) {
      const value = Number.parseInt(modifierInput, 10) * signValue
      modifier += value

      if (!Number.isSafeInteger(modifier)) {
        return null
      }
    } else {
      return null
    }

    position += match[0].length
  }

  if (rollGroups.length === 0) {
    return null
  }

  rollGroups[0].modifier = modifier
  return rollGroups
}
