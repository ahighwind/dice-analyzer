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
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let chart: ChartJS<'line', { x: number; y: number }[], number> | null = null
const firstBelowCertainSurvival = computed(() => props.probabilities.find(
  ({ probability }) => probability < 1 - Number.EPSILON * 10,
)?.turn ?? null)
const firstAtMostHalfSurvival = computed(() => props.probabilities.find(
  ({ probability }) => probability <= 0.5 + Number.EPSILON * 10,
)?.turn ?? null)

function render() {
  chart?.destroy()
  chart = null
  if (!canvas.value || props.probabilities.length === 0) return

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
}

useChartLifecycle(render, () => chart?.destroy(), [() => props.probabilities])
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
</style>
