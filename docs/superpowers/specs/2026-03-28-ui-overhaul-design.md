# Celestial UI Overhaul — Design Spec

**Date:** 2026-03-28
**Scope:** Restyle the entire UI to match the original Celestial's neon purple aesthetic, restructure the sidebar as the sole control surface, remove the floating toolbar.

## Overview

The current v2 UI uses a generic dark theme with neutral violet/gray. The original Celestial had a distinctive neon purple/magenta aesthetic with glass-morphism, glow effects, and an animated "CELESTIAL" title. This overhaul ports that identity to the v2 Svelte 5 codebase while restructuring the layout to eliminate the floating toolbar.

## 1. Color System

Replace the current palette with CSS custom properties in `app.css`:

```css
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
```

The `.glass-panel` utility in `app.css` updates to use these variables:
```css
.glass-panel {
  background: var(--bg-sidebar);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-glow);
  border-radius: 8px;
  box-shadow: 4px 0 20px rgba(0, 0, 0, 0.5);
}
```

## 2. Sidebar Structure

### Layout

The sidebar is a two-part flex container, positioned absolute left, full height:
- **Nav rail** (60px fixed width): icon buttons for panel switching + save/load at bottom
- **Content area** (flex-grow): panel content, scrollable

**Expanded width**: 340px. **Collapsed width**: 60px (rail only).
Transition: `width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)`.

### Nav Rail

Styled with `var(--bg-rail)` background and right border `var(--border-subtle)`.

**Icons (top to bottom):**
1. Toggle sidebar (hamburger/chevron) — top, with 20px top margin and 40px bottom margin
2. Entities panel (grid icon)
3. Properties panel (gear icon)
4. Presets panel (star icon)
5. *(spacer — margin-top: auto)*
6. Save (disk icon)
7. Load (folder icon)

**Icon styling:**
- Size: 40x40px, border-radius 8px
- Default: `color: var(--icon-default)`
- Hover: `background: var(--accent-hover); color: #fff`
- Active: `background: var(--accent); color: #fff; box-shadow: 0 0 10px var(--accent-glow)`

### Content Area

- Background: transparent (sidebar background shows through)
- Padding-top: 80px (space for title)
- Padding-left/right: 20px
- Padding-bottom: 80px
- Overflow-y: auto with custom scrollbar (6px, `#4a2b6e` thumb)

## 3. CELESTIAL Title

### New component: `src/ui/shared/SidebarTitle.svelte`

**Visual:**
- Text: "CELESTIAL"
- Font: 26px, weight 300, letter-spacing 7px, uppercase
- Color: transparent fill with `background: linear-gradient(135deg, #d187ff 0%, #00e5ff 100%); -webkit-background-clip: text`
- Glow: `filter: drop-shadow(0px 0px 6px rgba(0, 229, 255, 0.7)) drop-shadow(0px 0px 14px rgba(188, 19, 254, 0.5))`
- Position: absolute, top 24px, left 20px within the content area
- Hidden when sidebar collapsed (opacity 0, translateX(-10px))

**Scene name** displays below the title as a small editable text input (moved from toolbar).

### Scroll-Collapse Animation (750ms)

Triggered when the panel content scrolls past 10px. The title collapses into a crosshair dot:

**Elements:**
- `.title-text` — the "CELESTIAL" text
- `.crosshair-x` — horizontal line (width of title area, height 2px, centered)
- `.crosshair-y` — vertical line (height ~20px, width 2px, centered)
- `.anim-dot` — small circle (6px) at center

**Collapse sequence (750ms, `.scrolled` class):**
1. 0–15%: Text scaleY collapses from 1→0, glow shifts to white
2. 15–50%: Horizontal line draws left→right then shrinks
3. 20–50%: Vertical line fades in
4. 50–60%: Dot scales up to 1.5x
5. 60–80%: Dot settles to 1x
6. 80–100%: All elements fade/scale to 0

**Expand sequence (750ms, `.scrolled-up` class):**
- Reverse of collapse with inverted timing

**Scroll detection:** Monitor panel `scrollTop > 10`. Track `hasScrolledOnce` to only fire first transition. Toggle `.scrolled` / `.scrolled-up` classes.

## 4. Toolbar Removal

**Delete `src/ui/layout/Toolbar.svelte` entirely.** Its functions relocate:

### Add Entity Buttons → Entities Panel

A compact row of icon buttons at the top of `EntityTree.svelte`:

```
[ ★ ] [ ● ] [ ☁ ] [ 🌀 ] [ ◆ ]
```

- Each button: 32x32px, `var(--bg-control)` background, `var(--border-control)` border, border-radius 6px
- Hover: `var(--accent-hover)` background
- Tooltip on hover showing entity type name
- Same `addEntity()` logic currently in Toolbar

### Duplicate/Delete → Entity Tree Inline

