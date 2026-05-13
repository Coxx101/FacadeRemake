import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Landmark, Storylet, CharacterProfile, SharedContext, AppMode, WorldStateDefinition, ActionEntry, ExpressionEntry, PropEntry, LocationEntry } from '../types'
import { cascadeWorldStateChange } from './cascadeWorldState'

// ── 撤销/重做快照类型 ──
interface HistorySnapshot {
  landmarks: Landmark[]
  storylets: Storylet[]
  characters: CharacterProfile[]
  sharedContext: SharedContext
  worldStateDefinition: WorldStateDefinition
  actionLibrary: ActionEntry[]
  expressionLibrary: ExpressionEntry[]
  propLibrary: PropEntry[]
  locationLibrary: LocationEntry[]
}

// ── 撤销/重做状态（独立管理，不经过 immer） ──
interface UndoRedoSlice {
  _undoCount: number
  _redoCount: number
  undo: () => void
  redo: () => void
}

// 撤销栈（模块级，不放进 zustand state 避免序列化开销）
const undoStack: HistorySnapshot[] = []
const redoStack: HistorySnapshot[] = []
const UNDO_LIMIT = 50

function pushUndo(get: () => any) {
  const s = get()
  undoStack.push({
    landmarks: JSON.parse(JSON.stringify(s.landmarks)),
    storylets: JSON.parse(JSON.stringify(s.storylets)),
    characters: JSON.parse(JSON.stringify(s.characters)),
    sharedContext: JSON.parse(JSON.stringify(s.sharedContext)),
    worldStateDefinition: JSON.parse(JSON.stringify(s.worldStateDefinition)),
    actionLibrary: JSON.parse(JSON.stringify(s.actionLibrary)),
    expressionLibrary: JSON.parse(JSON.stringify(s.expressionLibrary)),
    propLibrary: JSON.parse(JSON.stringify(s.propLibrary)),
    locationLibrary: JSON.parse(JSON.stringify(s.locationLibrary)),
  })
  if (undoStack.length > UNDO_LIMIT) undoStack.shift()
  redoStack.length = 0
  useStore.setState({ _undoCount: undoStack.length, _redoCount: 0 })
}

function performUndo(get: () => any) {
  if (undoStack.length === 0) return
  const s = get()
  redoStack.push({
    landmarks: JSON.parse(JSON.stringify(s.landmarks)),
    storylets: JSON.parse(JSON.stringify(s.storylets)),
    characters: JSON.parse(JSON.stringify(s.characters)),
    sharedContext: JSON.parse(JSON.stringify(s.sharedContext)),
    worldStateDefinition: JSON.parse(JSON.stringify(s.worldStateDefinition)),
    actionLibrary: JSON.parse(JSON.stringify(s.actionLibrary)),
    expressionLibrary: JSON.parse(JSON.stringify(s.expressionLibrary)),
    propLibrary: JSON.parse(JSON.stringify(s.propLibrary)),
    locationLibrary: JSON.parse(JSON.stringify(s.locationLibrary)),
  })
  const snapshot = undoStack.pop()!
  useStore.setState({
    landmarks: snapshot.landmarks,
    storylets: snapshot.storylets,
    characters: snapshot.characters,
    sharedContext: snapshot.sharedContext,
    worldStateDefinition: snapshot.worldStateDefinition,
    actionLibrary: snapshot.actionLibrary,
    expressionLibrary: snapshot.expressionLibrary,
    propLibrary: snapshot.propLibrary,
    locationLibrary: snapshot.locationLibrary,
    _undoCount: undoStack.length,
    _redoCount: redoStack.length,
  })
}

