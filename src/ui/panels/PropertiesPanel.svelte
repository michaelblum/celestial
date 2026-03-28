<script lang="ts">
  import { getSelectedId } from '@lib/stores/selectionStore.svelte'
  import { getGraph, updateComponent } from '@lib/stores/sceneStore.svelte'
  import type { Entity, TransformComponent } from '@lib/ecs/types'
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

  function updateEntityField(field: 'mass' | 'size', value: number) {
    if (!selectedEntity) return
    selectedEntity[field] = value
  }
</script>

<div class="flex flex-col gap-4 p-3">
  {#if !selectedEntity}
    <p class="text-xs text-gray-600 italic text-center py-8">
      Select an entity to view its properties.
    </p>
  {:else}
    <!-- Entity Info -->
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-2">
        <span class="text-xs uppercase tracking-wider text-violet-400 font-semibold">
          {selectedEntity.type}
        </span>
      </div>
      <input
        type="text"
        value={selectedEntity.name}
        oninput={(e) => {
          if (selectedEntity) selectedEntity.name = (e.target as HTMLInputElement).value
        }}
        class="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-100
               focus:outline-none focus:border-violet-500/50 w-full"
      />
    </div>

    <!-- Mass & Size -->
    <div class="flex flex-col gap-3">
      <h3 class="text-xs uppercase tracking-wider text-gray-500 font-semibold border-b border-white/5 pb-1">
        Physics
      </h3>
      <SliderControl
        label="Mass"
        value={selectedEntity.mass}
        min={0.01}
        max={100}
        step={0.1}
        oninput={(v) => updateEntityField('mass', v)}
      />
      <SliderControl
        label="Size"
        value={selectedEntity.size}
        min={0.01}
        max={100}
        step={0.1}
        oninput={(v) => updateEntityField('size', v)}
      />
    </div>

    <!-- Transform -->
    {#if transform}
      <div class="flex flex-col gap-3">
        <h3 class="text-xs uppercase tracking-wider text-gray-500 font-semibold border-b border-white/5 pb-1">
          Transform
        </h3>

        {#each ['position', 'rotation', 'scale'] as field}
          {@const labels = ['X', 'Y', 'Z']}
          {@const values = transform[field as 'position' | 'rotation' | 'scale']}
          {@const isScale = field === 'scale'}

          <div class="flex flex-col gap-1.5">
            <span class="text-[10px] text-gray-500 uppercase tracking-wider">{field}</span>
            <div class="grid grid-cols-3 gap-2">
              {#each labels as label, i}
                <div class="flex flex-col gap-0.5">
                  <span class="text-[10px] text-gray-600">{label}</span>
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
                    class="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs
                           text-gray-200 font-mono tabular-nums
                           focus:outline-none focus:border-violet-500/50"
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
