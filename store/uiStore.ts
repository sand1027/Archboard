'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ComponentCategory, Provider } from '@/types/architecture'

type ActivePanel = 'library' | 'inspector' | 'templates'
type Theme = 'light' | 'dark'

interface UiState {
  // Panel state
  activePanel: ActivePanel
  libraryOpen: boolean
  inspectorOpen: boolean

  // Library state
  activeCategory: ComponentCategory | Provider | 'all' | 'recent'
  searchQuery: string
  recentlyUsed: string[]  // component ids

  // Inspector state
  inspectorTab: 'properties' | 'connections'

  // Template modal
  templateModalOpen: boolean

  // Keyboard shortcuts modal
  shortcutsModalOpen: boolean

  // Context menu
  contextMenu: {
    visible: boolean
    x: number
    y: number
    type: 'canvas' | 'node' | 'edge'
    targetId?: string
  }

  // Theme
  theme: Theme

  // Export modal
  exportModalOpen: boolean

  // Actions
  setActivePanel: (panel: ActivePanel) => void
  setLibraryOpen: (open: boolean) => void
  setInspectorOpen: (open: boolean) => void
  setActiveCategory: (cat: ComponentCategory | Provider | 'all' | 'recent') => void
  setSearchQuery: (q: string) => void
  addRecentlyUsed: (componentId: string) => void
  setInspectorTab: (tab: 'properties' | 'connections') => void
  setTemplateModalOpen: (open: boolean) => void
  setShortcutsModalOpen: (open: boolean) => void
  setContextMenu: (menu: UiState['contextMenu']) => void
  hideContextMenu: () => void
  setTheme: (theme: Theme) => void
  setExportModalOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      activePanel: 'library',
      libraryOpen: true,
      inspectorOpen: true,
      activeCategory: 'all',
      searchQuery: '',
      recentlyUsed: [],
      inspectorTab: 'properties',
      templateModalOpen: false,
      shortcutsModalOpen: false,
      contextMenu: {
        visible: false,
        x: 0,
        y: 0,
        type: 'canvas',
      },
      theme: 'light',
      exportModalOpen: false,

      setActivePanel: (activePanel) => set({ activePanel }),
      setLibraryOpen: (libraryOpen) => set({ libraryOpen }),
      setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
      setActiveCategory: (activeCategory) => set({ activeCategory }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),

      addRecentlyUsed: (componentId) =>
        set((state) => {
          const filtered = state.recentlyUsed.filter((id) => id !== componentId)
          return { recentlyUsed: [componentId, ...filtered].slice(0, 12) }
        }),

      setInspectorTab: (inspectorTab) => set({ inspectorTab }),
      setTemplateModalOpen: (templateModalOpen) => set({ templateModalOpen }),
      setShortcutsModalOpen: (shortcutsModalOpen) => set({ shortcutsModalOpen }),

      setContextMenu: (contextMenu) => set({ contextMenu }),
      hideContextMenu: () =>
        set((state) => ({
          contextMenu: { ...state.contextMenu, visible: false },
        })),

      setTheme: (theme) => set({ theme }),
      setExportModalOpen: (exportModalOpen) => set({ exportModalOpen }),
    }),
    {
      name: 'archboard-ui',
      partialize: (state: UiState) => ({
        recentlyUsed: state.recentlyUsed,
        theme: state.theme,
        libraryOpen: state.libraryOpen,
        inspectorOpen: state.inspectorOpen,
      }),
    }
  )
)
