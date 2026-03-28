<script lang="ts">
  import type { Entity, OrbitalComponent } from '@lib/ecs/types'
  import { updateComponent, syncComponentToThreeObject, getGraph } from '@lib/stores/sceneStore.svelte'
  import { orbitalPeriod, formatDerived } from '@lib/physics/PhysicsProperties'
  import SliderControl from '@ui/controls/SliderControl.svelte'

  let { entity }: { entity: Entity } = $props()

  let comp = $derived(entity.components['orbital'] as OrbitalComponent | undefined)

  let derivedPeriod = $derived.by(() => {
    if (!comp || !entity.parentId) return comp?.period ?? 0
    const parent = getGraph().get(entity.parentId)
    if (!parent) return comp?.period ?? 0
    return orbitalPeriod(parent.mass, comp.orbitRadius)
  })

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

    <div class="flex flex-col gap-1">
      <div class="flex justify-between text-xs">
        <span style="color: var(--label)">Period</span>
        <span class="font-mono tabular-nums" style="color: var(--text-muted)">{formatDerived(derivedPeriod)}</span>
      </div>
      <div class="text-[10px]" style="color: var(--text-muted); opacity: 0.6">
        Derived from parent mass + orbit radius
      </div>
    </div>

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
