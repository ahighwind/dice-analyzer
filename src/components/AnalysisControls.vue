<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { getDamageTypeOptions } from '../domain/dice/damageTypes'
import { parseIntegerInput, parseRollExpression } from '../domain/dice/rollExpression'
import type {
  ActionDefinition,
  DamageRollDefinition,
  EnemyDefinition,
  EnemySaveType,
} from '../domain/dice/actionTypes'
import type { AnalysisMode, RollCondition } from '../domain/dice/types'

interface SaveOption {
  value: EnemySaveType
  label: string
}

const props = defineProps<{
  actions: ActionDefinition[]
  dcInput: string
  enemy: EnemyDefinition | null
  mode: AnalysisMode
  parsedExpressionIsInvalid: boolean
  rollExpression: string
}>()

const emit = defineEmits<{
  'update:actions': [actions: ActionDefinition[]]
  'update:dcInput': [value: string]
  'update:enemy': [enemy: EnemyDefinition | null]
  'update:rollExpression': [value: string]
  'select-mode': [mode: AnalysisMode]
}>()

const damageTypes = computed(() => getDamageTypeOptions(props.mode))
const focusedEnemySave = ref<EnemySaveType | null>(null)
const saveOptions = computed<SaveOption[]>(() => props.mode === 'pf2'
  ? [
      { value: 'for', label: 'FOR' },
      { value: 'ref', label: 'REF' },
      { value: 'wil', label: 'WIL' },
    ]
  : [
      { value: 'str', label: 'STR' },
      { value: 'dex', label: 'DEX' },
      { value: 'con', label: 'CON' },
      { value: 'cha', label: 'CHA' },
      { value: 'wis', label: 'WIS' },
      { value: 'int', label: 'INT' },
    ])

function updateAction(index: number, updates: Partial<ActionDefinition>) {
  const actions = props.actions.map((action, actionIndex) =>
    actionIndex === index ? { ...action, ...updates } : action,
  )
  emit('update:actions', actions)
}

function setActionRollCondition(
  index: number,
  condition: Exclude<RollCondition, 'normal'>,
  checked: boolean,
) {
  const currentCondition = props.actions[index].rollCondition
  updateAction(index, {
    rollCondition: checked
      ? condition
      : currentCondition === condition ? 'normal' : currentCondition,
  })
}

function setActionSave(index: number, isSave: boolean) {
  updateAction(index, {
    isSave,
    ...(!isSave ? { isBasicSave: false } : {}),
  })
}

function saveTypeForAction(action: ActionDefinition): EnemySaveType {
  return saveOptions.value.some((option) => option.value === action.saveType)
    ? action.saveType
    : saveOptions.value[0].value
}

function createEnemy(): EnemyDefinition {
  return {
    acInput: '10',
    saves: {
      str: '0',
      dex: '0',
      cha: '0',
      con: '0',
      wis: '0',
      int: '0',
      for: '0',
      ref: '0',
      wil: '0',
    },
    hpInput: '',
    resistances: {},
    weaknesses: {},
    immunities: [],
  }
}

function updateEnemy(updates: Partial<EnemyDefinition>) {
  if (props.enemy === null) return
  emit('update:enemy', { ...props.enemy, ...updates })
}

function setEnemyEnabled(enabled: boolean) {
  emit('update:enemy', enabled ? createEnemy() : null)
}

function updateEnemySave(saveType: EnemySaveType, value: number) {
  if (props.enemy === null) return
  emit('update:enemy', {
    ...props.enemy,
    saves: { ...props.enemy.saves, [saveType]: String(value) },
  })
}

function updateEnemySaveFromInput(saveType: EnemySaveType, event: Event) {
  const value = numberValue(event)
  if (value !== null) updateEnemySave(saveType, value)
}

function prepareEnemySave(saveType: EnemySaveType, event: Event) {
  focusedEnemySave.value = saveType
  const value = parseIntegerInput(props.enemy?.saves[saveType] ?? '')
  ;(event.target as HTMLInputElement).value = String(value ?? 0)
}

async function finishEnemySave(saveType: EnemySaveType, event: Event) {
  const input = event.target as HTMLInputElement
  const value = numberValue(event)
  focusedEnemySave.value = null
  if (value === null) {
    updateEnemySave(saveType, 0)
    await nextTick()
    input.value = '0'
    return
  }

  updateEnemySave(saveType, value)
  await nextTick()
  input.value = String(Math.abs(value))
}

function hasInvalidEnemyTarget(): boolean {
  return props.enemy !== null && (
    parseIntegerInput(props.enemy.acInput) === null
    || saveOptions.value.some((option) => parseIntegerInput(props.enemy?.saves[option.value] ?? '') === null)
  )
}

