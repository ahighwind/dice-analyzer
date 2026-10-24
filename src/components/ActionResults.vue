<script setup lang="ts">
import { getOutcomeColors } from '../utils/outcomeColors'
import type { ActionAnalysis } from '../domain/dice/actionTypes'
import type { AnalysisMode, OutcomeStatus } from '../domain/dice/types'
import DamageContributionChart from './DamageContributionChart.vue'
import DistributionChart from './DistributionChart.vue'

const props = defineProps<{
  analyses: ActionAnalysis[]
  mode: AnalysisMode
}>()

const statuses: Array<{ status: OutcomeStatus; label: string }> = [
  { status: 'criticalFailure', label: 'Critical failure' },
  { status: 'failure', label: 'Failure' },
  { status: 'success', label: 'Success' },
  { status: 'criticalSuccess', label: 'Critical success' },
  { status: 'unclassified', label: 'Unclassified' },
]

function statusColor(status: OutcomeStatus): string {
  return getOutcomeColors(status).border
}

function isVisibleStatus(status: OutcomeStatus, mode: AnalysisMode): boolean {
  return mode !== 'default' || status === 'failure' || status === 'success'
}

function visibleProbabilities(analysis: ActionAnalysis, mode: AnalysisMode) {
  return statuses
    .filter((item) => isVisibleStatus(item.status, mode))
    .map((item) => ({
      ...item,
      probability: analysis.degreeProbabilities[item.status],
    }))
    .filter((item) => item.probability > 0 || item.status === 'criticalFailure')
}
</script>

<template>
  <section class="action-results">
    <h2>Action results</h2>
    <article v-for="(analysis, index) in analyses" :key="analysis.action.id" class="panel action-result-card">
      <header class="action-result-header">
        <div class="action-result-identity">
          <span class="action-result-index">{{ String(index + 1).padStart(2, '0') }}</span>
          <div>
            <h3>{{ analysis.action.name }}</h3>
            <div class="action-result-meta" aria-label="Action settings">
              <span class="action-result-chip">{{ analysis.targetLabel }} {{ analysis.dc ?? '—' }}</span>
              <span class="action-result-chip">
                Mod {{ analysis.testModifier >= 0 ? '+' : '' }}{{ analysis.testModifier }}
              </span>
              <span v-if="analysis.action.isSave" class="action-result-chip">Save</span>
              <span v-if="analysis.action.isSave && analysis.action.isBasicSave" class="action-result-chip">Basic</span>
              <span
                v-if="mode === 'dnd' && analysis.action.rollCondition !== 'normal'"
                class="action-result-chip"
              >
                {{ analysis.action.rollCondition === 'advantage' ? 'Advantage' : 'Disadvantage' }}
              </span>
              <span v-if="analysis.action.rerollDamageOnes" class="action-result-chip">Reroll 1</span>
            </div>
          </div>
        </div>
        <strong v-if="analysis.successProbability !== null" class="success-rate">
          {{ analysis.action.isSave ? 'Save success' : 'Success' }} {{ (analysis.successProbability * 100).toFixed(2) }}%
        </strong>
        <span v-else class="muted-result">Enter valid target values for this action.</span>
      </header>

      <div v-if="analysis.successProbability !== null" class="action-probability-summary">
        <div class="degree-list" :class="{ 'degree-list--grid': mode !== 'default' }">
          <div
            v-for="item in visibleProbabilities(analysis, mode)"
            :key="item.status"
            class="degree-item"
            :style="{ '--degree-color': statusColor(item.status) }"
          >
            <span>{{ item.label }}</span>
            <strong>{{ (item.probability * 100).toFixed(2) }} %</strong>
          </div>
        </div>
        <div
          class="probability-chart"
          role="img"
          :aria-label="`Outcome distribution: ${visibleProbabilities(analysis, mode).map((item) => `${item.label} ${(item.probability * 100).toFixed(2)}%`).join(', ')}`"
        >
          <div class="probability-chart__heading">
            <span>Outcome distribution</span>
            <strong>100%</strong>
          </div>
          <div class="probability-chart__bar">
            <span
              v-for="item in visibleProbabilities(analysis, mode)"
              :key="item.status"
              class="probability-chart__segment"
              :style="{
                width: `${item.probability * 100}%`,
                backgroundColor: statusColor(item.status),
              }"
              :title="`${item.label}: ${(item.probability * 100).toFixed(2)}%`"
            ></span>
          </div>
          <div class="probability-chart__scale" aria-hidden="true">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      <p v-if="!analysis.damageRolls.length" class="muted-result">
        This action has no damage: only the test outcome distribution is analyzed.
      </p>
      <p v-else-if="analysis.hasInvalidDamageExpression" class="input-error">
        Fix the invalid damage expression (d2 to d12 only) to display this action.
      </p>
      <div v-else class="action-damage-results">
        <DistributionChart
          v-for="(roll, index) in analysis.damageRolls"
          :key="roll.definition.id"
          :title="`Roll ${index + 1} — ${roll.definition.expression} ${roll.definition.type}`"
          :distribution="roll.distribution ?? []"
          :color="roll.definition.color"
        />
        <DamageContributionChart
          v-if="analysis.damageDistribution"
          :distribution="analysis.damageDistribution"
          :damage-rolls="analysis.damageRolls"
        />
      </div>
    </article>
  </section>
