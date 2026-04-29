/**
 * Play 模式运行时状态
 * P3-a：WebSocket 通信（LLM 驱动）
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { WorldStateDefinition } from '../types'
import { useStore } from './useStore'

// ── 运行时 WorldState 值（与 WSD 定义分离）─────────────────────────────────
export interface RuntimeWorldState {
  qualities: Record<string, number>
  flags: Record<string, boolean | string | number>
  relationships: Record<string, number>
}

// ── 对话消息类型 ─────────────────────────────────────────────────────────────
export type MessageRole = 'narrator' | 'trip' | 'grace' | 'player' | 'system'

export interface ChatMessage {
  id: string
  role: MessageRole
  speakerName?: string
  speech?: string
  action?: string
  thought?: string
  isSilence?: boolean  // 玩家保持沉默标记
  timestamp: number
}

// ── 快照（回退用）────────────────────────────────────────────────────────────
interface PlaySnapshot {
  messages: ChatMessage[]
  worldState: RuntimeWorldState
  currentLandmarkId: string
  currentStoryletId: string | null
  turn: number
}

// ── WebSocket 后端消息类型 ──────────────────────────────────────────────────
interface WsChatMessage {
  type: 'chat'
  role: string
  speech?: string
  action?: string
  thought?: string
  speaker_name?: string
}

interface LandmarkInfo {
  id: string
  title: string | null
  phase_tag: string | null
  is_ending: boolean
}

interface StoryletInfo {
  id: string
  title: string | null
  narrative_goal: string | null
  phase_tags: string[]
}

interface WsStateUpdate {
  type: 'state_update'
  world_state: RuntimeWorldState
  current_landmark_id: string
  current_landmark?: LandmarkInfo
  current_storylet_id: string | null
  current_storylet?: StoryletInfo
  turn: number
  game_ended: boolean
}

interface WsErrorMessage {
  type: 'error'
  message: string
}

// ── LLM 调试日志条目 ─────────────────────────────────────────────────────
export interface LlmDebugEntry {
  id: string
  event: 'llm_request' | 'llm_response'
  model?: string
  temperature?: number
  max_tokens?: number | null
  messages?: Array<{ role: string; content: string }>
  content?: string
  ts: number
}

interface WsLlmDebug {
  type: 'llm_debug'
  event: 'llm_request' | 'llm_response'
  data: {
    model?: string
    temperature?: number
    max_tokens?: number | null
    messages?: Array<{ role: string; content: string }>
    content?: string
  }
  ts: number
}

type WsIncomingMessage = WsChatMessage | WsStateUpdate | WsErrorMessage | WsLlmDebug

// ── Store 类型 ────────────────────────────────────────────────────────────────
export interface PlayStoreState {
  messages: ChatMessage[]
  worldState: RuntimeWorldState
  currentLandmarkId: string
  currentStoryletId: string | null
  currentLandmark: LandmarkInfo | null
  currentStorylet: StoryletInfo | null
  turn: number
  debugOpen: boolean
  setDebugOpen: (open: boolean) => void
  isLoading: boolean
  gameEnded: boolean
  connected: boolean // WebSocket 连接状态
  debugLogs: LlmDebugEntry[]
  clearDebugLogs: () => void

  // 回退栈
  _snapshotStack: PlaySnapshot[]

  // ── 操作 ──
  initFromWSD: (wsd: WorldStateDefinition, firstLandmarkId: string) => void
  sendMessage: (text: string) => void
  rollback: () => void
  resetGame: (wsd: WorldStateDefinition, firstLandmarkId: string) => void
  setQuality: (key: string, value: number) => void
  setFlag: (key: string, value: boolean | string | number) => void
  setRelationship: (key: string, value: number) => void

  // WebSocket
  connect: () => void
  disconnect: () => void
  _sendWs: (data: Record<string, unknown>) => void
  _handleWsMessage: (data: WsIncomingMessage) => void
}

// ── 工具 ────────────────────────────────────────────────────────────────────
let msgCounter = 0
function uid() { return `msg_${Date.now()}_${msgCounter++}` }

const WS_URL = 'ws://localhost:8000/ws/play'

// ── WebSocket 单例 ──────────────────────────────────────────────────────────
let wsInstance: WebSocket | null = null
let wsMessageHandler: ((data: WsIncomingMessage) => void) | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

function getWs(
  storeHandler: (data: WsIncomingMessage) => void,
  onStateChange: (connected: boolean) => void,
): WebSocket {
  if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
    wsMessageHandler = storeHandler
    return wsInstance
  }

  // 清理旧连接
  if (wsInstance) {
    wsInstance.onclose = null
    wsInstance.close()
  }

  wsMessageHandler = storeHandler
  wsInstance = new WebSocket(WS_URL)

  wsInstance.onopen = () => {
    console.log('[WS] Connected')
    onStateChange(true)
    // 不在此处自动 sendInitScene，由 PlayMode 组件在数据就绪后显式调用
  }

  wsInstance.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as WsIncomingMessage
      if (data.type === 'llm_debug') {
        console.log('[WS] ✅ 收到 llm_debug:', data.event, data)
      }
      wsMessageHandler?.(data)
    } catch (e) {
      console.error('[WS] Parse error:', e)
    }
  }

  wsInstance.onclose = () => {
    console.log('[WS] Disconnected')
    onStateChange(false)
    // 自动重连（3秒后）
    reconnectTimer = setTimeout(() => {
      console.log('[WS] Reconnecting...')
      getWs(storeHandler, onStateChange)
    }, 3000)
  }

  wsInstance.onerror = (e) => {
    console.error('[WS] Error:', e)
    onStateChange(false)
  }

  return wsInstance
}

/** 从 useStore 读取当前编辑器数据，发送 init_scene 给后端 */
export function sendInitScene() {
  const state = useStore.getState()
  const sceneData = {
    landmarks: state.landmarks.map(({ position: _pos, ...rest }) => rest),
    storylets: state.storylets,
    characters: state.characters,
    world_state_definition: state.worldStateDefinition,
  }
  if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
    wsInstance.send(JSON.stringify({ type: 'init_scene', data: sceneData }))
    console.log(`[WS] init_scene sent: ${sceneData.landmarks.length} landmarks, ${sceneData.storylets.length} storylets, ${sceneData.characters.length} characters`)
  }
}