function enemyTraitTypes(trait: 'resistances' | 'weaknesses' | 'immunities'): string[] {
  if (!props.enemy) return []
  const configuredTypes = trait === 'immunities'
    ? props.enemy.immunities
    : Object.keys(props.enemy[trait])
  const availableTypes = new Set(damageTypes.value.map((option) => option.label.toLowerCase()))
  return configuredTypes.filter((type) => availableTypes.has(type.trim().toLowerCase()))
}

function toggleEnemyTrait(
  trait: 'resistances' | 'weaknesses' | 'immunities',
  damageType: string,
  checked: boolean,
) {
  if (!props.enemy) return
  if (trait === 'immunities') {
    const immunities = checked
      ? [...props.enemy.immunities, damageType]
      : props.enemy.immunities.filter((type) => type !== damageType)
    updateEnemy({ immunities })
    return
  }

  const values = { ...props.enemy[trait] }
  if (checked) {
    values[damageType] = '5'
  } else {
    delete values[damageType]
  }
  updateEnemy({ [trait]: values })
}

function updateEnemyTraitValue(
  trait: 'resistances' | 'weaknesses',
  damageType: string,
  value: string,
) {
  if (!props.enemy) return
  updateEnemy({
    [trait]: { ...props.enemy[trait], [damageType]: value },
  })
}

function hasInvalidEnemyTraitValue(
  trait: 'resistances' | 'weaknesses',
  damageType: string,
): boolean {
  if (props.mode !== 'pf2') return false
  const value = parseIntegerInput(props.enemy?.[trait][damageType] ?? '')
  return value === null || !Number.isSafeInteger(value) || value < 0
}

function hasInvalidEnemyTraitValues(): boolean {
  if (!props.enemy || props.mode !== 'pf2') return false
  return (['resistances', 'weaknesses'] as const).some((trait) =>
    enemyTraitTypes(trait).some((damageType) =>
      hasInvalidEnemyTraitValue(trait, damageType),
    ),
  )
}

function updateDamage(
  actionIndex: number,
  damageIndex: number,
  updates: Partial<DamageRollDefinition>,
) {
  const actions = props.actions.map((action, index) => {
    if (index !== actionIndex) return action
    return {
      ...action,
      damageRolls: action.damageRolls.map((damage, rollIndex) =>
        rollIndex === damageIndex ? { ...damage, ...updates } : damage,
      ),
    }
  })
  emit('update:actions', actions)
}

function createDamageRoll(): DamageRollDefinition {
  return {
    id: crypto.randomUUID(),
    expression: '1d8',
    type: damageTypes.value[0]?.label ?? '',
    color: damageTypes.value[0]?.color ?? '#94a3b8',
  }
}

function addAction() {
  const previousAction = props.actions.at(-1)
  const newActionIndex = props.actions.length + 1
  const action: ActionDefinition = previousAction
    ? {
        ...previousAction,
        id: crypto.randomUUID(),
        name: `Action ${newActionIndex}`,
        saveType: saveTypeForAction(previousAction),
        damageRolls: previousAction.damageRolls.map((damageRoll) => ({
          ...damageRoll,
          id: crypto.randomUUID(),
        })),
      }
    : {
        id: crypto.randomUUID(),
        name: 'Action 1',
        dcInput: '',
        testModifier: 0,
        rollCondition: 'normal',
        isSave: false,
        saveType: props.mode === 'pf2' ? 'for' : 'str',
        isBasicSave: false,
        rerollDamageOnes: false,
        damageRolls: [createDamageRoll()],
      }

  emit('update:actions', [
    ...props.actions,
    action,
  ])
}

function removeAction(index: number) {
  emit('update:actions', props.actions.filter((_, actionIndex) => actionIndex !== index))
}

function moveAction(index: number, direction: -1 | 1) {
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= props.actions.length) return
  const actions = [...props.actions]
    ;[actions[index], actions[targetIndex]] = [actions[targetIndex], actions[index]]
  emit('update:actions', actions)
}

function addDamage(actionIndex: number) {
  const action = props.actions[actionIndex]
  updateAction(actionIndex, {
    damageRolls: [
      ...action.damageRolls,
      createDamageRoll(),
    ],
  })
}

function removeDamage(actionIndex: number, damageIndex: number) {
  const action = props.actions[actionIndex]
  updateAction(actionIndex, {
    damageRolls: action.damageRolls.filter((_, index) => index !== damageIndex),
  })
}