Each entity row in the tree shows action buttons on hover or when selected:
- Right side of row: `⧉` (duplicate) and `✕` (delete) as small icon buttons
- Delete button: red hover state (`#ff4444`)
- Only visible on hover or when row is selected

### Save/Load → Nav Rail

Two icon buttons at the bottom of the nav rail (pushed down with `margin-top: auto`):
- Save icon (💾 or disk SVG)
- Load icon (📂 or folder SVG)
- Same styling as other nav icons
- Trigger `saveScene()` and file picker respectively

### Scene Name → Sidebar Header

Below the CELESTIAL title, a small editable text input for scene name:
- Same styling as current name input but positioned in sidebar header area
- Font: 12px, `var(--text-muted)` color
- Only visible when sidebar is expanded

## 5. StudioNav Restyle

Stays floating at top center of viewport. Restyle to match purple theme:
- Background: `var(--bg-sidebar)` with backdrop-blur
- Border: `var(--border-glow)`
- Active scale button: `background: var(--accent); box-shadow: 0 0 10px var(--accent-glow)`
- Chevron separators: `var(--icon-default)` color

## 6. Controls Restyle

All controls updated to use the CSS custom properties:

### SliderControl
- Track: `var(--bg-control-hover)` (#2a1b3d)
- Thumb: `var(--accent)` with `box-shadow: 0 0 5px var(--accent-glow)`
- Thumb hover: `transform: scale(1.2)`
- Label: `var(--label)` color

### SelectControl
- Background: `var(--bg-control)`
- Border: `var(--border-control)`
- Text: white

### ToggleSwitch
- Active: `var(--accent)` instead of `violet-500`

### ColorPickerControl
- Border: `var(--border-control)`

### GradientEditor
- Handle border: white (keep)
- Bar border: `var(--border-control)`

### Section Headings (in all panels)
- Color: white
- Text-transform: uppercase
- Letter-spacing: 1px
- Border-bottom: `1px solid var(--accent)` (magenta accent line)
- Font-size: slightly larger than current

### Control Groups
- Background: `var(--bg-group)`
- Border: `var(--border-control)`
- Padding: 10px
- Border-radius: 6px

## 7. App.svelte Layout Changes

Remove toolbar import and rendering. Structure becomes:

```
<div class="w-screen h-screen relative" style="background: #050208">
  <Viewport />
  <div class="absolute inset-0 pointer-events-none z-10">
    <Sidebar />                    <!-- Left, pointer-events-auto -->
    <StudioNav />                  <!-- Top center, pointer-events-auto -->
    <div class="status-bar">       <!-- Bottom center -->
      {activeStudio} · Entities: {count}
    </div>
  </div>
</div>
```

Status bar simplified (remove control hints — users know how to orbit/zoom).

## 8. Files Changed

| File | Action | Notes |
|------|--------|-------|
| `src/app.css` | Modify | CSS variables, updated `.glass-panel`, scroll animation keyframes |
| `src/App.svelte` | Modify | Remove toolbar, simplify layout |
| `src/ui/layout/Toolbar.svelte` | Delete | Functions moved to sidebar |
| `src/ui/layout/Sidebar.svelte` | Major rewrite | New structure, title, rail icons, save/load |
| `src/ui/shared/SidebarTitle.svelte` | Create | Animated CELESTIAL title with scroll collapse |
| `src/ui/panels/EntityTree.svelte` | Modify | Add entity buttons row, inline duplicate/delete |
| `src/ui/layout/StudioNav.svelte` | Modify | Purple restyle |
| `src/ui/controls/SliderControl.svelte` | Modify | Purple theme |
| `src/ui/controls/SelectControl.svelte` | Modify | Purple theme |
| `src/ui/controls/ToggleSwitch.svelte` | Modify | Purple theme |
| `src/ui/controls/ColorPickerControl.svelte` | Modify | Purple theme |
| `src/ui/controls/GradientEditor.svelte` | Modify | Purple theme |
| `src/ui/panels/PropertiesPanel.svelte` | Modify | Section heading restyle |
| `src/ui/panels/StarPanel.svelte` | Modify | Section heading restyle |
| `src/ui/panels/PlanetPanel.svelte` | Modify | Section heading restyle |
| `src/ui/panels/NebulaPanel.svelte` | Modify | Section heading restyle |
| `src/ui/panels/GalaxyPanel.svelte` | Modify | Section heading restyle |
| `src/ui/panels/AlienTechPanel.svelte` | Modify | Section heading restyle |
| `src/ui/panels/OrbitalPanel.svelte` | Modify | Section heading restyle |

## 9. Out of Scope

- Random preset button (separate feature)
- "Dive into" cross-studio navigation (separate feature)
- Custom SVG icons for nav rail (use text/emoji for now, can refine later)
- Mobile/responsive layout (desktop-only for now)
