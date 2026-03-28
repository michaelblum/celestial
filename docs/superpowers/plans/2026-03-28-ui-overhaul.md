# UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Celestial UI with the original's neon purple aesthetic, restructure the sidebar as the sole control surface, and remove the floating toolbar.

**Architecture:** CSS custom properties define the color system. The floating Toolbar is deleted — add-entity buttons move into EntityTree, save/load move to the nav rail. A new SidebarTitle component handles the animated "CELESTIAL" gradient text with 750ms crosshair collapse on scroll. All controls and panels get restyled to the purple theme.

**Tech Stack:** Svelte 5 (runes), TailwindCSS 4, CSS custom properties, CSS keyframe animations

---

### Task 1: CSS Foundation — color system and global styles

**Files:**
- Modify: `src/app.css`

- [ ] **Step 1: Replace the entire contents of `src/app.css`**

```css
@import "tailwindcss";

/* ─── Celestial Color System ─────────────────────────────────────────────── */

:root {
  --bg-sidebar: rgba(20, 10, 30, 0.85);
  --bg-rail: rgba(15, 5, 25, 0.6);
  --bg-control: #1a0b2e;
  --bg-control-hover: #2a1b3d;
  --bg-group: rgba(42, 27, 61, 0.4);
  --border-subtle: rgba(74, 43, 110, 0.4);
  --border-control: rgba(74, 43, 110, 0.5);
  --border-glow: rgba(209, 135, 255, 0.3);
  --accent: #bc13fe;
  --accent-glow: rgba(188, 19, 254, 0.5);
  --accent-hover: rgba(188, 19, 254, 0.2);
  --label: #d187ff;
  --icon-default: #a060d0;
  --text-primary: #ffffff;
  --text-muted: #aaaaaa;
}

/* ─── Glass Morphism ─────────────────────────────────────────────────────── */

@layer components {
  .glass-panel {
    background: var(--bg-sidebar);
    backdrop-filter: blur(8px);
    border: 1px solid var(--border-glow);
    border-radius: 8px;
    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.5);
  }
}

/* ─── Global Resets ──────────────────────────────────────────────────────── */

html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #050208;
  color: var(--text-primary);
  font-family: 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
  -webkit-font-smoothing: antialiased;
}

#app {
  width: 100vw;
  height: 100vh;
  position: relative;
}

/* ─── Scrollbar ──────────────────────────────────────────────────────────── */

::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb {
  background: #4a2b6e;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #6b3fa0;
}

/* ─── Range Input ────────────────────────────────────────────────────────── */

input[type="range"] {
  accent-color: var(--accent);
}

/* ─── Color Picker ───────────────────────────────────────────────────────── */

input[type="color"] {
  -webkit-appearance: none;
  border: none;
  padding: 0;
  cursor: pointer;
}
input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}
input[type="color"]::-webkit-color-swatch {
  border: 1px solid var(--border-control);
  border-radius: 4px;
}

/* ─── Section Heading ────────────────────────────────────────────────────── */

.section-heading {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--accent);
  padding-bottom: 4px;
  margin-bottom: 0;
}

/* ─── CELESTIAL Title Animations (750ms) ─────────────────────────────────── */

@keyframes title-collapse-text {
  0% { transform: scaleY(1); opacity: 1; filter: drop-shadow(0px 0px 6px rgba(0, 229, 255, 0.7)) drop-shadow(0px 0px 14px rgba(188, 19, 254, 0.5)); }
  15% { transform: scaleY(0.05); opacity: 1; filter: drop-shadow(0px 0px 10px rgba(255, 255, 255, 0.8)); }
  20% { transform: scaleY(0); opacity: 0; }
  100% { transform: scaleY(0); opacity: 0; }
}

@keyframes title-collapse-x {
  0% { transform: scaleX(1) scaleY(0); opacity: 0; }
  15% { transform: scaleX(1) scaleY(1); opacity: 1; }
  50% { transform: scaleX(0.1) scaleY(1); opacity: 1; }
  60% { transform: scaleX(0) scaleY(1); opacity: 0; }
  100% { transform: scaleX(0) scaleY(1); opacity: 0; }
}

@keyframes title-collapse-y {
  0% { transform: scaleY(0); opacity: 0; }
  20% { transform: scaleY(0); opacity: 0; }
  50% { transform: scaleY(1); opacity: 1; }
  60% { transform: scaleY(0); opacity: 0; }
  100% { transform: scaleY(0); opacity: 0; }
}

@keyframes title-collapse-dot {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.5); opacity: 1; }
  80% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0); opacity: 0; }
}

@keyframes title-expand-text {
  0% { transform: scaleY(0); opacity: 0; }
  80% { transform: scaleY(0); opacity: 0; }
  85% { transform: scaleY(0.05); opacity: 1; filter: drop-shadow(0px 0px 10px rgba(255, 255, 255, 0.8)); }
  100% { transform: scaleY(1); opacity: 1; filter: drop-shadow(0px 0px 6px rgba(0, 229, 255, 0.7)) drop-shadow(0px 0px 14px rgba(188, 19, 254, 0.5)); }
}

@keyframes title-expand-x {
  0% { transform: scaleX(0) scaleY(1); opacity: 0; }
  40% { transform: scaleX(0) scaleY(1); opacity: 0; }
  50% { transform: scaleX(0.1) scaleY(1); opacity: 1; }
  85% { transform: scaleX(1) scaleY(1); opacity: 1; }
  100% { transform: scaleX(1) scaleY(0); opacity: 0; }
}

@keyframes title-expand-y {
  0% { transform: scaleY(0); opacity: 0; }
  40% { transform: scaleY(1); opacity: 1; }
  80% { transform: scaleY(0); opacity: 0; }
  100% { transform: scaleY(0); opacity: 0; }
}

@keyframes title-expand-dot {
  0% { transform: scale(0); opacity: 0; }
  20% { transform: scale(1); opacity: 1; }
  40% { transform: scale(1.5); opacity: 1; }
  50% { transform: scale(0); opacity: 0; }
  100% { transform: scale(0); opacity: 0; }
}
```

