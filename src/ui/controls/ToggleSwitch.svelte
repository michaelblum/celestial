<script lang="ts">
  let {
    label,
    checked = $bindable(false),
    onchange,
  }: {
    label: string
    checked: boolean
    onchange?: (checked: boolean) => void
  } = $props()
</script>

<label class="flex items-center justify-between gap-3 cursor-pointer group">
  <span class="text-xs transition-colors" style="color: var(--label)">{label}</span>
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onclick={() => { checked = !checked; onchange?.(checked) }}
    class="toggle"
    class:active={checked}
  >
    <span class="toggle-thumb" class:on={checked}></span>
  </button>
</label>

<style>
  .toggle {
    position: relative;
    width: 36px;
    height: 20px;
    border-radius: 10px;
    background: var(--bg-control-hover);
    border: 1px solid var(--border-control);
    transition: all 0.2s ease;
    cursor: pointer;
  }
  .toggle.active {
    background: var(--accent);
    border-color: var(--accent);
    box-shadow: 0 0 8px var(--accent-glow);
  }
  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: transform 0.2s ease;
  }
  .toggle-thumb.on {
    transform: translateX(16px);
  }
</style>
