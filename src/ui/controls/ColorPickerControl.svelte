<script lang="ts">
  let {
    label,
    value = $bindable('#ffffff'),
    oninput,
  }: {
    label: string
    value: string
    oninput?: (value: string) => void
  } = $props()
</script>

<div class="flex items-center justify-between gap-2">
  <span class="text-xs text-gray-400">{label}</span>
  <div class="flex items-center gap-2">
    <input
      type="color"
      bind:value
      oninput={() => oninput?.(value)}
      class="w-6 h-6 rounded cursor-pointer bg-transparent border border-white/10 p-0"
    />
    <span class="text-[10px] text-gray-500 font-mono w-16">{value}</span>
  </div>
</div>