- [ ] **Step 2: Verify the dev server picks up the changes**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Clean.

- [ ] **Step 3: Commit**

```bash
git add src/app.css
git commit -m "feat: replace color system with neon purple theme + title animation keyframes"
```

---

### Task 2: Create SidebarTitle component

**Files:**
- Create: `src/ui/shared/SidebarTitle.svelte`

- [ ] **Step 1: Create the animated title component**

Create `src/ui/shared/SidebarTitle.svelte`:

```svelte
<script lang="ts">
  import { getSceneName, setSceneName } from '@lib/stores/sceneStore.svelte'
  import { isSidebarOpen } from '@lib/stores/uiStore.svelte'

  let scrollState = $state<'idle' | 'scrolled' | 'scrolled-up'>('idle')
  let hasScrolledOnce = $state(false)

  export function onPanelScroll(scrollTop: number) {
    if (scrollTop > 10) {
      if (!hasScrolledOnce || scrollState !== 'scrolled') {
        scrollState = 'scrolled'
        hasScrolledOnce = true
      }
    } else if (hasScrolledOnce && scrollState !== 'scrolled-up') {
      scrollState = 'scrolled-up'
    }
  }
</script>

<div
  class="title-wrapper"
  class:sidebar-hidden={!isSidebarOpen()}
>
  <!-- Animated text -->
  <div
    class="title-text"
    class:anim-collapse={scrollState === 'scrolled'}
    class:anim-expand={scrollState === 'scrolled-up'}
  >
    CELESTIAL
  </div>

  <!-- Crosshair elements -->
  <div
    class="crosshair-x"
    class:anim-collapse={scrollState === 'scrolled'}
    class:anim-expand={scrollState === 'scrolled-up'}
  ></div>
  <div
    class="crosshair-y"
    class:anim-collapse={scrollState === 'scrolled'}
    class:anim-expand={scrollState === 'scrolled-up'}
  ></div>
  <div
    class="anim-dot"
    class:anim-collapse={scrollState === 'scrolled'}
    class:anim-expand={scrollState === 'scrolled-up'}
  ></div>

  <!-- Scene name -->
  <input
    type="text"
    value={getSceneName()}
    oninput={(e) => setSceneName((e.target as HTMLInputElement).value)}
    class="scene-name"
    placeholder="Scene name..."
  />
</div>

<style>
  .title-wrapper {
    position: relative;
    padding: 24px 0 12px 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    transition: opacity 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .title-wrapper.sidebar-hidden {
    opacity: 0;
    transform: translateX(-10px);
    pointer-events: none;
  }

  .title-text {
    font-size: 26px;
    font-weight: 300;
    letter-spacing: 7px;
    text-transform: uppercase;
    background: linear-gradient(135deg, #d187ff 0%, #00e5ff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    filter: drop-shadow(0px 0px 6px rgba(0, 229, 255, 0.7)) drop-shadow(0px 0px 14px rgba(188, 19, 254, 0.5));
    transform-origin: center center;
    line-height: 1;
  }

  .crosshair-x {
    position: absolute;
    top: 38px;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, #d187ff, #00e5ff);
    transform: scaleX(0) scaleY(0);
    opacity: 0;
    transform-origin: center center;
  }

  .crosshair-y {
    position: absolute;
    top: 28px;
    left: 50%;
    width: 2px;
    height: 20px;
    background: linear-gradient(180deg, #d187ff, #00e5ff);
    transform: scaleY(0);
    opacity: 0;
    transform-origin: center center;
    margin-left: -1px;
  }

  .anim-dot {
    position: absolute;
    top: 36px;
    left: 50%;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #00e5ff;
    transform: scale(0);
    opacity: 0;
    margin-left: -3px;
    box-shadow: 0 0 8px rgba(0, 229, 255, 0.8);
  }

  /* Collapse animations (750ms) */
  .title-text.anim-collapse { animation: title-collapse-text 750ms ease-out forwards; }
  .crosshair-x.anim-collapse { animation: title-collapse-x 750ms ease-out forwards; }
  .crosshair-y.anim-collapse { animation: title-collapse-y 750ms ease-out forwards; }
  .anim-dot.anim-collapse { animation: title-collapse-dot 750ms ease-out forwards; }

  /* Expand animations (750ms) */
  .title-text.anim-expand { animation: title-expand-text 750ms ease-out forwards; }
  .crosshair-x.anim-expand { animation: title-expand-x 750ms ease-out forwards; }
  .crosshair-y.anim-expand { animation: title-expand-y 750ms ease-out forwards; }
  .anim-dot.anim-expand { animation: title-expand-dot 750ms ease-out forwards; }

  .scene-name {
    margin-top: 8px;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-muted);
    font-size: 12px;
    width: 100%;
    padding: 0;
  }
  .scene-name:focus {
    color: var(--text-primary);
  }
  .scene-name::placeholder {
    color: rgba(160, 96, 208, 0.4);
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/shared/SidebarTitle.svelte
git commit -m "feat: add SidebarTitle with animated gradient text and crosshair collapse"
```

