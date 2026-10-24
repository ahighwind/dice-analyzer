<script setup lang="ts">
import {
  BarController,
  BarElement,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
} from 'chart.js'
import { ref } from 'vue'
import type { ChartConfiguration } from 'chart.js'
import type { DamageRollAnalysis, DistributionOutcome } from '../domain/dice/actionTypes'
import { useChartLifecycle } from '../composables/useChartLifecycle'
import { getDamageContributionsByTotal } from '../domain/dice/damageContributions'

ChartJS.register(BarController, BarElement, LinearScale, Tooltip)

const props = defineProps<{
  title: string
  distribution: DistributionOutcome[]
  color?: string
  damageRolls?: DamageRollAnalysis[]
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let chart: ChartJS | null = null

function mixColors(colors: string[], weights: number[]): string {
  const parsedColors = colors.map((color) => {
    const match = /^#([0-9a-f]{6})$/i.exec(color)
    return match
      ? [0, 2, 4].map((offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16))
      : null
  })

  if (parsedColors.some((color) => color === null)) return props.color ?? '#60a5fa'

  const channels = [0, 1, 2].map((channel) =>
    Math.round(parsedColors.reduce(
      (sum, color, index) => sum + (color?.[channel] ?? 0) * weights[index],
      0,
    )),
  )
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function getContributionColors(): string[] | null {
  const outcomes = getDamageContributionsByTotal(props.damageRolls ?? [], props.distribution)
  if (!outcomes.length) return null

  const colors = outcomes[0].contributions.map((contribution) => contribution.color)
  const totalExpectedContributions = colors.map((_, index) =>
    outcomes.reduce(
      (sum, outcome, outcomeIndex) =>
        sum + outcome.contributions[index].value * props.distribution[outcomeIndex].probability,
      0,
    ),
  )
  const totalExpectedDamage = totalExpectedContributions.reduce((sum, value) => sum + value, 0)

  return outcomes.map((outcome) => {
    const contributions = outcome.contributions.map((contribution) => contribution.value)
    const damage = contributions.reduce((sum, value) => sum + value, 0)
    const weights = damage > 0
      ? contributions.map((value) => value / damage)
      : totalExpectedDamage > 0
        ? totalExpectedContributions.map((value) => value / totalExpectedDamage)
        : colors.map(() => 1 / colors.length)
    return mixColors(colors, weights)
  })
}

function render() {
  chart?.destroy()
  chart = null
  if (!canvas.value || props.distribution.length === 0) return

  const values = props.distribution.map((entry) => entry.value)
  const color = props.color ?? '#60a5fa'
  const pointColors = getContributionColors()
  const configuration: ChartConfiguration<'bar', { x: number; y: number }[], number> = {
    type: 'bar',
    data: {
      datasets: [{
        label: 'Probability',
        data: props.distribution.map((entry) => ({ x: entry.value, y: entry.probability })),
        backgroundColor: pointColors?.map((pointColor) => `${pointColor}bb`) ?? `${color}bb`,
        borderColor: pointColors ?? color,
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
            title: (items) => `Damage: ${items[0]?.parsed.x ?? ''}`,
            label: (context) => `${((context.parsed.y ?? 0) * 100).toFixed(3)}%`,
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
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
          max: Math.max(...props.distribution.map((entry) => entry.probability), 0.01) * 1.15,
          ticks: {
            callback: (value) => `${(Number(value) * 100).toFixed(0)}%`,
          },
        },
      },
    },
  }

  chart = new ChartJS(canvas.value, configuration)
}

useChartLifecycle(
  render,
  () => chart?.destroy(),
  [() => props.distribution, () => props.color, () => props.damageRolls],
)
</script>

<template>
  <section class="distribution-chart">
    <h4>{{ title }}</h4>
    <div class="distribution-chart__canvas">
      <canvas ref="canvas"></canvas>
    </div>
  </section>
</template>

<style scoped>
.distribution-chart {
  display: flex;
  flex-direction: column;
}

.distribution-chart h4 {
  margin: 0 0 8px;
  color: #cbd5e1;
  font-size: 0.88rem;
}

.distribution-chart__canvas {
  height: 200px;
  margin-top: auto;
}

@media (max-width: 600px) {
  .distribution-chart__canvas {
    height: 175px;
  }
}
</style>
