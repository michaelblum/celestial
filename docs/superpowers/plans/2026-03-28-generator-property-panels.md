# Generator Property Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire UI controls to Three.js shader uniforms so users can tweak entity appearance in real-time via per-type property panels.

**Architecture:** Per-entity-type Svelte panel components (StarPanel, PlanetPanel, etc.) call `updateComponent()` to update ECS state, then `syncComponentToThreeObject()` to patch live Three.js uniforms or regenerate meshes. A `ColorPickerControl` is added to the control library. Galaxy entities get a proper `GalaxyComponent` in the ECS.

**Tech Stack:** Svelte 5 (runes, `$bindable`, `$derived`), Three.js ShaderMaterial uniforms, TypeScript

---

### Task 1: Add `mass` and `size` to Entity type + GalaxyComponent to ECS

**Files:**
- Modify: `src/lib/ecs/types.ts`

- [ ] **Step 1: Add `mass` and `size` fields to Entity interface and add GalaxyComponent**

In `src/lib/ecs/types.ts`, add `mass` and `size` to the `Entity` interface, create a `GalaxyComponent`, and add it to the `Component` union:

```typescript
// In the Entity interface, add after childIds:
export interface Entity {
  id: string
  name: string
  type: EntityType
  parentId: string | null
  childIds: string[]
  mass: number
  size: number
  components: Record<string, Component>
}

// Add new GalaxyComponent after OortCloudComponent:
export interface GalaxyComponent {
  type: 'galaxy'
  armCount: number
  twist: number
  spread: number
  starCount: number
  radius: number
  bulgeSize: number
  innerColor: string
  outerColor: string
}

// Update Component union to include GalaxyComponent:
export type Component =
  | TransformComponent
  | StarComponent
  | PlanetComponent
  | NebulaComponent
  | OrbitalComponent
  | ImpostorComponent
  | AlienTechComponent
  | OortCloudComponent
  | GalaxyComponent
```

- [ ] **Step 2: Run the dev server to verify no type errors**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expected: Type errors in `SceneGraph.ts` and `sceneStore.svelte.ts` where `Entity` objects are created without `mass`/`size`. These will be fixed in Task 2.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ecs/types.ts
git commit -m "feat: add mass/size to Entity, add GalaxyComponent type"
```

---

### Task 2: Update SceneGraph + sceneStore to handle new Entity fields and GalaxyComponent

**Files:**
- Modify: `src/lib/ecs/SceneGraph.ts`
- Modify: `src/lib/stores/sceneStore.svelte.ts`
- Modify: `src/lib/generators/PlanetGenerator.ts` (export `createColorRampTexture`)
- Modify: `src/lib/generators/GalaxyGenerator.ts` (accept `GalaxyComponent`)

- [ ] **Step 1: Update SceneGraph.createEntity to include mass and size defaults**

In `src/lib/ecs/SceneGraph.ts`, find the `createEntity` method where it constructs the `Entity` object and add `mass: 1.0` and `size: 1.0` as defaults:

```typescript
const entity: Entity = {
  id: crypto.randomUUID(),
  name: name ?? `${type}-${this.entities.size}`,
  type,
  parentId: parentId ?? null,
  childIds: [],
  mass: 1.0,
  size: 1.0,
  components: {
    transform: defaultTransform,
    ...components,
  },
}
```

- [ ] **Step 2: Update sceneStore galaxy builder to store GalaxyComponent**

In `src/lib/stores/sceneStore.svelte.ts`, update the galaxy section of `buildThreeObject()`. Add imports for `GalaxyComponent` and change the builder to store the config as a component:

```typescript
// Add to imports at top:
import type { AlienTechComponent, OrbitalComponent, GalaxyComponent } from '@lib/ecs/types'

