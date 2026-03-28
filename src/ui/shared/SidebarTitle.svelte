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
  <div
    class="title-text"
    class:anim-collapse={scrollState === 'scrolled'}
    class:anim-expand={scrollState === 'scrolled-up'}
  >
    CELESTIAL
  </div>

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

  .title-text.anim-collapse { animation: title-collapse-text 750ms ease-out forwards; }
  .crosshair-x.anim-collapse { animation: title-collapse-x 750ms ease-out forwards; }
  .crosshair-y.anim-collapse { animation: title-collapse-y 750ms ease-out forwards; }
  :global(.anim-dot).anim-collapse { animation: title-collapse-dot 750ms ease-out forwards; }

  .title-text.anim-expand { animation: title-expand-text 750ms ease-out forwards; }
  .crosshair-x.anim-expand { animation: title-expand-x 750ms ease-out forwards; }
  .crosshair-y.anim-expand { animation: title-expand-y 750ms ease-out forwards; }
  :global(.anim-dot).anim-expand { animation: title-expand-dot 750ms ease-out forwards; }

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
