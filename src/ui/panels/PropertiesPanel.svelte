<script lang="ts">
  import { getSelectedId, select } from '@lib/stores/selectionStore.svelte'
  import { getGraph, updateComponent, updateEntityField as storeUpdateEntityField, addEntity, getThreeObject, enterSystemStudio } from '@lib/stores/sceneStore.svelte'
  import { getEngine } from '@lib/stores/engineStore.svelte'
  import type { Entity, EntityType, TransformComponent } from '@lib/ecs/types'
  import { density, gravity, escapeVelocity, formatDerived } from '@lib/physics/PhysicsProperties'
  import { defaultOrbitalConfig, createOrbitPath } from '@lib/generators/OrbitalSystem'
  import { generateRandomPlanet } from '@lib/generators/PlanetFactory'
  import SliderControl from '@ui/controls/SliderControl.svelte'
  import StarPanel from '@ui/panels/StarPanel.svelte'
  import PlanetPanel from '@ui/panels/PlanetPanel.svelte'
  import NebulaPanel from '@ui/panels/NebulaPanel.svelte'
  import GalaxyPanel from '@ui/panels/GalaxyPanel.svelte'
  import AlienTechPanel from '@ui/panels/AlienTechPanel.svelte'
  import OrbitalPanel from '@ui/panels/OrbitalPanel.svelte'

  let selectedEntity = $derived.by(() => {
    const id = getSelectedId()
    if (!id) return null
    return getGraph().get(id) ?? null
  })

  let transform = $derived.by(() => {
    if (!selectedEntity) return null
    return (selectedEntity.components['transform'] as TransformComponent) ?? null
  })

  let derivedProps = $derived.by(() => {
    if (!selectedEntity) return null
    const m = selectedEntity.mass
    const s = selectedEntity.size
    return {
      density: density(m, s),
      gravity: gravity(m, s),
      escapeVelocity: escapeVelocity(m, s),
    }
  })

  function updateTransformField(
    axis: 'position' | 'rotation' | 'scale',
    index: number,
    value: number
  ) {
    if (!selectedEntity || !transform) return
    const updated = { ...transform }
    updated[axis] = [...updated[axis]] as [number, number, number]
    updated[axis][index] = value
    updateComponent(selectedEntity.id, updated)
  }

  function updateEntityField(field: 'mass' | 'size' | 'velocity', value: number) {
    if (!selectedEntity) return
    storeUpdateEntityField(selectedEntity.id, field, value)
  }

  // ─── Contextual Add Menu ───────────────────────────────────────────────────

  const childOptionsMap: Partial<Record<EntityType, { type: EntityType; icon: string; label: string }[]>> = {
    'star': [
      { type: 'planet', icon: '●', label: 'Planet' },
      { type: 'oort-cloud', icon: '◌', label: 'Oort Cloud' },
      { type: 'alien-tech', icon: '◆', label: 'Structure' },
    ],
    'planet': [
      { type: 'moon', icon: '○', label: 'Moon' },
    ],
    'galaxy': [
      { type: 'star', icon: '★', label: 'Star' },
      { type: 'nebula', icon: '☁', label: 'Nebula' },
    ],
  }

  let childOptions = $derived(selectedEntity ? childOptionsMap[selectedEntity.type] ?? [] : [])
  let showAddMenu = $state(false)

  function addChild(type: EntityType) {
    if (!selectedEntity) return
    const parentId = selectedEntity.id

    if (type === 'planet' || type === 'moon') {
      // Count existing orbital children to determine slot
      const existingOrbitalCount = selectedEntity.childIds.filter(id => {
        const child = getGraph().get(id)
        return child?.components['orbital']
      }).length
      const slot = existingOrbitalCount + 1

      // Generate random planet using PlanetFactory
      const { planet, orbital } = generateRandomPlanet(slot, selectedEntity.size)

      const newEntity = addEntity(type, undefined, parentId, {
        transform: { type: 'transform', position: [orbital.orbitRadius, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        orbital,
        planet,
      })

      // Add visible orbit path
      const engine = getEngine()
      if (engine) {
        const path = createOrbitPath(orbital)
        path.userData.orbitFor = newEntity.id
        const parentObj = getThreeObject(parentId)
        if (parentObj) parentObj.add(path)
        else engine.scene.add(path)
      }

      // Star stays selected — pull camera out to System view
      enterSystemStudio(parentId)
    } else {
      addEntity(type, undefined, parentId, {
        transform: { type: 'transform', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      })
    }

    showAddMenu = false
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement
    if (!target.closest('.add-menu-container')) {
      showAddMenu = false
    }
  }
</script>

<svelte:document onclick={handleClickOutside} />

<div class="flex flex-col gap-4 p-3">
  {#if !selectedEntity}
    <p class="text-xs text-gray-600 italic text-center py-8">
      Select an entity to view its properties.
    </p>
  {:else}
    <!-- Entity Info -->
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2">
        <span class="text-xs uppercase tracking-wider font-semibold" style="color: var(--label)">
          {selectedEntity.type}
        </span>
        <div class="flex-1"></div>
        {#if childOptions.length > 0}
          <div class="add-menu-container relative">
            <button
              onclick={(e) => { e.stopPropagation(); showAddMenu = !showAddMenu }}
              class="add-child-btn"
              title="Add child entity"
            >+</button>
            {#if showAddMenu}
              <div class="add-menu">
                {#each childOptions as opt}
                  <button
                    class="add-menu-item"
                    onclick={(e) => { e.stopPropagation(); addChild(opt.type) }}
                  >
                    <span class="add-menu-icon">{opt.icon}</span>
                    {opt.label}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
      <input
        type="text"
        value={selectedEntity.name}
        oninput={(e) => {
          if (selectedEntity) selectedEntity.name = (e.target as HTMLInputElement).value
        }}
        class="rounded-lg px-3 py-1.5 text-sm w-full outline-none"
        style="background: var(--bg-control); border: 1px solid var(--border-control); color: var(--text-primary)"
      />
    </div>

    <!-- Physics -->
    <div class="flex flex-col gap-3">
      <h3 class="section-heading">
        Physics
      </h3>
      <SliderControl
        label="Mass"
        value={selectedEntity.mass}
        min={0.001}
        max={selectedEntity.type === 'star' ? 1000000 : selectedEntity.type === 'galaxy' ? 1e10 : 1000}
        step={selectedEntity.type === 'star' ? 100 : 0.1}
        oninput={(v) => updateEntityField('mass', v)}
      />
      <SliderControl
        label="Size"
        value={selectedEntity.size}
        min={0.01}
        max={selectedEntity.type === 'star' ? 500 : selectedEntity.type === 'galaxy' ? 100 : 20}
        step={0.1}
        oninput={(v) => updateEntityField('size', v)}
      />
      <SliderControl
        label="Velocity"
        value={selectedEntity.velocity}
        min={0}
        max={10}
        step={0.1}
        oninput={(v) => updateEntityField('velocity', v)}
      />
    </div>

    <!-- Derived Properties -->
    {#if derivedProps}
      <div class="flex flex-col gap-2">
        <h3 class="section-heading" style="opacity: 0.6">
          Derived
        </h3>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs" style="color: var(--text-muted)">
          <span>Density</span>
          <span class="font-mono tabular-nums text-right">{formatDerived(derivedProps.density)}</span>
          <span>Gravity</span>
          <span class="font-mono tabular-nums text-right">{formatDerived(derivedProps.gravity)}</span>
          <span>Escape Vel.</span>
          <span class="font-mono tabular-nums text-right">{formatDerived(derivedProps.escapeVelocity)}</span>
        </div>
      </div>
    {/if}

    <!-- Transform -->
    {#if transform}
      <div class="flex flex-col gap-3">
        <h3 class="section-heading">
          Transform
        </h3>

        {#each ['position', 'rotation', 'scale'] as field}
          {@const labels = ['X', 'Y', 'Z']}
          {@const values = transform[field as 'position' | 'rotation' | 'scale']}
          {@const isScale = field === 'scale'}

          <div class="flex flex-col gap-1.5">
            <span class="text-[10px] uppercase tracking-wider" style="color: var(--icon-default)">{field}</span>
            <div class="grid grid-cols-3 gap-2">
              {#each labels as label, i}
                <div class="flex flex-col gap-0.5">
                  <span class="text-[10px]" style="color: var(--text-muted)">{label}</span>
                  <input
                    type="number"
                    value={values[i]}
                    step={isScale ? 0.1 : 0.5}
                    oninput={(e) => {
                      updateTransformField(
                        field as 'position' | 'rotation' | 'scale',
                        i,
                        parseFloat((e.target as HTMLInputElement).value) || 0
                      )
                    }}
                    class="w-full rounded px-2 py-1 text-xs font-mono tabular-nums outline-none"
                    style="background: var(--bg-control); border: 1px solid var(--border-control); color: var(--text-primary)"
                  />
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Type-specific panel -->
    {#if selectedEntity.type === 'star'}
      <StarPanel entity={selectedEntity} />
    {:else if selectedEntity.type === 'planet' || selectedEntity.type === 'moon'}
      <PlanetPanel entity={selectedEntity} />
    {:else if selectedEntity.type === 'nebula'}
      <NebulaPanel entity={selectedEntity} />
    {:else if selectedEntity.type === 'galaxy'}
      <GalaxyPanel entity={selectedEntity} />
    {:else if selectedEntity.type === 'alien-tech'}
      <AlienTechPanel entity={selectedEntity} />
    {/if}

    <!-- Orbital panel (shown for any entity with orbital component) -->
    {#if selectedEntity.components['orbital']}
      <OrbitalPanel entity={selectedEntity} />
    {/if}
  {/if}
</div>

<style>
  .add-child-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-control);
    border: 1px solid var(--border-control);
    border-radius: 6px;
    color: var(--text-muted);
    font-size: 16px;
    font-weight: 300;
    line-height: 1;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .add-child-btn:hover {
    background: var(--accent-hover);
    color: var(--text-primary);
    border-color: var(--accent);
    box-shadow: 0 0 8px var(--accent-glow);
  }

  .add-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    min-width: 140px;
    background: var(--bg-panel);
    border: 1px solid var(--border-control);
    border-radius: 8px;
    padding: 4px;
    z-index: 50;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(20px);
  }

  .add-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    border-radius: 5px;
    transition: all 0.1s ease;
    text-align: left;
  }

  .add-menu-item:hover {
    background: var(--accent-hover);
    color: var(--text-primary);
  }

  .add-menu-icon {
    font-size: 11px;
    opacity: 0.7;
    width: 16px;
    text-align: center;
  }
</style>
