<script lang="ts">
  import type { StudioScale } from '@lib/ecs/types'
  import { getActiveStudio, setActiveStudio } from '@lib/stores/sceneStore.svelte'

  const scales: { id: StudioScale; label: string; icon: string }[] = [
    { id: 'body', label: 'Body', icon: '◉' },
    { id: 'star-system', label: 'System', icon: '☉' },
    { id: 'galaxy', label: 'Galaxy', icon: '🌀' },
    { id: 'cluster', label: 'Cluster', icon: '✧' },
    { id: 'universe', label: 'Universe', icon: '∞' },
  ]
</script>

<div class="glass-panel px-2 py-1 flex items-center gap-0.5 pointer-events-auto">
  {#each scales as scale, i}
    {@const isActive = getActiveStudio() === scale.id}
    {#if i > 0}
      <span class="text-gray-700 text-[10px]">›</span>
    {/if}
    <button
      onclick={() => setActiveStudio(scale.id)}
      class="px-2 py-1 rounded-md text-xs transition-colors
             {isActive
               ? 'bg-violet-500/20 text-violet-300 font-semibold'
               : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}"
    >
      <span class="mr-1">{scale.icon}</span>{scale.label}
    </button>
  {/each}
</div>
