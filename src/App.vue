<script setup lang="ts">
import { computed, ref } from 'vue'
import ActionResults from './components/ActionResults.vue'
import AnalysisControls from './components/AnalysisControls.vue'
import DamageComparisonChart from './components/DamageComparisonChart.vue'
import DamageThresholdChart from './components/DamageThresholdChart.vue'
import CumulativeChart from './components/CumulativeChart.vue'
import EnemySurvivalChart from './components/EnemySurvivalChart.vue'
import HistogramChart from './components/HistogramChart.vue'
import RollSummary from './components/RollSummary.vue'
import StatisticsPanel from './components/StatisticsPanel.vue'
import { useRollAnalysis } from './composables/useRollAnalysis'
import { parseIntegerInput } from './domain/dice/rollExpression'
import { getEnemySurvivalAnalysis } from './domain/dice/survivalAnalysis'

const {
  actions,
  analysis,
  criticalDamageRule,
  dc,
  dcInput,
  dcIsEmpty,
  dcIsInvalid,
  enemy,
  mode,
  outcomes,
  parsedRollGroups,
  rollExpression,
  rollExpressionIsEmpty,
  statistics,
  successChance,
  setMode,
} = useRollAnalysis()
const actionAnalyses = computed(() => analysis.value?.actions ?? [])
const enemyHitPoints = computed(() => parseIntegerInput(enemy.value?.hpInput ?? ''))
const enemySurvivalAnalysis = computed(() => {
  if (enemyHitPoints.value === null || enemyHitPoints.value <= 0) {
    return { survivalProbabilities: [], hitPointQuantiles: [] }
  }
  return getEnemySurvivalAnalysis(
    analysis.value?.totalDamageDistribution ?? [],
    enemyHitPoints.value,
  )
})
const settingsDialog = ref<HTMLDialogElement | null>(null)

function openSettings() {
  settingsDialog.value?.showModal()
}

function closeSettings() {
  settingsDialog.value?.close()
}
</script>

