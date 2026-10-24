<script setup lang="ts">
import type { AnalysisMode, D20Statistics } from '../domain/dice/types'

const props = defineProps<{
  statistics: D20Statistics | null
  mode: AnalysisMode
  showSuccessStats: boolean
}>()
</script>

<template>
  <section class="panel stats-panel" :aria-busy="!statistics">
    <h2>Statistics</h2>
    <template v-if="statistics">
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">Mean</span>
          <strong>{{ statistics.mean.toFixed(2) }}</strong>
        </div>
        <div class="stat-card">
          <span class="stat-label">Median</span>
          <strong>{{ statistics.median }}</strong>
        </div>
        <div class="stat-card">
          <span class="stat-label">Std. dev.</span>
          <strong>{{ statistics.standardDeviation.toFixed(2) }}</strong>
        </div>
        <div class="stat-card">
          <span class="stat-label">Min</span>
          <strong>{{ statistics.minimum }}</strong>
        </div>
        <div class="stat-card">
          <span class="stat-label">Max</span>
          <strong>{{ statistics.maximum }}</strong>
        </div>
        <div v-if="showSuccessStats && mode === 'default'" class="stat-card stat-card--success">
          <span class="stat-label">Success prob.</span>
          <strong>{{ (statistics.successProbability * 100).toFixed(2) }}%</strong>
        </div>
      </div>
      <div v-if="showSuccessStats && mode !== 'default'" class="outcome-grid">
        <div class="stat-card stat-card--critical-failure stat-card--compact">
          <span class="stat-label">Crit. fail</span>
          <strong>{{ (statistics.criticalFailureProbability * 100).toFixed(2) }}%</strong>
        </div>
        <div class="stat-card stat-card--failure stat-card--compact">
          <span class="stat-label">Failure</span>
          <strong>{{ (statistics.simpleFailureProbability * 100).toFixed(2) }}%</strong>
        </div>
        <div class="stat-card stat-card--success stat-card--compact">
          <span class="stat-label">Success</span>
          <strong>{{ (statistics.simpleSuccessProbability * 100).toFixed(2) }}%</strong>
        </div>
        <div class="stat-card stat-card--critical-success stat-card--compact">
          <span class="stat-label">Crit. success</span>
          <strong>{{ (statistics.criticalSuccessProbability * 100).toFixed(2) }}%</strong>
        </div>
      </div>
    </template>
    <div v-else class="stats-grid skeleton-stats" aria-hidden="true">
      <div v-for="index in (mode === 'default' ? 6 : 9)" :key="index" class="stat-card">
        <span class="skeleton-line skeleton-label"></span>
        <span class="skeleton-line skeleton-value"></span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.stats-panel {
  padding: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.outcome-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  display: grid;
  gap: 8px;
  margin-top: 8px;
}

.stat-card {
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 11px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 60px;
  justify-content: center;
  text-align: center;
}

.stat-card--compact {
  min-height: 56px;
  padding: 7px;
}

.stat-card--compact .stat-label {
  font-size: 0.66rem;
}

.stat-card--compact strong {
  font-size: 0.95rem;
}

.stat-label {
  display: block;
  font-size: 0.72rem;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.stat-card strong {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: -0.04em;
}

.stat-card--failure {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.45);
}

.stat-card--failure .stat-label,
.stat-card--failure strong {
  color: #fca5a5;
}

.stat-card--success {
  background: rgba(34, 197, 94, 0.09);
  border-color: rgba(34, 197, 94, 0.45);
}

.stat-card--success .stat-label,
.stat-card--success strong {
  color: #86efac;
}

.stat-card--critical-failure {
  background: rgba(127, 29, 29, 0.18);
  border-color: rgba(127, 29, 29, 0.9);
}

.stat-card--critical-failure .stat-label,
.stat-card--critical-failure strong {
  color: #fca5a5;
}

.stat-card--critical-success {
  background: rgba(251, 191, 36, 0.09);
  border-color: rgba(251, 191, 36, 0.6);
}

.stat-card--critical-success .stat-label,
.stat-card--critical-success strong {
  color: #fde68a;
}

@media (max-width: 640px) {
  .outcome-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stat-card--compact {
    padding-right: 6px;
    padding-left: 6px;
  }
}
</style>