</template>

<style scoped>
.action-results {
  display: grid;
  gap: 10px;
}

.action-results > h2 {
  margin: 0;
}

.action-result-card {
  padding: 13px;
  min-width: 0;
  border-left: 3px solid #34d399;
  background: linear-gradient(115deg, rgba(16, 38, 44, 0.82), rgba(15, 23, 42, 0.96) 36%);
  box-shadow: none;
}

.action-result-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 9px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.action-result-header h3 {
  margin: 0;
}

.action-result-identity {
  display: flex;
  align-items: flex-start;
  gap: 9px;
}

.action-result-index {
  display: inline-grid;
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 1px solid rgba(52, 211, 153, 0.3);
  border-radius: 7px;
  background: rgba(52, 211, 153, 0.12);
  color: #6ee7b7;
  font-size: 0.66rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.action-result-header h3 {
  color: #f8fafc;
}

.muted-result {
  color: #94a3b8;
  font-size: 0.82rem;
}

.action-result-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
}

.action-result-chip {
  padding: 2px 7px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.72);
  color: #cbd5e1;
  font-size: 0.72rem;
  line-height: 1.5;
  white-space: nowrap;
}

.success-rate {
  padding: 5px 9px;
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.1);
  color: #86efac;
  font-size: 0.85rem;
}

.degree-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.degree-list--grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
}

.action-probability-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(160px, 220px);
  align-items: center;
  gap: 12px;
  margin: 10px 0;
  padding: 9px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 11px;
  background: rgba(7, 12, 24, 0.45);
}

.probability-chart {
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid #334155;
  border-radius: 10px;
  background: #0f172a;
}

.probability-chart__heading,
.probability-chart__scale {
  display: flex;
  justify-content: space-between;
}

.probability-chart__heading {
  margin-bottom: 7px;
  color: #cbd5e1;
  font-size: 0.72rem;
}

.probability-chart__heading strong {
  color: #94a3b8;
  font-weight: 500;
}

.probability-chart__bar {
  display: flex;
  overflow: hidden;
  height: 11px;
  border-radius: 999px;
  background: #1e293b;
}

.probability-chart__segment {
  height: 100%;
  transition: width 180ms ease;
}

.probability-chart__scale {
  margin-top: 5px;
  color: #64748b;
  font-size: 0.65rem;
}

.degree-item {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid color-mix(in srgb, var(--degree-color) 45%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--degree-color) 7%, transparent);
  color: var(--degree-color);
  font-size: 0.8rem;
}

.action-damage-results {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: 10px;
  margin-top: 10px;
}

.action-damage-results :deep(.distribution-chart),
.action-damage-results :deep(.damage-contribution-chart) {
  padding: 10px;
  border: 1px solid rgba(96, 165, 250, 0.15);
  border-radius: 11px;
  background: rgba(7, 12, 24, 0.38);
}

.muted-result {
  margin: 12px 0 0;
}

.input-error {
  color: #fca5a5;
  font-size: 0.86rem;
}

@media (max-width: 600px) {
  .action-probability-summary {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
}
</style>
