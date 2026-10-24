import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  analyzeActions,
} from '../domain/dice/actionAnalysis'
import type { ActionDefinition, EnemyDefinition } from '../domain/dice/actionTypes'
import { getDamageTypeOptions } from '../domain/dice/damageTypes'
import type { DamageTypeOption } from '../domain/dice/damageTypes'
import {
  buildCombinedHistogram,
  getStatistics,
  getSuccessChance,
} from '../domain/dice/probability'
import { parseIntegerInput, parseRollExpression } from '../domain/dice/rollExpression'
import type { AnalysisMode, CriticalDamageRule } from '../domain/dice/types'

function getModeFromUrl(): AnalysisMode {
  const requestedMode = new URLSearchParams(window.location.search).get('mode')
  return requestedMode === 'dnd' || requestedMode === 'pf2' ? requestedMode : 'default'
}

function getDamageTypeForMode(
  damageType: string,
  mode: Exclude<AnalysisMode, 'default'>,
): DamageTypeOption | null {
  const options = getDamageTypeOptions(mode)
  const matchingType = options.find(
    (option) => option.label.toLowerCase() === damageType.trim().toLowerCase(),
  )
  if (matchingType) return matchingType

  const aliases: Record<string, string> = mode === 'pf2'
    ? {
        physical: 'Bludgeoning',
        lightning: 'Electricity',
        psychic: 'Mental',
        positive: 'Vitality',
        radiant: 'Vitality',
        negative: 'Void',
        necrotic: 'Void',
        thunder: 'Sonic',
      }
    : {
        physical: 'Bludgeoning',
        electricity: 'Lightning',
        mental: 'Psychic',
        positive: 'Radiant',
        vitality: 'Radiant',
        negative: 'Necrotic',
        void: 'Necrotic',
        sonic: 'Thunder',
      }
  const alias = aliases[damageType.trim().toLowerCase()]
  return options.find((option) => option.label === alias) ?? null
}

function normalizeActionsForMode(
  actions: ActionDefinition[],
  mode: Exclude<AnalysisMode, 'default'>,
): ActionDefinition[] {
  return actions.map((action) => ({
    ...action,
    damageRolls: action.damageRolls.map((damageRoll) => {
      const option = getDamageTypeForMode(damageRoll.type, mode)
      if (!option) return damageRoll
      return {
        ...damageRoll,
        type: option.label,
        color: option.label === damageRoll.type ? damageRoll.color : option.color,
      }
    }),
  }))
}

function normalizeEnemyTypes(
  enemy: EnemyDefinition,
  mode: Exclude<AnalysisMode, 'default'>,
): EnemyDefinition {
  const normalizeTraitMap = (traits: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(traits).flatMap(([type, value]) => {
        const option = getDamageTypeForMode(type, mode)
        return option ? [[option.label, value]] : [[type, value]]
      }),
    )

  const normalizeImmunities = (types: string[]) =>
    [...new Set(types.flatMap((type) => {
      const option = getDamageTypeForMode(type, mode)
      return option ? [option.label] : [type]
    }))]

  return {
    ...enemy,
    resistances: normalizeTraitMap(enemy.resistances),
    weaknesses: normalizeTraitMap(enemy.weaknesses),
    immunities: normalizeImmunities(enemy.immunities),
  }
}

export function useRollAnalysis() {
  const dcInput = ref('')
  const dc = computed(() => parseIntegerInput(dcInput.value))
  const dcIsEmpty = computed(() => dcInput.value.trim() === '')
  const dcIsInvalid = computed(() => !dcIsEmpty.value && dc.value === null)
  const mode = ref<AnalysisMode>(getModeFromUrl())
  const enemy = ref<EnemyDefinition | null>(null)
  const criticalDamageRule = ref<CriticalDamageRule>('raw')
  const rollExpression = ref('1d20')
  const rollExpressionIsEmpty = computed(() => rollExpression.value.trim() === '')
  const parsedRollGroups = computed(() => parseRollExpression(rollExpression.value))
  const lastValidRollGroups = ref(parsedRollGroups.value)
  watch(rollExpression, (expression) => {
    if (expression.trim() === '') {
      lastValidRollGroups.value = null
      return
    }
    const groups = parseRollExpression(expression)
    if (groups !== null) lastValidRollGroups.value = groups
  })
  const actions = ref<ActionDefinition[]>([
    {
      id: crypto.randomUUID(),
      name: 'Action 1',
      dcInput: '',
      testModifier: 0,
      rollCondition: 'normal',
      isSave: false,
      saveType: 'str',
      isBasicSave: false,
      rerollDamageOnes: false,
      damageRolls: [
        {
          id: crypto.randomUUID(),
          expression: '1d8',
          type: 'Bludgeoning',
          color: getDamageTypeOptions('dnd').find((option) => option.label === 'Bludgeoning')?.color
            ?? '#c08457',
        },
      ],
    },
  ])

  function setMode(nextMode: AnalysisMode) {
    if (nextMode !== 'default' && mode.value !== nextMode) {
      actions.value = normalizeActionsForMode(actions.value, nextMode)
      if (enemy.value) enemy.value = normalizeEnemyTypes(enemy.value, nextMode)
    }
    mode.value = nextMode

    const url = new URL(window.location.href)
    if (nextMode === 'default') {
      url.searchParams.delete('mode')
    } else {
      url.searchParams.set('mode', nextMode)
    }
    window.history.pushState(window.history.state, '', url)
  }

  function syncModeFromUrl() {
    const nextMode = getModeFromUrl()
    if (nextMode !== 'default' && mode.value !== nextMode) {
      actions.value = normalizeActionsForMode(actions.value, nextMode)
      if (enemy.value) enemy.value = normalizeEnemyTypes(enemy.value, nextMode)
    }
    mode.value = nextMode
  }

  onMounted(() => window.addEventListener('popstate', syncModeFromUrl))
  onUnmounted(() => window.removeEventListener('popstate', syncModeFromUrl))

  const analysis = computed(() => {
    if (mode.value === 'default' || dcIsInvalid.value) return null
    return analyzeActions(
      actions.value,
      mode.value,
      criticalDamageRule.value,
      enemy.value,
    )
  })
  const outcomes = computed(() => {
    if (
      mode.value !== 'default'
      || lastValidRollGroups.value === null
      || (dc.value === null && !dcIsEmpty.value)
    ) return []

    return buildCombinedHistogram(
      lastValidRollGroups.value,
      dc.value,
      mode.value,
      'normal',
      0,
    )
  })
  const successChance = computed(() => {
    if (mode.value !== 'default' || dc.value === null || outcomes.value.length === 0) return null
    return getSuccessChance(outcomes.value)
  })
  const statistics = computed(() => {
    if (
      mode.value !== 'default'
      || lastValidRollGroups.value === null
      || (dc.value === null && !dcIsEmpty.value)
    ) return null
    return getStatistics(outcomes.value, dc.value)
  })

  return {
    actions,
    analysis,
    enemy,
    dc,
    dcInput,
    dcIsEmpty,
    dcIsInvalid,
    criticalDamageRule,
    lastValidRollGroups,
    mode,
    outcomes,
    parsedRollGroups,
    rollExpression,
    rollExpressionIsEmpty,
    statistics,
    successChance,
    setMode,
  }
}