// Replace the galaxy section in buildThreeObject():
if (type === 'galaxy') {
  const galaxyComp = (entity.components['galaxy'] as GalaxyComponent) ?? {
    type: 'galaxy' as const,
    ...defaultGalaxyConfig(),
  }
  if (!entity.components['galaxy']) entity.components['galaxy'] = galaxyComp
  const group = generateGalaxy(galaxyComp)
  group.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Points) child.userData.entityId = entity.id
  })
  return group
}
```

Note: `generateGalaxy` accepts `GalaxyConfig` which has the same data shape as `GalaxyComponent` minus the `type` field. TypeScript structural typing means `GalaxyComponent` (which has all the same fields plus `type`) is assignable to `GalaxyConfig`. No changes needed to `generateGalaxy`.

- [ ] **Step 3: Export `createColorRampTexture` from PlanetGenerator**

In `src/lib/generators/PlanetGenerator.ts`, change line 10 from:

```typescript
function createColorRampTexture(stops: GradientStop[]): THREE.DataTexture {
```

to:

```typescript
export function createColorRampTexture(stops: GradientStop[]): THREE.DataTexture {
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expected: Clean (no errors) or only unrelated warnings.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ecs/SceneGraph.ts src/lib/stores/sceneStore.svelte.ts src/lib/generators/PlanetGenerator.ts
git commit -m "feat: wire GalaxyComponent into ECS, export createColorRampTexture, add mass/size defaults"
```

---

### Task 3: Add `syncComponentToThreeObject()` to sceneStore

**Files:**
- Modify: `src/lib/stores/sceneStore.svelte.ts`

This is the core bridge function. It reads the updated ECS component and patches the live Three.js object's uniforms/materials, or regenerates the mesh if needed.

- [ ] **Step 1: Add the sync function**

In `src/lib/stores/sceneStore.svelte.ts`, add imports and the function after the existing `updateComponent` function (after line 183):

```typescript
import { createColorRampTexture } from '@lib/generators/PlanetGenerator'
import { createOrbitPath } from '@lib/generators/OrbitalSystem'
```

Add the function:

```typescript
/** Sync an ECS component change to the live Three.js object */
export function syncComponentToThreeObject(entityId: string, componentType: string): void {
  const entity = graph.get(entityId)
  if (!entity) return
  const obj = threeObjects.get(entityId)
  if (!obj) return

  // Helper: find all ShaderMaterials in the group
  const findShaderMaterials = (): THREE.ShaderMaterial[] => {
    const mats: THREE.ShaderMaterial[] = []
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.ShaderMaterial) {
        mats.push(child.material)
      }
    })
    return mats
  }

  // Helper: find all MeshStandardMaterials in the group
  const findStandardMaterials = (): THREE.MeshStandardMaterial[] => {
    const mats: THREE.MeshStandardMaterial[] = []
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        mats.push(child.material)
      }
    })
    return mats
  }

  // Helper: regenerate the entire Three.js object
  const regenerate = () => {
    // Unregister from LOD
    if (lodManager) lodManager.unregister(entityId)

    // Dispose old object
    obj.removeFromParent()
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose())
        } else {
          child.material.dispose()
        }
      }
    })

    // Build fresh
    const newObj = buildThreeObject(entity)
    newObj.name = entityId

    // Apply transform
    const t = entity.components['transform']
    if (t && t.type === 'transform') {
      newObj.position.set(...t.position)
      newObj.rotation.set(...t.rotation)
      newObj.scale.set(...t.scale)
    }

    // Add to parent or scene
    const engine = getEngine()
    if (entity.parentId) {
      const parentObj = threeObjects.get(entity.parentId)
      if (parentObj) parentObj.add(newObj)
      else engine?.scene.add(newObj)
    } else {
      engine?.scene.add(newObj)
    }

    threeObjects.set(entityId, newObj)

    // Re-register with LOD
    if (lodManager) lodManager.register(entityId, newObj, true)
  }

  // ── Star live updates ──
  if (componentType === 'star') {
    const comp = entity.components['star'] as StarComponent | undefined
    if (!comp) return
    const shaderMats = findShaderMaterials()
    // Check if regeneration needed (spectralClass or variant changed means geometry differs)
    // We detect this by checking if the current mesh structure matches - but simpler:
    // just always do live patching for numeric uniforms; the panel calls regenerate explicitly
    // for variant/spectralClass changes by calling with a special flag.
    for (const mat of shaderMats) {
      if (mat.uniforms['temperature']) mat.uniforms['temperature'].value = comp.temperature
      if (mat.uniforms['surfaceDetail']) mat.uniforms['surfaceDetail'].value = comp.surfaceDetail
      if (mat.uniforms['intensity']) mat.uniforms['intensity'].value = comp.coronaIntensity
      if (mat.uniforms['reach']) mat.uniforms['reach'].value = comp.coronaReach
    }
    return
  }

  // ── Planet live updates ──
  if (componentType === 'planet') {
    const comp = entity.components['planet'] as PlanetComponent | undefined
    if (!comp) return
    const shaderMats = findShaderMaterials()
    for (const mat of shaderMats) {
      if (mat.uniforms['noiseScale']) mat.uniforms['noiseScale'].value = comp.noiseScale
      if (mat.uniforms['noiseOctaves']) mat.uniforms['noiseOctaves'].value = comp.noiseOctaves
      if (mat.uniforms['roughness']) mat.uniforms['roughness'].value = comp.roughness
      if (mat.uniforms['colorRamp']) {
        const oldTexture = mat.uniforms['colorRamp'].value as THREE.DataTexture
        oldTexture?.dispose()
        mat.uniforms['colorRamp'].value = createColorRampTexture(comp.colorRamp)
      }
      // Atmosphere uniforms
      if (mat.uniforms['atmosphereColor']) {
        mat.uniforms['atmosphereColor'].value = new THREE.Color(comp.atmosphereColor)
      }
      if (mat.uniforms['density']) mat.uniforms['density'].value = comp.atmosphereDensity
    }
    return
  }

  // ── Nebula live updates ──
  if (componentType === 'nebula') {
    const comp = entity.components['nebula'] as NebulaComponent | undefined
    if (!comp) return
    const shaderMats = findShaderMaterials()
    for (const mat of shaderMats) {
      if (mat.uniforms['color1']) mat.uniforms['color1'].value = new THREE.Color(comp.colorPrimary)
      if (mat.uniforms['color2']) mat.uniforms['color2'].value = new THREE.Color(comp.colorSecondary)
      if (mat.uniforms['opacity']) mat.uniforms['opacity'].value = comp.density
      if (mat.uniforms['lightColor']) mat.uniforms['lightColor'].value = new THREE.Color(comp.lightColor)
      if (mat.uniforms['lightIntensity']) mat.uniforms['lightIntensity'].value = comp.lightIntensity
    }
    return
  }

  // ── Alien Tech live updates ──
  if (componentType === 'alien-tech') {
    const comp = entity.components['alien-tech'] as AlienTechComponent | undefined
    if (!comp) return
    const stdMats = findStandardMaterials()
    for (const mat of stdMats) {
      mat.metalness = comp.metalness
      mat.roughness = comp.roughness
      mat.emissive = new THREE.Color(comp.emissiveColor)
      mat.emissiveIntensity = comp.emissiveIntensity
    }
    return
  }

  // ── Orbital live updates ──
  if (componentType === 'orbital') {
    const comp = entity.components['orbital'] as OrbitalComponent | undefined
    if (!comp) return
    // Find and replace the orbit path line in the parent or scene
    const engine = getEngine()
    if (!engine) return
    const parent = entity.parentId ? threeObjects.get(entity.parentId) : engine.scene
    if (!parent) return
    // Remove old orbit path (tagged with userData.orbitFor)
    const toRemove: THREE.Object3D[] = []
    parent.traverse((child) => {
      if (child instanceof THREE.Line && child.userData.orbitFor === entityId) {
        toRemove.push(child)
      }
    })
    toRemove.forEach((child) => {
      child.removeFromParent()
      if (child instanceof THREE.Line) {
        child.geometry.dispose()
        ;(child.material as THREE.Material).dispose()
      }
    })
    // Create new path
    const path = createOrbitPath(comp)
    path.userData.orbitFor = entityId
    if (entity.parentId) {
      const parentObj = threeObjects.get(entity.parentId)
      if (parentObj) parentObj.add(path)
      else engine.scene.add(path)
    } else {
      engine.scene.add(path)
    }
    return
  }

  // ── Galaxy / any component needing full regeneration ──
  if (componentType === 'galaxy') {
    regenerate()
    return
  }
}