---

### Task 3: Rewrite Sidebar with new structure

**Files:**
- Modify: `src/ui/layout/Sidebar.svelte`

- [ ] **Step 1: Replace the entire contents of `src/ui/layout/Sidebar.svelte`**

```svelte
<script lang="ts">
  import { isSidebarOpen, toggleSidebar, getActivePanel, setActivePanel } from '@lib/stores/uiStore.svelte'
  import { saveScene, loadScene } from '@lib/stores/sceneStore.svelte'
  import EntityTree from '@ui/panels/EntityTree.svelte'
  import PropertiesPanel from '@ui/panels/PropertiesPanel.svelte'
  import SidebarTitle from '@ui/shared/SidebarTitle.svelte'

  let titleRef: SidebarTitle
  let fileInput: HTMLInputElement

  const panels = [
    { id: 'entities', icon: '☰', label: 'Entities' },
    { id: 'properties', icon: '⚙', label: 'Properties' },
    { id: 'presets', icon: '✦', label: 'Presets' },
  ]

  function handlePanelScroll(e: Event) {
    const target = e.target as HTMLElement
    titleRef?.onPanelScroll(target.scrollTop)
  }

  async function handleLoad() {
    fileInput?.click()
  }

  async function onFileSelected(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      try {
        await loadScene(file)
      } catch (err) {
        console.error('Failed to load scene:', err)
      }
    }
  }
</script>

<input
  bind:this={fileInput}
  type="file"
  accept=".json,.celestial.json"
  class="hidden"
  onchange={onFileSelected}
/>

<div
  class="sidebar"
  class:collapsed={!isSidebarOpen()}
>
  <!-- Nav Rail -->
  <div class="rail">
    <!-- Toggle -->
    <button
      onclick={toggleSidebar}
      class="rail-icon toggle-btn"
      title={isSidebarOpen() ? 'Collapse sidebar' : 'Expand sidebar'}
    >
      {isSidebarOpen() ? '◀' : '▶'}
    </button>

    <!-- Panel Icons -->
    {#each panels as panel}
      {@const isActive = getActivePanel() === panel.id && isSidebarOpen()}
      <button
        onclick={() => setActivePanel(panel.id)}
        class="rail-icon"
        class:active={isActive}
        title={panel.label}
      >
        {panel.icon}
      </button>
    {/each}

    <!-- Spacer -->
    <div class="flex-1"></div>

    <!-- Save / Load -->
    <button
      onclick={saveScene}
      class="rail-icon"
      title="Save scene"
    >
      💾
    </button>
    <button
      onclick={handleLoad}
      class="rail-icon"
      title="Load scene"
    >
      📂
    </button>
  </div>

  <!-- Content Area -->
  <div class="content" class:hidden-content={!isSidebarOpen()}>
    <div class="content-inner">
      <!-- Title -->
      <div class="title-area">
        <SidebarTitle bind:this={titleRef} />
      </div>

      <!-- Panel Content -->
      <div class="panel-scroll" onscroll={handlePanelScroll}>
        {#if getActivePanel() === 'entities'}
          <div class="p-3">
            <EntityTree />
          </div>
        {:else if getActivePanel() === 'properties'}
          <PropertiesPanel />
        {:else if getActivePanel() === 'presets'}
          <div class="p-4 text-xs italic text-center" style="color: var(--icon-default)">
            Preset browser coming soon
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .sidebar {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    z-index: 20;
    display: flex;
    pointer-events: auto;
    width: 340px;
    transition: width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .sidebar.collapsed {
    width: 60px;
  }

  .rail {
    width: 60px;
    min-width: 60px;
    height: 100%;
    background: var(--bg-rail);
    border-right: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 0;
    gap: 4px;
    overflow-y: auto;
  }

  .rail::-webkit-scrollbar {
    display: none;
  }

  .rail-icon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: var(--icon-default);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .rail-icon:hover {
    background: var(--accent-hover);
    color: var(--text-primary);
  }

  .rail-icon.active {
    background: var(--accent);
    color: var(--text-primary);
    box-shadow: 0 0 10px var(--accent-glow);
  }

  .toggle-btn {
    margin-bottom: 32px;
  }

  .content {
    flex: 1;
    min-width: 0;
    height: 100%;
    background: var(--bg-sidebar);
    backdrop-filter: blur(8px);
    border-right: 1px solid var(--border-glow);
    overflow: hidden;
    transition: opacity 0.3s ease;
  }

  .hidden-content {
    opacity: 0;
    pointer-events: none;
    width: 0;
  }

  .content-inner {
    width: 280px;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .title-area {
    padding: 0 20px;
    flex-shrink: 0;
  }

  .panel-scroll {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 80px;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/layout/Sidebar.svelte
git commit -m "feat: rewrite sidebar with neon purple theme, nav rail save/load, title integration"
```

