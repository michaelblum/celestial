<script lang="ts">
  import Viewport from '@ui/layout/Viewport.svelte'
  import Sidebar from '@ui/layout/Sidebar.svelte'
  import StudioNav from '@ui/layout/StudioNav.svelte'
  import OortCloudOverlay from '@ui/layout/OortCloudOverlay.svelte'
  import { getEntities, getActiveStudio } from '@lib/stores/sceneStore.svelte'
  import { isPaused, togglePause, getRawTimeScale, setTimeScale } from '@lib/stores/timeStore.svelte'
  import { getEngine } from '@lib/stores/engineStore.svelte'

  let cameraDistance = $state(0)
  let cameraPos = $state({ x: 0, y: 0, z: 0 })
  let cameraDir = $state({ x: 0, y: 0, z: 0 })

  function updateOdometer() {
    const engine = getEngine()
    if (engine) {
      const p = engine.camera.position
      cameraDistance = p.length()
      cameraPos = { x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z) }
      const d = p.clone().normalize()
      cameraDir = { x: +d.x.toFixed(3), y: +d.y.toFixed(3), z: +d.z.toFixed(3) }
    }
    requestAnimationFrame(updateOdometer)
  }
  requestAnimationFrame(updateOdometer)

  function formatDistance(d: number): string {
    if (d < 1) return d.toFixed(2) + ' u'
    if (d < 1000) return d.toFixed(1) + ' u'
    return (d / 1000).toFixed(2) + ' ku'
  }

  const speedPresets = [0.1, 0.25, 0.5, 1, 2, 5]

  function cycleSpeed(direction: 1 | -1) {
    const current = getRawTimeScale()
    const idx = speedPresets.findIndex(s => s >= current)
    const next = Math.max(0, Math.min(speedPresets.length - 1, (idx === -1 ? 3 : idx) + direction))
    setTimeScale(speedPresets[next])
  }

  function formatSpeed(s: number): string {
    if (s < 1) return `${s}x`
    return `${s}x`
  }
</script>

<div class="w-screen h-screen relative" style="background: #050208">
  <!-- 3D Viewport -->
  <Viewport />

  <!-- Oort cloud exit overlay (2D screen-space effect) -->
  <OortCloudOverlay />

  <!-- UI Overlay -->
  <div class="absolute inset-0 pointer-events-none z-10">
    <Sidebar />

    <!-- Studio nav — top center -->
    <div class="flex justify-center pt-3 pointer-events-none">
      <StudioNav />
    </div>

    <!-- Status bar — bottom center -->
    <div class="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
      <div class="text-[11px] px-3 py-1.5 rounded-full backdrop-blur-sm flex items-center gap-3"
           style="color: var(--icon-default); background: rgba(20, 10, 30, 0.6)">
        <span class="capitalize">{getActiveStudio()}</span>
        <span style="color: var(--border-subtle)">&middot;</span>
        <span>Entities: {getEntities().length}</span>
        <span style="color: var(--border-subtle)">&middot;</span>

        <!-- Time controls -->
        <div class="flex items-center gap-1.5">
          <button class="hover:text-white transition-colors" onclick={() => cycleSpeed(-1)} title="Slower">⏪</button>
          <button class="hover:text-white transition-colors w-5 text-center" onclick={() => togglePause()} title={isPaused() ? 'Play' : 'Pause'}>
            {isPaused() ? '▶' : '⏸'}
          </button>
          <button class="hover:text-white transition-colors" onclick={() => cycleSpeed(1)} title="Faster">⏩</button>
          <span class="ml-0.5 tabular-nums" style="min-width: 2.5em; text-align: center; color: {isPaused() ? '#ff6666' : 'var(--icon-default)'}">
            {isPaused() ? 'II' : formatSpeed(getRawTimeScale())}
          </span>
        </div>
      </div>
    </div>

    <!-- Camera debug — bottom right -->
    <div class="absolute bottom-4 right-4 pointer-events-none">
      <div class="text-[10px] px-3 py-1.5 rounded-lg backdrop-blur-sm tabular-nums font-mono flex flex-col items-end gap-0.5"
           style="color: var(--icon-default); background: rgba(20, 10, 30, 0.6)">
        <span>{formatDistance(cameraDistance)}</span>
        <span style="opacity: 0.5">pos ({cameraPos.x}, {cameraPos.y}, {cameraPos.z})</span>
        <span style="opacity: 0.5">dir ({cameraDir.x}, {cameraDir.y}, {cameraDir.z})</span>
      </div>
    </div>
  </div>
</div>