function performRedo(get: () => any) {
  if (redoStack.length === 0) return
  const s = get()
  undoStack.push({
    landmarks: JSON.parse(JSON.stringify(s.landmarks)),
    storylets: JSON.parse(JSON.stringify(s.storylets)),
    characters: JSON.parse(JSON.stringify(s.characters)),
    sharedContext: JSON.parse(JSON.stringify(s.sharedContext)),
    worldStateDefinition: JSON.parse(JSON.stringify(s.worldStateDefinition)),
    actionLibrary: JSON.parse(JSON.stringify(s.actionLibrary)),
    expressionLibrary: JSON.parse(JSON.stringify(s.expressionLibrary)),
    propLibrary: JSON.parse(JSON.stringify(s.propLibrary)),
    locationLibrary: JSON.parse(JSON.stringify(s.locationLibrary)),
  })
  const snapshot = redoStack.pop()!
  useStore.setState({
    landmarks: snapshot.landmarks,
    storylets: snapshot.storylets,
    characters: snapshot.characters,
    sharedContext: snapshot.sharedContext,
    worldStateDefinition: snapshot.worldStateDefinition,
    actionLibrary: snapshot.actionLibrary,
    expressionLibrary: snapshot.expressionLibrary,
    propLibrary: snapshot.propLibrary,
    locationLibrary: snapshot.locationLibrary,
    _undoCount: undoStack.length,
    _redoCount: redoStack.length,
  })
}

function clearHistory() {
  undoStack.length = 0
  redoStack.length = 0
  useStore.setState({ _undoCount: 0, _redoCount: 0 })
}

export interface StoreState extends UndoRedoSlice {
  // ── 模式 ──
  mode: AppMode
  setMode: (mode: AppMode) => void
  /** 当前打开的项目 ID（用于保存到 localStorage） */
  currentProjectId: string | null
  setCurrentProjectId: (id: string | null) => void

  // ── 数据 ──
  landmarks: Landmark[]
  storylets: Storylet[]
  characters: CharacterProfile[]
  sharedContext: SharedContext
  worldStateDefinition: WorldStateDefinition
  actionLibrary: ActionEntry[]
  expressionLibrary: ExpressionEntry[]
  propLibrary: PropEntry[]
  locationLibrary: LocationEntry[]
  isDirty: boolean

  // ── 选中状态 ──
  selectedLandmarkId: string | null
  selectedStoryletId: string | null
  selectedCharacterId: string | null
  selectedLandmarkIds: string[]
  inspectorTab: 'properties' | 'transitions'
  rightPanel: 'inspector' | 'characters' | 'worldstate' | 'library'
  isStoryletModalOpen: boolean

  // ── Landmark 操作 ──
  selectLandmark: (id: string | null) => void
  selectLandmarks: (ids: string[]) => void
  addLandmark: (landmark: Landmark) => void
  updateLandmark: (id: string, patch: Partial<Landmark>) => void
  deleteLandmark: (id: string) => void
  deleteLandmarks: (ids: string[]) => void
  updateLandmarkPosition: (id: string, position: { x: number; y: number }) => void
  updateLandmarksPositions: (updates: { id: string; position: { x: number; y: number } }[]) => void
  addTransition: (sourceId: string, targetId: string) => void
  removeTransition: (sourceId: string, transitionIndex: number) => void

  // ── Storylet 操作 ──
  openStoryletModal: (id: string | null) => void
  closeStoryletModal: () => void
  saveStorylet: (storylet: Storylet) => void
  deleteStorylet: (id: string) => void

  // ── Character 操作 ──
  selectCharacter: (id: string | null) => void
  updateCharacter: (id: string, patch: Partial<CharacterProfile>) => void
  addCharacter: (character: CharacterProfile) => void
  deleteCharacter: (id: string) => void
  updateSharedContext: (patch: Partial<SharedContext>) => void

  // ── WorldState 操作 ──
  updateWorldStateDefinition: (patch: Partial<WorldStateDefinition>) => void
  loadWorldStateDefinition: (wsd: WorldStateDefinition) => void