---

### Task 4: Update EntityTree with add-entity buttons and inline actions

**Files:**
- Modify: `src/ui/panels/EntityTree.svelte`

- [ ] **Step 1: Replace the entire contents of `src/ui/panels/EntityTree.svelte`**

This moves the add-entity logic from the deleted Toolbar into EntityTree and adds inline duplicate/delete buttons on entity rows.

```svelte
<script lang="ts">
  import type { Entity, EntityType } from '@lib/ecs/types'
  import { getEntities, getGraph, addEntity, removeEntity, duplicateEntity, getThreeObject } from '@lib/stores/sceneStore.svelte'
  import { getSelectedId, select, clearSelection } from '@lib/stores/selectionStore.svelte'
  import { defaultOrbitalConfig, createOrbitPath } from '@lib/generators/OrbitalSystem'
  import { getEngine } from '@lib/stores/engineStore.svelte'

  let roots = $derived(getEntities().filter((e) => e.parentId === null))

  function getChildren(parentId: string): Entity[] {
    return getEntities().filter((e) => e.parentId === parentId)
  }

  const typeIcons: Record<string, string> = {
    star: '★',
    planet: '●',
    moon: '○',
    nebula: '☁',
    galaxy: '🌀',
    'oort-cloud': '◌',
    'alien-tech': '◆',
    placeholder: '◇',
  }

  const addButtons: { type: EntityType; icon: string; label: string }[] = [
    { type: 'star', icon: '★', label: 'Star' },
    { type: 'planet', icon: '●', label: 'Planet' },
    { type: 'nebula', icon: '☁', label: 'Nebula' },
    { type: 'galaxy', icon: '🌀', label: 'Galaxy' },
    { type: 'alien-tech', icon: '◆', label: 'Alien Tech' },
  ]

  function handleAdd(type: EntityType) {
    const selectedId = getSelectedId()
    const selectedEntity = selectedId ? getGraph().get(selectedId) : null

    if (type === 'planet' && selectedEntity?.type === 'star') {
      const orbitRadius = 3 + Math.random() * 5
      const orbital = defaultOrbitalConfig(orbitRadius)

      addEntity(type, undefined, selectedId, {
        transform: { type: 'transform', position: [orbitRadius, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        orbital,
      })

      const engine = getEngine()
      if (engine) {
        const path = createOrbitPath(orbital)
        const parentObj = getThreeObject(selectedId)
        if (parentObj) {
          path.position.copy(parentObj.position)
        }
        engine.scene.add(path)
      }
      return
    }

    const offset = Math.random() * 8 - 4
    addEntity(type, undefined, null, {
      transform: {
        type: 'transform',
        position: [offset, Math.random() * 2 - 1, Math.random() * 4 - 2],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
    })
  }

  function handleDelete(id: string, e: Event) {
    e.stopPropagation()
    removeEntity(id)
    if (getSelectedId() === id) clearSelection()
  }

  function handleDuplicate(id: string, e: Event) {
    e.stopPropagation()
    duplicateEntity(id)
  }
</script>

<div class="flex flex-col gap-2">
  <!-- Add Entity Buttons -->
  <div class="add-row">
    {#each addButtons as btn}
      <button
        onclick={() => handleAdd(btn.type)}
        class="add-btn"
        title="Add {btn.label}"
      >
        {btn.icon}
      </button>
    {/each}
  </div>

  <!-- Entity List -->
  <div class="flex flex-col gap-0.5">
    {#if roots.length === 0}
      <p class="text-xs italic px-2 py-4 text-center" style="color: var(--icon-default)">
        No entities yet. Click an icon above to add one.
      </p>
    {/if}

    {#each roots as entity (entity.id)}
      {@render entityNode(entity, 0)}
    {/each}
  </div>
</div>

{#snippet entityNode(entity: Entity, depth: number)}
  {@const isSelected = getSelectedId() === entity.id}
  {@const children = getChildren(entity.id)}

  <div class="entity-row" class:selected={isSelected}>
    <button
      onclick={() => select(entity.id)}
      class="entity-btn"
      style="padding-left: {12 + depth * 16}px"
    >
      <span class="entity-icon">{typeIcons[entity.type] ?? '◇'}</span>
      <span class="truncate flex-1">{entity.name}</span>
      {#if children.length > 0}
        <span class="child-count">{children.length}</span>
      {/if}
    </button>

    <!-- Inline actions (visible on hover / selection) -->
    <div class="entity-actions">
      <button
        onclick={(e) => handleDuplicate(entity.id, e)}
        class="action-btn"
        title="Duplicate"
      >⧉</button>
      <button
        onclick={(e) => handleDelete(entity.id, e)}
        class="action-btn delete"
        title="Delete"
      >✕</button>
    </div>
  </div>

  {#each children as child (child.id)}
    {@render entityNode(child, depth + 1)}
  {/each}
{/snippet}

<style>
  .add-row {
    display: flex;
    gap: 4px;
    padding: 0 4px;
  }

  .add-btn {
    flex: 1;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-control);
    border: 1px solid var(--border-control);
    border-radius: 6px;
    color: var(--icon-default);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .add-btn:hover {
    background: var(--accent-hover);
    color: var(--text-primary);
    border-color: var(--accent);
  }

  .entity-row {
    position: relative;
    display: flex;
    align-items: center;
    border-radius: 6px;
    transition: background 0.1s ease;
  }

  .entity-row:hover {
    background: rgba(188, 19, 254, 0.08);
  }

  .entity-row.selected {
    background: var(--accent-hover);
  }

  .entity-btn {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    min-width: 0;
  }

  .entity-row.selected .entity-btn {
    color: var(--label);
  }

  .entity-icon {
    font-size: 11px;
    opacity: 0.6;
  }

  .child-count {
    font-size: 10px;
    color: var(--icon-default);
    opacity: 0.5;
  }

  .entity-actions {
    display: flex;
    gap: 2px;
    padding-right: 4px;
    opacity: 0;
    transition: opacity 0.1s ease;
  }

  .entity-row:hover .entity-actions,
  .entity-row.selected .entity-actions {
    opacity: 1;
  }

  .action-btn {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--icon-default);
    font-size: 11px;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.1s ease;
  }

  .action-btn:hover {
    background: var(--accent-hover);
    color: var(--text-primary);
  }

  .action-btn.delete:hover {
    background: rgba(255, 68, 68, 0.15);
    color: #ff4444;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/panels/EntityTree.svelte
git commit -m "feat: add entity buttons and inline duplicate/delete to EntityTree"
```

