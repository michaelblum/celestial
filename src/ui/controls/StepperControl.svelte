<script lang="ts">
  let {
    label,
    value = $bindable(0),
    min = 0,
    max = 20,
  }: {
    label: string
    value: number
    min?: number
    max?: number
  } = $props()
</script>

<div class="flex items-center justify-between">
  <span class="text-xs text-gray-400">{label}</span>
  <div class="flex items-center gap-1">
    <button
      onclick={() => { if (value > min) value-- }}
      disabled={value <= min}
      class="w-6 h-6 rounded flex items-center justify-center text-sm
             bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed
             transition-colors"
    >-</button>
    <span class="w-8 text-center text-xs font-mono tabular-nums text-gray-200">{value}</span>
    <button
      onclick={() => { if (value < max) value++ }}
      disabled={value >= max}
      class="w-6 h-6 rounded flex items-center justify-center text-sm
             bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed
             transition-colors"
    >+</button>
  </div>
</div>