  // ── 库操作 ──
  addAction: (action: ActionEntry) => void
  updateAction: (id: string, patch: Partial<ActionEntry>) => void
  deleteAction: (id: string) => void
  addExpression: (expression: ExpressionEntry) => void
  updateExpression: (id: string, patch: Partial<ExpressionEntry>) => void
  deleteExpression: (id: string) => void
  addProp: (prop: PropEntry) => void
  updateProp: (id: string, patch: Partial<PropEntry>) => void
  deleteProp: (id: string) => void
  addLocation: (location: LocationEntry) => void
  updateLocation: (id: string, patch: Partial<LocationEntry>) => void
  deleteLocation: (id: string) => void

  // ── Inspector ──
  inspectorWidth: number
  setInspectorTab: (tab: 'properties' | 'transitions') => void
  setInspectorWidth: (width: number) => void
  setRightPanel: (panel: 'inspector' | 'characters' | 'worldstate' | 'library') => void

  // ── 持久化 ──
  loadFromJSON: (landmarks: Landmark[], storylets: Storylet[], characters?: CharacterProfile[], sharedContext?: SharedContext, worldStateDefinition?: WorldStateDefinition, actionLibrary?: ActionEntry[], expressionLibrary?: ExpressionEntry[], propLibrary?: PropEntry[], locationLibrary?: LocationEntry[]) => void
  markClean: () => void
}

