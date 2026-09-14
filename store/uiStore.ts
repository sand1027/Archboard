'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ComponentCategory,
  ConnectionType,
  EdgeStylePreset,
  Protocol,
  Provider,
} from '@/types/architecture'
import type { BoardMode } from '@/types/lld'

export type ActiveTool =
  | 'select'
  | 'hand'
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'triangle'
  | 'parallelogram'
  | 'cylinder'
  | 'hexagon'
  | 'star'
  | 'arrow'
  | 'text'
  | 'line'
  | 'frame'
  | 'terminator'
  | 'document'
  | 'preparation'
  | 'connector'
  | 'note'

type ActivePanel = 'library' | 'inspector' | 'templates'
type Theme = 'light' | 'dark'

/** The right rail's panels. Exactly one may be open. */
type RailPanel = 'simulationOpen' | 'estimateOpen' | 'notesOpen'

const RAIL_PANELS: RailPanel[] = ['simulationOpen', 'estimateOpen', 'notesOpen']

/**
 * Open one rail panel and close the others, or just close this one.
 *
 * Returns a partial state patch, so each setter stays a one-liner and the exclusion rule lives
 * in a single place instead of being restated per pair.
 */
function openOnly(panel: RailPanel, open: boolean): Partial<Record<RailPanel, boolean>> {
  if (!open) return { [panel]: false }

  const patch: Partial<Record<RailPanel, boolean>> = {}
  for (const key of RAIL_PANELS) patch[key] = key === panel
  return patch
}

const DEFAULT_EDGE_STYLE: EdgeStylePreset = {
  strokeColor: '#374151',
  strokeWidth: 1.5,
  strokeStyle: 'solid',
  lineStyle: 'smoothstep',
  startArrow: 'none',
  endArrow: 'arrowclosed',
  animated: false,
}

interface UiState {
  boardMode: BoardMode

  // Panel state
  activePanel: ActivePanel
  libraryOpen: boolean
  inspectorOpen: boolean

  // Active drawing tool
  activeTool: ActiveTool

  // Default style for newly-drawn shapes (persisted so last used sticks)
  defaultFill: string
  defaultFillOpacity: number
  defaultStroke: string
  defaultStrokeWidth: number
  defaultStrokeStyle: 'solid' | 'dashed' | 'dotted'
  defaultOpacity: number
  defaultCornerRadius: number
  defaultFontSize: number
  defaultTextColor: string

  // Default style for new edges
  activeEdgeStyle: EdgeStylePreset

  /**
   * Connector preset armed from the HLD library. When set, a newly drawn
   * connection uses it instead of the behaviour-inferred default.
   */
  armedConnectionType: ConnectionType | null
  armedProtocol: Protocol | null

  // Library state
  /**
   * The library's active filter.
   *
   * `'bbg'` is a tag filter rather than a category or a provider, but it is still a value this
   * field holds — it was previously passed through `as any` at both the read and the write,
   * which is the kind of cast that hides a real modelling gap.
   */
  activeCategory: ComponentCategory | Provider | 'all' | 'recent' | 'bbg'
  searchQuery: string
  recentlyUsed: string[]

  // Inspector state
  inspectorTab: 'properties' | 'connections'

  // Modals
  templateModalOpen: boolean
  shortcutsModalOpen: boolean
  exportModalOpen: boolean
  shareModalOpen: boolean
  simulationOpen: boolean
  estimateOpen: boolean
  /** Requirements — FR, NFR and assumptions. Shares the right rail. */
  notesOpen: boolean
  /**
   * The text editor pane. Shares the left rail with the component library, because writing
   * code and dragging components are not things anyone does at the same moment.
   */
  codeOpen: boolean

  // Context menu
  contextMenu: {
    visible: boolean
    x: number
    y: number
    type: 'canvas' | 'node' | 'edge'
    targetId?: string
  }

  theme: Theme

  // Actions
  setBoardMode: (mode: BoardMode) => void
  setActivePanel: (panel: ActivePanel) => void
  setLibraryOpen: (open: boolean) => void
  setInspectorOpen: (open: boolean) => void
  setActiveTool: (tool: ActiveTool) => void
  setDefaultFill: (v: string) => void
  setDefaultFillOpacity: (v: number) => void
  setDefaultStroke: (v: string) => void
  setDefaultStrokeWidth: (v: number) => void
  setDefaultStrokeStyle: (v: 'solid' | 'dashed' | 'dotted') => void
  setDefaultOpacity: (v: number) => void
  setDefaultCornerRadius: (v: number) => void
  setDefaultFontSize: (v: number) => void
  setDefaultTextColor: (v: string) => void
  setActiveEdgeStyle: (style: Partial<EdgeStylePreset>) => void
  setArmedConnection: (type: ConnectionType | null, protocol?: Protocol | null) => void
  setActiveCategory: (cat: UiState['activeCategory']) => void
  setSearchQuery: (q: string) => void
  addRecentlyUsed: (componentId: string) => void
  setInspectorTab: (tab: 'properties' | 'connections') => void
  setTemplateModalOpen: (open: boolean) => void
  setShortcutsModalOpen: (open: boolean) => void
  setExportModalOpen: (open: boolean) => void
  setShareModalOpen: (open: boolean) => void
  setSimulationOpen: (open: boolean) => void
  setEstimateOpen: (open: boolean) => void
  setNotesOpen: (open: boolean) => void
  setCodeOpen: (open: boolean) => void
  setContextMenu: (menu: UiState['contextMenu']) => void
  hideContextMenu: () => void
  setTheme: (theme: Theme) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      boardMode: 'hld',