function updateDamageType(actionIndex: number, damageIndex: number, label: string) {
  const matchingType = damageTypes.value.find((option) => option.label === label)
  updateDamage(actionIndex, damageIndex, {
    type: label,
    ...(matchingType ? { color: matchingType.color } : {}),
  })
}

function isDamageExpressionInvalid(expression: string): boolean {
  const groups = parseRollExpression(expression)
  return groups === null
    || groups.some((group) => !['d2', 'd4', 'd6', 'd8', 'd10', 'd12'].includes(group.dieType))
}

function numberValue(event: Event): number | null {
  const input = event.target as HTMLInputElement
  if (input.value.trim() === '') return null

  const value = Number(input.value)
  return Number.isSafeInteger(value) ? value : null
}

function updateTestModifier(index: number, event: Event) {
  const value = numberValue(event)
  if (value !== null) updateAction(index, { testModifier: value })
}

function prepareTestModifier(index: number, event: Event) {
  ;(event.target as HTMLInputElement).value = String(props.actions[index].testModifier)
}

async function finishTestModifier(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const value = numberValue(event)
  if (value === null) {
    updateAction(index, { testModifier: 0 })
    await nextTick()
    input.value = '0'
    return
  }

  updateAction(index, { testModifier: value })
  await nextTick()
  input.value = String(Math.abs(value))
}
</script>