<template>
  <main class="page" :class="mode === 'default' ? 'legacy-page' : 'action-page'">
    <section class="panel controls-panel">
      <header class="panel-header">
        <div>
          <div class="title-lockup">
            <span class="brand-icon material-symbols-rounded" aria-hidden="true">casino</span>
            <h1>Dice Analyzer</h1>
          </div>
          <p class="mode-subtitle">
            {{ mode === 'default' ? 'Combined dice probability analyzer' : 'Action probability analyzer' }}
          </p>
        </div>
        <button type="button" class="settings-button" aria-label="Open settings" title="Settings"
          aria-haspopup="dialog" aria-controls="settings-dialog" @click="openSettings">
          <span class="material-symbols-rounded" aria-hidden="true">settings</span>
        </button>
      </header>
      <dialog id="settings-dialog" ref="settingsDialog" class="settings-dialog"
        aria-labelledby="settings-title" @click.self="closeSettings">
        <div class="settings-dialog-header">
          <h2 id="settings-title">Settings</h2>
          <button type="button" class="settings-close-button" aria-label="Close settings"
            @click="closeSettings">
            <span class="material-symbols-rounded" aria-hidden="true">close</span>
          </button>
        </div>
        <section class="mode-settings-section" aria-labelledby="default-settings-title">
          <h3 id="default-settings-title">Default</h3>
          <p>No additional settings for this mode.</p>
        </section>
        <section class="mode-settings-section" aria-labelledby="dnd-settings-title">
          <h3 id="dnd-settings-title">DnD</h3>
          <fieldset class="roll-condition-field critical-damage-field">
            <legend>Critical damage</legend>
            <label class="roll-condition-option" :class="{ 'is-active': criticalDamageRule === 'raw' }">
              <input type="radio" name="critical-damage-rule" value="raw" :checked="criticalDamageRule === 'raw'"
                @change="criticalDamageRule = 'raw'" />
              <span title="Double the damage dice">RAW: double dice</span>
            </label>
            <label class="roll-condition-option" :class="{ 'is-active': criticalDamageRule === 'alternative' }">
              <input type="radio" name="critical-damage-rule" value="alternative"
                :checked="criticalDamageRule === 'alternative'"
                @change="criticalDamageRule = 'alternative'" />
              <span title="Add the maximum possible die result">Alternative: + max die</span>
            </label>
          </fieldset>
        </section>
        <section class="mode-settings-section" aria-labelledby="pf2-settings-title">
          <h3 id="pf2-settings-title">PF2</h3>
          <p>No additional settings for this mode.</p>
        </section>
      </dialog>
      <p v-if="mode === 'default'" class="intro">
        Enter a dice expression to see the full distribution. DC is optional, but it unlocks the success analysis.
      </p>
      <p v-else class="intro">
        Configure action tests and damage. Saves deal damage on failure.
      </p>

      <AnalysisControls
        v-model:dc-input="dcInput"
        v-model:enemy="enemy"
        v-model:roll-expression="rollExpression"
        v-model:actions="actions"
        :mode="mode"
        :parsed-expression-is-invalid="!rollExpressionIsEmpty && parsedRollGroups === null"
        @select-mode="setMode"
      />
      <EnemySurvivalChart
        v-if="enemyHitPoints !== null && enemyHitPoints > 0 && enemySurvivalAnalysis.survivalProbabilities.length"
        :hit-points="enemyHitPoints"
        :probabilities="enemySurvivalAnalysis.survivalProbabilities"
        :hit-point-quantiles="enemySurvivalAnalysis.hitPointQuantiles"
      />
      <p
        v-else-if="mode !== 'default' && enemyHitPoints !== null && enemyHitPoints > 0"
        class="survival-chart-prompt"
      >
        Complete valid action targets and damage expressions to calculate enemy survival.
      </p>
      <p v-if="dcIsInvalid" class="input-error">The DC must be a valid integer.</p>
      <details v-if="mode !== 'default'" class="calculation-note">
        <summary>Damage calculation notes</summary>
        <p>
          Damage from a roll is capped at 0 after applying its modifier. Test reroll conditions apply only to tests;
          each action can separately reroll damage dice that show 1 once.
        </p>
      </details>
    </section>

    <div v-if="mode === 'default'" class="results-column">
      <p v-if="!outcomes.length" class="results-prompt">
        Enter a valid dice expression to see your statistics and charts.
      </p>
      <RollSummary
        :dc="dc"
        :dc-is-empty="dcIsEmpty"
        :outcomes-count="outcomes.length"
        :roll-expression="rollExpression"
        :roll-expression-is-empty="rollExpressionIsEmpty"
        :success-chance="successChance"
        :showing-last-valid-expression="parsedRollGroups === null && !rollExpressionIsEmpty"
      />
      <StatisticsPanel
        :statistics="statistics"
        :mode="mode"
        :show-success-stats="dc !== null"
      />
      <HistogramChart :outcomes="outcomes" />
      <CumulativeChart :outcomes="outcomes" />
    </div>

    <div v-else class="results-column">
      <template v-if="analysis">
        <div v-if="analysis.totalDamageDistribution !== null" class="summary summary--positive">
          <p>
            Distribution calculated for <strong>{{ actionAnalyses.length }}</strong>
            {{ actionAnalyses.length === 1 ? 'action' : 'actions' }}.
          </p>
        </div>
        <div v-else class="summary summary--neutral">
          <p>
            {{ analysis.hasInvalidEnemyDamageTraits
              ? 'PF2 resistance and weakness values must be non-negative integers.'
              : 'Enter valid target values for every action to calculate success probabilities and overall distributions.' }}
          </p>
        </div>

        <ActionResults
          :analyses="actionAnalyses"
          :mode="mode"
        />

        <template v-if="analysis.totalDamageDistribution !== null">
          <div class="total-damage-charts">
            <DamageComparisonChart
              title="Total damage distribution"
              description="Exact distribution of cumulative damage across all actions, weighted by the success of each test."
              :series="[{
                id: 'total',
                label: 'Total damage',
                color: '#38bdf8',
                distribution: analysis.totalDamageDistribution,
              }]"
            />
            <DamageThresholdChart
              :distribution="analysis.totalDamageDistribution"
            />
          </div>
        </template>
        <p v-else class="results-prompt">
          {{ analysis.hasInvalidEnemyDamageTraits
            ? 'Fix the invalid enemy resistance or weakness values to calculate the charts.'
            : analysis.hasInvalidDamageExpression
              ? 'Fix the invalid damage expressions to calculate the charts.'
              : 'Weighted and total damage charts will appear as soon as every action has valid target values.' }}
        </p>
      </template>

      <p v-else class="results-prompt">Fix the DC to display the action analysis.</p>
    </div>
  </main>
