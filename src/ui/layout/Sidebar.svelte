<script lang="ts">
  import { isSidebarOpen, toggleSidebar, getActivePanel, setActivePanel } from '@lib/stores/uiStore.svelte'
  import EntityTree from '@ui/panels/EntityTree.svelte'
  import PropertiesPanel from '@ui/panels/PropertiesPanel.svelte'

  const panels = [
    { id: 'entities', icon: '☰', label: 'Entities' },
    { id: 'properties', icon: '⚙', label: 'Properties' },
    { id: 'presets', icon: '✦', label: 'Presets' },
  ]
</script>

<div
  class="absolute top-0 left-0 h-full z-20 flex pointer-events-auto"
>
  <!-- Icon Rail -->
  <div class="w-12 h-full bg-black/80 backdrop-blur-xl border-r border-white/5 flex flex-col items-center py-4 gap-1">
    <!-- Toggle Button -->
    <button
      onclick={toggleSidebar}
      class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-200
             hover:bg-white/10 transition-colors mb-3 text-sm"
      title={isSidebarOpen() ? 'Collapse sidebar' : 'Expand sidebar'}
    >
      {isSidebarOpen() ? '◀' : '▶'}
    </button>

    <!-- Panel Icons -->
    {#each panels as panel}
      {@const isActive = getActivePanel() === panel.id && isSidebarOpen()}
      <button
        onclick={() => setActivePanel(panel.id)}
        class="w-8 h-8 rounded-lg flex items-center justify-center transition-all text-sm
               {isActive
                 ? 'bg-violet-500/20 text-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.15)]'
                 : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}"
        title={panel.label}
      >
        {panel.icon}
      </button>
    {/each}
  </div>

  <!-- Sliding Content Panel -->
  <div
    class="h-full bg-black/70 backdrop-blur-xl border-r border-white/5 overflow-hidden transition-all duration-300 ease-out
           {isSidebarOpen() ? 'w-64 opacity-100' : 'w-0 opacity-0'}"
  >
    <div class="w-64 h-full flex flex-col">
      <!-- Panel Header -->
      <div class="px-4 py-3 border-b border-white/5 flex-shrink-0">
        <h2 class="text-sm font-semibold text-gray-200">
          {panels.find((p) => p.id === getActivePanel())?.label ?? 'Panel'}
        </h2>
      </div>

      <!-- Panel Content -->
      <div class="flex-1 overflow-y-auto">
        {#if getActivePanel() === 'entities'}
          <div class="p-2">
            <EntityTree />
          </div>
        {:else if getActivePanel() === 'properties'}
          <PropertiesPanel />
        {:else if getActivePanel() === 'presets'}
          <div class="p-4 text-xs text-gray-600 italic text-center">
            Preset browser coming in Phase 2
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