<template>
  <div class="control-row">
    <div class="mode-field">
      <span>Mode</span>
      <div class="segmented-control" role="group" aria-label="Analysis mode">
        <button type="button" :class="{ active: mode === 'default' }" :aria-pressed="mode === 'default'"
          @click="emit('select-mode', 'default')">
          Default
        </button>
        <button type="button" :class="{ active: mode === 'dnd' }" :aria-pressed="mode === 'dnd'"
          @click="emit('select-mode', 'dnd')">
          DnD
        </button>
        <button type="button" :class="{ active: mode === 'pf2' }" :aria-pressed="mode === 'pf2'"
          @click="emit('select-mode', 'pf2')">
          PF2
        </button>
      </div>
    </div>
  </div>

  <label v-if="mode === 'default'" class="roll-expression-field">
    <span>Dice expression</span>
    <input :value="rollExpression" :class="{ 'input-invalid': parsedExpressionIsInvalid }"
      :aria-invalid="parsedExpressionIsInvalid" type="text" placeholder="2d20+3d8+1" autocomplete="off"
      @input="emit('update:rollExpression', ($event.target as HTMLInputElement).value)" />
    <small>Use d2, d4, d6, d8, d10, d12, d20 or d100; add a modifier with + or -.</small>
  </label>

  <label v-if="mode === 'default'" class="dc-field">
    <span>Target</span>
    <input :value="dcInput" type="number" step="1" placeholder="e.g. 15"
      @input="emit('update:dcInput', ($event.target as HTMLInputElement).value)" />
  </label>

  <section v-else class="actions-editor" aria-labelledby="actions-title">
    <div class="section-heading">
      <div>
        <h2 id="actions-title">Actions</h2>
        <p>{{ enemy ? 'Actions use the enemy AC or selected save.' : 'Each action uses its own test and DC.' }}</p>
      </div>
    </div>

    <article v-for="(action, actionIndex) in actions" :key="action.id" class="action-editor-card">
      <section class="action-test-section" :aria-label="`Test settings for ${action.name}`">
        <div class="editor-section-heading editor-section-heading--test">
          <span class="editor-section-index">{{ String(actionIndex + 1).padStart(2, '0') }}</span>
          <span>Test</span>
        </div>
        <div class="action-heading" :class="{ 'has-enemy': enemy !== null, 'is-save': action.isSave }">
          <label class="action-name-field">
            <span>Action name</span>
            <input :value="action.name" type="text"
              @input="updateAction(actionIndex, { name: ($event.target as HTMLInputElement).value })" />
          </label>
          <label v-if="!enemy || action.isSave" class="action-dc-field">
            <span>Action DC</span>
            <input :value="action.dcInput" type="number" step="1" placeholder="e.g. 15"
              :class="{ 'input-invalid': action.dcInput.trim() !== '' && parseIntegerInput(action.dcInput) === null }"
              :aria-invalid="action.dcInput.trim() !== '' && parseIntegerInput(action.dcInput) === null"
              @input="updateAction(actionIndex, { dcInput: ($event.target as HTMLInputElement).value })" />
          </label>
          <label v-if="!enemy || !action.isSave" class="compact-number-field action-modifier-field">
            <span>Test mod.</span>
            <div class="modifier-input"
              :class="{ 'has-positive-modifier': action.testModifier > 0, 'has-negative-modifier': action.testModifier < 0 }"
              :data-sign="action.testModifier > 0 ? '+' : action.testModifier < 0 ? '-' : ''">
              <input :value="action.testModifier" type="number" step="1"
                @focus="prepareTestModifier(actionIndex, $event)"
                @input="updateTestModifier(actionIndex, $event)"
                @blur="finishTestModifier(actionIndex, $event)" />
            </div>
          </label>
          <label v-if="action.isSave" class="action-save-field">
            <span>Save ability</span>
            <select :value="saveTypeForAction(action)"
              @change="updateAction(actionIndex, { saveType: ($event.target as HTMLSelectElement).value as EnemySaveType })">
              <option v-for="option in saveOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
          <div class="action-toolbar">
            <button type="button" class="icon-button danger-button" :aria-label="`Delete ${action.name}`"
              :title="`Delete ${action.name}`"
              :disabled="actions.length === 1" @click="removeAction(actionIndex)">
              <span class="material-symbols-rounded" aria-hidden="true">delete</span>
            </button>
            <div v-if="actions.length > 1" class="action-order-controls" aria-label="Action order">
              <button type="button" class="icon-button" :disabled="actionIndex === 0" :aria-label="`Move ${action.name} up`"
                :title="`Move ${action.name} up`" @click="moveAction(actionIndex, -1)">
                <span class="material-symbols-rounded" aria-hidden="true">keyboard_arrow_up</span>
              </button>
              <button type="button" class="icon-button" :disabled="actionIndex === actions.length - 1"
                :aria-label="`Move ${action.name} down`" :title="`Move ${action.name} down`"
                @click="moveAction(actionIndex, 1)">
                <span class="material-symbols-rounded" aria-hidden="true">keyboard_arrow_down</span>
              </button>
            </div>
          </div>
        </div>

        <fieldset v-if="mode === 'dnd'" class="roll-condition-field">
          <legend>Test condition</legend>
          <label class="roll-condition-option" :class="{ 'is-active': action.rollCondition === 'advantage' }">
            <input type="checkbox" :checked="action.rollCondition === 'advantage'"
              @change="setActionRollCondition(actionIndex, 'advantage', ($event.target as HTMLInputElement).checked)" />
            <span>Advantage</span>
          </label>
          <label class="roll-condition-option" :class="{ 'is-active': action.rollCondition === 'disadvantage' }">
            <input type="checkbox" :checked="action.rollCondition === 'disadvantage'"
              @change="setActionRollCondition(actionIndex, 'disadvantage', ($event.target as HTMLInputElement).checked)" />
            <span>Disadvantage</span>
          </label>
        </fieldset>
      </section>

      <section class="action-trigger-section" aria-label="Damage trigger settings">
        <fieldset class="roll-condition-field">
          <legend>Damage parameters</legend>
          <label class="roll-condition-option" :class="{ 'is-active': action.isSave }">
            <input type="checkbox" :checked="action.isSave"
              @change="setActionSave(actionIndex, ($event.target as HTMLInputElement).checked)" />
            <span>Save</span>
          </label>
          <label v-if="action.isSave" class="roll-condition-option" :class="{ 'is-active': action.isBasicSave }">
            <input type="checkbox" :checked="action.isBasicSave"
              @change="updateAction(actionIndex, { isBasicSave: ($event.target as HTMLInputElement).checked })" />
            <span>Basic</span>
          </label>
          <label class="roll-condition-option" :class="{ 'is-active': action.rerollDamageOnes }">
            <input type="checkbox" :checked="action.rerollDamageOnes"
              @change="updateAction(actionIndex, { rerollDamageOnes: ($event.target as HTMLInputElement).checked })" />
            <span>Reroll 1</span>
          </label>
        </fieldset>
      </section>

      <section class="action-damage-section" :aria-label="`Damage settings for ${action.name}`">
        <div class="damage-heading">
          <div class="editor-section-heading editor-section-heading--damage">
            <h3>Damage</h3>
          </div>
          <button type="button" class="text-button damage-add-button" :aria-label="`Add damage roll to ${action.name}`"
            :title="`Add damage roll to ${action.name}`" @click="addDamage(actionIndex)">
            <span class="material-symbols-rounded" aria-hidden="true">add</span>
          </button>
        </div>

        <p v-if="!action.damageRolls.length" class="empty-damage-note">
          No damage: the action only analyzes the test.
        </p>

        <div v-for="(damage, damageIndex) in action.damageRolls" :key="damage.id" class="damage-roll-editor">
          <label>
            <span>Damage expression</span>
            <input :value="damage.expression" type="text"
              :class="{ 'input-invalid': isDamageExpressionInvalid(damage.expression) }"
              :aria-label="`Damage expression ${damageIndex + 1} for ${action.name}`" placeholder="2d6+3"
              autocomplete="off"
              @input="updateDamage(actionIndex, damageIndex, { expression: ($event.target as HTMLInputElement).value })" />
            <small>d2-d12; e.g. 2d6+3.</small>
          </label>
          <label>
            <span>Damage type</span>
            <select :value="damage.type"
              :style="{ borderColor: damageTypes.find((option) => option.label === damage.type)?.color }"
              @change="updateDamageType(actionIndex, damageIndex, ($event.target as HTMLSelectElement).value)">
              <option v-if="!damageTypes.some((option) => option.label === damage.type)"
                :value="damage.type" disabled>
                {{ damage.type }} (not available in {{ mode }})
              </option>
              <option v-for="option in damageTypes" :key="option.label" :value="option.label">
                {{ option.label }}
              </option>
            </select>
          </label>
          <label class="color-field">
            <span>Color</span>
            <input :value="damage.color" type="color" :aria-label="`Color for ${damage.type || 'damage'} type`"
              @input="updateDamage(actionIndex, damageIndex, { color: ($event.target as HTMLInputElement).value })" />
          </label>
          <button type="button" class="icon-button danger-button"
            :aria-label="`Delete damage roll ${damage.type}`" :title="`Delete damage roll ${damage.type}`"
            @click="removeDamage(actionIndex, damageIndex)">
            <span class="material-symbols-rounded" aria-hidden="true">delete</span>
          </button>
        </div>
      </section>
    </article>

    <div class="action-add-row">
      <button type="button" class="secondary-button action-add-button" aria-label="Add action" title="Add action"
        @click="addAction">
        <span class="material-symbols-rounded" aria-hidden="true">add</span>
      </button>
    </div>

    <div class="enemy-controls">
      <button type="button" class="enemy-toggle-button" :class="{ 'is-active': enemy !== null }"
        :aria-pressed="enemy !== null" @click="setEnemyEnabled(enemy === null)">
        <span class="material-symbols-rounded" aria-hidden="true">skull</span>
        {{ enemy ? 'Remove enemy' : 'Add enemy' }}
      </button>
      <section v-if="enemy" class="enemy-editor" aria-label="Enemy settings">
        <div class="enemy-editor-heading">
          <h3>Enemy</h3>
          <p>Set the target values for these actions.</p>
        </div>
        <div class="enemy-stat-grid">
          <label class="enemy-ac-field">
            <span>AC</span>
            <input :value="enemy.acInput" type="number" step="1"
              :aria-invalid="parseIntegerInput(enemy.acInput) === null"
              @input="updateEnemy({ acInput: ($event.target as HTMLInputElement).value })" />
          </label>
          <label v-for="option in saveOptions" :key="option.value">
            <span>Save {{ option.label }}</span>
            <div class="modifier-input"
              :class="{
                'has-positive-modifier': (parseIntegerInput(enemy.saves[option.value]) ?? 0) > 0,
                'has-negative-modifier': (parseIntegerInput(enemy.saves[option.value]) ?? 0) < 0,
              }"
              :data-sign="(parseIntegerInput(enemy.saves[option.value]) ?? 0) > 0 ? '+' : '-'">
              <input
                :value="focusedEnemySave === option.value
                  ? (parseIntegerInput(enemy.saves[option.value]) ?? 0)
                  : Math.abs(parseIntegerInput(enemy.saves[option.value]) ?? 0)"
                type="number" step="1"
                :aria-label="`Save ${option.label}`"
                :aria-invalid="parseIntegerInput(enemy.saves[option.value]) === null"
                @focus="prepareEnemySave(option.value, $event)"
                @input="updateEnemySaveFromInput(option.value, $event)"
                @blur="finishEnemySave(option.value, $event)" />
            </div>
          </label>
          <label class="enemy-hp-field">
            <span>HP (optional)</span>
            <input :value="enemy.hpInput" type="number" step="1" min="0"
              :aria-invalid="enemy.hpInput.trim() !== '' && parseIntegerInput(enemy.hpInput) === null"
              @input="updateEnemy({ hpInput: ($event.target as HTMLInputElement).value })" />
          </label>
        </div>
        <p v-if="hasInvalidEnemyTarget()" class="enemy-input-error">
          AC and saves must be valid integers to calculate affected actions.
        </p>
        <details class="enemy-more-options">
          <summary>More Options</summary>
          <div class="enemy-traits">
            <fieldset v-for="trait in ['resistances', 'weaknesses', 'immunities'] as const"
              :key="trait" class="enemy-trait-field">
              <legend>{{ trait === 'resistances' ? 'Resistances' : trait === 'weaknesses' ? 'Weaknesses' : 'Immunities' }}</legend>
              <details class="enemy-type-dropdown">
                <summary>
                  {{ enemyTraitTypes(trait).length
                    ? `${enemyTraitTypes(trait).length} selected`
                    : 'Select damage types' }}
                </summary>
                <div class="enemy-type-options">
                  <label v-for="damageType in damageTypes" :key="damageType.label">
                    <input type="checkbox"
                      :checked="enemyTraitTypes(trait).includes(damageType.label)"
                      @change="toggleEnemyTrait(
                        trait,
                        damageType.label,
                        ($event.target as HTMLInputElement).checked,
                      )" />
                    <span>{{ damageType.label }}</span>
                  </label>
                </div>
              </details>
              <p v-if="mode === 'dnd' && enemyTraitTypes(trait).length" class="enemy-trait-selection">
                Selected: {{ enemyTraitTypes(trait).join(', ') }}
              </p>
              <div v-if="trait !== 'immunities' && mode === 'pf2'" class="enemy-trait-values">
                <label v-for="damageType in enemyTraitTypes(trait)" :key="damageType">
                  <span>{{ damageType }} {{ trait === 'resistances' ? 'resistance' : 'weakness' }}</span>
                  <input :value="enemy[trait][damageType]" type="number" step="1" min="0"
                    :aria-label="`${damageType} ${trait === 'resistances' ? 'resistance' : 'weakness'} value`"
                    :aria-invalid="hasInvalidEnemyTraitValue(trait, damageType)"
                    @input="updateEnemyTraitValue(
                      trait,
                      damageType,
                      ($event.target as HTMLInputElement).value,
                    )" />
                </label>
              </div>
            </fieldset>
          </div>
          <p v-if="mode === 'dnd'" class="enemy-trait-note">
            Weaknesses (vulnerabilities) double damage; resistances halve it, rounded down.
          </p>
          <p v-else class="enemy-trait-note">
            Damage is reduced by each resistance value or increased by each weakness value per action.
          </p>
          <p v-if="hasInvalidEnemyTraitValues()" class="enemy-input-error">
            PF2 resistance and weakness values must be non-negative integers.
          </p>
        </details>
      </section>
    </div>
  </section>
