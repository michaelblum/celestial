<script lang="ts">
  import type { Entity, AlienTechComponent } from '@lib/ecs/types'
  import { updateComponent, syncComponentToThreeObject, regenerateEntity } from '@lib/stores/sceneStore.svelte'
  import SliderControl from '@ui/controls/SliderControl.svelte'
  import SelectControl from '@ui/controls/SelectControl.svelte'
  import ColorPickerControl from '@ui/controls/ColorPickerControl.svelte'

  let { entity }: { entity: Entity } = $props()

  let comp = $derived(entity.components['alien-tech'] as AlienTechComponent | undefined)

  const variantOptions = [
    { value: 'dyson-sphere', label: 'Dyson Sphere' },
    { value: 'halo-construct', label: 'Halo Construct' },
  ]

  function updateLive(field: string, value: number | string) {
    if (!comp) return
    const updated = { ...comp, [field]: value }
    updateComponent(entity.id, updated)
    syncComponentToThreeObject(entity.id, 'alien-tech')
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
      Alien Tech
    </h3>

    <SelectControl
      label="Variant"
      value={comp.variant}
      options={variantOptions}
      onchange={(v) => updateRegenerate('variant', v)}
    />

    <SliderControl
      label="Metalness"
      value={comp.metalness}
      min={0}
      max={1}
      step={0.01}
      oninput={(v) => updateLive('metalness', v)}
    />

    <SliderControl
      label="Roughness"
      value={comp.roughness}
      min={0}
      max={1}
      step={0.01}
      oninput={(v) => updateLive('roughness', v)}
    />

    <ColorPickerControl
      label="Emissive Color"
      value={comp.emissiveColor}
      oninput={(v) => updateLive('emissiveColor', v)}
    />

    <SliderControl
      label="Emissive Intensity"
      value={comp.emissiveIntensity}
      min={0}
      max={3}
      step={0.05}
      oninput={(v) => updateLive('emissiveIntensity', v)}
    />

    <SliderControl
      label="Radius"
      value={comp.radius}
      min={1}
      max={5}
      step={0.1}
      oninput={(v) => updateRegenerate('radius', v)}
    />

    <SliderControl
      label="Detail"
      value={comp.detail}
      min={1}
      max={4}
      step={1}
      oninput={(v) => updateRegenerate('detail', v)}
    />
  </div>
{/if}
