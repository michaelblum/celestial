# Camera & Navigation System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement focus-based camera navigation with functional System/Body studios, weighted-realistic planet creation with camera pullout, auto oort cloud on stars, and orbit hover highlighting.

**Architecture:** A new `CameraController` manages the focus target, animated camera transitions (position + OrbitControls target lerp), and adaptive framing distance based on object size + FOV. Studio switching is driven by camera distance thresholds — zoom out past a body and you enter System studio; click a body in System to enter Body studio. Planet creation uses a `PlanetFactory` for weighted-realistic random generation (inner rocky, mid gas giant, outer ice). Stars automatically get a visual-only oort cloud shell sized by mass.

**Tech Stack:** Three.js (PerspectiveCamera, OrbitControls, Raycaster), TypeScript, Svelte 5 runes, Vitest

**Spec references:**
- `docs/superpowers/specs/2026-03-28-physics-properties-design.md`
- `memory/scratchpad/focus-navigation-ux.md`
- `memory/scratchpad/celestial-roadmap.md`

**Research basis:** Universe Sandbox (focus-lock + exaggerated scale), KSP (SOI + map view), Cosmos Journeyer (nearest-body compensation), Atlas (normalized rendering radius), Space Engine (adaptive speed + Go-To)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/camera/CameraController.ts` | Create | Focus target management, animated transitions, framing distance math, studio threshold detection |
| `src/lib/camera/CameraController.test.ts` | Create | Unit tests for framing distance, lerp math, threshold logic |
| `src/lib/generators/PlanetFactory.ts` | Create | Weighted-realistic random planet generation (type, colors, orbit distance) |
| `src/lib/generators/PlanetFactory.test.ts` | Create | Tests for slot-based type selection, orbit spacing |
| `src/lib/generators/OortCloudGenerator.ts` | Create | Translucent shell visual for stars, mass-derived radius |
| `src/lib/engine/Engine.ts` | Modify | Expose camera/controls, remove autoRotate, add animation tick hook |
| `src/lib/stores/sceneStore.svelte.ts` | Modify | Add `focusEntity()`, studio auto-switching, oort cloud auto-creation on star add |
| `src/lib/stores/selectionStore.svelte.ts` | Modify | Focus camera on select |
| `src/ui/layout/Viewport.svelte` | Modify | Initialize CameraController, remove hardcoded lights, pass to animation loop |
| `src/ui/layout/StudioNav.svelte` | Modify | Show breadcrumb path based on focused entity hierarchy |
| `src/ui/panels/PropertiesPanel.svelte` | Modify | Use PlanetFactory for +→Planet, star stays selected, camera pulls out |
| `src/lib/generators/StarGenerator.ts` | Modify | Auto-add oort cloud shell to star groups |

---

### Task 1: Create CameraController with TDD

**Files:**
- Create: `src/lib/camera/CameraController.ts`
- Create: `src/lib/camera/CameraController.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/camera/CameraController.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  computeFramingDistance,
  lerpVector3,
  shouldSwitchToSystem,
  SYSTEM_THRESHOLD_RATIO,
} from './CameraController'

describe('computeFramingDistance', () => {
  it('returns distance that frames object at target viewport fraction', () => {
    // For a sphere of radius 1.0, FOV 60°, filling 60% of viewport height:
    // halfHeight at distance d = d * tan(FOV/2) = d * tan(30°) = d * 0.577
    // We want objectRadius / halfHeight = 0.6 (fill 60%)
    // So: 1.0 / (d * 0.577) = 0.6 → d = 1.0 / (0.6 * 0.577) ≈ 2.89
    const dist = computeFramingDistance(1.0, 60, 0.6)
    expect(dist).toBeCloseTo(2.89, 1)
  })

  it('returns larger distance for larger objects', () => {
    const small = computeFramingDistance(1.0, 60, 0.6)
    const large = computeFramingDistance(5.0, 60, 0.6)
    expect(large).toBeGreaterThan(small)
  })

  it('returns larger distance for smaller viewport fraction', () => {
    const tight = computeFramingDistance(1.0, 60, 0.8)
    const loose = computeFramingDistance(1.0, 60, 0.3)
    expect(loose).toBeGreaterThan(tight)
  })
})

describe('lerpVector3', () => {
  it('returns start at t=0', () => {
    const result = lerpVector3([0, 0, 0], [10, 10, 10], 0)
    expect(result).toEqual([0, 0, 0])
  })

  it('returns end at t=1', () => {
    const result = lerpVector3([0, 0, 0], [10, 10, 10], 1)
    expect(result).toEqual([10, 10, 10])
  })

  it('returns midpoint at t=0.5', () => {
    const result = lerpVector3([0, 0, 0], [10, 20, 30], 0.5)
    expect(result).toEqual([5, 10, 15])
  })
})

