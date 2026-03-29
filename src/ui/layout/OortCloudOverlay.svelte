<script lang="ts">
  import { getEngine } from '@lib/stores/engineStore.svelte'

  // Scale zones (scene units from origin)
  const DEBRIS_START = 100    // First dust specks appear
  const DEBRIS_PEAK = 1500    // Maximum density
  const SHELL_START = 1500    // Shell disc appears
  const SHELL_FULL = 2500     // Shell fills viewport
  const SHELL_SHRINK_END = 8000 // Shell has shrunk to a dot
  const NEIGHBOR_START = 6000 // Neighbor star enters field of view
  const NEIGHBOR_PASS = 10000 // Neighbor star passes camera

  interface Debris {
    id: number
    x: number       // viewport fraction 0-1
    y: number
    size: number     // px
    opacity: number
    speed: number
    born: number
  }

  let debris: Debris[] = $state([])
  let debrisProgress = $state(0)
  let shellProgress = $state(0)   // 0=invisible, 0-1=growing, 1+=shrinking
  let shellShrink = $state(0)     // 0=full size, 1=dot
  let neighborProgress = $state(0)
  let dist = $state(0)
  let nextId = 0

  function spawnDebris() {
    // Spawn from random edge position
    const edge = Math.floor(Math.random() * 4)
    let x: number, y: number
    switch (edge) {
      case 0: x = Math.random(); y = -0.05; break
      case 1: x = 1.05; y = Math.random(); break
      case 2: x = Math.random(); y = 1.05; break
      default: x = -0.05; y = Math.random(); break
    }

    debris.push({
      id: nextId++,
      x, y,
      size: 3 + Math.random() * 15,
      opacity: 0.06 + Math.random() * 0.15,
      speed: 0.4 + Math.random() * 0.8,
      born: performance.now(),
    })

    if (debris.length > 120) debris = debris.slice(-120)
  }

  function update() {
    const engine = getEngine()
    if (!engine) { requestAnimationFrame(update); return }

    dist = engine.camera.position.length()

    // Debris: ramp up from DEBRIS_START to DEBRIS_PEAK
    debrisProgress = Math.max(0, Math.min(1, (dist - DEBRIS_START) / (DEBRIS_PEAK - DEBRIS_START)))

    // Shell: appear at SHELL_START, fill at SHELL_FULL
    shellProgress = Math.max(0, Math.min(1, (dist - SHELL_START) / (SHELL_FULL - SHELL_START)))

    // Shell shrink: SHELL_FULL to SHELL_SHRINK_END
    shellShrink = Math.max(0, Math.min(1, (dist - SHELL_FULL) / (SHELL_SHRINK_END - SHELL_FULL)))

    // Neighbor star
    neighborProgress = Math.max(0, Math.min(1, (dist - NEIGHBOR_START) / (NEIGHBOR_PASS - NEIGHBOR_START)))

    // Spawn debris — more frequent as progress increases
    if (debrisProgress > 0 && shellShrink < 0.5) {
      const rate = debrisProgress * 0.6
      if (Math.random() < rate) spawnDebris()
      if (debrisProgress > 0.5 && Math.random() < rate * 0.5) spawnDebris()
    }

    // Clean old debris
    const now = performance.now()
    debris = debris.filter(d => (now - d.born) < 2500)

    requestAnimationFrame(update)
  }
  requestAnimationFrame(update)

  function getDebrisStyle(d: Debris): string {
    const age = (performance.now() - d.born) / 2500
    const t = Math.min(age * d.speed * 2, 1)

    // Drift toward center
    const cx = d.x + (0.5 - d.x) * t
    const cy = d.y + (0.5 - d.y) * t
    const scale = Math.max(0, 1 - t)
    const fade = t < 0.2 ? t / 0.2 : t > 0.6 ? (1 - t) / 0.4 : 1

    // Fade out debris as shell takes over
    const shellFade = 1 - shellShrink

    return `left:${cx * 100}%;top:${cy * 100}%;width:${d.size * scale}px;height:${d.size * scale}px;opacity:${d.opacity * fade * debrisProgress * shellFade};`
  }

  // One continuous tween from fully transparent to visible shell to shrinking dot
  // t goes from 0 (shell just appearing) to 1 (fully shrunk)
  // Combines shellProgress and shellShrink into one smooth value
  function getOverallT(): number {
    if (shellShrink > 0) return 0.5 + shellShrink * 0.5 // 0.5 → 1.0
    return shellProgress * 0.5 // 0.0 → 0.5
  }

  function getShellSize(): number {
    const t = getOverallT()
    if (t > 0.5) {
      // Shrinking: 150vmax → 0
      const shrinkT = (t - 0.5) * 2
      return 150 * (1 - shrinkT)
    }
    return 150
  }

  function getShellBackground(): string {
    const t = getOverallT()

    // Continuous tween:
    // t=0.0: fully transparent
    // t=0.25: slight uniform haze
    // t=0.5: peak opacity, center just starting to clear
    // t=0.75: center mostly clear, opacity at edges
    // t=1.0: thin ring, almost gone

    // Center clear radius: 0% at t=0, gradually opens to 70% at t=1
    const clearRadius = t * 70

    // Edge opacity: ramps up 0→0.12 in first half, holds then fades in second
    const edgeOpacity = t < 0.5
      ? t * 2 * 0.12
      : 0.12 * (1 - (t - 0.5) * 0.5)

    // Center opacity: starts equal to edge, gradually becomes transparent
    const centerOpacity = edgeOpacity * Math.max(0, 1 - t * 1.5)

    return `radial-gradient(circle, rgba(130,150,180,${centerOpacity.toFixed(4)}) ${clearRadius.toFixed(1)}%, rgba(110,130,160,${edgeOpacity.toFixed(4)}) 100%)`
  }

  // Neighbor star: enters from a viewport edge, crosses the field
  function getNeighborStyle(): string {
    // Travel from upper-right to lower-left across the viewport
    const x = 85 - neighborProgress * 70
    const y = 15 + neighborProgress * 70
    const brightness = neighborProgress < 0.5
      ? neighborProgress * 2       // brighten as it approaches
      : 2 - neighborProgress * 2   // dim as it recedes
    const size = 2 + brightness * 4

    return `left:${x}%;top:${y}%;width:${size}px;height:${size}px;opacity:${brightness * 0.9};`
  }
