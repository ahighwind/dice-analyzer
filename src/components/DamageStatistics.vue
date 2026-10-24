<script setup lang="ts">
import type { DamageTypeDistribution, DistributionOutcome } from '../domain/dice/actionTypes'

const props = defineProps<{
  totalDistribution: DistributionOutcome[]
  damageTypes: DamageTypeDistribution[]
}>()

const statisticColumns = [
  { label: 'Mean', kind: 'mean' },
  { label: 'Min', kind: 'min' },
  { label: 'D1', kind: 'quantile', threshold: 0.1 },
  { label: 'Q1', kind: 'quantile', threshold: 0.25 },
  { label: '50%', kind: 'quantile', threshold: 0.5 },
  { label: 'Q3', kind: 'quantile', threshold: 0.75 },
  { label: 'D9', kind: 'quantile', threshold: 0.9 },
  { label: 'Max', kind: 'max' },
] as const

function getStatistics(distribution: DistributionOutcome[]): number[] {
  const sorted = [...distribution].sort((left, right) => left.value - right.value)
  const mean = sorted.reduce(
    (sum, outcome) => sum + outcome.value * outcome.probability,
    0,
  )
  const min = sorted[0]?.value ?? 0
  const max = sorted.at(-1)?.value ?? 0

  return statisticColumns.map((column) => {
    if (column.kind === 'mean') return mean
    if (column.kind === 'min') return min
    if (column.kind === 'max') return max

    let cumulativeProbability = 0
    for (const outcome of sorted) {
      cumulativeProbability += outcome.probability
      if (cumulativeProbability >= column.threshold) return Math.round(outcome.value)
    }
    return Math.round(sorted.at(-1)?.value ?? 0)
  })
}

const rows = () => [
  { type: 'Combined total', color: '#38bdf8', distribution: props.totalDistribution },
  ...props.damageTypes,
]
</script>

<template>
  <section class="damage-statistics" aria-labelledby="damage-statistics-title">
    <h2 id="damage-statistics-title">Combined damage statistics</h2>
    <div class="damage-statistics__table-wrapper">
      <table>
        <thead>
          <tr>
            <th scope="col">Damage type</th>
            <th v-for="column in statisticColumns" :key="column.label" scope="col">
              {{ column.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows()" :key="row.type">
            <th scope="row">
              <span class="damage-statistics__type">
                <span
                  class="damage-statistics__swatch"
                  :style="{ backgroundColor: row.color }"
                  aria-hidden="true"
                ></span>
                <span class="damage-statistics__type-label">{{ row.type }}</span>
              </span>
            </th>
            <td
              v-for="(value, index) in getStatistics(row.distribution)"
              :key="index"
              :data-label="statisticColumns[index].label"
            >
              {{ statisticColumns[index].kind === 'mean' ? value.toFixed(2) : Math.round(value) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.damage-statistics {
  grid-column: 1 / -1;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--panel);
}

.damage-statistics h2 {
  margin: 0 0 10px;
  color: var(--text-strong);
  font-size: 1rem;
}

.damage-statistics__table-wrapper {
  min-width: 0;
}

.damage-statistics table {
  width: 100%;
  table-layout: auto;
  border-collapse: collapse;
  text-align: right;
}

.damage-statistics th,
.damage-statistics td {
  padding: 6px 6px;
  border-bottom: 1px solid var(--border);
}

.damage-statistics thead th {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
}

.damage-statistics thead th:not(:first-child),
.damage-statistics tbody td {
  white-space: nowrap;
}

.damage-statistics tbody th {
  max-width: 10rem;
  color: var(--text-strong);
  font-weight: 600;
  text-align: left;
  overflow-wrap: anywhere;
}

.damage-statistics tbody td {
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.damage-statistics tbody tr:last-child th,
.damage-statistics tbody tr:last-child td {
  border-bottom: 0;
}

.damage-statistics__type {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-width: 0;
  font-size: 0.78rem;
  line-height: 1.25;
}

.damage-statistics__type-label {
  min-width: 0;
  overflow-wrap: anywhere;
}

.damage-statistics__swatch {
  flex: 0 0 10px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

@media (max-width: 720px) {
  .damage-statistics table,
  .damage-statistics tbody {
    display: block;
  }

  .damage-statistics thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    clip-path: inset(50%);
  }

  .damage-statistics tbody tr {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-bottom: 10px;
    border: 1px solid var(--border);
    border-radius: 10px;
  }

  .damage-statistics tbody tr:last-child {
    margin-bottom: 0;
  }

  .damage-statistics tbody th {
    grid-column: 1 / -1;
    border-bottom: 1px solid var(--border);
  }

  .damage-statistics__type {
    font-size: 0.74rem;
  }

  .damage-statistics tbody td {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 2px;
    padding: 6px 7px;
    border-bottom: 0;
    text-align: left;
    white-space: normal;
  }

  .damage-statistics tbody td::before {
    color: var(--muted);
    content: attr(data-label);
    font-size: 0.68rem;
    line-height: 1.2;
  }
}
</style>