      activePanel: 'library',
      libraryOpen: true,
      inspectorOpen: true,

      activeTool: 'select',

      // Soft architecture-diagram defaults (not harsh white boxes)
      defaultFill: 'transparent',
      defaultFillOpacity: 1,
      defaultStroke: '#334155',
      defaultStrokeWidth: 2,
      defaultStrokeStyle: 'solid',
      defaultOpacity: 100,
      defaultCornerRadius: 8,
      defaultFontSize: 14,
      defaultTextColor: '#0f172a',

      activeEdgeStyle: DEFAULT_EDGE_STYLE,
      armedConnectionType: null,
      armedProtocol: null,

      activeCategory: 'all',
      searchQuery: '',
      recentlyUsed: [],
      inspectorTab: 'properties',
      templateModalOpen: false,
      shortcutsModalOpen: false,
      exportModalOpen: false,
      shareModalOpen: false,
      simulationOpen: false,
      estimateOpen: false,
      notesOpen: false,
      codeOpen: false,
      contextMenu: { visible: false, x: 0, y: 0, type: 'canvas' },
      theme: 'light',

      setBoardMode: (boardMode) =>
        set({
          boardMode,
          activeTool: 'select',
          searchQuery: '',
          activeCategory: 'all',
        }),
      setActivePanel: (activePanel) => set({ activePanel }),
      setLibraryOpen: (libraryOpen) => set({ libraryOpen }),
      setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
      setActiveTool: (activeTool) => set({ activeTool }),
      setDefaultFill: (defaultFill) => set({ defaultFill }),
      setDefaultFillOpacity: (defaultFillOpacity) => set({ defaultFillOpacity }),
      setDefaultStroke: (defaultStroke) => set({ defaultStroke }),
      setDefaultStrokeWidth: (defaultStrokeWidth) => set({ defaultStrokeWidth }),
      setDefaultStrokeStyle: (defaultStrokeStyle) => set({ defaultStrokeStyle }),
      setDefaultOpacity: (defaultOpacity) => set({ defaultOpacity }),
      setDefaultCornerRadius: (defaultCornerRadius) => set({ defaultCornerRadius }),
      setDefaultFontSize: (defaultFontSize) => set({ defaultFontSize }),
      setDefaultTextColor: (defaultTextColor) => set({ defaultTextColor }),
      setActiveEdgeStyle: (style) =>
        set((state) => ({ activeEdgeStyle: { ...state.activeEdgeStyle, ...style } })),
      setArmedConnection: (armedConnectionType, armedProtocol = null) =>
        set({ armedConnectionType, armedProtocol }),
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
      setExportModalOpen: (exportModalOpen) => set({ exportModalOpen }),
      setShareModalOpen: (shareModalOpen) => set({ shareModalOpen }),
      /*
       * The right rail holds one panel at a time, so opening one closes the rest.
       *
       * Written as a shared helper rather than three hand-maintained pairs: with three panels
       * that is six exclusions to keep in step, and the one someone forgets is the one that
       * leaves two panels fighting over the same 280px.
       */
      setSimulationOpen: (open) => set(openOnly('simulationOpen', open)),
      setEstimateOpen: (open) => set(openOnly('estimateOpen', open)),
      setNotesOpen: (open) => set(openOnly('notesOpen', open)),
      /**
       * Deliberately does not touch `libraryOpen`.
       *
       * The rail renders code in preference to the library, so closing the code pane brings
       * the library back on its own. Forcing it shut here would persist that — `libraryOpen`
       * is stored — and leave the rail empty after the pane closed.
       */
      setCodeOpen: (codeOpen) => set({ codeOpen }),
      setContextMenu: (contextMenu) => set({ contextMenu }),
      hideContextMenu: () =>
        set((state) => ({ contextMenu: { ...state.contextMenu, visible: false } })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'archboard-ui-v2',
      partialize: (state: UiState) => ({
        boardMode: state.boardMode,
        recentlyUsed: state.recentlyUsed,
        theme: state.theme,
        libraryOpen: state.libraryOpen,
        inspectorOpen: state.inspectorOpen,
        defaultFill: state.defaultFill,
        defaultFillOpacity: state.defaultFillOpacity,
        defaultStroke: state.defaultStroke,
        defaultStrokeWidth: state.defaultStrokeWidth,
        defaultStrokeStyle: state.defaultStrokeStyle,
        defaultOpacity: state.defaultOpacity,
        defaultCornerRadius: state.defaultCornerRadius,
        defaultFontSize: state.defaultFontSize,
        defaultTextColor: state.defaultTextColor,
        activeEdgeStyle: state.activeEdgeStyle,
      }),
    }
  )
)
