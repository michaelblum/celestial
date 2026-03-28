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
