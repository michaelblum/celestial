<script lang="ts">
  import type { Entity, NebulaComponent } from '@lib/ecs/types'
  import { updateComponent, syncComponentToThreeObject, regenerateEntity } from '@lib/stores/sceneStore.svelte'
  import SliderControl from '@ui/controls/SliderControl.svelte'
  import SelectControl from '@ui/controls/SelectControl.svelte'
  import ColorPickerControl from '@ui/controls/ColorPickerControl.svelte'

  let { entity }: { entity: Entity } = $props()

  let comp = $derived(entity.components['nebula'] as NebulaComponent | undefined)

  const methodOptions = [
    { value: 'sprites', label: 'Sprites' },
    { value: 'volumetric', label: 'Volumetric' },
    { value: 'particles', label: 'GPU Particles' },
  ]

  const styleOptions = [
    { value: 'nebula', label: 'Nebula' },
    { value: 'smoke', label: 'Smoke' },
    { value: 'fire', label: 'Fire' },
    { value: 'plasma', label: 'Plasma' },
  ]

  function updateLive(field: string, value: number | string) {
    if (!comp) return
    const updated = { ...comp, [field]: value }
    updateComponent(entity.id, updated)
    syncComponentToThreeObject(entity.id, 'nebula')
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
      Nebula
    </h3>

    <SelectControl
      label="Method"
      value={comp.method}
      options={methodOptions}
      onchange={(v) => updateRegenerate('method', v)}
    />

    <SelectControl
      label="Style"
      value={comp.style}
      options={styleOptions}
      onchange={(v) => updateRegenerate('style', v)}
    />

    <ColorPickerControl
      label="Primary Color"
      value={comp.colorPrimary}
      oninput={(v) => updateLive('colorPrimary', v)}
    />

    <ColorPickerControl
      label="Secondary Color"
      value={comp.colorSecondary}
      oninput={(v) => updateLive('colorSecondary', v)}
    />

    <SliderControl
      label="Density"
      value={comp.density}
      min={0}
      max={2}
      step={0.05}
      oninput={(v) => updateLive('density', v)}
    />

    <SliderControl
      label="Scale"
      value={comp.scale}
      min={0.5}
      max={10}
      step={0.1}
      oninput={(v) => updateRegenerate('scale', v)}
    />

    <ColorPickerControl
      label="Light Color"
      value={comp.lightColor}
      oninput={(v) => updateLive('lightColor', v)}
    />

    <SliderControl
      label="Light Intensity"
      value={comp.lightIntensity}
      min={0}
      max={5}
      step={0.1}
      oninput={(v) => updateLive('lightIntensity', v)}
    />

    <SliderControl
      label="Particle Count"
      value={comp.particleCount}
      min={5000}
      max={40000}
      step={1000}
      oninput={(v) => updateRegenerate('particleCount', v)}
    />
  </div>
{/if}