</script>

{#if debrisProgress > 0 || shellProgress > 0 || neighborProgress > 0}
  <div class="absolute inset-0 pointer-events-none overflow-hidden" style="z-index: 5">

    <!-- Debris circles flying toward center -->
    {#each debris as d (d.id)}
      <div
        class="absolute rounded-full -translate-x-1/2 -translate-y-1/2"
        style="{getDebrisStyle(d)}background: radial-gradient(circle, rgba(200,210,230,0.5) 0%, rgba(160,175,200,0.15) 50%, transparent 100%);"
      ></div>
    {/each}

    <!-- Oort cloud shell disc -->
    {#if shellProgress > 0}
      <div
        class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style="
          width: {getShellSize()}vmax;
          height: {getShellSize()}vmax;
          background: {getShellBackground()};
        "
      ></div>
    {/if}

    <!-- Central star dot — smaller than the 3D star, takes over as it fades -->
    {#if debrisProgress > 0.5}
      <div
        class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style="
          width: 3px;
          height: 3px;
          background: white;
          box-shadow: 0 0 2px rgba(255,255,255,0.9), 0 0 5px rgba(200,210,255,0.5);
        "
      ></div>
    {/if}

    <!-- Neighbor star passing through field of view -->
    {#if neighborProgress > 0 && neighborProgress < 1}
      <div
        class="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
        style="{getNeighborStyle()}background: white; box-shadow: 0 0 6px rgba(255,255,255,0.8), 0 0 12px rgba(200,220,255,0.4);"
      ></div>
    {/if}
  </div>
{/if}
