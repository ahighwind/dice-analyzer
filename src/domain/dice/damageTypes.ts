import type { AnalysisMode } from './types'

export interface DamageTypeOption {
  label: string
  modes: AnalysisMode[]
  color: string
}

export const DAMAGE_TYPES: DamageTypeOption[] = [
  { label: 'Acid', modes: ['dnd', 'pf2'], color: '#a3e635' },
  { label: 'Bludgeoning', modes: ['dnd', 'pf2'], color: '#c08457' },
  { label: 'Cold', modes: ['dnd', 'pf2'], color: '#38bdf8' },
  { label: 'Fire', modes: ['dnd', 'pf2'], color: '#fb923c' },
  { label: 'Force', modes: ['dnd', 'pf2'], color: '#c084fc' },
  { label: 'Lightning', modes: ['dnd'], color: '#facc15' },
  { label: 'Necrotic', modes: ['dnd'], color: '#64748b' },
  { label: 'Piercing', modes: ['dnd', 'pf2'], color: '#d1d5db' },
  { label: 'Poison', modes: ['dnd', 'pf2'], color: '#4ade80' },
  { label: 'Psychic', modes: ['dnd'], color: '#e879f9' },
  { label: 'Radiant', modes: ['dnd'], color: '#fde047' },
  { label: 'Slashing', modes: ['dnd', 'pf2'], color: '#f87171' },
  { label: 'Thunder', modes: ['dnd'], color: '#60a5fa' },
  { label: 'Electricity', modes: ['pf2'], color: '#facc15' },
  { label: 'Sonic', modes: ['pf2'], color: '#60a5fa' },
  { label: 'Vitality', modes: ['pf2'], color: '#fde047' },
  { label: 'Void', modes: ['pf2'], color: '#64748b' },
  { label: 'Spirit', modes: ['pf2'], color: '#c084fc' },
  { label: 'Mental', modes: ['pf2'], color: '#e879f9' },
  { label: 'Bleed', modes: ['pf2'], color: '#dc2626' },
  { label: 'Precision', modes: ['pf2'], color: '#f472b6' },
  { label: 'Holy', modes: ['pf2'], color: '#fbbf24' },
  { label: 'Unholy', modes: ['pf2'], color: '#a855f7' },
]

export function getDamageTypeOptions(mode: AnalysisMode): DamageTypeOption[] {
  const options = DAMAGE_TYPES.filter((option) => option.modes.includes(mode))
  if (mode !== 'pf2') return options

  const order = [
    'Bludgeoning',
    'Piercing',
    'Slashing',
    'Acid',
    'Cold',
    'Electricity',
    'Fire',
    'Sonic',
    'Vitality',
    'Void',
    'Force',
    'Spirit',
    'Mental',
    'Poison',
    'Bleed',
    'Precision',
    'Holy',
    'Unholy',
  ]
  return options.sort((left, right) => order.indexOf(left.label) - order.indexOf(right.label))
}
