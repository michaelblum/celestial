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
      <span class="text-[10px]" style="color: var(--border-subtle)">›</span>
    {/if}
    <button
      onclick={() => setActiveStudio(scale.id)}
      class="nav-btn"
      class:active={isActive}
    >
      <span class="mr-1">{scale.icon}</span>{scale.label}
    </button>
  {/each}
</div>

<style>
  .nav-btn {
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    color: var(--icon-default);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .nav-btn:hover {
    color: var(--text-primary);
    background: var(--accent-hover);
  }
  .nav-btn.active {
    color: var(--text-primary);
    background: var(--accent);
    font-weight: 600;
    box-shadow: 0 0 10px var(--accent-glow);
  }
</style>
