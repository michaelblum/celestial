<script lang="ts">
  import Viewport from '@ui/layout/Viewport.svelte'
  import Sidebar from '@ui/layout/Sidebar.svelte'
  import Toolbar from '@ui/layout/Toolbar.svelte'
  import StudioNav from '@ui/layout/StudioNav.svelte'
  import { getEntities } from '@lib/stores/sceneStore.svelte'
  import { getActiveStudio } from '@lib/stores/sceneStore.svelte'
</script>

<div class="w-screen h-screen relative bg-black">
  <!-- 3D Viewport (fills entire screen) -->
  <Viewport />

  <!-- UI Overlay -->
  <div class="absolute inset-0 pointer-events-none z-10">
    <!-- Sidebar (left) -->
    <Sidebar />

    <!-- Top area -->
    <div class="flex flex-col items-center gap-2 pt-3 pointer-events-none">
      <!-- Studio Navigation Breadcrumb -->
      <StudioNav />

      <!-- Toolbar -->
      <Toolbar />
    </div>

    <!-- Bottom status -->
    <div class="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
      <div class="text-[11px] text-gray-600 bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm flex items-center gap-3">
        <span class="text-gray-500 capitalize">{getActiveStudio()}</span>
        <span class="text-gray-700">&middot;</span>
        <span>Orbit: Left Drag</span>
        <span class="text-gray-700">&middot;</span>
        <span>Zoom: Scroll</span>
        <span class="text-gray-700">&middot;</span>
        <span>Entities: {getEntities().length}</span>
      </div>
    </div>
  </div>
</div>
