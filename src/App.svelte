<script lang="ts">
  import Viewport from '@ui/layout/Viewport.svelte'
</script>

<div class="w-screen h-screen relative bg-black">
  <!-- 3D Viewport (fills entire screen) -->
  <Viewport />

  <!-- UI Overlay (panels will be added in Phase 1) -->
  <div class="absolute inset-0 pointer-events-none z-10">
    <!-- Top bar -->
    <div class="flex justify-center pt-6 pointer-events-none">
      <div class="glass-panel px-6 py-3 pointer-events-auto">
        <h1 class="text-lg font-semibold tracking-wide text-gray-100">
          Celestial
        </h1>
        <p class="text-xs text-gray-500 mt-0.5">Cosmic Scene Builder</p>
      </div>
    </div>

    <!-- Bottom status -->
    <div class="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
      <div class="text-xs text-gray-600 bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
        Orbit: Left Drag &middot; Zoom: Scroll &middot; Pan: Right Drag
      </div>
    </div>
  </div>
</div>
