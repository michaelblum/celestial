<script lang="ts">
  let {
    label,
    value = $bindable(''),
    options,
    onchange,
  }: {
    label: string
    value: string
    options: { value: string; label: string }[]
    onchange?: (value: string) => void
  } = $props()
</script>

<div class="flex flex-col gap-1">
  <span class="text-xs" style="color: var(--label)">{label}</span>
  <select
    bind:value
    onchange={() => onchange?.(value)}
    class="select-control"
  >
    {#each options as opt}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  </select>
</div>

<style>
  .select-control {
    width: 100%;
    background: var(--bg-control);
    border: 1px solid var(--border-control);
    color: var(--text-primary);
    padding: 8px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    appearance: none;
    outline: none;
    background-image: url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23a060d0%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E');
    background-repeat: no-repeat;
    background-position: right 8px center;
  }
  .select-control:focus {
    border-color: var(--accent);
    box-shadow: 0 0 5px var(--accent-glow);
  }
</style>