/** Regenerate the Three.js object for an entity (full rebuild) */
export function regenerateEntity(entityId: string): void {
  const entity = graph.get(entityId)
  if (!entity) return
  const obj = threeObjects.get(entityId)
  if (!obj) return

  // Unregister from LOD
  if (lodManager) lodManager.unregister(entityId)

  // Dispose old object
  obj.removeFromParent()
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
      child.geometry.dispose()
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose())
      } else {
        child.material.dispose()
      }
    }
  })

  // Build fresh
  const newObj = buildThreeObject(entity)
  newObj.name = entityId

  // Apply transform
  const t = entity.components['transform']
  if (t && t.type === 'transform') {
    newObj.position.set(...t.position)
    newObj.rotation.set(...t.rotation)
    newObj.scale.set(...t.scale)
  }

  // Add to parent or scene
  const engine = getEngine()
  if (entity.parentId) {
    const parentObj = threeObjects.get(entity.parentId)
    if (parentObj) parentObj.add(newObj)
    else engine?.scene.add(newObj)
  } else {
    engine?.scene.add(newObj)
  }

  threeObjects.set(entityId, newObj)

  // Re-register with LOD
  if (lodManager) lodManager.register(entityId, newObj, true)
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expected: Clean or only unrelated warnings.

- [ ] **Step 3: Start dev server and verify existing functionality still works**