---

### Task 5: Update App.svelte — remove Toolbar, simplify layout

**Files:**
- Modify: `src/App.svelte`
- Delete: `src/ui/layout/Toolbar.svelte`

- [ ] **Step 1: Replace the entire contents of `src/App.svelte`**

```svelte
<script lang="ts">
  import Viewport from '@ui/layout/Viewport.svelte'
  import Sidebar from '@ui/layout/Sidebar.svelte'
  import StudioNav from '@ui/layout/StudioNav.svelte'
  import { getEntities, getActiveStudio } from '@lib/stores/sceneStore.svelte'
</script>

<div class="w-screen h-screen relative" style="background: #050208">
  <!-- 3D Viewport -->
  <Viewport />

  <!-- UI Overlay -->
  <div class="absolute inset-0 pointer-events-none z-10">
    <Sidebar />

    <!-- Studio nav — top center -->
    <div class="flex justify-center pt-3 pointer-events-none">
      <StudioNav />
    </div>

    <!-- Status bar — bottom center -->
    <div class="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
      <div class="text-[11px] px-3 py-1 rounded-full backdrop-blur-sm flex items-center gap-3"
           style="color: var(--icon-default); background: rgba(20, 10, 30, 0.6)">
        <span class="capitalize">{getActiveStudio()}</span>
        <span style="color: var(--border-subtle)">&middot;</span>
        <span>Entities: {getEntities().length}</span>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Delete the Toolbar file**

```bash
rm src/ui/layout/Toolbar.svelte
```

- [ ] **Step 3: Commit**

```bash
git add src/App.svelte && git rm src/ui/layout/Toolbar.svelte
git commit -m "feat: remove floating toolbar, simplify App layout"
```

---

### Task 6: Restyle StudioNav

**Files:**
- Modify: `src/ui/layout/StudioNav.svelte`

- [ ] **Step 1: Replace the entire contents of `src/ui/layout/StudioNav.svelte`**

```svelte
<script lang="ts">
  import type { StudioScale } from '@lib/ecs/types'
  import { getActiveStudio, setActiveStudio } from '@lib/stores/sceneStore.svelte'

  const scales: { id: StudioScale; label: string; icon: string }[] = [
    { id: 'body', label: 'Body', icon: '◉' },
    { id: 'star-system', label: 'System', icon: '☉' },
    { id: 'galaxy', label: 'Galaxy', icon: '🌀' },
    { id: 'cluster', label: 'Cluster', icon: '✧' },
    { id: 'universe', label: 'Universe', icon: '∞' },
  ]
