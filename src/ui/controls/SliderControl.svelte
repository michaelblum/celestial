<script lang="ts">
  let {
    label,
    value = $bindable(0),
    min = 0,
    max = 1,
    step = 0.01,
    oninput,
  }: {
    label: string
    value: number
    min?: number
    max?: number
    step?: number
    oninput?: (value: number) => void
  } = $props()
</script>

<div class="flex flex-col gap-1">
  <div class="flex justify-between text-xs">
    <span class="text-gray-400">{label}</span>
    <span class="text-gray-300 font-mono tabular-nums">{value.toFixed(step < 1 ? 2 : 0)}</span>
  </div>
  <input
    type="range"
    bind:value
    {min}
    {max}
    {step}
    oninput={() => oninput?.(value)}
    class="w-full h-1.5 rounded-full appearance-none cursor-pointer
           bg-white/10 accent-violet-500
           [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
           [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400
           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer"
  />
</div>