Run: `npm run dev`
Test: Open browser, add a star, add a planet, verify they render. Select entities and confirm the properties panel still shows transform controls.

- [ ] **Step 4: Commit**

```bash
git add src/lib/stores/sceneStore.svelte.ts
git commit -m "feat: add syncComponentToThreeObject and regenerateEntity to sceneStore"
```

---

### Task 4: Create ColorPickerControl

**Files:**
- Create: `src/ui/controls/ColorPickerControl.svelte`

- [ ] **Step 1: Create the component**

Create `src/ui/controls/ColorPickerControl.svelte`:

```svelte
<script lang="ts">
  let {
    label,
    value = $bindable('#ffffff'),
    oninput,
  }: {
    label: string
    value: string
    oninput?: (value: string) => void
  } = $props()
</script>

<div class="flex items-center justify-between gap-2">
  <span class="text-xs text-gray-400">{label}</span>
  <div class="flex items-center gap-2">
    <input
      type="color"
      bind:value
      oninput={() => oninput?.(value)}
      class="w-6 h-6 rounded cursor-pointer bg-transparent border border-white/10 p-0"
    />
    <span class="text-[10px] text-gray-500 font-mono w-16">{value}</span>
  </div>
</div>
```

- [ ] **Step 2: Verify it renders**

Start dev server if not running. We'll verify this component works when we use it in panels. For now, just check no syntax errors:

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/controls/ColorPickerControl.svelte
git commit -m "feat: add ColorPickerControl component"
```

---

### Task 5: Create StarPanel

**Files:**
- Create: `src/ui/panels/StarPanel.svelte`

- [ ] **Step 1: Create the StarPanel component**

Create `src/ui/panels/StarPanel.svelte`:

```svelte
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
```

**Important**: The existing `SliderControl` and `SelectControl` use `$bindable` for two-way binding, but we need `onchange`/`oninput` callbacks to trigger sync. We need to modify the controls to support callback props. See Task 5b.

- [ ] **Step 2: Commit**

```bash
git add src/ui/panels/StarPanel.svelte
git commit -m "feat: add StarPanel component"
```

---

### Task 5b: Add callback props to SliderControl and SelectControl

**Files:**
- Modify: `src/ui/controls/SliderControl.svelte`
- Modify: `src/ui/controls/SelectControl.svelte`

The existing controls use `bind:value` with `$bindable`. The panels need to know when a value changes to trigger sync. Add optional `oninput`/`onchange` callback props that fire after the value updates.

- [ ] **Step 1: Update SliderControl to fire oninput callback**

In `src/ui/controls/SliderControl.svelte`, add an `oninput` callback prop and fire it on input:

```svelte
<script lang="ts">
  let {
    label,
    value = $bindable(0),
    min = 0,
    max = 1,
    step = 0.01,
    oninput,
  }: {
    label: string
    value: number
    min?: number
    max?: number
    step?: number
    oninput?: (value: number) => void
  } = $props()
