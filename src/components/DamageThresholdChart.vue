<script setup lang="ts">
import {
  BarController,
  BarElement,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
} from 'chart.js'
import { ref } from 'vue'
import type { ChartConfiguration, Plugin } from 'chart.js'
import type { DistributionOutcome } from '../domain/dice/actionTypes'
import { useChartLifecycle } from '../composables/useChartLifecycle'

ChartJS.register(BarController, BarElement, LinearScale, Tooltip)

const props = defineProps<{
  distribution: DistributionOutcome[]
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let chart: ChartJS<'bar', { x: number; y: number }[], number> | null = null

const statisticMarkers = [
  { key: 'mean', color: '#f87171', dash: [] },
  { key: 'd1', color: '#60a5fa', dash: [2, 3] },
  { key: 'q1', color: '#60a5fa', dash: [5, 3] },
  { key: 'median', color: '#60a5fa', dash: [10, 3, 2, 3] },
  { key: 'q3', color: '#60a5fa', dash: [5, 3] },
  { key: 'd9', color: '#60a5fa', dash: [2, 3] },
] as const

type StatisticKey = typeof statisticMarkers[number]['key']

function calculateStatistics(distribution: DistributionOutcome[]): Record<StatisticKey, number> {
  const sorted = [...distribution].sort((left, right) => left.value - right.value)
  const mean = sorted.reduce(
    (sum, outcome) => sum + outcome.value * outcome.probability,
    0,
  )
  const quantile = (threshold: number) => {
    let cumulativeProbability = 0
    for (const outcome of sorted) {
      cumulativeProbability += outcome.probability
      if (cumulativeProbability >= threshold) return outcome.value
    }
    return sorted.at(-1)?.value ?? 0
  }

  return {
    mean,
    d1: quantile(0.1),
    q1: quantile(0.25),
    median: quantile(0.5),
    q3: quantile(0.75),
    d9: quantile(0.9),
  }
}

function getThresholdProbabilities(distribution: DistributionOutcome[]) {
  if (!distribution.length) return []

  const sortedOutcomes = [...distribution].sort((left, right) => left.value - right.value)
  const maxDamage = sortedOutcomes[sortedOutcomes.length - 1].value
  const thresholds: Array<{ x: number; y: number }> = []
  let outcomeIndex = sortedOutcomes.length - 1
  let probability = 0

  for (let threshold = Math.ceil(maxDamage) + 1; threshold >= 1; threshold -= 1) {
    while (
      outcomeIndex >= 0
      && sortedOutcomes[outcomeIndex].value >= threshold
    ) {
      probability += sortedOutcomes[outcomeIndex].probability
      outcomeIndex -= 1
    }
    thresholds.push({ x: threshold, y: probability })
  }

  return thresholds.reverse()
}

function render() {
  chart?.destroy()
  chart = null

  const data = getThresholdProbabilities(props.distribution)
  if (!canvas.value || !data.length) return
  const statistics = calculateStatistics(props.distribution)
  const statisticsPlugin: Plugin<'bar'> = {
    id: 'threshold-damage-statistic-markers',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart
      ctx.save()
      for (const marker of statisticMarkers) {
        const x = scales.x.getPixelForValue(statistics[marker.key])
        if (x < chartArea.left || x > chartArea.right) continue

        ctx.beginPath()
        ctx.setLineDash([...marker.dash])
        ctx.strokeStyle = marker.color
        ctx.lineWidth = marker.key === 'mean' ? 2 : 1.5
        ctx.moveTo(x, chartArea.top)
        ctx.lineTo(x, chartArea.bottom)
        ctx.stroke()
      }
      ctx.restore()
    },
  }
  const minStatistic = Math.min(...Object.values(statistics))

  const configuration: ChartConfiguration<'bar', { x: number; y: number }[], number> = {
    type: 'bar',
    data: {
      datasets: [{
        label: 'Probability',
        data,
        borderColor: '#38bdf8',
        backgroundColor: '#38bdf8bb',
        borderWidth: 1,
        barPercentage: 0.9,
        categoryPercentage: 0.9,
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
            title: (items) => `At least ${items[0]?.parsed.x ?? ''} total damage`,
            label: (context) => `${((context.parsed.y ?? 0) * 100).toFixed(2)}%`,
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: Math.min(1, minStatistic),
          max: data[data.length - 1].x,
          ticks: {
            stepSize: 1,
            precision: 0,
            autoSkip: true,
            callback: (value) => Number.isInteger(Number(value)) ? value : '',
          },
          title: { display: true, text: 'Minimum total damage (X)' },
        },
        y: {
          min: 0,
          max: 1,
          title: { display: true, text: 'Probability of at least X damage' },
          ticks: { callback: (value) => `${(Number(value) * 100).toFixed(0)}%` },
        },
      },
    },
    plugins: [statisticsPlugin],
  }

  chart = new ChartJS(canvas.value, configuration)
}

useChartLifecycle(render, () => chart?.destroy(), [() => props.distribution])
</script>

<template>
  <div class="chart-card damage-threshold">
    <h2>Probability of at least X total damage</h2>
    <p class="chart-description">
      Chance that the combined damage from all actions reaches or exceeds each threshold.
    </p>
    <div class="chart-wrapper">
      <canvas ref="canvas" aria-label="Probability of reaching each total damage threshold"></canvas>
    </div>
  </div>
</template>

<style scoped>
.damage-threshold {
  display: flex;
  flex-direction: column;
  padding: 14px;
}

.chart-description {
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
