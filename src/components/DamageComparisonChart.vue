<script setup lang="ts">
import {
  BarController,
  BarElement,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js'
import { ref } from 'vue'
import type { ChartConfiguration } from 'chart.js'
import type { DistributionOutcome } from '../domain/dice/actionTypes'
import { useChartLifecycle } from '../composables/useChartLifecycle'

ChartJS.register(BarController, BarElement, LinearScale, Tooltip, Legend)

export interface DamageSeries {
  id: string
  label: string
  color: string
  distribution: DistributionOutcome[]
}

const props = defineProps<{
  title: string
  description: string
  series: DamageSeries[]
  stacked?: boolean
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let chart: ChartJS | null = null

function render() {
  chart?.destroy()
  chart = null
  if (!canvas.value || props.series.length === 0) return

  const values = props.series.flatMap((item) => item.distribution.map((entry) => entry.value))
  if (values.length === 0) return
  const maxProbability = Math.max(
    ...props.series.flatMap((item) => item.distribution.map((entry) => entry.probability)),
  )

  const configuration: ChartConfiguration<'bar', { x: number; y: number }[], number> = {
    type: 'bar',
    data: {
      datasets: props.series.map((item) => ({
        label: item.label,
        data: item.distribution.map((entry) => ({ x: entry.value, y: entry.probability })),
        backgroundColor: `${item.color}bb`,
        borderColor: item.color,
        borderWidth: 1,
        stack: props.stacked ? 'actions' : undefined,
        barThickness: props.stacked ? 18 : undefined,
        barPercentage: 0.9,
        categoryPercentage: 0.9,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: props.series.length > 1, position: 'bottom' },
        tooltip: {
          callbacks: {
            title: (items) => `Damage: ${items[0]?.parsed.x ?? ''}`,
            label: (context) => `${context.dataset.label}: ${((context.parsed.y ?? 0) * 100).toFixed(3)}%`,
            footer: () => props.stacked
              ? 'Marginal contributions: probabilities are summed by action.'
              : '',
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          stacked: props.stacked ?? false,
          min: Math.min(...values) - 0.5,
          max: Math.max(...values) + 0.5,
          ticks: {
            stepSize: 1,
            precision: 0,
            autoSkip: true,
            callback: (value) => Number.isInteger(Number(value)) ? value : '',
          },
          title: { display: true, text: 'Damage' },
        },
        y: {
          beginAtZero: true,
          stacked: props.stacked ?? false,
          ...(props.stacked ? {} : { max: maxProbability }),
          title: { display: true, text: 'Probability' },
          ticks: { callback: (value) => `${(Number(value) * 100).toFixed(0)}%` },
        },
      },
    },
  }

  chart = new ChartJS(canvas.value, configuration)
}

useChartLifecycle(render, () => chart?.destroy(), [() => props.series, () => props.stacked])
</script>

<template>
  <div class="chart-card damage-comparison">
    <h2>{{ title }}</h2>
    <p class="chart-description">{{ description }}</p>
    <div v-if="series.length" class="chart-wrapper">
      <canvas ref="canvas"></canvas>
    </div>
    <p v-else class="empty-chart-note">Add at least one action to display this distribution.</p>
  </div>
</template>

<style scoped>
.damage-comparison {
  display: flex;
  flex-direction: column;
  padding: 14px;
}

.chart-description,
.empty-chart-note {
  margin: -3px 0 8px;
  color: #94a3b8;
  font-size: 0.86rem;
  line-height: 1.5;
}

.chart-wrapper {
  height: 200px;
  margin-top: auto;
}

@media (max-width: 600px) {
  .chart-wrapper {
    height: 180px;
    min-height: 0;
  }
}
</style>
