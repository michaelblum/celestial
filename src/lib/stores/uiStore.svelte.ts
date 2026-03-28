// ─── UI State ───────────────────────────────────────────────────────────────

let sidebarOpen = $state(true)
let activePanel = $state<string>('entities')

// ─── Public API ─────────────────────────────────────────────────────────────

export function isSidebarOpen(): boolean {
  return sidebarOpen
}

export function toggleSidebar(): void {
  sidebarOpen = !sidebarOpen
}

export function setSidebarOpen(open: boolean): void {
  sidebarOpen = open
}

export function getActivePanel(): string {
  return activePanel
}

export function setActivePanel(panel: string): void {
  activePanel = panel
  if (!sidebarOpen) sidebarOpen = true
}
