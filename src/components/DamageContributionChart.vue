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
import type { ChartConfiguration, Plugin } from 'chart.js'
import type { DamageRollAnalysis, DistributionOutcome } from '../domain/dice/actionTypes'
import { useChartLifecycle } from '../composables/useChartLifecycle'
import { getDamageContributionsByTotal } from '../domain/dice/damageContributions'

ChartJS.register(BarController, BarElement, LinearScale, Tooltip, Legend)

const props = defineProps<{
  distribution: DistributionOutcome[]
  damageRolls: DamageRollAnalysis[]
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let chart: ChartJS | null = null

const statisticMarkers = [
  { key: 'mean', label: 'Mean', color: '#f87171', dash: [] },
  { key: 'd1', label: 'D1', color: '#60a5fa', dash: [2, 3] },
  { key: 'q1', label: 'Q1', color: '#60a5fa', dash: [5, 3] },
  { key: 'median', label: 'Median', color: '#60a5fa', dash: [10, 3, 2, 3] },
  { key: 'q3', label: 'Q3', color: '#60a5fa', dash: [5, 3] },
  { key: 'd9', label: 'D9', color: '#60a5fa', dash: [2, 3] },
] as const

type StatisticKey = typeof statisticMarkers[number]['key']

function calculateStatistics(distribution: DistributionOutcome[]): Record<StatisticKey, number> {
  const mean = distribution.reduce(
    (sum, outcome) => sum + outcome.value * outcome.probability,
    0,
  )
  const quantile = (threshold: number) => {
    let cumulativeProbability = 0
    for (const outcome of distribution) {
      cumulativeProbability += outcome.probability
      if (cumulativeProbability >= threshold) return outcome.value
    }
    return distribution.at(-1)?.value ?? 0
  }

  return {
    mean,
    d1: quantile(0.1),
    median: quantile(0.5),
    q1: quantile(0.25),
    q3: quantile(0.75),
    d9: quantile(0.9),
  }
}

function render() {
  chart?.destroy()
  chart = null
  if (!canvas.value || !props.distribution.length) return

  const outcomes = getDamageContributionsByTotal(props.damageRolls, props.distribution)
  const values = outcomes.map((outcome) => outcome.value)
  const types = outcomes[0]?.contributions ?? []
  const statistics = calculateStatistics(props.distribution)
  const statisticsPlugin: Plugin<'bar'> = {
    id: 'damage-statistic-markers',
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

  const configuration: ChartConfiguration<'bar', { x: number; y: number }[], number> = {
    type: 'bar',
    data: {
      datasets: types.map((type, typeIndex) => ({
        label: type.type,
        data: outcomes.map((outcome) => ({
          x: outcome.value,
          y: outcome.contributions[typeIndex]?.value ?? 0,
        })),
        backgroundColor: `${type.color}bb`,
        borderColor: type.color,
        borderWidth: 1,
        stack: 'damage-types',
        barPercentage: 0.9,
        categoryPercentage: 0.9,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: types.length > 1, position: 'bottom' },
        tooltip: {
          callbacks: {
            title: (items) => `Damage: ${items[0]?.parsed.x ?? ''}`,
            label: (context) =>
              `${context.dataset.label}: ${(context.parsed.y ?? 0).toFixed(2)}`,
            footer: (items) =>
              `Total contribution: ${(items.reduce((sum, item) => sum + (item.parsed.y ?? 0), 0)).toFixed(2)}`,
          },
        },
      },
      layout: { padding: { top: 4 } },
      scales: {
        x: {
          type: 'linear',
          stacked: true,
          min: Math.min(...values) - 0.5,
          max: Math.max(...values) + 0.5,
          ticks: {
            stepSize: 1,
            precision: 0,
            autoSkip: true,
            callback: (value) => Number.isInteger(Number(value)) ? value : '',
          },
          title: { display: true, text: 'Total damage' },
        },
        y: {
          beginAtZero: true,
          stacked: true,
          title: { display: true, text: 'Average contribution' },
          ticks: { precision: 0 },
        },
      },
    },
    plugins: [statisticsPlugin],
  }

  chart = new ChartJS(canvas.value, configuration)
}

useChartLifecycle(render, () => chart?.destroy(), [() => props.distribution, () => props.damageRolls])
</script>

<template>
  <section class="damage-contribution-chart">
    <h4>Damage contribution by type (before applying test result)</h4>
    <ul class="damage-contribution-chart__statistics" aria-label="Damage statistics">
      <li v-for="marker in statisticMarkers" :key="marker.key">
        <span
          class="damage-contribution-chart__marker"
          :style="{ '--marker-color': marker.color, '--marker-dash': marker.dash.length ? 'dashed' : 'solid' }"
          aria-hidden="true"
        ></span>
        {{ marker.label }}: {{ calculateStatistics(distribution)[marker.key].toFixed(2) }}
      </li>
    </ul>
    <div class="damage-contribution-chart__canvas">
      <canvas ref="canvas"></canvas>
    </div>
  </section>
</template>

<style scoped>
.damage-contribution-chart {
  display: flex;
  flex-direction: column;
}

.damage-contribution-chart h4 {
  margin: 0 0 8px;
  color: #cbd5e1;
  font-size: 0.88rem;
}

.damage-contribution-chart__statistics {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin: 0 0 4px;
  padding: 0;
  color: #94a3b8;
  font-size: 0.7rem;
  list-style: none;
}

.damage-contribution-chart__statistics li {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.damage-contribution-chart__marker {
  width: 12px;
  border-top: 2px var(--marker-dash) var(--marker-color);
}

.damage-contribution-chart__canvas {
  height: 200px;
  margin-top: auto;
}

@media (max-width: 600px) {
  .damage-contribution-chart__canvas {
    height: 175px;
  }
}
</style>
