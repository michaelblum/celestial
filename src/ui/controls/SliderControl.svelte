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
    <span style="color: var(--label)">{label}</span>
    <span class="font-mono tabular-nums" style="color: var(--text-muted)">{value.toFixed(step < 1 ? 2 : 0)}</span>
  </div>
  <input
    type="range"
    bind:value
    {min}
    {max}
    {step}
    oninput={() => oninput?.(value)}
    class="slider"
  />
</div>

<style>
  .slider {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    appearance: none;
    cursor: pointer;
    background: var(--bg-control-hover);
    outline: none;
    margin: 6px 0;
  }
  .slider::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
    box-shadow: 0 0 5px var(--accent-glow);
    transition: transform 0.1s ease;
  }
  .slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }
</style>