</script>

<div class="flex flex-col gap-1">
  <div class="flex justify-between text-xs">
    <span class="text-gray-400">{label}</span>
    <span class="text-gray-300 font-mono tabular-nums">{value.toFixed(step < 1 ? 2 : 0)}</span>
  </div>
  <input
    type="range"
    bind:value
    {min}
    {max}
    {step}
    oninput={() => oninput?.(value)}
    class="w-full h-1.5 rounded-full appearance-none cursor-pointer
           bg-white/10 accent-violet-500
           [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
           [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400
           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer"
  />
</div>
```

- [ ] **Step 2: Update SelectControl to fire onchange callback**

In `src/ui/controls/SelectControl.svelte`, add an `onchange` callback prop:

```svelte
<script lang="ts">
  let {
    label,
    value = $bindable(''),
    options,
    onchange,
  }: {
    label: string
    value: string
    options: { value: string; label: string }[]
    onchange?: (value: string) => void
  } = $props()
</script>

<div class="flex flex-col gap-1">
  <span class="text-xs text-gray-400">{label}</span>
  <select
    bind:value
    onchange={() => onchange?.(value)}
    class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-200
           focus:outline-none focus:border-violet-500/50 cursor-pointer appearance-none
           bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23999%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')]
           bg-no-repeat bg-[position:right_8px_center]"
  >
    {#each options as opt}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  </select>
</div>
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Clean — the new props are optional, so existing usages in PropertiesPanel still work.

- [ ] **Step 4: Commit**

```bash
git add src/ui/controls/SliderControl.svelte src/ui/controls/SelectControl.svelte
git commit -m "feat: add oninput/onchange callback props to SliderControl and SelectControl"
```

---

### Task 6: Create PlanetPanel

**Files:**
- Create: `src/ui/panels/PlanetPanel.svelte`

- [ ] **Step 1: Create the PlanetPanel component**

Create `src/ui/panels/PlanetPanel.svelte`:

```svelte
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
```

- [ ] **Step 2: Add onchange callback to ToggleSwitch**

In `src/ui/controls/ToggleSwitch.svelte`, add an `onchange` callback prop:

```svelte
<script lang="ts">
  let {
    label,
    checked = $bindable(false),
    onchange,
  }: {
    label: string
    checked: boolean
    onchange?: (checked: boolean) => void
  } = $props()
</script>

<label class="flex items-center justify-between gap-3 cursor-pointer group">
  <span class="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">{label}</span>
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onclick={() => { checked = !checked; onchange?.(checked) }}
    class="relative w-9 h-5 rounded-full transition-colors duration-200
           {checked ? 'bg-violet-500' : 'bg-white/15'}"
  >
    <span
      class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
             {checked ? 'translate-x-4' : 'translate-x-0'}"
    ></span>
  </button>
</label>
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/panels/PlanetPanel.svelte src/ui/controls/ToggleSwitch.svelte
git commit -m "feat: add PlanetPanel with gradient editor, atmosphere, and ring controls"
```

---

### Task 7: Create NebulaPanel

**Files:**
- Create: `src/ui/panels/NebulaPanel.svelte`

- [ ] **Step 1: Create the NebulaPanel component**

Create `src/ui/panels/NebulaPanel.svelte`:

```svelte
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
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/panels/NebulaPanel.svelte
git commit -m "feat: add NebulaPanel with method, style, and color controls"
```

---

### Task 8: Create GalaxyPanel

**Files:**
- Create: `src/ui/panels/GalaxyPanel.svelte`

Galaxy properties all require particle regeneration. Use a debounce timer so rapid slider changes don't thrash the GPU.

- [ ] **Step 1: Create the GalaxyPanel component**

Create `src/ui/panels/GalaxyPanel.svelte`:

```svelte
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
    <h3 class="text-xs uppercase tracking-wider text-gray-500 font-semibold border-b border-white/5 pb-1">
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
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/panels/GalaxyPanel.svelte
git commit -m "feat: add GalaxyPanel with debounced particle regeneration"
```

---

### Task 9: Create AlienTechPanel

**Files:**
- Create: `src/ui/panels/AlienTechPanel.svelte`

- [ ] **Step 1: Create the AlienTechPanel component**

Create `src/ui/panels/AlienTechPanel.svelte`:

```svelte
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
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/panels/AlienTechPanel.svelte
git commit -m "feat: add AlienTechPanel with live PBR material controls"
```

---

### Task 10: Create OrbitalPanel

**Files:**
- Create: `src/ui/panels/OrbitalPanel.svelte`

- [ ] **Step 1: Create the OrbitalPanel component**

Create `src/ui/panels/OrbitalPanel.svelte`:

```svelte
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
    <h3 class="text-xs uppercase tracking-wider text-gray-500 font-semibold border-b border-white/5 pb-1">
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
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/panels/OrbitalPanel.svelte
git commit -m "feat: add OrbitalPanel with orbit radius, period, inclination, eccentricity"
```

---

### Task 11: Wire panels into PropertiesPanel + add mass/size controls

**Files:**
- Modify: `src/ui/panels/PropertiesPanel.svelte`

- [ ] **Step 1: Replace the placeholder with panel imports and type switch**

Replace the entire contents of `src/ui/panels/PropertiesPanel.svelte` with:

```svelte
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
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expected: Clean.

- [ ] **Step 3: Commit**

```bash
git add src/ui/panels/PropertiesPanel.svelte
git commit -m "feat: wire per-type panels into PropertiesPanel with mass/size controls"
```

---

### Task 12: Integration test — verify everything works end-to-end

**Files:** None (manual verification)

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Test star panel**

1. Click "Star" in toolbar to add a star
2. Click the star in the viewport (or in entity tree)
3. In Properties panel: verify Star section appears with all controls
4. Drag Temperature slider — star color should change in real-time
5. Drag Surface Detail slider — surface texture should change
6. Drag Corona Intensity/Reach sliders — corona should respond
7. Change Spectral Class dropdown — star should regenerate with new color/size
8. Change Variant dropdown — star should regenerate (black hole should look different)

- [ ] **Step 3: Test planet panel**

1. Select the star, then click "Planet" — should create child planet with orbit
2. Select the planet, verify Planet section appears
3. Edit gradient stops — planet surface colors should update live
4. Drag Noise Scale/Octaves/Roughness — texture should change in real-time
5. Toggle Atmosphere off/on — atmosphere mesh should appear/disappear
6. Change atmosphere color/density — should update live
7. Toggle Rings on — ring should appear
8. Change Variant — planet should regenerate

- [ ] **Step 4: Test nebula, galaxy, alien tech panels**

1. Add a Nebula — verify controls appear, color changes work live
2. Add a Galaxy — verify controls appear, slider changes rebuild particles (with 200ms debounce)
3. Add Alien Tech — verify metalness/roughness/emissive update live, variant change regenerates

- [ ] **Step 5: Test orbital panel**

1. Select the planet (child of star)
2. Verify Orbit section appears below the Planet section
3. Drag Orbit Radius — orbit path should update
4. Drag Inclination — orbit tilt should change
5. Drag Eccentricity — orbit shape should change from circle to ellipse

- [ ] **Step 6: Test mass/size controls**

1. Select any entity
2. Verify Physics section appears with Mass and Size sliders
3. Drag sliders — values should update (no visual effect yet, just stored)

- [ ] **Step 7: Commit any fixes found during testing**

```bash
git add -A
git commit -m "fix: integration fixes from end-to-end property panel testing"
```

Only commit this if fixes were needed. If everything works, skip this step.
