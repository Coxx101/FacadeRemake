import { create } from 'zustand'
import type { StoryProjectMeta, Landmark, Storylet, CharacterProfile, SharedContext, WorldStateDefinition, ActionEntry, ExpressionEntry, PropEntry, LocationEntry } from '../types'
import {
  defaultLandmarks,
  defaultStorylets,
  defaultCharacters,
  defaultSharedContext,
  defaultWorldStateDefinition,
  defaultActionLibrary,
  defaultExpressionLibrary,
  defaultPropLibrary,
  defaultLocationLibrary,
} from '../data/defaults'

const STORAGE_KEY = 'facadestudio_projects'

function createDefaultProject(): StoryProjectMeta {
  const now = new Date().toISOString()
  return {
    id: 'default_project',
    name: '晚餐派对',
    description: '一个关于婚姻与秘密的互动叙事故事。Trip 和 Grace 的婚姻在这个夜晚面临最终考验。',
    createdAt: now,
    updatedAt: now,
    snapshot: {
      landmarks: JSON.parse(JSON.stringify(defaultLandmarks)),
      storylets: JSON.parse(JSON.stringify(defaultStorylets)),
      characters: JSON.parse(JSON.stringify(defaultCharacters)),
      sharedContext: JSON.parse(JSON.stringify(defaultSharedContext)),
      worldStateDefinition: JSON.parse(JSON.stringify(defaultWorldStateDefinition)),
      actionLibrary: JSON.parse(JSON.stringify(defaultActionLibrary)),
      expressionLibrary: JSON.parse(JSON.stringify(defaultExpressionLibrary)),
      propLibrary: JSON.parse(JSON.stringify(defaultPropLibrary)),
      locationLibrary: JSON.parse(JSON.stringify(defaultLocationLibrary)),
    },
  }
}

function loadFromStorage(): StoryProjectMeta[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const stored = raw ? JSON.parse(raw) : []
    if (stored.length === 0) {
      return [createDefaultProject()]
    }
    return stored
  } catch {
    return [createDefaultProject()]
  }
}

function saveToStorage(projects: StoryProjectMeta[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
}

function generateId(): string {
  return 'proj_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6)
}

export interface ProjectStoreState {
  projects: StoryProjectMeta[]

  // ── 项目 CRUD ──
  /** 新建项目（空模板） */
  createProject: (name: string, description?: string) => StoryProjectMeta
  /** 更新项目元信息 */
  updateProjectMeta: (id: string, patch: Partial<Pick<StoryProjectMeta, 'name' | 'description'>>) => void
  /** 保存项目快照（从当前 useStore 数据写入） */
  saveProjectSnapshot: (
    id: string,
    data: {
      landmarks: Landmark[]
      storylets: Storylet[]
      characters: CharacterProfile[]
      sharedContext: SharedContext
      worldStateDefinition: WorldStateDefinition
      actionLibrary: ActionEntry[]
      expressionLibrary: ExpressionEntry[]
      propLibrary: PropEntry[]
      locationLibrary: LocationEntry[]
    },
  ) => void
  /** 删除项目 */
  deleteProject: (id: string) => void
  /** 获取单个项目 */
  getProject: (id: string) => StoryProjectMeta | undefined
}

export const useProjectStore = create<ProjectStoreState>()((set, get) => ({
  projects: loadFromStorage(),

  createProject: (name, description = '') => {
    const now = new Date().toISOString()
    const project: StoryProjectMeta = {
      id: generateId(),
      name,
      description,
      createdAt: now,
      updatedAt: now,
      snapshot: {
        landmarks: [] as Landmark[],
        storylets: [] as Storylet[],
        characters: [] as CharacterProfile[],
        sharedContext: { marriage_secret: {}, key_events: {} } as SharedContext,
        worldStateDefinition: { qualities: [], flags: [], relationships: [] } as WorldStateDefinition,
        actionLibrary: [] as ActionEntry[],
        expressionLibrary: [] as ExpressionEntry[],
        propLibrary: [] as PropEntry[],
        locationLibrary: [] as LocationEntry[],
      },
    }
    set((s) => {
      const projects = [...s.projects, project]
      saveToStorage(projects)
      return { projects }
    })
    return project
  },

  updateProjectMeta: (id, patch) => {
    set((s) => {
      const projects = s.projects.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
      )
      saveToStorage(projects)
      return { projects }
    })
  },

  saveProjectSnapshot: (id, data) => {
    set((s) => {
      const projects = s.projects.map((p) =>
        p.id === id
          ? {
              ...p,
              updatedAt: new Date().toISOString(),
              snapshot: JSON.parse(JSON.stringify(data)),
            }
          : p,
      )
      saveToStorage(projects)
      return { projects }
    })
  },

  deleteProject: (id) => {
    set((s) => {
      const projects = s.projects.filter((p) => p.id !== id)
      saveToStorage(projects)
      return { projects }
    })
  },

  getProject: (id) => get().projects.find((p) => p.id === id),
}))
