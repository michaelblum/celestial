<script lang="ts">
  import type { Entity, EntityType } from '@lib/ecs/types'
  import { getEntities, getGraph, addEntity, removeEntity, duplicateEntity, getThreeObject } from '@lib/stores/sceneStore.svelte'
  import { getSelectedId, select, clearSelection } from '@lib/stores/selectionStore.svelte'
  import { defaultOrbitalConfig, createOrbitPath } from '@lib/generators/OrbitalSystem'
  import { getEngine } from '@lib/stores/engineStore.svelte'

  let roots = $derived(getEntities().filter((e) => e.parentId === null))

  function getChildren(parentId: string): Entity[] {
    return getEntities().filter((e) => e.parentId === parentId)
  }

  const typeIcons: Record<string, string> = {
    star: '★',
    planet: '●',
    moon: '○',
    nebula: '☁',
    galaxy: '🌀',
    'oort-cloud': '◌',
    'alien-tech': '◆',
    placeholder: '◇',
  }

  const addButtons: { type: EntityType; icon: string; label: string }[] = [
    { type: 'star', icon: '★', label: 'Star' },
    { type: 'planet', icon: '●', label: 'Planet' },
    { type: 'nebula', icon: '☁', label: 'Nebula' },
    { type: 'galaxy', icon: '🌀', label: 'Galaxy' },
    { type: 'alien-tech', icon: '◆', label: 'Alien Tech' },
  ]

  function handleAdd(type: EntityType) {
    const selectedId = getSelectedId()
    const selectedEntity = selectedId ? getGraph().get(selectedId) : null

    if (type === 'planet' && selectedEntity?.type === 'star') {
      const orbitRadius = 3 + Math.random() * 5
      const orbital = defaultOrbitalConfig(orbitRadius)

      addEntity(type, undefined, selectedId, {
        transform: { type: 'transform', position: [orbitRadius, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        orbital,
      })

      const engine = getEngine()
      if (engine) {
        const path = createOrbitPath(orbital)
        const parentObj = getThreeObject(selectedId)
        if (parentObj) {
          path.position.copy(parentObj.position)
        }
        engine.scene.add(path)
      }
      return
    }

    const offset = Math.random() * 8 - 4
    addEntity(type, undefined, null, {
      transform: {
        type: 'transform',
        position: [offset, Math.random() * 2 - 1, Math.random() * 4 - 2],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
    })
  }

  function handleDelete(id: string, e: Event) {
    e.stopPropagation()
    removeEntity(id)
    if (getSelectedId() === id) clearSelection()
  }

  function handleDuplicate(id: string, e: Event) {
    e.stopPropagation()
    duplicateEntity(id)
  }
</script>

<div class="flex flex-col gap-2">
  <!-- Add Entity Buttons -->
  <div class="add-row">
    {#each addButtons as btn}
      <button
        onclick={() => handleAdd(btn.type)}
        class="add-btn"
        title="Add {btn.label}"
      >
        {btn.icon}
      </button>
    {/each}
  </div>

  <!-- Entity List -->
  <div class="flex flex-col gap-0.5">
    {#if roots.length === 0}
      <p class="text-xs italic px-2 py-4 text-center" style="color: var(--icon-default)">
        No entities yet. Click an icon above to add one.
      </p>
    {/if}

    {#each roots as entity (entity.id)}
      {@render entityNode(entity, 0)}
    {/each}
  </div>
</div>

{#snippet entityNode(entity: Entity, depth: number)}
  {@const isSelected = getSelectedId() === entity.id}
  {@const children = getChildren(entity.id)}

  <div class="entity-row" class:selected={isSelected}>
    <button
      onclick={() => select(entity.id)}
      class="entity-btn"
      style="padding-left: {12 + depth * 16}px"
    >
      <span class="entity-icon">{typeIcons[entity.type] ?? '◇'}</span>
      <span class="truncate flex-1">{entity.name}</span>
      {#if children.length > 0}
        <span class="child-count">{children.length}</span>
      {/if}
    </button>

    <div class="entity-actions">
      <button
        onclick={(e) => handleDuplicate(entity.id, e)}
        class="action-btn"
        title="Duplicate"
      >⧉</button>
      <button
        onclick={(e) => handleDelete(entity.id, e)}
        class="action-btn delete"
        title="Delete"
      >✕</button>
    </div>
  </div>

  {#each children as child (child.id)}
    {@render entityNode(child, depth + 1)}
  {/each}
{/snippet}

<style>
  .add-row {
    display: flex;
    gap: 4px;
    padding: 0 4px;
  }

  .add-btn {
    flex: 1;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-control);
    border: 1px solid var(--border-control);
    border-radius: 6px;
    color: var(--icon-default);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .add-btn:hover {
    background: var(--accent-hover);
    color: var(--text-primary);
    border-color: var(--accent);
  }

  .entity-row {
    position: relative;
    display: flex;
    align-items: center;
    border-radius: 6px;
    transition: background 0.1s ease;
  }

  .entity-row:hover {
    background: rgba(188, 19, 254, 0.08);
  }

  .entity-row.selected {
    background: var(--accent-hover);
  }

  .entity-btn {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    min-width: 0;
  }

  .entity-row.selected .entity-btn {
    color: var(--label);
  }

  .entity-icon {
    font-size: 11px;
    opacity: 0.6;
  }

  .child-count {
    font-size: 10px;
    color: var(--icon-default);
    opacity: 0.5;
  }

  .entity-actions {
    display: flex;
    gap: 2px;
    padding-right: 4px;
    opacity: 0;
    transition: opacity 0.1s ease;
  }

  .entity-row:hover .entity-actions,
  .entity-row.selected .entity-actions {
    opacity: 1;
  }

  .action-btn {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--icon-default);
    font-size: 11px;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.1s ease;
  }

  .action-btn:hover {
    background: var(--accent-hover);
    color: var(--text-primary);
  }

  .action-btn.delete:hover {
    background: rgba(255, 68, 68, 0.15);
    color: #ff4444;
  }
</style>