</template>

<style scoped>
.section-heading,
.action-heading,
.damage-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 10px;
}

.section-heading h2,
.damage-heading h3,
.section-heading p {
  margin: 0;
}

.roll-condition-field {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 10px;
}

.roll-condition-field legend {
  flex-basis: 100%;
  margin-bottom: 2px;
  color: #94a3b8;
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  line-height: 1.2;
  text-transform: uppercase;
}

.roll-condition-option {
  min-height: 34px;
  padding: 5px 8px;
}

.section-heading p,
.empty-damage-note {
  color: #94a3b8;
  font-size: 0.82rem;
}

.editor-section-heading {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 20px;
  color: #cbd5e1;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  line-height: 1;
  text-transform: uppercase;
}

.editor-section-heading h3 {
  margin: 0;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
}

.editor-section-index {
  display: inline-grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border-radius: 6px;
  background: rgba(148, 163, 184, 0.14);
  color: #cbd5e1;
  font-size: 0.62rem;
  letter-spacing: 0;
}

.editor-section-heading--test {
  color: #93c5fd;
}

.editor-section-heading--test .editor-section-index {
  background: rgba(59, 130, 246, 0.2);
  color: #bfdbfe;
}

.editor-section-heading--damage {
  color: #86efac;
}

.hero-point-note {
  grid-column: 1 / -1;
  color: #94a3b8;
  font-size: 0.78rem;
}

