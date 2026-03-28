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
  <span class="text-xs" style="color: var(--label)">{label}</span>
  <div class="flex items-center gap-2">
    <input
      type="color"
      bind:value
      oninput={() => oninput?.(value)}
      class="color-input"
    />
    <span class="text-[10px] font-mono w-16" style="color: var(--text-muted)">{value}</span>
  </div>
</div>

<style>
  .color-input {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    cursor: pointer;
    background: var(--bg-control);
    border: 1px solid var(--border-control);
    padding: 0;
  }
</style>
