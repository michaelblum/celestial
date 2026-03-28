<script lang="ts">
  import type { Entity, StarComponent } from '@lib/ecs/types'
  import { updateComponent, syncComponentToThreeObject, regenerateEntity } from '@lib/stores/sceneStore.svelte'
  import SliderControl from '@ui/controls/SliderControl.svelte'
  import SelectControl from '@ui/controls/SelectControl.svelte'

  let { entity }: { entity: Entity } = $props()

  let comp = $derived(entity.components['star'] as StarComponent | undefined)

  const spectralOptions = [
    { value: 'O', label: 'O — Blue' },
    { value: 'B', label: 'B — Blue-white' },
    { value: 'A', label: 'A — White' },
    { value: 'F', label: 'F — Yellow-white' },
    { value: 'G', label: 'G — Yellow (Sol)' },
    { value: 'K', label: 'K — Orange' },
    { value: 'M', label: 'M — Red' },
  ]

  const variantOptions = [
    { value: 'main-sequence', label: 'Main Sequence' },
    { value: 'red-giant', label: 'Red Giant' },
    { value: 'neutron', label: 'Neutron Star' },
    { value: 'white-dwarf', label: 'White Dwarf' },
    { value: 'black-hole', label: 'Black Hole' },
  ]

  function updateLive(field: string, value: number) {
    if (!comp) return
    const updated = { ...comp, [field]: value }
    updateComponent(entity.id, updated)
    syncComponentToThreeObject(entity.id, 'star')
  }

  function updateRegenerate(field: string, value: string | number) {
    if (!comp) return
    const updated = { ...comp, [field]: value }
    updateComponent(entity.id, updated)
    regenerateEntity(entity.id)
  }
</script>

{#if comp}
  <div class="flex flex-col gap-3">
    <h3 class="text-xs uppercase tracking-wider text-gray-500 font-semibold border-b border-white/5 pb-1">
      Star
    </h3>

    <SelectControl
      label="Spectral Class"
      value={comp.spectralClass}
      options={spectralOptions}
      onchange={(v) => updateRegenerate('spectralClass', v)}
    />

    <SelectControl
      label="Variant"
      value={comp.variant}
      options={variantOptions}
      onchange={(v) => updateRegenerate('variant', v)}
    />

    <SliderControl
      label="Temperature (K)"
      value={comp.temperature}
      min={1000}
      max={40000}
      step={100}
      oninput={(v) => updateLive('temperature', v)}
    />

    <SliderControl
      label="Surface Detail"
      value={comp.surfaceDetail}
      min={1}
      max={8}
      step={0.1}
      oninput={(v) => updateLive('surfaceDetail', v)}
    />

    <SliderControl
      label="Corona Intensity"
      value={comp.coronaIntensity}
      min={0}
      max={2}
      step={0.05}
      oninput={(v) => updateLive('coronaIntensity', v)}
    />

    <SliderControl
      label="Corona Reach"
      value={comp.coronaReach}
      min={0}
      max={3}
      step={0.05}
      oninput={(v) => updateLive('coronaReach', v)}
    />

    <SliderControl
      label="Radius"
      value={comp.radius}
      min={0.2}
      max={5}
      step={0.1}
      oninput={(v) => updateRegenerate('radius', v)}
    />
  </div>
{/if}
