<script lang="ts">
  import type { Entity, OrbitalComponent } from '@lib/ecs/types'
  import { updateComponent, syncComponentToThreeObject } from '@lib/stores/sceneStore.svelte'
  import SliderControl from '@ui/controls/SliderControl.svelte'

  let { entity }: { entity: Entity } = $props()

  let comp = $derived(entity.components['orbital'] as OrbitalComponent | undefined)

  function updateOrbital(field: string, value: number) {
    if (!comp) return
    const updated = { ...comp, [field]: value }
    updateComponent(entity.id, updated)
    syncComponentToThreeObject(entity.id, 'orbital')
  }
</script>

{#if comp}
  <div class="flex flex-col gap-3">
    <h3 class="section-heading">
      Orbit
    </h3>

    <SliderControl
      label="Orbit Radius"
      value={comp.orbitRadius}
      min={1}
      max={50}
      step={0.5}
      oninput={(v) => updateOrbital('orbitRadius', v)}
    />

    <SliderControl
      label="Period"
      value={comp.period}
      min={5}
      max={100}
      step={1}
      oninput={(v) => updateOrbital('period', v)}
    />

    <SliderControl
      label="Inclination"
      value={comp.inclination}
      min={0}
      max={360}
      step={1}
      oninput={(v) => updateOrbital('inclination', v)}
    />

    <SliderControl
      label="Eccentricity"
      value={comp.eccentricity}
      min={0}
      max={0.9}
      step={0.01}
      oninput={(v) => updateOrbital('eccentricity', v)}
    />
  </div>
{/if}