export const useStore = create<StoreState>()(
  immer((set, get) => ({
    mode: 'home',
    setMode: (mode) => set((s) => { s.mode = mode }),
    currentProjectId: null,
    setCurrentProjectId: (id) => set((s) => { s.currentProjectId = id }),

    landmarks: [] as Landmark[],
    storylets: [] as Storylet[],
    characters: [] as CharacterProfile[],
    sharedContext: { marriage_secret: {}, key_events: {} } as SharedContext,
    worldStateDefinition: { qualities: [], flags: [], relationships: [] } as WorldStateDefinition,
    actionLibrary: [] as ActionEntry[],
    expressionLibrary: [] as ExpressionEntry[],
    propLibrary: [] as PropEntry[],
    locationLibrary: [] as LocationEntry[],
    isDirty: false,

    selectedLandmarkId: null,
    selectedStoryletId: null,
    selectedCharacterId: null,
    selectedLandmarkIds: [],
    inspectorTab: 'properties',
    rightPanel: 'inspector',
    inspectorWidth: 380,
    isStoryletModalOpen: false,

    // ── 撤销/重做 ──
    _undoCount: 0,
    _redoCount: 0,
    undo: () => performUndo(get),
    redo: () => performRedo(get),

    // ── Landmark ──
    selectLandmark: (id) => set((s) => {
      s.selectedLandmarkId = id
      s.selectedLandmarkIds = id ? [id] : []
      s.inspectorTab = 'properties'
    }),

    selectLandmarks: (ids) => set((s) => {
      s.selectedLandmarkIds = ids
      s.selectedLandmarkId = ids.length === 1 ? ids[0] : null
    }),

    addLandmark: (landmark) => {
      pushUndo(get)
      set((s) => {
        s.landmarks.push(landmark)
        s.isDirty = true
      })
    },

    updateLandmark: (id, patch) => {
      pushUndo(get)
      set((s) => {
        const idx = s.landmarks.findIndex((l) => l.id === id)
        if (idx !== -1) {
          Object.assign(s.landmarks[idx], patch)
          s.isDirty = true
        }
      })
    },

    deleteLandmark: (id) => {
      pushUndo(get)
      set((s) => {
        s.landmarks = s.landmarks.filter((l) => l.id !== id)
        if (s.selectedLandmarkId === id) s.selectedLandmarkId = null
        s.selectedLandmarkIds = s.selectedLandmarkIds.filter((sid) => sid !== id)
        s.isDirty = true
      })
    },

    deleteLandmarks: (ids) => {
      pushUndo(get)
      set((s) => {
        const idSet = new Set(ids)
        s.landmarks = s.landmarks.filter((l) => !idSet.has(l.id))
        if (idSet.has(s.selectedLandmarkId ?? '')) s.selectedLandmarkId = null
        s.selectedLandmarkIds = []
        s.isDirty = true
      })
    },

    updateLandmarkPosition: (id, position) => set((s) => {
      const lm = s.landmarks.find((l) => l.id === id)
      if (lm) {
        lm.position = { ...position }
        s.isDirty = true
      }
    }),

    updateLandmarksPositions: (updates) => {
      set((s) => {
        for (const { id, position } of updates) {
          const lm = s.landmarks.find((l) => l.id === id)
          if (lm) lm.position = { ...position }
        }
        s.isDirty = true
      })
    },

    addTransition: (sourceId, targetId) => {
      pushUndo(get)
      set((s) => {
        const source = s.landmarks.find((l) => l.id === sourceId)
        if (!source) return
        if (source.transitions.some((t) => t.target_id === targetId)) return
        if (sourceId === targetId) return
          source.transitions.push({
            target_id: targetId,
            conditions: [],
            label: '',
          })
        s.isDirty = true
      })
    },

    removeTransition: (sourceId, transitionIndex) => {
      pushUndo(get)
      set((s) => {
        const source = s.landmarks.find((l) => l.id === sourceId)
        if (!source) return
        source.transitions.splice(transitionIndex, 1)
        s.isDirty = true
      })
    },

    // ── Storylet ──
    openStoryletModal: (id) => set((s) => {
      s.selectedStoryletId = id
      s.isStoryletModalOpen = true
    }),

    closeStoryletModal: () => set((s) => {
      s.isStoryletModalOpen = false
      s.selectedStoryletId = null
    }),

    saveStorylet: (storylet) => {
      pushUndo(get)
      set((s) => {
        const idx = s.storylets.findIndex((sl) => sl.id === storylet.id)
        if (idx !== -1) {
          s.storylets[idx] = storylet
        } else {
          s.storylets.push(storylet)
        }
        s.isDirty = true
      })
    },

    deleteStorylet: (id) => {
      pushUndo(get)
      set((s) => {
        s.storylets = s.storylets.filter((sl) => sl.id !== id)
        s.isDirty = true
      })
    },

    // ── Character ──
    selectCharacter: (id) => set((s) => { s.selectedCharacterId = id }),

    updateCharacter: (id, patch) => {
      pushUndo(get)
      set((s) => {
        const idx = s.characters.findIndex((c) => c.id === id)
        if (idx !== -1) {
          Object.assign(s.characters[idx], patch)
          s.isDirty = true
        }
      })
    },

    addCharacter: (character) => {
      pushUndo(get)
      set((s) => {
        s.characters.push(character)
        s.isDirty = true
      })
    },

    deleteCharacter: (id) => {
      pushUndo(get)
      set((s) => {
        s.characters = s.characters.filter((c) => c.id !== id)
        if (s.selectedCharacterId === id) s.selectedCharacterId = null
        s.isDirty = true
      })
    },

    updateSharedContext: (patch) => {
      pushUndo(get)
      set((s) => {
        Object.assign(s.sharedContext, patch)
        s.isDirty = true
      })
    },

    // ── WorldState ──
    updateWorldStateDefinition: (patch) => {
      pushUndo(get)
      const oldWSD = JSON.parse(JSON.stringify(get().worldStateDefinition))
      set((s) => {
        // 应用 patch
        Object.assign(s.worldStateDefinition, patch)
        // 级联同步：清理/替换 landmark 和 storylet 中引用被删/被改名的变量
        const { landmarks, storylets } = cascadeWorldStateChange(
          oldWSD, s.worldStateDefinition, s.landmarks, s.storylets,
        )
        s.landmarks = landmarks
        s.storylets = storylets
        s.isDirty = true
      })
    },

    // ── Inspector ──
    setInspectorTab: (tab) => set((s) => { s.inspectorTab = tab }),
    setInspectorWidth: (width) => set((s) => { s.inspectorWidth = width }),
    setRightPanel: (panel) => set((s) => { s.rightPanel = panel }),

    // ── 库操作 ──
    addAction: (action) => {
      pushUndo(get)
      set((s) => {
        s.actionLibrary.push(action)
        s.isDirty = true
      })
    },

    updateAction: (id, patch) => {
      pushUndo(get)
      set((s) => {
        const idx = s.actionLibrary.findIndex((a) => a.id === id)
        if (idx !== -1) {
          Object.assign(s.actionLibrary[idx], patch)
          s.isDirty = true
        }
      })
    },

    deleteAction: (id) => {
      pushUndo(get)
      set((s) => {
        s.actionLibrary = s.actionLibrary.filter((a) => a.id !== id)
        s.isDirty = true
      })
    },

    addExpression: (expression) => {
      pushUndo(get)
      set((s) => {
        s.expressionLibrary.push(expression)
        s.isDirty = true
      })
    },

    updateExpression: (id, patch) => {
      pushUndo(get)
      set((s) => {
        const idx = s.expressionLibrary.findIndex((e) => e.id === id)
        if (idx !== -1) {
          Object.assign(s.expressionLibrary[idx], patch)
          s.isDirty = true
        }
      })
    },

    deleteExpression: (id) => {
      pushUndo(get)
      set((s) => {
        s.expressionLibrary = s.expressionLibrary.filter((e) => e.id !== id)
        s.isDirty = true
      })
    },

    addProp: (prop) => {
      pushUndo(get)
      set((s) => {
        s.propLibrary.push(prop)
        s.isDirty = true
      })
    },

    updateProp: (id, patch) => {
      pushUndo(get)
      set((s) => {
        const idx = s.propLibrary.findIndex((p) => p.id === id)
        if (idx !== -1) {
          Object.assign(s.propLibrary[idx], patch)
          s.isDirty = true
        }
      })
    },

    deleteProp: (id) => {
      pushUndo(get)
      set((s) => {
        s.propLibrary = s.propLibrary.filter((p) => p.id !== id)
        s.isDirty = true
      })
    },

    addLocation: (location) => {
      pushUndo(get)
      set((s) => {
        s.locationLibrary.push(location)
        s.isDirty = true
      })
    },

    updateLocation: (id, patch) => {
      pushUndo(get)
      set((s) => {
        const idx = s.locationLibrary.findIndex((l) => l.id === id)
        if (idx !== -1) {
          Object.assign(s.locationLibrary[idx], patch)
          s.isDirty = true
        }
      })
    },

    deleteLocation: (id) => {
      pushUndo(get)
      set((s) => {
        s.locationLibrary = s.locationLibrary.filter((l) => l.id !== id)
        s.isDirty = true
      })
    },

    // ── 持久化 ──
    loadFromJSON: (landmarks, storylets, characters, sharedContext, worldStateDefinition, actionLibrary, expressionLibrary, propLibrary, locationLibrary) => {
      clearHistory()
      set((s) => {
        s.landmarks = landmarks
        s.storylets = storylets
        if (characters) s.characters = characters
        if (sharedContext) s.sharedContext = sharedContext
        if (worldStateDefinition) s.worldStateDefinition = worldStateDefinition
        if (actionLibrary) s.actionLibrary = actionLibrary
        if (expressionLibrary) s.expressionLibrary = expressionLibrary
        if (propLibrary) s.propLibrary = propLibrary
        // 只有 locationLibrary 有数据时才覆盖，保持编辑器中的数据不变
        if (locationLibrary && locationLibrary.length > 0) {
          s.locationLibrary = locationLibrary
        }
        s.isDirty = false
        s.selectedLandmarkId = null
        s.selectedLandmarkIds = []
        s.selectedCharacterId = null
      })
    },

    loadWorldStateDefinition: (wsd: WorldStateDefinition) => {
      set((s) => {
        s.worldStateDefinition = wsd
      })
    },

    markClean: () => set((s) => { s.isDirty = false }),
  }))
)