.secondary-button,
.text-button,
.icon-button {
  white-space: nowrap;
}

.secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  min-height: 40px;
  padding: 8px 12px;
  border-radius: 10px;
}

.action-add-button {
  display: flex;
  flex: 0 0 34px;
  width: 34px;
  min-height: 34px;
  padding: 5px;
  border-radius: 9px;
}

.action-add-row {
  display: flex;
  justify-content: center;
  margin-top: 10px;
}

.text-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  min-height: 34px;
  padding: 5px;
  border-radius: 8px;
}

.damage-add-button {
  width: 28px;
  min-height: 28px;
  padding: 3px;
  border: 1px solid rgba(74, 222, 128, 0.22);
  background: rgba(22, 101, 52, 0.3);
  color: #86efac;
}

.damage-add-button:hover {
  border-color: rgba(74, 222, 128, 0.5);
  background: rgba(22, 101, 52, 0.52);
}

.secondary-button .material-symbols-rounded,
.text-button .material-symbols-rounded,
.icon-button .material-symbols-rounded {
  display: block;
  font-family: 'Material Symbols Rounded';
  font-size: 20px;
  font-weight: 400;
  line-height: 1;
  font-feature-settings: 'liga';
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20;
}

.damage-add-button .material-symbols-rounded {
  font-size: 18px;
}

