<script lang="ts">
  import Viewport from '@ui/layout/Viewport.svelte'
  import Sidebar from '@ui/layout/Sidebar.svelte'
  import Toolbar from '@ui/layout/Toolbar.svelte'
  import { getEntities } from '@lib/stores/sceneStore.svelte'
</script>

<div class="w-screen h-screen relative bg-black">
  <!-- 3D Viewport (fills entire screen) -->
  <Viewport />

  <!-- UI Overlay -->
  <div class="absolute inset-0 pointer-events-none z-10">
    <!-- Sidebar (left) -->
    <Sidebar />

    <!-- Top Toolbar (centered) -->
    <div class="flex justify-center pt-4 pointer-events-none">
      <Toolbar />
    </div>

    <!-- Bottom status -->
    <div class="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
      <div class="text-[11px] text-gray-600 bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm flex items-center gap-3">
        <span>Orbit: Left Drag</span>
        <span class="text-gray-700">&middot;</span>
        <span>Zoom: Scroll</span>
        <span class="text-gray-700">&middot;</span>
        <span>Pan: Right Drag</span>
        <span class="text-gray-700">&middot;</span>
        <span>Entities: {getEntities().length}</span>
      </div>
    </div>
  </div>
</div>
