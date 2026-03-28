<script lang="ts">
  import type { Entity, PlanetComponent } from '@lib/ecs/types'
  import { updateComponent, syncComponentToThreeObject, regenerateEntity } from '@lib/stores/sceneStore.svelte'
  import SliderControl from '@ui/controls/SliderControl.svelte'
  import SelectControl from '@ui/controls/SelectControl.svelte'
  import ToggleSwitch from '@ui/controls/ToggleSwitch.svelte'
  import ColorPickerControl from '@ui/controls/ColorPickerControl.svelte'
  import GradientEditor from '@ui/controls/GradientEditor.svelte'
  import type { GradientStop } from '@lib/ecs/types'

  let { entity }: { entity: Entity } = $props()

  let comp = $derived(entity.components['planet'] as PlanetComponent | undefined)

  const variantOptions = [
    { value: 'rocky', label: 'Rocky' },
    { value: 'gas-giant', label: 'Gas Giant' },
    { value: 'ice', label: 'Ice' },
    { value: 'volcanic', label: 'Volcanic' },
  ]

  function updateLive(field: string, value: number | string | boolean) {
    if (!comp) return
    const updated = { ...comp, [field]: value }
    updateComponent(entity.id, updated)
    syncComponentToThreeObject(entity.id, 'planet')
  }

  function updateRegenerate(field: string, value: string | number | boolean) {
    if (!comp) return
    const updated = { ...comp, [field]: value }
    updateComponent(entity.id, updated)
    regenerateEntity(entity.id)
  }

  function updateColorRamp(stops: GradientStop[]) {
    if (!comp) return
    const updated = { ...comp, colorRamp: stops }
    updateComponent(entity.id, updated)
    syncComponentToThreeObject(entity.id, 'planet')
  }
</script>

{#if comp}
  <div class="flex flex-col gap-3">
    <h3 class="text-xs uppercase tracking-wider text-gray-500 font-semibold border-b border-white/5 pb-1">
      Planet
    </h3>

    <SelectControl
      label="Variant"
      value={comp.variant}
      options={variantOptions}
      onchange={(v) => updateRegenerate('variant', v)}
    />

    <GradientEditor
      stops={comp.colorRamp}
      onchange={updateColorRamp}
    />

    <SliderControl
      label="Noise Scale"
      value={comp.noiseScale}
      min={0.5}
      max={8}
      step={0.1}
      oninput={(v) => updateLive('noiseScale', v)}
    />

    <SliderControl
      label="Noise Octaves"
      value={comp.noiseOctaves}
      min={2}
      max={6}
      step={1}
      oninput={(v) => updateLive('noiseOctaves', v)}
    />

    <SliderControl
      label="Roughness"
      value={comp.roughness}
      min={0}
      max={1}
      step={0.01}
      oninput={(v) => updateLive('roughness', v)}
    />

    <SliderControl
      label="Radius"
      value={comp.radius}
      min={0.2}
      max={5}
      step={0.1}
      oninput={(v) => updateRegenerate('radius', v)}
    />

    <!-- Atmosphere Section -->
    <div class="flex flex-col gap-2 pt-1">
      <ToggleSwitch
        label="Atmosphere"
        checked={comp.atmosphereEnabled}
        onchange={(v) => updateRegenerate('atmosphereEnabled', v)}
      />

      {#if comp.atmosphereEnabled}
        <ColorPickerControl
          label="Atmosphere Color"
          value={comp.atmosphereColor}
          oninput={(v) => updateLive('atmosphereColor', v)}
        />

        <SliderControl
          label="Atmosphere Density"
          value={comp.atmosphereDensity}
          min={0}
          max={1}
          step={0.01}
          oninput={(v) => updateLive('atmosphereDensity', v)}
        />
      {/if}
    </div>

    <!-- Ring Section -->
    <div class="flex flex-col gap-2 pt-1">
      <ToggleSwitch
        label="Rings"
        checked={comp.ringEnabled}
        onchange={(v) => updateRegenerate('ringEnabled', v)}
      />

      {#if comp.ringEnabled}
        <SliderControl
          label="Ring Inner Radius"
          value={comp.ringInnerRadius}
          min={1.2}
          max={3}
          step={0.1}
          oninput={(v) => updateRegenerate('ringInnerRadius', v)}
        />

        <SliderControl
          label="Ring Outer Radius"
          value={comp.ringOuterRadius}
          min={2}
          max={4}
          step={0.1}
          oninput={(v) => updateRegenerate('ringOuterRadius', v)}
        />
      {/if}
    </div>
  </div>
{/if}
