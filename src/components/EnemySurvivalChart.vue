<script setup lang="ts">
import {
  Chart as ChartJS,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import { computed, ref } from 'vue'
import type { ChartConfiguration } from 'chart.js'
import { SURVIVAL_ANALYSIS_TURNS } from '../domain/dice/survivalAnalysis'
import { useChartLifecycle } from '../composables/useChartLifecycle'

ChartJS.register(Filler, LineController, LineElement, LinearScale, PointElement, Tooltip)

const props = defineProps<{
  hitPoints: number
  probabilities: Array<{ turn: number; probability: number }>
  hitPointQuantiles: Array<{
    turn: number
    d1: number
    q1: number
    median: number
    q3: number
    d9: number
  }>
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const hitPointCanvas = ref<HTMLCanvasElement | null>(null)
let chart: ChartJS<'line', { x: number; y: number }[], number> | null = null
let hitPointChart: ChartJS<'line', { x: number; y: number }[], number> | null = null
const firstBelowCertainSurvival = computed(() => props.probabilities.find(
  ({ probability }) => probability < 1 - Number.EPSILON * 10,
)?.turn ?? null)
const firstAtMostHalfSurvival = computed(() => props.probabilities.find(
  ({ probability }) => probability <= 0.5 + Number.EPSILON * 10,
)?.turn ?? null)

const hitPointSeries = [
  { key: 'd1', label: 'D1', color: '#fca5a5', dash: [2, 3], width: 1.5 },
  { key: 'q1', label: 'Q1', color: '#fb7185', dash: [5, 3], width: 1.75 },
  { key: 'median', label: 'Median', color: '#f87171', dash: [], width: 3 },
  { key: 'q3', label: 'Q3', color: '#fb7185', dash: [5, 3], width: 1.75 },
  { key: 'd9', label: 'D9', color: '#fca5a5', dash: [2, 3], width: 1.5 },
] as const

function render() {
  chart?.destroy()
  chart = null
  hitPointChart?.destroy()
  hitPointChart = null
  if (!canvas.value || !hitPointCanvas.value || props.probabilities.length === 0) return

  const configuration: ChartConfiguration<'line', { x: number; y: number }[], number> = {
    type: 'line',
    data: {
      datasets: [{
        label: 'Survival probability',
        data: props.probabilities.map(({ turn, probability }) => ({ x: turn, y: probability })),
        borderColor: '#f87171',
        backgroundColor: '#f8717133',
        pointBackgroundColor: '#fecaca',
        pointRadius: 2,
        borderWidth: 2,
        fill: true,
        tension: 0.2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `After ${items[0]?.parsed.x ?? ''} turns`,
            label: (context) => `${((context.parsed.y ?? 0) * 100).toFixed(2)}%`,
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: 1,
          max: SURVIVAL_ANALYSIS_TURNS,
          ticks: {
            stepSize: 1,
            precision: 0,
            autoSkip: true,
            callback: (value) => Number.isInteger(Number(value)) ? value : '',
          },
          title: { display: true, text: 'Turns' },
        },
        y: {
          min: 0,
          max: 1,
          title: { display: true, text: 'Survival probability' },
          ticks: { callback: (value) => `${(Number(value) * 100).toFixed(0)}%` },
        },
      },
    },
  }

  chart = new ChartJS(canvas.value, configuration)

  const hitPointConfiguration: ChartConfiguration<'line', { x: number; y: number }[], number> = {
    type: 'line',
    data: {
      datasets: hitPointSeries.map((series) => ({
        label: series.label,
        data: props.hitPointQuantiles.map((quantile) => ({
          x: quantile.turn,
          y: quantile[series.key],
        })),
        borderColor: series.color,
        backgroundColor: series.color,
        pointBackgroundColor: series.color,
        pointRadius: series.key === 'median' ? 2.5 : 1.5,
        pointHoverRadius: 4,
        borderWidth: series.width,
        borderDash: [...series.dash],
        tension: 0.2,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `After ${items[0]?.parsed.x ?? ''} turns`,
            label: (context) => `${context.dataset.label}: ${(context.parsed.y ?? 0).toFixed(0)} HP`,
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: 1,
          max: SURVIVAL_ANALYSIS_TURNS,
          ticks: {
            stepSize: 1,
            precision: 0,
            autoSkip: true,
            callback: (value) => Number.isInteger(Number(value)) ? value : '',
          },
          title: { display: true, text: 'Turns' },
        },
        y: {
          min: 0,
          max: props.hitPoints,
          title: { display: true, text: 'Enemy HP' },
          ticks: { precision: 0 },
        },
      },
    },
  }

  hitPointChart = new ChartJS(hitPointCanvas.value, hitPointConfiguration)
}

useChartLifecycle(render, () => {
  chart?.destroy()
  hitPointChart?.destroy()
}, [() => props.probabilities, () => props.hitPointQuantiles])
</script>

<template>
  <section class="chart-card enemy-survival">
    <h2>Enemy survival</h2>
    <p class="chart-description">
      Probability the enemy survives each turn, with {{ hitPoints }} HP and the current actions repeated every turn.
    </p>
    <div class="chart-wrapper">
      <canvas ref="canvas" aria-label="Enemy survival probability over 10 turns"></canvas>
    </div>
    <p class="survival-milestones">
      <span>
        Below 100% survival: {{ firstBelowCertainSurvival === null ? 'not reached' : `turn ${firstBelowCertainSurvival}` }}
      </span>
      <span>
        At most 50% survival: {{ firstAtMostHalfSurvival === null ? 'not reached' : `turn ${firstAtMostHalfSurvival}` }}
      </span>
    </p>
    <div class="hit-point-chart">
      <h3>Probable enemy HP</h3>
      <p class="chart-description">
        Remaining HP quantiles after each turn; defeated enemies stay at 0 HP.
      </p>
      <ul class="hit-point-chart__legend" aria-label="Hit point quantiles">
        <li v-for="series in hitPointSeries" :key="series.key">
          <span
            class="hit-point-chart__marker"
            :class="{ 'hit-point-chart__marker--median': series.key === 'median' }"
            :style="{ '--marker-color': series.color, '--marker-dash': series.dash.length ? 'dashed' : 'solid' }"
            aria-hidden="true"
          ></span>
          {{ series.label }}
        </li>
      </ul>
      <div class="chart-wrapper hit-point-chart__wrapper">
        <canvas ref="hitPointCanvas" aria-label="Enemy hit point quantiles over 10 turns"></canvas>
      </div>
    </div>
  </section>
</template>

<style scoped>
.enemy-survival {
  display: flex;
  flex-direction: column;
  margin-top: 8px;
  padding: 14px;
  border-color: rgba(248, 113, 113, 0.28);
  background: linear-gradient(145deg, rgba(69, 10, 10, 0.2), rgba(15, 23, 42, 0.9));
}

.enemy-survival h2 {
  margin-bottom: 0.4rem;
}

.chart-description {
  margin: 0 0 8px;
  color: #94a3b8;
  font-size: 0.82rem;
  line-height: 1.45;
}

.chart-wrapper {
  height: 190px;
}

.survival-milestones {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 12px;
  margin: 7px 0 0;
  color: #cbd5e1;
  font-size: 0.7rem;
  line-height: 1.35;
}

.hit-point-chart {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(148, 163, 184, 0.16);
}

.hit-point-chart h3 {
  margin: 0 0 4px;
  color: #cbd5e1;
  font-size: 0.88rem;
}

.hit-point-chart .chart-description {
  margin-bottom: 6px;
}

.hit-point-chart__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin: 0 0 4px;
  padding: 0;
  color: #94a3b8;
  font-size: 0.7rem;
  list-style: none;
}

.hit-point-chart__legend li {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.hit-point-chart__marker {
  width: 12px;
  border-top: 2px var(--marker-dash) var(--marker-color);
}

.hit-point-chart__marker--median {
  border-top-width: 3px;
}

.hit-point-chart__wrapper {
  height: 190px;
}

@media (max-width: 600px) {
  .hit-point-chart__wrapper {
    height: 175px;
  }
}
</style>
