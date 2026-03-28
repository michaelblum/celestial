<script lang="ts">
  let {
    label,
    checked = $bindable(false),
  }: {
    label: string
    checked: boolean
  } = $props()
</script>

<label class="flex items-center justify-between gap-3 cursor-pointer group">
  <span class="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">{label}</span>
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onclick={() => (checked = !checked)}
    class="relative w-9 h-5 rounded-full transition-colors duration-200
           {checked ? 'bg-violet-500' : 'bg-white/15'}"
  >
    <span
      class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
             {checked ? 'translate-x-4' : 'translate-x-0'}"
    ></span>
  </button>
</label>
