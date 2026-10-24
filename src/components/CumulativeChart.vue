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
import type { D20Outcome } from '../domain/dice/types'
import { getOutcomeColors } from '../utils/outcomeColors'
import { useChartLifecycle } from '../composables/useChartLifecycle'

ChartJS.register(BarController, BarElement, LinearScale, Tooltip, Legend)

const props = defineProps<{
  outcomes: D20Outcome[]
}>()

const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: ChartJS | null = null

interface HistogramPoint {
  x: number
  y: number
  backgroundColor: string
  borderColor: string
}

function renderChart() {
  chartInstance?.destroy()
  chartInstance = null

  if (!chartCanvas.value || !props.outcomes.length) {
    return
  }

  const tailData = new Array<number>(props.outcomes.length)
  let remainingProbability = 0
  for (let index = props.outcomes.length - 1; index >= 0; index -= 1) {
    remainingProbability += props.outcomes[index].probability
    tailData[index] = remainingProbability
  }

  const barPoints: HistogramPoint[] = props.outcomes.map((entry, index) => {
    const colors = getOutcomeColors(entry.status)
    return {
      x: entry.adjustedValue,
      y: tailData[index],
      backgroundColor: colors.background,
      borderColor: colors.border,
    }
  })

  const xValues = props.outcomes.map((entry) => entry.adjustedValue)
  const xMin = Math.min(...xValues) - 0.5
  const xMax = Math.max(...xValues) + 0.5
  const configuration: ChartConfiguration<'bar', HistogramPoint[], number> = {
    type: 'bar',
    data: {
      datasets: [
        {
          label: 'Probability of at least this value',
          data: barPoints,
          parsing: {
            xAxisKey: 'x',
            yAxisKey: 'y',
          },
          backgroundColor: barPoints.map((point) => point.backgroundColor),
          borderColor: barPoints.map((point) => point.borderColor),
          borderWidth: 1,
          borderSkipped: false,
          barPercentage: 0.9,
          categoryPercentage: 0.9,
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
              const percent = (context.parsed.y ?? 0) * 100
              const formattedPercent = percent < 0.001 ? percent.toExponential(3) : percent.toFixed(3)
              return `${formattedPercent}% chance`
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: Math.floor(xMin),
          max: Math.ceil(xMax),
          ticks: {
            stepSize: 1,
            precision: 0,
            autoSkip: false,
          },
          title: {
            display: true,
            text: 'Combined value',
          },
        },
        y: {
          beginAtZero: true,
          max: 1,
          title: {
            display: true,
            text: 'Probability',
          },
          ticks: {
            callback: (value) => `${(Number(value) * 100).toFixed(1).replace(/\.0$/, '')}%`,
          },
        },
      },
    },
  }

  chartInstance = new ChartJS(chartCanvas.value, configuration)
}

useChartLifecycle(renderChart, () => chartInstance?.destroy(), [() => props.outcomes])
</script>

<template>
  <div class="chart-card">
    <h2>Probability of at least each combined value</h2>
    <div v-if="outcomes.length" class="chart-wrapper">
      <canvas ref="chartCanvas"></canvas>
    </div>
    <div v-else class="chart-skeleton" aria-hidden="true">
      <div class="skeleton-axis"></div>
      <div class="skeleton-bars cumulative-skeleton-bars">
        <span v-for="height in [92, 86, 80, 70, 61, 53, 44, 35, 26, 18, 10]" :key="height" class="skeleton-bar" :style="{ height: `${height}%` }"></span>
      </div>
    </div>
  </div>
</template>