</template>

<style>
.action-page {
  grid-template-columns: minmax(340px, 400px) minmax(0, 1fr);
}

.legacy-page {
  grid-template-columns: minmax(340px, 400px) minmax(0, 1fr);
}

.action-page .controls-panel {
  position: static;
  max-height: none;
}

.action-page .actions-editor {
  margin-top: 14px;
}

.legacy-page .results-column {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
}

.legacy-page .results-column > .summary,
.legacy-page .results-column > .stats-panel,
.legacy-page .results-column > .results-prompt {
  grid-column: 1 / -1;
}

.legacy-page .chart-wrapper {
  height: 220px;
}

.legacy-page .chart-skeleton {
  height: 220px;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.title-lockup {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-icon {
  display: grid;
  place-items: center;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  border: 1px solid rgba(125, 142, 255, 0.4);
  border-radius: 12px;
  background: linear-gradient(145deg, rgba(124, 58, 237, 0.3), rgba(56, 189, 248, 0.18));
  color: #c4b5fd;
  box-shadow: 0 5px 16px rgba(91, 33, 182, 0.2);
  font-family: 'Material Symbols Rounded';
  font-size: 25px;
  font-weight: 400;
  line-height: 1;
  font-feature-settings: 'liga';
  font-variation-settings: 'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24;
}

.settings-button,
.settings-close-button {
  display: grid;
  place-items: center;
  flex: 0 0 40px;
  width: 40px;
  min-height: 40px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(30, 41, 59, 0.8);
  color: var(--text);
}

.settings-button:hover,
.settings-close-button:hover {
  border-color: var(--border-strong);
  background: rgba(51, 65, 85, 0.9);
}

.settings-button .material-symbols-rounded,
.settings-close-button .material-symbols-rounded {
  display: block;
  font-family: 'Material Symbols Rounded';
  font-size: 22px;
  font-weight: 400;
  line-height: 1;
  font-feature-settings: 'liga';
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20;
}

.settings-dialog {
  width: min(440px, calc(100vw - 32px));
  max-height: min(80vh, 640px);
  padding: 20px;
  overflow-y: auto;
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  background: var(--panel-strong);
  color: var(--text);
  box-shadow: 0 24px 72px var(--shadow);
}

.settings-dialog::backdrop {
  background: rgba(2, 6, 23, 0.72);
  backdrop-filter: blur(3px);
}

.settings-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.settings-dialog-header h2,
.mode-settings-section h3,
.mode-settings-section p {
  margin: 0;
}

.mode-settings-section {
  padding: 14px 0;
  border-top: 1px solid var(--border);
}

.mode-settings-section h3 {
  margin-bottom: 10px;
  color: var(--text-strong);
  font-size: 1rem;
}

.mode-settings-section p {
  color: var(--muted);
  font-size: 0.86rem;
}

.settings-dialog .roll-condition-field {
  margin-bottom: 0;
}

.input-error {
  color: #fca5a5;
  font-size: 0.86rem;
}

.survival-chart-prompt {
  margin: 8px 0 0;
  padding: 10px 12px;
  border: 1px solid rgba(248, 113, 113, 0.22);
  border-radius: 10px;
  background: rgba(69, 10, 10, 0.14);
  color: #fca5a5;
  font-size: 0.78rem;
}

.calculation-note {
  color: #94a3b8;
  font-size: 0.78rem;
  line-height: 1.4;
  margin-top: 8px;
}

.calculation-note summary {
  color: #cbd5e1;
  cursor: pointer;
}

.calculation-note p {
  margin: 5px 0 0;
}

.total-damage-charts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 1080px) {
  .action-page {
    grid-template-columns: minmax(0, 1fr);
  }

  .legacy-page {
    grid-template-columns: minmax(0, 1fr);
  }

  .controls-panel {
    position: static;
    max-height: none;
  }

  .legacy-page .results-column {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .legacy-page .results-column {
    grid-template-columns: minmax(0, 1fr);
  }

  .legacy-page .chart-wrapper {
    height: 190px;
    min-height: 0;
  }

  .legacy-page .chart-skeleton {
    height: 190px;
  }

  .total-damage-charts {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
