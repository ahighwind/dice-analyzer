import type { OutcomeStatus } from '../domain/dice/types'

export function getOutcomeColors(status: OutcomeStatus, backgroundOpacity = 1) {
  const colors: Record<OutcomeStatus, { background: string; border: string }> = {
    unclassified: { background: '59, 130, 246', border: '37, 99, 235' },
    criticalFailure: { background: '10, 15, 25', border: '110, 113, 125' },
    criticalSuccess: { background: '250, 204, 21', border: '202, 138, 4' },
    success: { background: '34, 197, 94', border: '22, 163, 74' },
    failure: { background: '239, 68, 68', border: '220, 38, 38' },
  }
  const color = colors[status]

  return {
    background: `rgba(${color.background}, ${backgroundOpacity})`,
    border: `rgba(${color.border}, 1)`,
  }
}
