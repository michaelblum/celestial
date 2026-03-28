<script lang="ts">
  import type { Entity } from '@lib/ecs/types'
  import { getEntities, getGraph, removeEntity, duplicateEntity } from '@lib/stores/sceneStore.svelte'
  import { getSelectedId, select } from '@lib/stores/selectionStore.svelte'

  // Get root entities (no parent)
  let roots = $derived(getEntities().filter((e) => e.parentId === null))

  function getChildren(parentId: string): Entity[] {
    return getEntities().filter((e) => e.parentId === parentId)
  }

  const typeIcons: Record<string, string> = {
    star: '★',
    planet: '●',
    moon: '○',
    nebula: '☁',
    'oort-cloud': '◌',
    'alien-tech': '◆',
    placeholder: '◇',
  }
</script>

<div class="flex flex-col gap-0.5">
  {#if roots.length === 0}
    <p class="text-xs text-gray-600 italic px-2 py-4 text-center">
      No entities yet. Add one from the toolbar.
    </p>
  {/if}

  {#each roots as entity (entity.id)}
    {@render entityNode(entity, 0)}
  {/each}
</div>

{#snippet entityNode(entity: Entity, depth: number)}
  {@const isSelected = getSelectedId() === entity.id}
  {@const children = getChildren(entity.id)}

  <button
    onclick={() => select(entity.id)}
    oncontextmenu={(e) => {
      e.preventDefault()
      // Simple context: delete on right-click for now
    }}
    class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors
           {isSelected ? 'bg-violet-500/20 text-violet-300' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}"
    style="padding-left: {12 + depth * 16}px"
  >
    <span class="text-[11px] opacity-60">{typeIcons[entity.type] ?? '◇'}</span>
    <span class="truncate flex-1">{entity.name}</span>
    {#if children.length > 0}
      <span class="text-[10px] text-gray-600">{children.length}</span>
    {/if}
  </button>

  {#each children as child (child.id)}
    {@render entityNode(child, depth + 1)}
  {/each}
{/snippet}
