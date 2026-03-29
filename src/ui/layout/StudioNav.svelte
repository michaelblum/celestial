<script lang="ts">
  import { getActiveStudio, enterBodyStudio, enterSystemStudio } from '@lib/stores/sceneStore.svelte'
  import { getSelectedId } from '@lib/stores/selectionStore.svelte'
  import { getGraph } from '@lib/stores/sceneStore.svelte'

  let breadcrumb = $derived.by(() => {
    const id = getSelectedId()
    if (!id) return []
    const graph = getGraph()
    const crumbs: { id: string; name: string; type: string }[] = []

    let current = graph.get(id)
    while (current) {
      crumbs.unshift({ id: current.id, name: current.name, type: current.type })
      current = current.parentId ? graph.get(current.parentId) : undefined
    }
    return crumbs
  })

  let studio = $derived(getActiveStudio())
</script>

<div class="glass-panel px-2 py-1 flex items-center gap-0.5 pointer-events-auto">
  {#if breadcrumb.length === 0}
    <span class="nav-label">No selection</span>
  {:else}
    {#each breadcrumb as crumb, i}
      {#if i > 0}
        <span class="text-[10px]" style="color: var(--border-subtle)">></span>
      {/if}
      <button
        onclick={() => enterBodyStudio(crumb.id)}
        class="nav-btn"
        class:active={i === breadcrumb.length - 1 && studio === 'body'}
      >
        {crumb.name}
      </button>
    {/each}

    <!-- System view toggle for entities with children -->
    {#if breadcrumb.length > 0}
      {@const last = breadcrumb[breadcrumb.length - 1]}
      {@const entity = getGraph().get(last.id)}
      {#if entity && entity.childIds.length > 0}
        <span class="text-[10px]" style="color: var(--border-subtle)">></span>
        <button
          onclick={() => enterSystemStudio(last.id)}
          class="nav-btn"
          class:active={studio === 'star-system'}
        >
          System
        </button>
      {/if}
    {/if}
  {/if}
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
  .nav-label {
    font-size: 12px;
    color: var(--icon-default);
    padding: 4px 8px;
  }
</style>