.action-editor-card {
  display: grid;
  gap: 0;
  margin-top: 10px;
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(129, 140, 248, 0.28);
  border-radius: 14px;
  background: rgba(8, 14, 28, 0.82);
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.025);
}

.action-test-section {
  display: grid;
  gap: 8px;
  padding: 11px;
  border-left: 3px solid #60a5fa;
  background: linear-gradient(110deg, rgba(37, 99, 235, 0.11), rgba(15, 23, 42, 0.12) 70%);
}

.action-test-section .roll-condition-field {
  margin: 0;
}

.action-trigger-section {
  padding: 8px 11px;
  border-top: 1px solid rgba(251, 191, 36, 0.14);
  border-left: 3px solid #fbbf24;
  background: rgba(251, 191, 36, 0.035);
}

.action-trigger-section .roll-condition-field {
  margin: 0;
}

.action-trigger-section .roll-condition-field legend {
  color: #fcd34d;
  font-size: 0.64rem;
}

.action-damage-section {
  display: grid;
  gap: 8px;
  padding: 10px 11px 11px;
  border-top: 1px solid rgba(34, 197, 94, 0.16);
  border-left: 3px solid #4ade80;
  background: linear-gradient(110deg, rgba(22, 101, 52, 0.12), rgba(15, 23, 42, 0.14) 72%);
}

.action-heading {
  display: grid;
  grid-template-columns: minmax(80px, 1fr) repeat(2, minmax(58px, 78px)) auto;
  align-items: end;
  gap: 6px;
  min-width: 0;
}

.action-heading.is-save {
  grid-template-columns: minmax(80px, 1fr) repeat(3, minmax(58px, 78px)) auto;
}

.action-heading.has-enemy:not(.is-save) {
  grid-template-columns: minmax(80px, 1fr) minmax(58px, 78px) auto;
}

.action-heading.has-enemy.is-save {
  grid-template-columns: minmax(80px, 1fr) repeat(2, minmax(58px, 78px)) auto;
}

.action-heading label,
.damage-roll-editor label {
  min-width: 0;
}

.action-save-field {
  min-width: 68px;
}

.enemy-controls {
  margin-top: 10px;
}

.enemy-toggle-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 36px;
  padding: 7px 12px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: 10px;
  background: rgba(127, 29, 29, 0.24);
  color: #fecaca;
}

.enemy-toggle-button.is-active {
  border-color: rgba(248, 113, 113, 0.7);
  background: rgba(127, 29, 29, 0.45);
}

.enemy-toggle-button .material-symbols-rounded {
  font-family: 'Material Symbols Rounded';
  font-size: 20px;
  font-feature-settings: 'liga';
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20;
}

.enemy-editor {
  margin-top: 8px;
  padding: 11px;
  border: 1px solid rgba(248, 113, 113, 0.25);
  border-radius: 12px;
  background: rgba(69, 10, 10, 0.16);
}

.enemy-editor-heading h3,
.enemy-editor-heading p {
  margin: 0;
}

.enemy-editor-heading h3 {
  color: #fecaca;
  font-size: 0.9rem;
}

.enemy-editor-heading p {
  margin-top: 2px;
  color: #94a3b8;
  font-size: 0.75rem;
}

.enemy-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
  margin-top: 9px;
}

.enemy-stat-grid label {
  min-width: 0;
  font-size: 0.72rem;
}

.enemy-stat-grid input {
  min-height: 34px;
  padding: 5px 7px;
}

.enemy-input-error {
  margin: 8px 0 0;
  color: #fca5a5;
  font-size: 0.72rem;
}

.enemy-more-options {
  margin-top: 10px;
  border-top: 1px solid rgba(248, 113, 113, 0.18);
  padding-top: 8px;
}

.enemy-more-options > summary {
  color: #fecaca;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 600;
}

.enemy-traits {
  display: grid;
  gap: 9px;
  margin-top: 9px;
}

