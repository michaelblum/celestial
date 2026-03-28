# Physics Properties + Emergent Behavior — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make size/mass/velocity real properties with consistent relationships. Derived properties (density, gravity, luminosity, escape velocity) computed automatically and drive visual behavior.

**Architecture:** New pure-function physics module (`src/lib/physics/PhysicsProperties.ts`) computes all derived values from three fundamentals (size, mass, velocity). A new `updateEntityField` export in sceneStore triggers cascading effects when fundamentals change — recalculating luminosity → corona uniforms, gravity → child orbital periods, and black hole threshold → variant auto-switch. UI panels display derived values as read-only text alongside editable sliders.

**Tech Stack:** TypeScript (pure functions), Svelte 5 (runes), Three.js (shader uniforms), Vitest (unit tests for physics module)

**Spec:** `docs/superpowers/specs/2026-03-28-physics-properties-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/physics/PhysicsProperties.ts` | Create | Pure derived-property functions + constants |
| `src/lib/physics/PhysicsProperties.test.ts` | Create | Unit tests for all physics functions |
| `src/lib/ecs/types.ts` | Modify | Add `velocity: number` to Entity interface |
| `src/lib/ecs/SceneGraph.ts` | Modify | Type-appropriate default mass/velocity values |
| `src/lib/stores/sceneStore.svelte.ts` | Modify | Add `updateEntityField()` with cascading physics effects |
| `src/ui/panels/PropertiesPanel.svelte` | Modify | Velocity slider + derived properties display section |
| `src/ui/panels/StarPanel.svelte` | Modify | Show luminosity (derived, read-only); black hole auto-detect |
| `src/ui/panels/PlanetPanel.svelte` | Modify | Show density (derived, read-only) |
| `src/ui/panels/OrbitalPanel.svelte` | Modify | Period becomes read-only derived value |
| `vitest.config.ts` | Create | Vitest configuration |
| `package.json` | Modify | Add vitest dev dependency + test script |

---

### Task 1: Install Vitest and Configure

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install vitest**

Run: `npm install -D vitest`

- [ ] **Step 2: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@lib': '/src/lib',
      '@ui': '/src/ui',
    },
  },
})
```

- [ ] **Step 3: Add test script to package.json**

Add to `"scripts"` in `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify vitest runs**

Run: `npm test`
Expected: "No test files found" (no tests exist yet), exit 0

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "chore: add vitest for unit testing"
```

---

### Task 2: Create PhysicsProperties.ts with TDD

**Files:**
- Create: `src/lib/physics/PhysicsProperties.ts`
- Create: `src/lib/physics/PhysicsProperties.test.ts`

- [ ] **Step 1: Write failing tests for all physics functions**

Create `src/lib/physics/PhysicsProperties.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  density,
  gravity,
  escapeVelocity,
  luminosity,
  isBlackHole,
  orbitalPeriod,
  BLACK_HOLE_THRESHOLD,
  ORBITAL_SCALE_FACTOR,
} from './PhysicsProperties'

describe('density', () => {
  it('computes mass / size^3', () => {
    expect(density(1, 1)).toBe(1)
    expect(density(8, 2)).toBe(1) // 8 / 2^3 = 1
    expect(density(27, 3)).toBe(1) // 27 / 3^3 = 1
  })

  it('returns Infinity for zero size', () => {
    expect(density(1, 0)).toBe(Infinity)
  })

  it('classifies gas giant range', () => {
    // density 0.5-2.0 = gas giant
    const d = density(4, 2) // 4/8 = 0.5
    expect(d).toBeGreaterThanOrEqual(0.5)
    expect(d).toBeLessThanOrEqual(2.0)
  })
})

describe('gravity', () => {
  it('computes mass / size^2', () => {
    expect(gravity(1, 1)).toBe(1)
    expect(gravity(4, 2)).toBe(1) // 4 / 2^2 = 1
    expect(gravity(9, 3)).toBe(1) // 9 / 3^2 = 1
  })

  it('returns Infinity for zero size', () => {
    expect(gravity(1, 0)).toBe(Infinity)
  })
})

describe('escapeVelocity', () => {
  it('computes sqrt(mass / size) * scaleFactor', () => {
    const ev = escapeVelocity(4, 1)
    expect(ev).toBe(Math.sqrt(4) * ORBITAL_SCALE_FACTOR)
  })

  it('increases with mass', () => {
    expect(escapeVelocity(100, 1)).toBeGreaterThan(escapeVelocity(10, 1))
  })

  it('decreases with size', () => {
    expect(escapeVelocity(100, 10)).toBeLessThan(escapeVelocity(100, 1))
  })
})

