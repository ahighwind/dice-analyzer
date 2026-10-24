import { nextTick, onMounted, onUnmounted, watch } from 'vue'
import type { WatchSource } from 'vue'

export function useChartLifecycle(
  render: () => void,
  destroy: () => void,
  sources: WatchSource[],
) {
  watch(sources, () => nextTick(render), { deep: true })
  onMounted(() => nextTick(render))
  onUnmounted(destroy)
}
