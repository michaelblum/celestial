<script lang="ts">
  import type { Entity, GalaxyComponent } from '@lib/ecs/types'
  import { updateComponent, regenerateEntity } from '@lib/stores/sceneStore.svelte'
  import SliderControl from '@ui/controls/SliderControl.svelte'
  import ColorPickerControl from '@ui/controls/ColorPickerControl.svelte'

  let { entity }: { entity: Entity } = $props()

  let comp = $derived(entity.components['galaxy'] as GalaxyComponent | undefined)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function updateDebounced(field: string, value: number | string) {
    if (!comp) return
    const updated = { ...comp, [field]: value }
    updateComponent(entity.id, updated)

    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      regenerateEntity(entity.id)
    }, 200)
  }
</script>

{#if comp}
  <div class="flex flex-col gap-3">
    <h3 class="section-heading">
      Galaxy
    </h3>

    <SliderControl
      label="Arm Count"
      value={comp.armCount}
      min={2}
      max={6}
      step={1}
      oninput={(v) => updateDebounced('armCount', v)}
    />

    <SliderControl
      label="Twist"
      value={comp.twist}
      min={0.2}
      max={1.0}
      step={0.05}
      oninput={(v) => updateDebounced('twist', v)}
    />

    <SliderControl
      label="Spread"
      value={comp.spread}
      min={1}
      max={5}
      step={0.1}
      oninput={(v) => updateDebounced('spread', v)}
    />

    <SliderControl
      label="Star Count"
      value={comp.starCount}
      min={5000}
      max={50000}
      step={1000}
      oninput={(v) => updateDebounced('starCount', v)}
    />

    <SliderControl
      label="Radius"
      value={comp.radius}
      min={3}
      max={20}
      step={0.5}
      oninput={(v) => updateDebounced('radius', v)}
    />

    <SliderControl
      label="Bulge Size"
      value={comp.bulgeSize}
      min={0}
      max={0.5}
      step={0.01}
      oninput={(v) => updateDebounced('bulgeSize', v)}
    />

    <ColorPickerControl
      label="Inner Color"
      value={comp.innerColor}
      oninput={(v) => updateDebounced('innerColor', v)}
    />

    <ColorPickerControl
      label="Outer Color"
      value={comp.outerColor}
      oninput={(v) => updateDebounced('outerColor', v)}
    />
  </div>
{/if}
