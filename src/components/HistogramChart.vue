<script setup lang="ts">
import {
  Chart as ChartJS,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js'
import { ref } from 'vue'
import type { D20Outcome } from '../domain/dice/types'
import { getOutcomeColors } from '../utils/outcomeColors'
import { useChartLifecycle } from '../composables/useChartLifecycle'

ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const props = defineProps<{
  outcomes: D20Outcome[]
}>()

const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: ChartJS | null = null

// Create a chart only after the canvas exists and the data has been prepared.
function renderChart() {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  if (!chartCanvas.value || !props.outcomes.length) {
    return
  }

  chartInstance = new ChartJS(chartCanvas.value, {
    type: 'bar',
    data: {
      labels: props.outcomes.map((entry) => entry.label),
      datasets: [
        {
          label: 'Probability',
          data: props.outcomes.map((entry) => entry.probability),
          backgroundColor: props.outcomes.map((entry) =>
            getOutcomeColors(entry.status, entry.status.startsWith('critical') ? 0.9 : 0.8).background,
          ),
          borderColor: props.outcomes.map((entry) => getOutcomeColors(entry.status).border),
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.parsed.y as number
              const percent = value * 100
              const formattedPercent = percent < 0.001 ? percent.toExponential(3) : percent.toFixed(3)
              return `${formattedPercent}% chance`
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: Math.max(...props.outcomes.map((entry) => entry.probability), 0.01),
          ticks: {
            callback: (value) => `${(Number(value) * 100).toFixed(1).replace(/\.0$/, '')}%`,
          },
        },
      },
    },
  })
}

useChartLifecycle(renderChart, () => chartInstance?.destroy(), [() => props.outcomes])
</script>

<template>
  <div class="chart-card">
    <h2>Probability by combined total</h2>
    <div v-if="outcomes.length" class="chart-wrapper">
      <canvas ref="chartCanvas"></canvas>
    </div>
    <div v-else class="chart-skeleton" aria-hidden="true">
      <div class="skeleton-axis"></div>
      <div class="skeleton-bars">
        <span v-for="height in [35, 58, 44, 76, 51, 86, 63, 42, 70, 52, 32]" :key="height" class="skeleton-bar" :style="{ height: `${height}%` }"></span>
      </div>
    </div>
  </div>
</template>
