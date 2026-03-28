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