</script>

<div class="glass-panel px-2 py-1 flex items-center gap-0.5 pointer-events-auto">
  {#each scales as scale, i}
    {@const isActive = getActiveStudio() === scale.id}
    {#if i > 0}
      <span class="text-[10px]" style="color: var(--border-subtle)">›</span>
    {/if}
    <button
      onclick={() => setActiveStudio(scale.id)}
      class="px-2 py-1 rounded-md text-xs transition-all"
      style={isActive
        ? `background: var(--accent); color: var(--text-primary); box-shadow: 0 0 10px var(--accent-glow); font-weight: 600;`
        : `color: var(--icon-default);`}
      onmouseenter={(e) => { if (!isActive) { (e.target as HTMLElement).style.color = 'var(--text-primary)'; (e.target as HTMLElement).style.background = 'var(--accent-hover)'; }}}
      onmouseleave={(e) => { if (!isActive) { (e.target as HTMLElement).style.color = 'var(--icon-default)'; (e.target as HTMLElement).style.background = 'transparent'; }}}
    >
      <span class="mr-1">{scale.icon}</span>{scale.label}
    </button>
  {/each}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/layout/StudioNav.svelte
git commit -m "feat: restyle StudioNav with purple theme"
```

---

### Task 7: Restyle all controls — SliderControl, SelectControl, ToggleSwitch, ColorPickerControl

**Files:**
- Modify: `src/ui/controls/SliderControl.svelte`
- Modify: `src/ui/controls/SelectControl.svelte`
- Modify: `src/ui/controls/ToggleSwitch.svelte`
- Modify: `src/ui/controls/ColorPickerControl.svelte`

- [ ] **Step 1: Replace `src/ui/controls/SliderControl.svelte`**

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
    <span style="color: var(--label)">{label}</span>
    <span class="font-mono tabular-nums" style="color: var(--text-muted)">{value.toFixed(step < 1 ? 2 : 0)}</span>
  </div>
  <input
    type="range"
    bind:value
    {min}
    {max}
    {step}
    oninput={() => oninput?.(value)}
    class="slider"
  />
</div>

<style>
  .slider {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    appearance: none;
    cursor: pointer;
    background: var(--bg-control-hover);
    outline: none;
    margin: 6px 0;
  }
  .slider::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
    box-shadow: 0 0 5px var(--accent-glow);
    transition: transform 0.1s ease;
  }
  .slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }
</style>
```

- [ ] **Step 2: Replace `src/ui/controls/SelectControl.svelte`**

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
  <span class="text-xs" style="color: var(--label)">{label}</span>
  <select
    bind:value
    onchange={() => onchange?.(value)}
    class="select-control"
  >
    {#each options as opt}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  </select>
</div>

<style>
  .select-control {
    width: 100%;
    background: var(--bg-control);
    border: 1px solid var(--border-control);
    color: var(--text-primary);
    padding: 8px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    appearance: none;
    outline: none;
    background-image: url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23a060d0%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E');
    background-repeat: no-repeat;
    background-position: right 8px center;
  }
  .select-control:focus {
    border-color: var(--accent);
    box-shadow: 0 0 5px var(--accent-glow);
  }
</style>
```

- [ ] **Step 3: Replace `src/ui/controls/ToggleSwitch.svelte`**

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
  <span class="text-xs transition-colors" style="color: var(--label)">{label}</span>
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onclick={() => { checked = !checked; onchange?.(checked) }}
    class="toggle"
    class:active={checked}
  >
    <span class="toggle-thumb" class:on={checked}></span>
  </button>
</label>

<style>
  .toggle {
    position: relative;
    width: 36px;
    height: 20px;
    border-radius: 10px;
    background: var(--bg-control-hover);
    border: 1px solid var(--border-control);
    transition: all 0.2s ease;
    cursor: pointer;
  }
  .toggle.active {
    background: var(--accent);
    border-color: var(--accent);
    box-shadow: 0 0 8px var(--accent-glow);
  }
  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: transform 0.2s ease;
  }
  .toggle-thumb.on {
    transform: translateX(16px);
  }
</style>
```

- [ ] **Step 4: Replace `src/ui/controls/ColorPickerControl.svelte`**

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
  <span class="text-xs" style="color: var(--label)">{label}</span>
  <div class="flex items-center gap-2">
    <input
      type="color"
      bind:value
      oninput={() => oninput?.(value)}
      class="color-input"
    />
    <span class="text-[10px] font-mono w-16" style="color: var(--text-muted)">{value}</span>
  </div>
</div>

<style>
  .color-input {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    cursor: pointer;
    background: var(--bg-control);
    border: 1px solid var(--border-control);
    padding: 0;
  }
</style>
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/controls/SliderControl.svelte src/ui/controls/SelectControl.svelte src/ui/controls/ToggleSwitch.svelte src/ui/controls/ColorPickerControl.svelte
git commit -m "feat: restyle all controls with neon purple theme"
```

---

### Task 8: Restyle panel section headings

**Files:**
- Modify: `src/ui/panels/PropertiesPanel.svelte`
- Modify: `src/ui/panels/StarPanel.svelte`
- Modify: `src/ui/panels/PlanetPanel.svelte`
- Modify: `src/ui/panels/NebulaPanel.svelte`
- Modify: `src/ui/panels/GalaxyPanel.svelte`
- Modify: `src/ui/panels/AlienTechPanel.svelte`
- Modify: `src/ui/panels/OrbitalPanel.svelte`

All `<h3>` section headings currently use Tailwind classes. Replace them with the `.section-heading` CSS class defined in Task 1.

- [ ] **Step 1: Update all h3 section headings across all panels**

In every panel file, replace all instances of:
```html
<h3 class="text-xs uppercase tracking-wider text-gray-500 font-semibold border-b border-white/5 pb-1">
```
with:
```html
<h3 class="section-heading">
```

The files and their h3 headings:

**PropertiesPanel.svelte** — 2 headings: "Physics" and "Transform"
**StarPanel.svelte** — 1 heading: "Star"
**PlanetPanel.svelte** — 1 heading: "Planet"
**NebulaPanel.svelte** — 1 heading: "Nebula"
**GalaxyPanel.svelte** — 1 heading: "Galaxy"
**AlienTechPanel.svelte** — 1 heading: "Alien Tech"
**OrbitalPanel.svelte** — 1 heading: "Orbit"

Also in **PropertiesPanel.svelte**, update the entity type badge and name input styling:
- Type badge: change `text-violet-400` to `style="color: var(--label)"`
- Name input: change `bg-white/5 border border-white/10` to `style="background: var(--bg-control); border: 1px solid var(--border-control)"` and update focus style
- Entity info area and transform inputs should use `var(--bg-control)`, `var(--border-control)`, `var(--text-primary)`, `var(--text-muted)` colors

- [ ] **Step 2: Commit**

```bash
git add src/ui/panels/PropertiesPanel.svelte src/ui/panels/StarPanel.svelte src/ui/panels/PlanetPanel.svelte src/ui/panels/NebulaPanel.svelte src/ui/panels/GalaxyPanel.svelte src/ui/panels/AlienTechPanel.svelte src/ui/panels/OrbitalPanel.svelte
git commit -m "feat: restyle panel section headings with magenta accent"
```

---

### Task 9: Restyle GradientEditor

**Files:**
- Modify: `src/ui/controls/GradientEditor.svelte`

- [ ] **Step 1: Update GradientEditor styling**

In `src/ui/controls/GradientEditor.svelte`, update the label and hint text colors:

Change the label:
```html
<span class="text-xs text-gray-400">Color Gradient</span>
```
to:
```html
<span class="text-xs" style="color: var(--label)">Color Gradient</span>
```

Change the gradient bar border:
```html
class="relative h-6 rounded-lg cursor-crosshair border border-white/10 select-none"
```
to:
```html
class="relative h-6 rounded-lg cursor-crosshair select-none" style="border: 1px solid var(--border-control)"
```

Change the hint text:
```html
<p class="text-[10px] text-gray-600">Click bar to add stops. Right-click to remove.</p>
```
to:
```html
<p class="text-[10px]" style="color: var(--icon-default); opacity: 0.5">Click bar to add stops. Right-click to remove.</p>
```

Change the percentage labels:
```html
<span class="text-[10px] text-gray-500 font-mono">
```
to:
```html
<span class="text-[10px] font-mono" style="color: var(--text-muted)">
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/controls/GradientEditor.svelte
git commit -m "feat: restyle GradientEditor with purple theme"
```

---

### Task 10: Integration test — verify everything visually

**Files:** None (manual verification)

- [ ] **Step 1: Start dev server and reload**

Run: `npm run dev` (if not running)
Reload the page. Check for console errors.

- [ ] **Step 2: Verify sidebar**

1. Sidebar opens at 340px with purple glass background
2. Nav rail has purple icon buttons — active one glows magenta
3. "CELESTIAL" gradient text visible at top of content area with neon glow
4. Scene name input below title
5. Collapse button (◀) works — sidebar collapses to 60px rail, title fades out
6. Expand button (▶) works — sidebar expands back, title fades in

- [ ] **Step 3: Verify title animation**

1. Scroll the entities panel content down past 10px
2. Title should collapse into crosshair animation (750ms)
3. Scroll back to top
4. Title should expand back with reverse animation

- [ ] **Step 4: Verify entity tree**

1. Add-entity icon row visible at top of Entities panel (★ ● ☁ 🌀 ◆)
2. Click ★ to add a star — appears in tree
3. Hover the star row — duplicate (⧉) and delete (✕) buttons appear at right
4. Select star — buttons stay visible, row highlights magenta
5. Save/Load icons visible at bottom of nav rail

- [ ] **Step 5: Verify floating toolbar is gone**

1. No floating toolbar at top of viewport
2. Only StudioNav breadcrumb and status bar visible over viewport
3. StudioNav uses purple theme — active scale has magenta background with glow

- [ ] **Step 6: Verify controls**

1. Select an entity, switch to Properties panel
2. Slider thumbs are magenta with glow, tracks are dark purple
3. Select dropdowns have dark purple background
4. Toggle switches glow magenta when active
5. Section headings have magenta bottom border
6. All labels use light purple (#d187ff)

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes from UI overhaul testing"
```

Only commit if fixes were needed.