function closeWs() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (wsInstance) {
    wsInstance.onclose = null
    wsInstance.close()
    wsInstance = null
  }
  wsMessageHandler = null
}

// ── Store 实现 ────────────────────────────────────────────────────────────────
export const usePlayStore = create<PlayStoreState>()(
  immer((set, get) => ({
    messages: [],
    worldState: { qualities: {}, flags: {}, relationships: {} },
    currentLandmarkId: '',
    currentStoryletId: null,
    currentLandmark: null,
    currentStorylet: null,
    turn: 0,
    debugOpen: true,
    isLoading: false,
    gameEnded: false,
    connected: false,
    _snapshotStack: [],
    debugLogs: [],

    setDebugOpen: (open) => set((s) => { s.debugOpen = open }),
    clearDebugLogs: () => set((s) => { s.debugLogs = [] }),

    initFromWSD: (_wsd, _firstLandmarkId) => {
      // P3: WorldState 初始化由后端发送 state_update 驱动
      // 前端只需确保连接已建立
      get().connect()
    },

    connect: () => {
      const s = get()
      if (s.connected) return
      set((st) => { st.connected = false }) // CONNECTING 状态
      getWs(
        (data) => get()._handleWsMessage(data),
        (connected) => set((st) => { st.connected = connected }),
      )
    },

    disconnect: () => {
      closeWs()
      set((s) => { s.connected = false })
    },

    _sendWs: (data) => {
      const ws = wsInstance
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data))
      } else {
        console.warn('[WS] Not connected, message dropped')
      }
    },

    _handleWsMessage: (data) => {
      if (data.type === 'chat') {
        // 玩家消息已在 sendMessage 中本地立即渲染，后端回显的 player 消息直接忽略
        if (data.role === 'player') return
        set((s) => {
          s.messages.push({
            id: uid(),
            role: data.role as MessageRole,
            speech: data.speech,
            action: data.action,
            thought: data.thought,
            speakerName: data.speaker_name,
            isSilence: (data as any).is_silence,
            timestamp: Date.now(),
          })
        })
      } else if (data.type === 'state_update') {
        set((s) => {
          if (data.world_state) {
            s.worldState.qualities = { ...s.worldState.qualities, ...data.world_state.qualities }
            s.worldState.flags = { ...s.worldState.flags, ...data.world_state.flags }
            s.worldState.relationships = { ...s.worldState.relationships, ...data.world_state.relationships }
          }
          if (data.current_landmark_id !== undefined) s.currentLandmarkId = data.current_landmark_id
          if (data.current_landmark) {
            s.currentLandmark = data.current_landmark
          } else if (data.current_landmark_id) {
            s.currentLandmark = null
          }
          if (data.current_storylet_id !== undefined) s.currentStoryletId = data.current_storylet_id
          if (data.current_storylet) {
            s.currentStorylet = data.current_storylet
          } else {
            s.currentStorylet = null
          }
          if (data.turn !== undefined) s.turn = data.turn
          if (data.game_ended !== undefined) {
            s.gameEnded = data.game_ended
            if (data.game_ended) s.isLoading = false
          }
          s.isLoading = false
        })
      } else if (data.type === 'error') {
        console.error('[WS] Server error:', (data as WsErrorMessage).message)
        set((s) => { s.isLoading = false })
      } else if (data.type === 'llm_debug') {
        const ld = data as WsLlmDebug
        set((s) => {
          // 最多保留 200 条调试日志
          s.debugLogs.push({
            id: `dbg_${Date.now()}_${s.debugLogs.length}`,
            event: ld.event,
            model: ld.data.model,
            temperature: ld.data.temperature,
            max_tokens: ld.data.max_tokens,
            messages: ld.data.messages,
            content: ld.data.content,
            ts: ld.ts,
          })
          if (s.debugLogs.length > 200) {
            s.debugLogs = s.debugLogs.slice(-200)
          }
        })
      }
    },

    sendMessage: (text) => {
      const s = get()
      if (s.isLoading || s.gameEnded) return

      const isSilence = !text.trim()
      const displayText = isSilence ? '……' : text

      // 压快照
      const snapshot: PlaySnapshot = {
        messages: JSON.parse(JSON.stringify(s.messages)),
        worldState: JSON.parse(JSON.stringify(s.worldState)),
        currentLandmarkId: s.currentLandmarkId,
        currentStoryletId: s.currentStoryletId,
        turn: s.turn,
      }
      set((st) => {
        st._snapshotStack.push(snapshot)
        if (st._snapshotStack.length > 30) st._snapshotStack.shift()
        // 立即显示玩家消息，不等后端回包
        st.messages.push({
          id: uid(),
          role: 'player',
          speech: displayText,
          isSilence,
          timestamp: Date.now(),
        })
        st.isLoading = true
      })

      // 发送到 WebSocket（空字符串也会发送，后端识别为沉默）
      get()._sendWs({ type: 'player_input', text })
    },

    rollback: () => {
      set((s) => {
        if (s._snapshotStack.length === 0) return
        const snap = s._snapshotStack.pop()!
        s.messages = snap.messages
        s.worldState = snap.worldState
        s.currentLandmarkId = snap.currentLandmarkId
        s.currentStoryletId = snap.currentStoryletId
        s.turn = snap.turn
        s.isLoading = false
        s.gameEnded = false
      })
    },

    resetGame: (_wsd, _firstLandmarkId) => {
      set((s) => {
        s.messages = []
        s.worldState = { qualities: {}, flags: {}, relationships: {} }
        s.currentLandmarkId = ''
        s.currentStoryletId = null
        s.turn = 0
        s._snapshotStack = []
        s.isLoading = false
        s.gameEnded = false
      })
      // 重新发送 init_scene 让后端重置
      sendInitScene()
    },

    setQuality: (key, value) => {
      set((s) => { s.worldState.qualities[key] = value })
      // 同步到后端
      get()._sendWs({
        type: 'debug_worldstate',
        data: get().worldState,
      })
    },

    setFlag: (key, value) => {
      set((s) => { s.worldState.flags[key] = value })
      get()._sendWs({
        type: 'debug_worldstate',
        data: get().worldState,
      })
    },

    setRelationship: (key, value) => {
      set((s) => { s.worldState.relationships[key] = value })
      get()._sendWs({
        type: 'debug_worldstate',
        data: get().worldState,
      })
    },
  }))
)
