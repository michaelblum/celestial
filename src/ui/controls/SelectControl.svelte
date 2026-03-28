<script lang="ts">
  let {
    label,
    value = $bindable(''),
    options,
  }: {
    label: string
    value: string
    options: { value: string; label: string }[]
  } = $props()
</script>

<div class="flex flex-col gap-1">
  <span class="text-xs text-gray-400">{label}</span>
  <select
    bind:value
    class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-200
           focus:outline-none focus:border-violet-500/50 cursor-pointer appearance-none
           bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23999%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')]
           bg-no-repeat bg-[position:right_8px_center]"
  >
    {#each options as opt}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  </select>
</div>