.enemy-trait-field {
  display: grid;
  gap: 6px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.enemy-trait-field legend {
  margin-bottom: 4px;
  color: #cbd5e1;
  font-size: 0.72rem;
  font-weight: 600;
}

.enemy-type-dropdown {
  position: relative;
}

.enemy-type-dropdown > summary {
  padding: 7px 9px;
  border: 1px solid rgba(100, 116, 139, 0.6);
  border-radius: 9px;
  background: rgba(15, 23, 42, 0.8);
  color: var(--text);
  cursor: pointer;
  font-size: 0.75rem;
}

.enemy-type-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  margin-top: 4px;
  padding: 7px;
  border: 1px solid var(--border-strong);
  border-radius: 9px;
  background: var(--panel-strong);
}

.enemy-type-options label {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  font-size: 0.72rem;
}

.enemy-type-options input {
  appearance: auto;
  -webkit-appearance: checkbox;
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  min-height: 16px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: initial;
  background: transparent;
  accent-color: #8b5cf6;
  cursor: pointer;
}

.enemy-trait-selection {
  margin: 0;
  color: #cbd5e1;
  font-size: 0.7rem;
  line-height: 1.4;
}

.enemy-trait-values {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.enemy-trait-values label {
  min-width: 0;
  font-size: 0.68rem;
}

.enemy-trait-values input {
  min-height: 32px;
  padding: 4px 7px;
}

.enemy-trait-note {
  margin: 0;
  color: #94a3b8;
  font-size: 0.68rem;
  line-height: 1.4;
}

.enemy-ac-field,
.enemy-hp-field {
  grid-column: span 3;
}

.action-order-controls {
  display: flex;
  gap: 4px;
}

.action-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
}

.compact-number-field {
  min-width: 70px;
}

.compact-number-field input {
  min-width: 0;
}

.modifier-input {
  position: relative;
  width: 100%;
}

.modifier-input.has-positive-modifier:not(:focus-within)::before,
.modifier-input.has-negative-modifier:not(:focus-within)::before {
  position: absolute;
  top: 50%;
  left: 12px;
  color: var(--text-strong);
  content: attr(data-sign);
  pointer-events: none;
  transform: translateY(-50%);
}

.modifier-input.has-positive-modifier:not(:focus-within) input,
.modifier-input.has-negative-modifier:not(:focus-within) input {
  padding-left: 24px;
}

.damage-heading {
  align-items: center;
}

.damage-roll-editor {
  display: grid;
  grid-template-columns: minmax(110px, 1fr) minmax(90px, 0.7fr) 48px 32px;
  align-items: start;
  gap: 6px;
  padding: 8px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 10px;
  background: rgba(7, 12, 24, 0.48);
}

.damage-roll-editor > .icon-button {
  align-self: start;
  margin-top: 28px;
}

.damage-roll-editor label,
.action-heading label {
  font-size: 0.78rem;
}

.damage-roll-editor label > span {
  line-height: 20px;
  color: #cbd5e1;
}

.damage-roll-editor small {
  font-size: 0.7rem;
  line-height: 1.3;
}

.damage-roll-editor input,
.action-heading input {
  padding: 6px 8px;
  min-height: 36px;
}

.color-field input {
  padding: 4px;
  min-height: 36px;
  cursor: pointer;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  min-width: 34px;
  padding: 5px 6px;
  border-radius: 9px;
  background: rgba(148, 163, 184, 0.12);
}

.secondary-button:focus-visible,
.text-button:focus-visible,
.icon-button:focus-visible {
  outline: 2px solid #c4b5fd;
  outline-offset: 3px;
}

.icon-button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.danger-button {
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.12);
}

.empty-damage-note {
  margin: 0;
}

@media (max-width: 640px) {
  .section-heading {
    align-items: center;
  }

  .action-heading,
  .action-heading.is-save,
  .action-heading.has-enemy:not(.is-save),
  .action-heading.has-enemy.is-save {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .action-heading > .action-toolbar {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }

  .action-heading > label {
    grid-column: span 1;
  }

  .action-heading > .action-name-field,
  .action-heading > .action-save-field {
    grid-column: 1 / -1;
  }

  .compact-number-field {
    min-width: 0;
  }

  .action-toolbar .icon-button {
    min-width: 30px;
    min-height: 30px;
  }

  .damage-roll-editor {
    grid-template-columns: minmax(0, 1fr) minmax(0, 0.7fr) 42px 32px;
  }

  .damage-roll-editor label:first-child {
    grid-column: 1 / -1;
  }

  .enemy-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .enemy-ac-field,
  .enemy-hp-field {
    grid-column: span 2;
  }
}

</style>