describe('shouldSwitchToSystem', () => {
  it('returns true when object occupies less than threshold of viewport', () => {
    // Object radius 1.0, camera distance 100, FOV 60
    // Object angular size = atan(1.0 / 100) ≈ 0.57°
    // Viewport half-angle = 30°
    // Fraction = 0.57 / 30 ≈ 0.019 → below 0.05 threshold
    expect(shouldSwitchToSystem(1.0, 100, 60)).toBe(true)
  })

  it('returns false when object fills significant viewport', () => {
    // Object radius 1.0, camera distance 3, FOV 60
    // Object angular size = atan(1.0 / 3) ≈ 18.4°
    // Fraction = 18.4 / 30 ≈ 0.61 → above threshold
    expect(shouldSwitchToSystem(1.0, 3, 60)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/camera/CameraController.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement CameraController.ts**

Create `src/lib/camera/CameraController.ts`:

```typescript
import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// ─── Constants ─────────────────────────────────────────────────────────────

/** Object occupying less than this fraction of viewport triggers System switch */
export const SYSTEM_THRESHOLD_RATIO = 0.05

/** Target fraction of viewport the focused body should fill in Body studio */
const BODY_FRAMING_FILL = 0.6

/** Camera transition duration in seconds */
const TRANSITION_DURATION = 1.0

// ─── Pure Math Functions (exported for testing) ────────────────────────────

/** Compute camera distance to frame an object at a target viewport fraction */
export function computeFramingDistance(
  objectRadius: number,
  fovDegrees: number,
  viewportFraction: number
): number {
  const halfFovRad = (fovDegrees / 2) * (Math.PI / 180)
  const halfHeight = Math.tan(halfFovRad)
  return objectRadius / (viewportFraction * halfHeight)
}

/** Linear interpolation between two [x,y,z] tuples */
export function lerpVector3(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}

/** Check if focused object is small enough to trigger System studio */
export function shouldSwitchToSystem(
  objectRadius: number,
  cameraDistance: number,
  fovDegrees: number
): boolean {
  const halfFovRad = (fovDegrees / 2) * (Math.PI / 180)
  const viewportHalfAngle = halfFovRad
  const objectAngle = Math.atan(objectRadius / cameraDistance)
  const fraction = objectAngle / viewportHalfAngle
  return fraction < SYSTEM_THRESHOLD_RATIO
}

// ─── CameraController Class ────────────────────────────────────────────────

interface FocusTarget {
  entityId: string
  position: THREE.Vector3
  radius: number
}

export class CameraController {
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private currentFocus: FocusTarget | null = null

  // Transition state
  private transitioning = false
  private transitionElapsed = 0
  private transitionDuration = TRANSITION_DURATION
  private startPosition = new THREE.Vector3()
  private startTarget = new THREE.Vector3()
  private endPosition = new THREE.Vector3()
  private endTarget = new THREE.Vector3()

  constructor(camera: THREE.PerspectiveCamera, controls: OrbitControls) {
    this.camera = camera
    this.controls = controls
  }

  /** Get the currently focused entity ID */
  getFocusedEntityId(): string | null {
    return this.currentFocus?.entityId ?? null
  }

  /** Animate camera to focus on a target entity */
  focusOn(entityId: string, worldPosition: THREE.Vector3, objectRadius: number): void {
    this.currentFocus = { entityId, position: worldPosition.clone(), radius: objectRadius }

    const distance = computeFramingDistance(objectRadius, this.camera.fov, BODY_FRAMING_FILL)

    // Camera end position: offset from target along current view direction
    const direction = new THREE.Vector3()
    direction.subVectors(this.camera.position, this.controls.target).normalize()
    if (direction.length() < 0.01) direction.set(0, 0.3, 1).normalize()

    this.startPosition.copy(this.camera.position)
    this.startTarget.copy(this.controls.target)
    this.endTarget.copy(worldPosition)
    this.endPosition.copy(worldPosition).addScaledVector(direction, distance)

    this.transitioning = true
    this.transitionElapsed = 0
  }

  /** Animate camera to show a system (pull out to see all children orbits) */
  showSystem(centerPosition: THREE.Vector3, maxOrbitRadius: number): void {
    const systemRadius = maxOrbitRadius * 1.3 // Margin to show full orbits
    const distance = computeFramingDistance(systemRadius, this.camera.fov, 0.85)

    const direction = new THREE.Vector3()
    direction.subVectors(this.camera.position, this.controls.target).normalize()
    if (direction.length() < 0.01) direction.set(0, 0.5, 1).normalize()

    // Elevate slightly for an angled top-down view
    direction.y = Math.max(direction.y, 0.4)
    direction.normalize()

    this.startPosition.copy(this.camera.position)
    this.startTarget.copy(this.controls.target)
    this.endTarget.copy(centerPosition)
    this.endPosition.copy(centerPosition).addScaledVector(direction, distance)

    this.transitioning = true
    this.transitionElapsed = 0
  }

  /** Check if current zoom level should trigger a studio change */
  checkStudioThreshold(): 'system' | 'body' | null {
    if (!this.currentFocus) return null
    const distance = this.camera.position.distanceTo(this.currentFocus.position)
    if (shouldSwitchToSystem(this.currentFocus.radius, distance, this.camera.fov)) {
      return 'system'
    }
    return null
  }

  /** Call every frame from the animation loop */
  update(dt: number): void {
    if (!this.transitioning) return

    this.transitionElapsed += dt
    const rawT = Math.min(this.transitionElapsed / this.transitionDuration, 1)

    // Smooth ease-in-out (cubic)
    const t = rawT < 0.5
      ? 4 * rawT * rawT * rawT
      : 1 - Math.pow(-2 * rawT + 2, 3) / 2

    this.camera.position.lerpVectors(this.startPosition, this.endPosition, t)
    this.controls.target.lerpVectors(this.startTarget, this.endTarget, t)

    if (rawT >= 1) {
      this.transitioning = false
      // Update orbit controls limits based on focused object
      if (this.currentFocus) {
        this.controls.minDistance = this.currentFocus.radius * 1.5
        this.controls.maxDistance = this.currentFocus.radius * 200
      }
    }
  }

  /** Whether a camera transition is currently in progress */
  isTransitioning(): boolean {
    return this.transitioning
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/camera/CameraController.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/camera/
git commit -m "feat: add CameraController with focus transitions and studio thresholds"
```

---

### Task 2: Wire CameraController into Engine and Viewport

**Files:**
- Modify: `src/lib/engine/Engine.ts`
- Modify: `src/ui/layout/Viewport.svelte`
- Modify: `src/lib/stores/engineStore.svelte.ts`

- [ ] **Step 1: Expose controls config on Engine, disable autoRotate**

In `src/lib/engine/Engine.ts`, change the constructor's OrbitControls setup (lines 40-46):

```typescript
    // OrbitControls with damping
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.autoRotate = false
    this.controls.maxDistance = 500
    this.controls.minDistance = 0.5
```

- [ ] **Step 2: Create CameraController in Viewport and add to animation loop**

Replace `src/ui/layout/Viewport.svelte`:

```svelte
<script lang="ts">
  import * as THREE from 'three'
  import { onMount, onDestroy } from 'svelte'
  import { Engine } from '@lib/engine/Engine'
  import { setEngine } from '@lib/stores/engineStore.svelte'
  import { handleViewportClick } from '@lib/stores/selectionStore.svelte'
  import { registerAnimationTick } from '@lib/stores/sceneStore.svelte'
  import { CameraController } from '@lib/camera/CameraController'
  import { setCameraController } from '@lib/stores/engineStore.svelte'

  let canvasEl: HTMLCanvasElement
  let containerEl: HTMLDivElement
  let engine: Engine | null = null

  onMount(() => {
    engine = new Engine(canvasEl)
    setEngine(engine)

    // Initialize camera controller
    const camController = new CameraController(engine.camera, engine.controls)
    setCameraController(camController)

    // Camera controller update in the render loop
    engine.onTick((dt) => {
      camController.update(dt)
    })

    // Size to container
    const rect = containerEl.getBoundingClientRect()
    engine.resize(rect.width, rect.height)

    // Watch for resize
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          engine?.resize(width, height)
        }
      }
    })
    observer.observe(containerEl)

    // Start render loop
    engine.start()

    // Register entity animation tick (shader uniforms, billboards, etc.)
    registerAnimationTick()

    return () => {
      observer.disconnect()
    }
  })

  onDestroy(() => {
    engine?.dispose()
  })

  function onClick(e: MouseEvent) {
    handleViewportClick(e)
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={containerEl} class="absolute inset-0 w-full h-full" onclick={onClick}>
  <canvas bind:this={canvasEl} class="block w-full h-full"></canvas>
</div>
```

- [ ] **Step 3: Add CameraController to engineStore**

In `src/lib/stores/engineStore.svelte.ts`, add:

```typescript
import { Engine } from '@lib/engine/Engine'
import type { CameraController } from '@lib/camera/CameraController'

/** Singleton engine instance — set once when Viewport mounts */
let engine: Engine | null = $state(null)
let cameraController: CameraController | null = $state(null)

export function getEngine(): Engine | null {
  return engine
}

export function setEngine(e: Engine): void {
  engine = e
}

export function getCameraController(): CameraController | null {
  return cameraController
}

export function setCameraController(c: CameraController): void {
  cameraController = c
}
```

- [ ] **Step 4: Remove hardcoded directional and point lights from Viewport**

The old Viewport.svelte added a `DirectionalLight` and `PointLight`. These are now removed (stars have their own PointLight via StarGenerator). The ambient light in Engine.ts remains.

- [ ] **Step 5: Verify app compiles and renders**

Run: `npm run dev`
Open browser — scene should render. No auto-rotation. Camera should orbit with mouse.

- [ ] **Step 6: Commit**

```bash
git add src/lib/engine/Engine.ts src/ui/layout/Viewport.svelte src/lib/stores/engineStore.svelte.ts
git commit -m "feat: wire CameraController into engine and viewport"
```

---

### Task 3: Focus Camera on Entity Selection

**Files:**
- Modify: `src/lib/stores/selectionStore.svelte.ts`
- Modify: `src/lib/stores/sceneStore.svelte.ts` (add `getThreeObject` export if not already, add `getEntityVisualRadius`)

- [ ] **Step 1: Add getEntityVisualRadius to sceneStore**

Add this function to `src/lib/stores/sceneStore.svelte.ts` in the helpers section:

```typescript
/** Get the visual bounding radius of an entity's Three.js object */
export function getEntityVisualRadius(entityId: string): number {
  const obj = threeObjects.get(entityId)
  if (!obj) return 1.0
  const box = new THREE.Box3().setFromObject(obj)
  const size = new THREE.Vector3()
  box.getSize(size)
  return Math.max(size.x, size.y, size.z) / 2
}
```

- [ ] **Step 2: Update selectionStore to focus camera on select**

In `src/lib/stores/selectionStore.svelte.ts`, update the `select` function:

```typescript
import * as THREE from 'three'
import { getThreeObject, getEntityVisualRadius } from './sceneStore.svelte'
import { getEngine } from './engineStore.svelte'
import { setActivePanel } from './uiStore.svelte'
import { getCameraController } from './engineStore.svelte'

// ... (existing state unchanged)

export function select(entityId: string | null): void {
  // Remove highlight from previous selection
  clearHighlight()

  selectedId = entityId

  // Apply highlight to new selection and show properties
  if (entityId) {
    applyHighlight(entityId)
    setActivePanel('properties')

    // Focus camera on selected entity
    const camController = getCameraController()
    const obj = getThreeObject(entityId)
    if (camController && obj) {
      const worldPos = new THREE.Vector3()
      obj.getWorldPosition(worldPos)
      const radius = getEntityVisualRadius(entityId)
      camController.focusOn(entityId, worldPos, radius)
    }
  }
}
```

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`
Create a star. Click it. Camera should smoothly animate to center the star at ~60% of viewport. Create a second star at a different position. Click it. Camera should animate to the new star.

- [ ] **Step 4: Commit**

```bash
git add src/lib/stores/selectionStore.svelte.ts src/lib/stores/sceneStore.svelte.ts
git commit -m "feat: camera focuses on selected entity with smooth animation"
```

---

### Task 4: Studio Switching — System and Body Views

**Files:**
- Modify: `src/lib/stores/sceneStore.svelte.ts`
- Modify: `src/ui/layout/StudioNav.svelte`

- [ ] **Step 1: Add focusEntity and studio switching to sceneStore**

Add these functions to `src/lib/stores/sceneStore.svelte.ts`:

```typescript
import { getCameraController } from './engineStore.svelte'

/** Switch to System studio — pull camera out to show all children orbits */
export function enterSystemStudio(parentEntityId: string): void {
  const entity = graph.get(parentEntityId)
  if (!entity) return

  const parentObj = threeObjects.get(parentEntityId)
  if (!parentObj) return

  const camController = getCameraController()
  if (!camController) return

  // Find the max orbit radius among children
  let maxOrbitRadius = 5
  for (const childId of entity.childIds) {
    const child = graph.get(childId)
    if (child?.components['orbital']) {
      const orbital = child.components['orbital'] as OrbitalComponent
      if (orbital.orbitRadius > maxOrbitRadius) {
        maxOrbitRadius = orbital.orbitRadius
      }
    }
  }

  const worldPos = new THREE.Vector3()
  parentObj.getWorldPosition(worldPos)
  camController.showSystem(worldPos, maxOrbitRadius)
  activeStudio = 'star-system'
  sync()
}

/** Switch to Body studio — focus on a specific entity */
export function enterBodyStudio(entityId: string): void {
  const obj = threeObjects.get(entityId)
  if (!obj) return

  const camController = getCameraController()
  if (!camController) return

  const worldPos = new THREE.Vector3()
  obj.getWorldPosition(worldPos)
  const radius = getEntityVisualRadius(entityId)
  camController.focusOn(entityId, worldPos, radius)
  activeStudio = 'body'
  sync()
}
```

- [ ] **Step 2: Add scroll-zoom studio threshold check to animation tick**

In `registerAnimationTick()` in sceneStore, add after the LOD manager update:

```typescript
    // Check if zoom level should trigger studio switch
    const camController = getCameraController()
    if (camController && activeStudio === 'body') {
      const studioSwitch = camController.checkStudioThreshold()
      if (studioSwitch === 'system') {
        // Find the focused entity's parent to show system view
        const focusedId = camController.getFocusedEntityId()
        if (focusedId) {
          const focused = graph.get(focusedId)
          const parentId = focused?.parentId ?? focusedId
          enterSystemStudio(parentId)
        }
      }
    }
```

- [ ] **Step 3: Update StudioNav to show contextual breadcrumb**

Replace `src/ui/layout/StudioNav.svelte`:

```svelte
<script lang="ts">
  import { getActiveStudio, enterBodyStudio, enterSystemStudio } from '@lib/stores/sceneStore.svelte'
  import { getSelectedId } from '@lib/stores/selectionStore.svelte'
  import { getGraph } from '@lib/stores/sceneStore.svelte'

  let breadcrumb = $derived.by(() => {
    const id = getSelectedId()
    if (!id) return []
    const graph = getGraph()
    const crumbs: { id: string; name: string; type: string }[] = []

    let current = graph.get(id)
    while (current) {
      crumbs.unshift({ id: current.id, name: current.name, type: current.type })
      current = current.parentId ? graph.get(current.parentId) : undefined
    }
    return crumbs
  })

  let studio = $derived(getActiveStudio())
</script>

<div class="glass-panel px-2 py-1 flex items-center gap-0.5 pointer-events-auto">
  {#if breadcrumb.length === 0}
    <span class="nav-label">No selection</span>
  {:else}
    {#each breadcrumb as crumb, i}
      {#if i > 0}
        <span class="text-[10px]" style="color: var(--border-subtle)">›</span>
      {/if}
      <button
        onclick={() => enterBodyStudio(crumb.id)}
        class="nav-btn"
        class:active={i === breadcrumb.length - 1 && studio === 'body'}
      >
        {crumb.name}
      </button>
    {/each}

    <!-- System view toggle for entities with children -->
    {#if breadcrumb.length > 0}
      {@const last = breadcrumb[breadcrumb.length - 1]}
      {@const entity = getGraph().get(last.id)}
      {#if entity && entity.childIds.length > 0}
        <span class="text-[10px]" style="color: var(--border-subtle)">›</span>
        <button
          onclick={() => enterSystemStudio(last.id)}
          class="nav-btn"
          class:active={studio === 'star-system'}
        >
          System
        </button>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .nav-btn {
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    color: var(--icon-default);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .nav-btn:hover {
    color: var(--text-primary);
    background: var(--accent-hover);
  }
  .nav-btn.active {
    color: var(--text-primary);
    background: var(--accent);
    font-weight: 600;
    box-shadow: 0 0 10px var(--accent-glow);
  }
  .nav-label {
    font-size: 12px;
    color: var(--icon-default);
    padding: 4px 8px;
  }
</style>
```

- [ ] **Step 4: Verify in browser**

Create a star, add a planet. Click the star — Body view. Click "System" in the breadcrumb — camera pulls out to show the star + orbit. Click the planet in the viewport — camera zooms to the planet (Body view). Scroll-zoom way out from the planet — should auto-switch to System.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/sceneStore.svelte.ts src/ui/layout/StudioNav.svelte
git commit -m "feat: functional System/Body studios with breadcrumb navigation"
```

---

### Task 5: Weighted-Realistic Planet Factory with TDD

**Files:**
- Create: `src/lib/generators/PlanetFactory.ts`
- Create: `src/lib/generators/PlanetFactory.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/generators/PlanetFactory.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { pickPlanetType, computeOrbitRadius, generateRandomPlanet } from './PlanetFactory'

describe('pickPlanetType', () => {
  it('picks rocky or volcanic for inner slots (1-2)', () => {
    const types = new Set<string>()
    for (let i = 0; i < 50; i++) {
      types.add(pickPlanetType(1))
    }
    // Inner slots should only produce rocky or volcanic
    for (const t of types) {
      expect(['rocky', 'volcanic']).toContain(t)
    }
  })

  it('picks gas-giant for middle slots (3-4)', () => {
    const types = new Set<string>()
    for (let i = 0; i < 50; i++) {
      types.add(pickPlanetType(3))
    }
    expect(types.has('gas-giant')).toBe(true)
  })

  it('picks ice for outer slots (5+)', () => {
    const types = new Set<string>()
    for (let i = 0; i < 50; i++) {
      types.add(pickPlanetType(6))
    }
    expect(types.has('ice')).toBe(true)
  })
})

describe('computeOrbitRadius', () => {
  it('increases with slot number', () => {
    const r1 = computeOrbitRadius(1, 2.0)
    const r2 = computeOrbitRadius(2, 2.0)
    const r3 = computeOrbitRadius(3, 2.0)
    expect(r2).toBeGreaterThan(r1)
    expect(r3).toBeGreaterThan(r2)
  })

  it('starts outside the star size', () => {
    const r = computeOrbitRadius(1, 5.0)
    expect(r).toBeGreaterThan(5.0)
  })
})

describe('generateRandomPlanet', () => {
  it('returns a valid PlanetComponent with orbital config', () => {
    const result = generateRandomPlanet(1, 2.0)
    expect(result.planet.type).toBe('planet')
    expect(result.planet.variant).toBeDefined()
    expect(result.planet.radius).toBeGreaterThan(0)
    expect(result.planet.colorRamp.length).toBeGreaterThanOrEqual(2)
    expect(result.orbital.type).toBe('orbital')
    expect(result.orbital.orbitRadius).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/generators/PlanetFactory.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PlanetFactory.ts**

Create `src/lib/generators/PlanetFactory.ts`:

```typescript
import type { PlanetComponent, OrbitalComponent, GradientStop } from '@lib/ecs/types'
import { defaultOrbitalConfig } from './OrbitalSystem'

// ─── Slot-Based Planet Type Selection ──────────────────────────────────────

const INNER_TYPES: PlanetComponent['variant'][] = ['rocky', 'volcanic', 'rocky', 'rocky']
const MIDDLE_TYPES: PlanetComponent['variant'][] = ['gas-giant', 'gas-giant', 'rocky', 'ice']
const OUTER_TYPES: PlanetComponent['variant'][] = ['ice', 'ice', 'gas-giant', 'ice']

/** Pick a planet type based on orbital slot (1-based, inner to outer) */
export function pickPlanetType(slot: number): PlanetComponent['variant'] {
  const pool = slot <= 2 ? INNER_TYPES : slot <= 4 ? MIDDLE_TYPES : OUTER_TYPES
  return pool[Math.floor(Math.random() * pool.length)]
}

// ─── Orbit Radius ──────────────────────────────────────────────────────────

/** Compute orbit radius for a given slot, ensuring it's outside the star */
export function computeOrbitRadius(slot: number, starSize: number): number {
  const baseGap = starSize + 2.0
  const spacing = 3.0 + slot * 1.5
  return baseGap + slot * spacing + (Math.random() - 0.5) * spacing * 0.3
}

// ─── Color Ramp Generators ─────────────────────────────────────────────────

function randomColor(): string {
  const h = Math.random() * 360
  const s = 30 + Math.random() * 40
  const l = 30 + Math.random() * 40
  return hslToHex(h, s, l)
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

const VARIANT_RAMPS: Record<string, () => GradientStop[]> = {
  rocky: () => {
    const base = 60 + Math.random() * 120 // green-brown range
    return [
      { position: 0, color: hslToHex(base + 40, 30, 20) },
      { position: 0.3, color: hslToHex(base, 40, 35) },
      { position: 0.6, color: hslToHex(base - 20, 35, 45) },
      { position: 0.85, color: hslToHex(0, 0, 65) },
      { position: 1, color: hslToHex(0, 0, 90) },
    ]
  },
  'gas-giant': () => {
    const base = Math.random() * 60 // warm tones
    return [
      { position: 0, color: hslToHex(base + 20, 50, 25) },
      { position: 0.3, color: hslToHex(base, 60, 50) },
      { position: 0.5, color: hslToHex(base + 10, 45, 55) },
      { position: 0.7, color: hslToHex(base - 10, 40, 60) },
      { position: 1, color: hslToHex(base + 5, 35, 70) },
    ]
  },
  ice: () => [
    { position: 0, color: hslToHex(230, 40, 15) },
    { position: 0.3, color: hslToHex(220, 55, 45) },
    { position: 0.6, color: hslToHex(200, 50, 65) },
    { position: 1, color: hslToHex(195, 20, 92) },
  ],
  volcanic: () => [
    { position: 0, color: hslToHex(0, 20, 8) },
    { position: 0.3, color: hslToHex(15, 40, 18) },
    { position: 0.6, color: hslToHex(0, 0, 35) },
    { position: 0.9, color: hslToHex(15, 100, 45) },
    { position: 1, color: hslToHex(45, 100, 55) },
  ],
}

// ─── Radius by Type ────────────────────────────────────────────────────────

const VARIANT_RADIUS: Record<string, () => number> = {
  rocky: () => 0.15 + Math.random() * 0.2,
  'gas-giant': () => 0.5 + Math.random() * 0.5,
  ice: () => 0.12 + Math.random() * 0.15,
  volcanic: () => 0.1 + Math.random() * 0.15,
}

// ─── Main Generator ────────────────────────────────────────────────────────

interface RandomPlanetResult {
  planet: PlanetComponent
  orbital: OrbitalComponent
}

/** Generate a random planet appropriate for its orbital slot */
export function generateRandomPlanet(slot: number, starSize: number): RandomPlanetResult {
  const variant = pickPlanetType(slot)
  const orbitRadius = computeOrbitRadius(slot, starSize)
  const radius = (VARIANT_RADIUS[variant] ?? (() => 0.2))()
  const colorRamp = (VARIANT_RAMPS[variant] ?? VARIANT_RAMPS.rocky)()

  const isGasGiant = variant === 'gas-giant'

  const planet: PlanetComponent = {
    type: 'planet',
    variant,
    radius,
    colorRamp,
    roughness: isGasGiant ? 0.1 : 0.2 + Math.random() * 0.4,
    noiseScale: isGasGiant ? 2 + Math.random() * 2 : 2 + Math.random() * 4,
    noiseOctaves: 4,
    atmosphereEnabled: isGasGiant || Math.random() > 0.4,
    atmosphereColor: isGasGiant ? hslToHex(30 + Math.random() * 30, 40, 70) : hslToHex(200 + Math.random() * 40, 50, 60),
    atmosphereDensity: isGasGiant ? 0.7 + Math.random() * 0.3 : 0.3 + Math.random() * 0.4,
    ringEnabled: isGasGiant && Math.random() > 0.5,
    ringInnerRadius: radius * 2.0,
    ringOuterRadius: radius * 3.5,
    ringSegments: 3 + Math.floor(Math.random() * 4),
    moonCount: 0,
  }

  const orbital = defaultOrbitalConfig(orbitRadius)

  return { planet, orbital }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/generators/PlanetFactory.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/generators/PlanetFactory.ts src/lib/generators/PlanetFactory.test.ts
git commit -m "feat: add PlanetFactory for weighted-realistic random generation"
```

---

### Task 6: Planet Creation Flow — Camera Pullout to System View

**Files:**
- Modify: `src/ui/panels/PropertiesPanel.svelte`

- [ ] **Step 1: Update addChild to use PlanetFactory and enter System studio**

In `PropertiesPanel.svelte`, add the import:

```typescript
import { generateRandomPlanet } from '@lib/generators/PlanetFactory'
import { enterSystemStudio } from '@lib/stores/sceneStore.svelte'
```

Replace the `addChild` function:

```typescript
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
```

- [ ] **Step 2: Add enterSystemStudio to sceneStore imports**

Make sure PropertiesPanel imports it:

```typescript
import { getGraph, updateComponent, updateEntityField as storeUpdateEntityField, addEntity, getThreeObject, enterSystemStudio } from '@lib/stores/sceneStore.svelte'
```

- [ ] **Step 3: Verify in browser**

Create a star. Click it. Click +→Planet. Camera should smoothly pull out to show the star + new orbital path. Star should remain selected. The planet should be randomly generated (appropriate type for slot 1 = rocky/volcanic, smaller than the star). Add a second planet — camera should pull out further if needed. Third planet should tend toward gas giant.

- [ ] **Step 4: Commit**

```bash
git add src/ui/panels/PropertiesPanel.svelte
git commit -m "feat: planet creation uses PlanetFactory, camera pulls out to System view"
```

---

### Task 7: Auto Oort Cloud on Stars

**Files:**
- Create: `src/lib/generators/OortCloudGenerator.ts`
- Modify: `src/lib/generators/StarGenerator.ts`

- [ ] **Step 1: Create OortCloudGenerator**

Create `src/lib/generators/OortCloudGenerator.ts`:

```typescript
import * as THREE from 'three'

/**
 * Create a visual-only oort cloud shell for a star.
 * Size is derived from star mass. Not an entity — purely a visual child of the star group.
 * Visible only when zoomed far out (large camera distance).
 */
export function createOortCloud(starMass: number): THREE.Group {
  const group = new THREE.Group()
  group.name = 'oort-cloud-visual'

  // Oort cloud radius scales with star mass (cube root for volume relationship)
  const baseRadius = 30
  const massScale = Math.pow(starMass / 333000, 1 / 3) // Normalize to Sun mass
  const radius = baseRadius * Math.max(massScale, 0.5) // Min 50% of base

  // Outer translucent shell
  const shellGeo = new THREE.SphereGeometry(radius, 32, 24)
  const shellMat = new THREE.MeshBasicMaterial({
    color: 0x334466,
    transparent: true,
    opacity: 0.03,
    side: THREE.BackSide,
    depthWrite: false,
  })
  const shell = new THREE.Mesh(shellGeo, shellMat)
  shell.name = 'oort-shell'
  group.add(shell)

  // Inner haze (slightly smaller, visible when camera is inside)
  const hazeGeo = new THREE.SphereGeometry(radius * 0.95, 24, 16)
  const hazeMat = new THREE.MeshBasicMaterial({
    color: 0x223344,
    transparent: true,
    opacity: 0.015,
    side: THREE.FrontSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const haze = new THREE.Mesh(hazeGeo, hazeMat)
  haze.name = 'oort-haze'
  group.add(haze)

  // Sparse particle scatter
  const particleCount = 500
  const positions = new Float32Array(particleCount * 3)
  for (let i = 0; i < particleCount; i++) {
    const r = radius * (0.7 + Math.random() * 0.3)
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = r * Math.cos(phi)
  }

  const particleGeo = new THREE.BufferGeometry()
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const particleMat = new THREE.PointsMaterial({
    color: 0x556677,
    size: 0.15,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const particles = new THREE.Points(particleGeo, particleMat)
  particles.name = 'oort-particles'
  group.add(particles)

  return group
}
```

- [ ] **Step 2: Auto-add oort cloud to star generation**

In `src/lib/generators/StarGenerator.ts`, add the import at the top:

```typescript
import { createOortCloud } from './OortCloudGenerator'
```

At the end of `generateStar()`, just before `return group`, add:

```typescript
  // Auto-add visual oort cloud
  const oortCloud = createOortCloud(333000) // Default sun mass; updated by physics system
  group.add(oortCloud)
```

- [ ] **Step 3: Verify in browser**

Create a star. It should look the same up close (oort cloud is nearly invisible at body scale). Click +→Planet to enter System view. Pull camera back further — at extreme distance you should see a faint spherical shell and scattered particles around the star.

- [ ] **Step 4: Commit**

```bash
git add src/lib/generators/OortCloudGenerator.ts src/lib/generators/StarGenerator.ts
git commit -m "feat: auto-add visual oort cloud to stars"
```

---

### Task 8: Orbit Path Hover Highlighting

**Files:**
- Modify: `src/lib/stores/selectionStore.svelte.ts`
- Modify: `src/lib/stores/sceneStore.svelte.ts`

- [ ] **Step 1: Add orbit path hover detection to Viewport**

In `src/lib/stores/selectionStore.svelte.ts`, add a new function for hover detection on orbit paths:

```typescript
/** Handle mouse move on viewport — highlight orbit paths on hover */
export function handleViewportHover(event: MouseEvent): void {
  const engine = getEngine()
  if (!engine) return

  const canvas = engine.renderer.domElement
  const rect = canvas.getBoundingClientRect()

  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(pointer, engine.camera)
  raycaster.params.Line = { threshold: 0.5 } // Generous threshold for orbit paths

  // Find orbit path lines
  const lines: THREE.Object3D[] = []
  engine.scene.traverse((obj) => {
    if (obj instanceof THREE.Line && obj.name === 'orbit-path') {
      lines.push(obj)
    }
  })

  const intersects = raycaster.intersectObjects(lines, false)

  // Reset all orbit paths to default appearance
  engine.scene.traverse((obj) => {
    if (obj instanceof THREE.Line && obj.name === 'orbit-path') {
      const mat = obj.material as THREE.LineBasicMaterial
      mat.opacity = 0.25
      mat.color.setHex(0x334466)
    }
  })

  if (intersects.length > 0) {
    const hitLine = intersects[0].object as THREE.Line
    const mat = hitLine.material as THREE.LineBasicMaterial
    mat.opacity = 0.8
    mat.color.setHex(0x8844ff)

    // Find the entity this orbit belongs to
    const entityId = hitLine.userData.orbitFor
    if (entityId) {
      hover(entityId)
    }
  } else {
    hover(null)
  }
}
```

- [ ] **Step 2: Wire hover handler into Viewport**

In `src/ui/layout/Viewport.svelte`, add the import and event handler:

```typescript
import { handleViewportClick, handleViewportHover } from '@lib/stores/selectionStore.svelte'
```

Add `onmousemove` to the div:

```svelte
<div bind:this={containerEl} class="absolute inset-0 w-full h-full" onclick={onClick} onmousemove={onHover}>
```

Add the handler function:

```typescript
  function onHover(e: MouseEvent) {
    handleViewportHover(e)
  }
```

- [ ] **Step 3: Verify in browser**

Create a star, add planets. Enter System view. Hover mouse near an orbital path — it should glow purple and become brighter. Moving away should reset it.

- [ ] **Step 4: Commit**

```bash
git add src/lib/stores/selectionStore.svelte.ts src/ui/layout/Viewport.svelte
git commit -m "feat: orbit path hover highlighting in System view"
```

---

## Task Dependency Graph

```
Task 1 (CameraController TDD)
  └─► Task 2 (Wire into Engine/Viewport)
        └─► Task 3 (Focus on select)
              └─► Task 4 (Studio switching + breadcrumb)
                    └─► Task 6 (Planet creation flow)
                    └─► Task 8 (Orbit hover highlighting)

Task 5 (PlanetFactory TDD) ─► Task 6

Task 7 (Oort cloud) — independent, can run anytime after Task 2
```

Tasks 1, 5, and 7 can run in **parallel** (all create new files, no conflicts).
After Tasks 1+2+3+4: Tasks 6 and 8 can run in **parallel**.

## Team Agent Assignments

| Agent | Tasks | Why |
|-------|-------|-----|
| **camera** | 1, 2, 3, 4 | Sequential camera infrastructure chain |
| **generators** | 5, 7 | New generator files, no conflicts |
| **integration** | 6, 8 | Wires everything together after camera + generators are done |
