<script lang="ts">
  import type { EntityType } from '@lib/ecs/types'
  import { addEntity, removeEntity, duplicateEntity, saveScene, loadScene, clearScene, getSceneName, setSceneName, getGraph, getThreeObject } from '@lib/stores/sceneStore.svelte'
  import { getSelectedId, clearSelection } from '@lib/stores/selectionStore.svelte'
  import { defaultOrbitalConfig } from '@lib/generators/OrbitalSystem'
  import { createOrbitPath } from '@lib/generators/OrbitalSystem'
  import { getEngine } from '@lib/stores/engineStore.svelte'

  let fileInput: HTMLInputElement

  const entityTypes: { type: EntityType; icon: string; label: string }[] = [
    { type: 'star', icon: '★', label: 'Star' },
    { type: 'planet', icon: '●', label: 'Planet' },
    { type: 'nebula', icon: '☁', label: 'Nebula' },
    { type: 'galaxy', icon: '🌀', label: 'Galaxy' },
    { type: 'alien-tech', icon: '◆', label: 'Alien Tech' },
  ]

  function handleAdd(type: EntityType) {
    const selectedId = getSelectedId()
    const selectedEntity = selectedId ? getGraph().get(selectedId) : null

    // If a star is selected and we're adding a planet, make it a child with orbital component
    if (type === 'planet' && selectedEntity?.type === 'star') {
      const orbitRadius = 3 + Math.random() * 5
      const orbital = defaultOrbitalConfig(orbitRadius)

      const planet = addEntity(type, undefined, selectedId, {
        transform: { type: 'transform', position: [orbitRadius, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        orbital,
      })

      // Add visible orbit path to the scene
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

    // Default: spread entities apart at root level
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

  function handleDelete() {
    const id = getSelectedId()
    if (id) {
      removeEntity(id)
      clearSelection()
    }
  }

  function handleDuplicate() {
    const id = getSelectedId()
    if (id) duplicateEntity(id)
  }

  async function handleLoad() {
    fileInput?.click()
  }

  async function onFileSelected(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      try {
        await loadScene(file)
      } catch (err) {
        console.error('Failed to load scene:', err)
      }
    }
  }
</script>

<input
  bind:this={fileInput}
  type="file"
  accept=".json,.celestial.json"
  class="hidden"
  onchange={onFileSelected}
/>

<div class="flex items-center gap-3 pointer-events-auto">
  <!-- Scene Name -->
  <div class="glass-panel px-4 py-2 flex items-center gap-3">
    <h1 class="text-sm font-semibold text-gray-100 tracking-wide">Celestial</h1>
    <span class="text-gray-600">|</span>
    <input
      type="text"
      value={getSceneName()}
      oninput={(e) => setSceneName((e.target as HTMLInputElement).value)}
      class="bg-transparent text-xs text-gray-400 border-none outline-none w-28
             focus:text-gray-200 placeholder-gray-600"
      placeholder="Scene name..."
    />
  </div>

  <!-- Add Entity Buttons -->
  <div class="glass-panel px-2 py-1.5 flex items-center gap-1">
    {#each entityTypes as et}
      <button
        onclick={() => handleAdd(et.type)}
        class="px-2.5 py-1 rounded-md text-xs text-gray-400 hover:text-gray-100
               hover:bg-white/10 transition-colors flex items-center gap-1.5"
        title="Add {et.label}"
      >
        <span class="text-sm">{et.icon}</span>
        <span class="hidden sm:inline">{et.label}</span>
      </button>
    {/each}
  </div>

  <!-- Actions -->
  <div class="glass-panel px-2 py-1.5 flex items-center gap-1">
    <button
      onclick={handleDuplicate}
      disabled={!getSelectedId()}
      class="px-2 py-1 rounded-md text-xs text-gray-400 hover:text-gray-100
             hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      title="Duplicate selected"
    >⧉</button>
    <button
      onclick={handleDelete}
      disabled={!getSelectedId()}
      class="px-2 py-1 rounded-md text-xs text-red-400/70 hover:text-red-300
             hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      title="Delete selected"
    >✕</button>
    <span class="w-px h-4 bg-white/10 mx-1"></span>
    <button
      onclick={saveScene}
      class="px-2 py-1 rounded-md text-xs text-gray-400 hover:text-gray-100
             hover:bg-white/10 transition-colors"
      title="Save scene"
    >💾</button>
    <button
      onclick={handleLoad}
      class="px-2 py-1 rounded-md text-xs text-gray-400 hover:text-gray-100
             hover:bg-white/10 transition-colors"
      title="Load scene"
    >📂</button>
  </div>
</div>
