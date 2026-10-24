<script setup lang="ts">
defineProps<{
  dc: number | null
  dcIsEmpty: boolean
  outcomesCount: number
  rollExpression: string
  rollExpressionIsEmpty: boolean
  successChance: number | null
  showingLastValidExpression: boolean
}>()
</script>

<template>
  <div v-if="successChance !== null && dc !== null" class="summary summary--positive">
    <p>
      With <strong>{{ showingLastValidExpression ? 'the last valid expression' : rollExpression }}</strong> and a DC of
      <strong>{{ dc }}</strong>, your success chance is <strong>{{ successChance.toFixed(1) }}%</strong>.
    </p>
  </div>
  <div v-else-if="dcIsEmpty && outcomesCount > 0" class="summary summary--neutral">
    <p>
      Showing the probability distribution for
      <strong>{{ showingLastValidExpression ? 'the last valid expression' : rollExpression }}</strong>,
      without classifying outcomes as success or failure.
    </p>
  </div>
  <div v-else class="summary summary--neutral">
    <p>
      {{ rollExpressionIsEmpty || outcomesCount === 0
        ? 'Enter a valid dice expression and, if desired, a valid DC, for example 2d20+3d8+1.'
        : 'Enter a valid DC or clear the field to view the probability distribution.' }}
    </p>
  </div>
</template>

<style scoped>
.summary {
  margin-top: 0;
  color: #dfe7f3;
  padding: 11px 14px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.65));
}

.summary--positive {
  border-color: rgba(34, 197, 94, 0.5);
  background: linear-gradient(180deg, rgba(34, 197, 94, 0.10), rgba(15, 23, 42, 0.75));
}

.summary--neutral {
  border-color: rgba(148, 163, 184, 0.2);
}

.summary p {
  margin: 0;
  line-height: 1.45;
}

.summary strong {
  color: #f8fafc;
}
</style>