describe('luminosity', () => {
  it('computes mass^3.5', () => {
    expect(luminosity(1)).toBe(1) // 1^3.5 = 1
    expect(luminosity(2)).toBeCloseTo(Math.pow(2, 3.5))
  })

  it('returns 0 for zero mass', () => {
    expect(luminosity(0)).toBe(0)
  })

  it('scales steeply with mass', () => {
    // 10x mass = ~3162x luminosity
    const ratio = luminosity(10) / luminosity(1)
    expect(ratio).toBeCloseTo(Math.pow(10, 3.5), 0)
  })
})

describe('isBlackHole', () => {
  it('returns false for normal mass/size ratios', () => {
    expect(isBlackHole(1, 1)).toBe(false)
    expect(isBlackHole(100, 1)).toBe(false)
  })

  it('returns true when mass/size exceeds threshold', () => {
    // threshold is 50000
    expect(isBlackHole(BLACK_HOLE_THRESHOLD + 1, 1)).toBe(true)
    expect(isBlackHole(BLACK_HOLE_THRESHOLD * 2, 2)).toBe(true)
  })

  it('returns false just below threshold', () => {
    expect(isBlackHole(BLACK_HOLE_THRESHOLD - 1, 1)).toBe(false)
  })
})

describe('orbitalPeriod', () => {
  it('computes sqrt(radius^3 / parentMass) * scaleFactor', () => {
    const period = orbitalPeriod(1, 1)
    expect(period).toBe(ORBITAL_SCALE_FACTOR) // sqrt(1/1) * scale
  })

  it('increases with orbit radius', () => {
    expect(orbitalPeriod(1, 10)).toBeGreaterThan(orbitalPeriod(1, 5))
  })

  it('decreases with parent mass', () => {
    expect(orbitalPeriod(100, 5)).toBeLessThan(orbitalPeriod(1, 5))
  })

  it('follows Kepler: period^2 proportional to radius^3', () => {
    const p1 = orbitalPeriod(1, 1)
    const p2 = orbitalPeriod(1, 4)
    // p2/p1 should be sqrt(4^3 / 1^3) = sqrt(64) = 8
    expect(p2 / p1).toBeCloseTo(8, 5)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/physics/PhysicsProperties.test.ts`
Expected: FAIL — module `./PhysicsProperties` not found

- [ ] **Step 3: Implement PhysicsProperties.ts**

Create `src/lib/physics/PhysicsProperties.ts`:

```typescript
// ─── Constants (tuning knobs) ──────────────────────────────────────────────

export const BLACK_HOLE_THRESHOLD = 50000    // mass/size ratio
export const NEUTRON_STAR_THRESHOLD = 5000   // mass/size ratio
export const ORBITAL_SCALE_FACTOR = 10       // tuning factor for orbital period feel
export const LUMINOSITY_EXPONENT = 3.5       // mass-luminosity relation

// ─── Derived Property Functions ────────────────────────────────────────────

/** Density = mass / size^3. Determines object character. */
export function density(mass: number, size: number): number {
  if (size === 0) return Infinity
  return mass / (size ** 3)
}

/** Surface gravity = mass / size^2. Drives orbital speed of children. */
export function gravity(mass: number, size: number): number {
  if (size === 0) return Infinity
  return mass / (size ** 2)
}

/** Escape velocity = sqrt(mass / size) * scaleFactor. */
export function escapeVelocity(mass: number, size: number): number {
  if (size === 0) return Infinity
  return Math.sqrt(mass / size) * ORBITAL_SCALE_FACTOR
}

/** Star luminosity = mass^3.5 (mass-luminosity relation). */
export function luminosity(mass: number): number {
  if (mass === 0) return 0
  return Math.pow(mass, LUMINOSITY_EXPONENT)
}

/** Black hole threshold: mass/size ratio exceeds threshold. */
export function isBlackHole(mass: number, size: number): boolean {
  if (size === 0) return true
  return (mass / size) > BLACK_HOLE_THRESHOLD
}

/** Orbital period from Kepler's third law: sqrt(radius^3 / parentMass) * scaleFactor. */
export function orbitalPeriod(parentMass: number, orbitRadius: number): number {
  if (parentMass <= 0) return Infinity
  return Math.sqrt((orbitRadius ** 3) / parentMass) * ORBITAL_SCALE_FACTOR
}

// ─── Display Formatting ────────────────────────────────────────────────────

/** Format a number for display — uses scientific notation for large values. */
export function formatDerived(value: number, precision: number = 1): string {
  if (!isFinite(value)) return '\u221E'
  if (value === 0) return '0'
  if (Math.abs(value) >= 1e6) {
    const exp = Math.floor(Math.log10(Math.abs(value)))
    const mantissa = value / Math.pow(10, exp)
    return `${mantissa.toFixed(precision)} \u00D7 10${toSuperscript(exp)}`
  }
  if (Math.abs(value) < 0.01) {
    const exp = Math.floor(Math.log10(Math.abs(value)))
    const mantissa = value / Math.pow(10, exp)
    return `${mantissa.toFixed(precision)} \u00D7 10${toSuperscript(exp)}`
  }
  return value.toFixed(precision)
}

const superscriptDigits: Record<string, string> = {
  '0': '\u2070', '1': '\u00B9', '2': '\u00B2', '3': '\u00B3', '4': '\u2074',
  '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079',
  '-': '\u207B',
}

function toSuperscript(n: number): string {
  return String(n).split('').map(c => superscriptDigits[c] ?? c).join('')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/physics/PhysicsProperties.test.ts`
Expected: All 14 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/physics/
git commit -m "feat: add PhysicsProperties pure functions with tests"
```

---

### Task 3: Add Velocity to Entity + Update SceneGraph Defaults

**Files:**
- Modify: `src/lib/ecs/types.ts:139-148`
- Modify: `src/lib/ecs/SceneGraph.ts:43-66`

- [ ] **Step 1: Add velocity to Entity interface**

In `src/lib/ecs/types.ts`, modify the Entity interface (line 139-148):

```typescript
export interface Entity {
  id: string
  name: string
  type: EntityType
  parentId: string | null
  childIds: string[]
  mass: number
  size: number
  velocity: number
  components: Record<string, Component>
}
```

- [ ] **Step 2: Add default masses and velocity to SceneGraph.createEntity**

In `src/lib/ecs/SceneGraph.ts`, add a `defaultMasses` map and `velocity` field in `createEntity()` (lines 43-66):

```typescript
  createEntity(
    type: EntityType,
    name?: string,
    parentId?: string | null,
    components?: Record<string, Component>
  ): Entity {
    const id = generateId()
    const defaultSizes: Record<string, number> = {
      'star': 2.0,
      'planet': 1.0,
      'moon': 0.5,
      'nebula': 4.0,
      'galaxy': 12.0,
      'alien-tech': 3.0,
      'oort-cloud': 5.0,
      'placeholder': 1.0,
    }

    const defaultMasses: Record<string, number> = {
      'star': 333000,
      'planet': 1.0,
      'moon': 0.012,
      'nebula': 0.001,
      'galaxy': 1000000000,
      'alien-tech': 100,
      'oort-cloud': 0.001,
      'placeholder': 1.0,
    }

    const entity: Entity = {
      id,
      name: name ?? `${defaultNames[type]} ${this.entities.size + 1}`,
      type,
      parentId: parentId ?? null,
      childIds: [],
      mass: defaultMasses[type] ?? 1.0,
      size: defaultSizes[type] ?? 1.0,
      velocity: 0,
      components: {
        transform: defaultTransform(),
        ...components,
      },
    }
```

- [ ] **Step 3: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No errors (or only pre-existing ones). If there are errors about missing `velocity` in object literals elsewhere, fix them by adding `velocity: 0`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ecs/types.ts src/lib/ecs/SceneGraph.ts
git commit -m "feat: add velocity to Entity, type-appropriate default masses"
```

---

### Task 4: Wire Physics into SceneStore

**Files:**
- Modify: `src/lib/stores/sceneStore.svelte.ts`

This task adds a new `updateEntityField()` function to sceneStore that triggers cascading physics effects when mass/size/velocity change.

- [ ] **Step 1: Add physics imports to sceneStore**

At the top of `src/lib/stores/sceneStore.svelte.ts`, add:

```typescript
import { luminosity, isBlackHole, orbitalPeriod } from '@lib/physics/PhysicsProperties'
```

- [ ] **Step 2: Add updateEntityField with cascading effects**

Add this function in the exports section of `sceneStore.svelte.ts` (after the existing `updateComponent` function around line 183):

```typescript
/** Update a top-level entity field (mass, size, velocity) with cascading physics effects */
export function updateEntityField(entityId: string, field: 'mass' | 'size' | 'velocity', value: number): void {
  const entity = graph.get(entityId)
  if (!entity) return

  entity[field] = value

  // Cascade 1: Star luminosity → corona uniforms
  if (entity.type === 'star' && (field === 'mass' || field === 'size')) {
    const starComp = entity.components['star'] as StarComponent | undefined
    if (starComp) {
      const lum = luminosity(entity.mass)
      // Scale corona intensity from luminosity (log scale for usable range)
      const logLum = lum > 0 ? Math.log10(lum) : 0
      const coronaIntensity = Math.max(0.1, Math.min(3.0, logLum * 0.15))
      const updated = { ...starComp, coronaIntensity }
      updateComponent(entityId, updated)
      syncComponentToThreeObject(entityId, 'star')
    }
  }

  // Cascade 2: Black hole auto-detection
  if (entity.type === 'star' && (field === 'mass' || field === 'size')) {
    const starComp = entity.components['star'] as StarComponent | undefined
    if (starComp) {
      const shouldBeBlackHole = isBlackHole(entity.mass, entity.size)
      const isCurrentlyBlackHole = starComp.variant === 'black-hole'
      if (shouldBeBlackHole !== isCurrentlyBlackHole) {
        const newVariant = shouldBeBlackHole ? 'black-hole' : 'main-sequence'
        const updated = { ...starComp, variant: newVariant }
        updateComponent(entityId, updated)
        regenerateEntity(entityId)
      }
    }
  }

  // Cascade 3: Parent mass/size change → recalculate child orbital periods
  if (field === 'mass') {
    for (const childId of entity.childIds) {
      const child = graph.get(childId)
      if (!child) continue
      const orbital = child.components['orbital'] as OrbitalComponent | undefined
      if (orbital) {
        const newPeriod = orbitalPeriod(entity.mass, orbital.orbitRadius)
        const updated = { ...orbital, period: newPeriod }
        graph.setComponent(childId, updated)
        syncComponentToThreeObject(childId, 'orbital')
      }
    }
  }

  sync()
}
```

- [ ] **Step 3: Update orbit radius changes to recalculate period**

In the existing `syncComponentToThreeObject` function's orbital section (around line 278), add period recalculation when orbit radius changes. Replace the orbital block:

Find the orbital sync block (line 278-308) and add period recalculation before the path rebuild. After line `if (!comp) return` and before `const engine = getEngine()`:

```typescript
  // Orbital live updates
  if (componentType === 'orbital') {
    const comp = entity.components['orbital'] as OrbitalComponent | undefined
    if (!comp) return

    // Recalculate period from parent mass + orbit radius
    if (entity.parentId) {
      const parent = graph.get(entity.parentId)
      if (parent) {
        const newPeriod = orbitalPeriod(parent.mass, comp.orbitRadius)
        if (Math.abs(comp.period - newPeriod) > 0.01) {
          comp.period = newPeriod
          graph.setComponent(entityId, comp)
        }
      }
    }

    // Determine orbit path color: red if velocity > escape velocity
    let pathColor = 0x334466
    if (entity.parentId) {
      const parent = graph.get(entity.parentId)
      if (parent && entity.velocity > 0) {
        const ev = escapeVelocity(parent.mass, parent.size)
        if (entity.velocity > ev) {
          pathColor = 0xff4444
        }
      }
    }

    const engine = getEngine()
    // ... rest of existing orbital path rebuild code, but pass pathColor:
    // const path = createOrbitPath(comp)  →  const path = createOrbitPath(comp, pathColor)
```

Also add `escapeVelocity` to the physics import at the top of sceneStore:

```typescript
import { luminosity, isBlackHole, orbitalPeriod, escapeVelocity } from '@lib/physics/PhysicsProperties'
```

- [ ] **Step 4: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/sceneStore.svelte.ts
git commit -m "feat: wire physics cascading effects into sceneStore"
```

---

### Task 5: Update PropertiesPanel — Velocity Slider + Derived Display

**Files:**
- Modify: `src/ui/panels/PropertiesPanel.svelte`

- [ ] **Step 1: Add imports**

In `PropertiesPanel.svelte`, add physics imports in the `<script>` block:

```typescript
import { updateEntityField as storeUpdateEntityField } from '@lib/stores/sceneStore.svelte'
import { density, gravity, escapeVelocity, formatDerived } from '@lib/physics/PhysicsProperties'
```

- [ ] **Step 2: Replace updateEntityField to use sceneStore version**

Replace the existing `updateEntityField` function (lines 36-39):

```typescript
  function updateEntityField(field: 'mass' | 'size' | 'velocity', value: number) {
    if (!selectedEntity) return
    storeUpdateEntityField(selectedEntity.id, field, value)
  }
```

- [ ] **Step 3: Add derived properties computed values**

Add derived values as `$derived` after the existing `transform` derived (after line 22):

```typescript
  let derivedProps = $derived.by(() => {
    if (!selectedEntity) return null
    const m = selectedEntity.mass
    const s = selectedEntity.size
    return {
      density: density(m, s),
      gravity: gravity(m, s),
      escapeVelocity: escapeVelocity(m, s),
    }
  })
```

- [ ] **Step 4: Add velocity slider and derived properties display to template**

Replace the Physics section (lines 67-87) with:

```svelte
    <!-- Physics -->
    <div class="flex flex-col gap-3">
      <h3 class="section-heading">
        Physics
      </h3>
      <SliderControl
        label="Mass"
        value={selectedEntity.mass}
        min={0.001}
        max={selectedEntity.type === 'star' ? 1000000 : selectedEntity.type === 'galaxy' ? 1e10 : 1000}
        step={selectedEntity.type === 'star' ? 100 : 0.1}
        oninput={(v) => updateEntityField('mass', v)}
      />
      <SliderControl
        label="Size"
        value={selectedEntity.size}
        min={0.01}
        max={selectedEntity.type === 'star' ? 500 : selectedEntity.type === 'galaxy' ? 100 : 20}
        step={0.1}
        oninput={(v) => updateEntityField('size', v)}
      />
      <SliderControl
        label="Velocity"
        value={selectedEntity.velocity}
        min={0}
        max={10}
        step={0.1}
        oninput={(v) => updateEntityField('velocity', v)}
      />
    </div>

    <!-- Derived Properties -->
    {#if derivedProps}
      <div class="flex flex-col gap-2">
        <h3 class="section-heading" style="opacity: 0.6">
          Derived
        </h3>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs" style="color: var(--text-muted)">
          <span>Density</span>
          <span class="font-mono tabular-nums text-right">{formatDerived(derivedProps.density)}</span>
          <span>Gravity</span>
          <span class="font-mono tabular-nums text-right">{formatDerived(derivedProps.gravity)}</span>
          <span>Escape Vel.</span>
          <span class="font-mono tabular-nums text-right">{formatDerived(derivedProps.escapeVelocity)}</span>
        </div>
      </div>
    {/if}
```

- [ ] **Step 5: Verify in browser**

Run: `npm run dev`
Open browser. Select any entity — should see Mass, Size, Velocity sliders + Derived section with Density, Gravity, Escape Vel. values.

- [ ] **Step 6: Commit**

```bash
git add src/ui/panels/PropertiesPanel.svelte
git commit -m "feat: add velocity slider and derived properties display"
```

---

### Task 6: Update StarPanel — Luminosity + Black Hole Auto-Detection

**Files:**
- Modify: `src/ui/panels/StarPanel.svelte`

- [ ] **Step 1: Add physics imports**

In `StarPanel.svelte`, add:

```typescript
import { luminosity, isBlackHole, formatDerived } from '@lib/physics/PhysicsProperties'
```

- [ ] **Step 2: Add derived luminosity**

After the existing `comp` derived (line 9), add:

```typescript
  let starLuminosity = $derived.by(() => {
    if (!entity) return 0
    return luminosity(entity.mass)
  })

  let blackHoleDetected = $derived.by(() => {
    if (!entity) return false
    return isBlackHole(entity.mass, entity.size)
  })
```

- [ ] **Step 3: Add luminosity display and black hole indicator to template**

After the Radius slider (line 107) and before the closing `</div>`, add:

```svelte
    <!-- Derived Star Properties -->
    <div class="flex flex-col gap-2 pt-2">
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs" style="color: var(--text-muted)">
        <span>Luminosity</span>
        <span class="font-mono tabular-nums text-right">{formatDerived(starLuminosity)}</span>
      </div>
      {#if blackHoleDetected && comp?.variant !== 'black-hole'}
        <div class="text-xs px-2 py-1 rounded" style="background: rgba(255,60,60,0.15); color: #ff6b6b; border: 1px solid rgba(255,60,60,0.3)">
          Mass/size ratio exceeds black hole threshold
        </div>
      {/if}
    </div>
```

- [ ] **Step 4: Verify in browser**

Select a star entity. Should see luminosity value below the radius slider. Crank mass up to extreme values — should see the black hole warning appear.

- [ ] **Step 5: Commit**

```bash
git add src/ui/panels/StarPanel.svelte
git commit -m "feat: show luminosity and black hole indicator on StarPanel"
```

---

### Task 7: Update PlanetPanel — Density Display

**Files:**
- Modify: `src/ui/panels/PlanetPanel.svelte`

- [ ] **Step 1: Add physics imports**

In `PlanetPanel.svelte`, add:

```typescript
import { density, formatDerived } from '@lib/physics/PhysicsProperties'
```

- [ ] **Step 2: Add derived density**

After the existing `comp` derived (line 13), add:

```typescript
  let planetDensity = $derived.by(() => {
    if (!entity) return 0
    return density(entity.mass, entity.size)
  })
```

- [ ] **Step 3: Add density display to template**

After the Radius slider (line 96) and before the Atmosphere section, add:

```svelte
    <!-- Derived Planet Properties -->
    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pt-1" style="color: var(--text-muted)">
      <span>Density</span>
      <span class="font-mono tabular-nums text-right">{formatDerived(planetDensity)}</span>
    </div>
```

- [ ] **Step 4: Verify in browser**

Select a planet. Should see density value below the radius slider.

- [ ] **Step 5: Commit**

```bash
git add src/ui/panels/PlanetPanel.svelte
git commit -m "feat: show density on PlanetPanel"
```

---

### Task 8: Update OrbitalPanel — Period Becomes Read-Only

**Files:**
- Modify: `src/ui/panels/OrbitalPanel.svelte`

- [ ] **Step 1: Add physics imports**

In `OrbitalPanel.svelte`, add:

```typescript
import { getGraph } from '@lib/stores/sceneStore.svelte'
import { orbitalPeriod, formatDerived } from '@lib/physics/PhysicsProperties'
```

- [ ] **Step 2: Add derived period**

After the existing `comp` derived (line 8), add:

```typescript
  let derivedPeriod = $derived.by(() => {
    if (!comp || !entity.parentId) return comp?.period ?? 0
    const parent = getGraph().get(entity.parentId)
    if (!parent) return comp?.period ?? 0
    return orbitalPeriod(parent.mass, comp.orbitRadius)
  })
```

- [ ] **Step 3: Replace period slider with read-only display**

Replace the Period slider (lines 33-39) with:

```svelte
    <div class="flex flex-col gap-1">
      <div class="flex justify-between text-xs">
        <span style="color: var(--label)">Period</span>
        <span class="font-mono tabular-nums" style="color: var(--text-muted)">{formatDerived(derivedPeriod)}</span>
      </div>
      <div class="text-[10px]" style="color: var(--text-muted); opacity: 0.6">
        Derived from parent mass + orbit radius
      </div>
    </div>
```

- [ ] **Step 4: Verify in browser**

Select an orbiting entity (planet around star). Period should display as read-only text. Changing the orbit radius slider should cause the period value to update. Changing the parent star's mass should also update the period.

- [ ] **Step 5: Commit**

```bash
git add src/ui/panels/OrbitalPanel.svelte
git commit -m "feat: derive orbital period from parent mass + orbit radius"
```

---

## Task Dependency Graph

```
Task 1 (Vitest setup)
  └─► Task 2 (PhysicsProperties TDD)
        └─► Task 4 (SceneStore wiring)
        │     └─► Task 5 (PropertiesPanel)
        │     └─► Task 8 (OrbitalPanel)
        └─► Task 6 (StarPanel)
        └─► Task 7 (PlanetPanel)

Task 3 (Entity types + defaults) ─► Task 4, 5, 6, 7, 8
```

Tasks 1→2 and Task 3 can run in **parallel** (different files, no conflicts).
After Tasks 2+3 complete: Tasks 4, 6, 7 can run in **parallel**.
After Task 4 completes: Tasks 5, 8 can run in **parallel**.

## Team Agent Assignments

| Agent | Tasks | Why |
|-------|-------|-----|
| **physics** | 1, 2 | New files only — no merge conflicts possible |
| **data-model** | 3 | Small edits to types.ts + SceneGraph.ts |
| **integration** | 4, 5, 8 | SceneStore + panels that depend on it (sequential) |
| **panels** | 6, 7 | Independent panel files, can work in parallel |
