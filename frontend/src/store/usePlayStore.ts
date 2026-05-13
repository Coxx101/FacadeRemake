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

interface WsPlayerTurn {
  type: 'player_turn'
}

// ── LLM 调试日志条目 ─────────────────────────────────────────────────────
export interface LlmDebugEntry {
  id: string
  event: 'llm_request' | 'llm_response'
  component?: string  // v2.0: 组件标签，如 "InputParser/Gate1"
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
    component?: string
    model?: string
    temperature?: number
    max_tokens?: number | null
    messages?: Array<{ role: string; content: string }>
    content?: string
  }
  ts: number
}

// ── v2.0: 流水线调试事件 ──────────────────────────────────────────────
export interface PipelineEvent {
  turn: number
  step: string
  result: string
  detail: string
  ts?: number
}

interface WsPipelineEvent {
  type: 'pipeline_event'
  turn: number
  step: string
  result: string
  detail: string
}

interface WsReadyMessage {
  type: 'ready'
  message?: string
}

// ── 位置和实体类型 ──────────────────────────────────────────────────────────
export interface EntityLocation {
  entityId: string
  entityName: string
  entityType: 'character' | 'prop' | 'narrator'
}

interface WsLocationUpdate {
  type: 'location_update'
  player_location: string
  entity_locations: Record<string, string>  // entityId -> locationId
}

interface WsLocationInfo {
  type: 'location_info'
  locations: Array<{
    id: string
    label: string
    adjacent: string[]
  }>
  player_location: string
  entity_locations: Record<string, string>
}

interface WsBeatPlanRefresh {
  type: 'beat_plan_refresh'
  reason: 'player_moved' | 'auto_refresh'
  message?: string
}

// ── v2.0: GameLog ──────────────────────────────────────────────────────────
interface GameLogEntry {
  title: string
  completion_status: string
  summary: string
  turn: number
  storylet_id: string
  timestamp: string
}

interface WsGameLog {
  type: 'game_log'
  entries: GameLogEntry[]
}

type WsIncomingMessage = WsChatMessage | WsStateUpdate | WsErrorMessage | WsLlmDebug | WsPlayerTurn | WsReadyMessage | WsLocationUpdate | WsLocationInfo | WsBeatPlanRefresh | WsGameLog | WsPipelineEvent

// ── Store 类型 ────────────────────────────────────────────────────────────────
export interface PlayState {
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
  connecting: boolean // WebSocket 正在连接中
  backendReady: boolean // 后端已准备好接收 init_scene
  sentInitScene: boolean // 是否已发送 init_scene
  setSentInitScene: (v: boolean) => void
  debugLogs: LlmDebugEntry[]
  clearDebugLogs: () => void

  // ── v2.0: 流水线调试 ──
  pipelineEvents: PipelineEvent[]
  clearPipelineEvents: () => void
  isPlayerTurn: boolean // 是否轮到玩家输入

  // ── v2.0: GameLog ──
  gameLogEntries: GameLogEntry[]

  // ── 位置系统 ──
  locations: Array<{ id: string; label: string; adjacent: string[] }>
  playerLocation: string  // 玩家当前位置
  entityLocations: Record<string, string>  // 实体当前位置 { entityId: locationId }
  characters: Array<{ id: string; name: string }>  // 当前场景的角色列表
  props: Array<{ id: string; name: string }>  // 当前场景的物品列表

  // 回退栈
  _snapshotStack: PlaySnapshot[]

  // ── 操作 ──
  initFromWSD: (wsd: WorldStateDefinition, firstLandmarkId: string) => void
  sendMessage: (text: string) => void
  moveToLocation: (locationId: string) => void
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

// 生成唯一会话ID
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

const WS_URL = 'ws://localhost:8000/ws/play'

// ── WebSocket 单例管理 ──────────────────────────────────────────────────────
let wsInstance: WebSocket | null = null
let wsMessageHandler: ((data: WsIncomingMessage) => void) | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempts = 0
let intentionalClose = false
const MAX_RECONNECT = 5
const BASE_DELAY = 3000

// 缓存待发送的场景数据（用于连接建立后自动发送）
let pendingSceneData: any = null

// 待发送的消息队列（用于连接中/连接失败重试）
let pendingMessages: Array<Record<string, unknown>> = []

// 开发环境下暴露调试接口
if (process.env.NODE_ENV === 'development') {
  ;(window as any).__WS_DEBUG__ = {
    getWsInstance: () => wsInstance,
    getPendingSceneData: () => pendingSceneData,
    getPendingMessages: () => pendingMessages,
    getReconnectAttempts: () => reconnectAttempts,
    forceConnect: () => {
      if (wsInstance) {
        wsInstance.close()
      }
      reconnectAttempts = 0
      pendingSceneData = null
      pendingMessages = []
    },
  }
}

// 延迟导出 store 实例以便调试（在文件末尾定义）
let playStoreInstance: typeof usePlayStore | null = null

function getReconnectDelay(): number {
  return Math.min(BASE_DELAY * Math.pow(2, reconnectAttempts), 60000)
}

function getWs(
  storeHandler: (data: WsIncomingMessage) => void,
  onStateChange: (connected: boolean, connecting: boolean) => void,
  forceNew: boolean = false,
): WebSocket {
  // 如果已有连接且状态正常，更新 handler 后返回（除非强制新建）
  if (wsInstance && !forceNew) {
    if (wsInstance.readyState === WebSocket.OPEN) {
      wsMessageHandler = storeHandler
      return wsInstance
    }
    // 如果正在连接中，等待连接完成，更新 handler
    if (wsInstance.readyState === WebSocket.CONNECTING) {
      wsMessageHandler = storeHandler
      return wsInstance
    }
    // 否则清理无效连接
    safeCloseWs()
  } else if (forceNew && wsInstance) {
    // 强制新建会话，先断开旧连接
    intentionalClose = true
    safeCloseWs()
    intentionalClose = false
    reconnectAttempts = 0
  }

  wsMessageHandler = storeHandler
  // 每次连接都使用唯一的会话ID
  const sessionId = generateSessionId()
  const wsUrlWithSession = `${WS_URL}?session_id=${sessionId}`
  const currentWs = new WebSocket(wsUrlWithSession)
  wsInstance = currentWs
  console.log('[WS] 🔗 Created WebSocket, wsInstance:', !!wsInstance, 'readyState:', wsInstance.readyState)

  console.log('[WS] 🔗 Connecting with session:', sessionId)

  onStateChange(false, true)

  // 使用闭包保存当前连接引用，防止被后续连接覆盖
  currentWs.onopen = () => {
        console.log('[WS] ✅ onopen fired! wsInstance:', !!wsInstance, 'currentWs === wsInstance:', currentWs === wsInstance)
        reconnectAttempts = 0
        onStateChange(true, false)
        // 如果有缓存的场景数据，立即发送
        if (pendingSceneData) {
          console.log('[WS] 📤 Sending cached init_scene...')
          const jsonStr = JSON.stringify({ type: 'init_scene', data: pendingSceneData })
          // 使用闭包中的 currentWs 而非全局 wsInstance
          if (currentWs.readyState === WebSocket.OPEN) {
            currentWs.send(jsonStr)
            console.log(`[WS] 📤 init_scene sent (from cache): ${pendingSceneData.landmarks.length} landmarks, ${pendingSceneData.storylets.length} storylets, ${pendingSceneData.characters.length} characters`)
            pendingSceneData = null
          } else {
            console.warn('[WS] ⚠️ WebSocket not open when trying to send cached data')
          }
        }
        // 发送所有待处理的消息
        if (pendingMessages.length > 0) {
          console.log(`[WS] 📤 Flushing ${pendingMessages.length} pending messages...`)
          pendingMessages.forEach((msg) => {
            if (currentWs.readyState === WebSocket.OPEN) {
              currentWs.send(JSON.stringify(msg))
              console.log(`[WS] 📤 Sent pending message: ${(msg as any).type}`)
            }
          })
          pendingMessages = []
        }
      }

  // 使用闭包保存回调，防止被覆盖
  currentWs.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as WsIncomingMessage
      console.log('[WS] 📥 onmessage received:', data.type, data)
      if (data.type === 'llm_debug') {
        console.debug('[WS] 📝 LLM Debug:', data.event)
      }
      if (!wsMessageHandler) {
        console.warn('[WS] ⚠️ onmessage fired but wsMessageHandler is null — message dropped:', data.type)
      } else {
        wsMessageHandler(data)
      }
    } catch (e) {
      console.error('[WS] ❌ Parse error:', e)
    }
  }

  currentWs.onclose = (event) => {
    console.log(`[WS] 🚪 Disconnected (code: ${event.code}, reason: ${event.reason}), wsInstance:`, !!wsInstance, 'currentWs === wsInstance:', currentWs === wsInstance)
    onStateChange(false, false)

    if (intentionalClose) {
      intentionalClose = false
      return
    }

    if (reconnectAttempts >= MAX_RECONNECT) {
      console.warn(`[WS] ⚠️ 已达最大重连次数 (${MAX_RECONNECT})，停止重连`)
      return
    }

    const delay = getReconnectDelay()
    reconnectAttempts++
    console.log(`[WS] 🔄 ${delay / 1000}s 后重连 (第 ${reconnectAttempts}/${MAX_RECONNECT} 次)...`)

    reconnectTimer = setTimeout(() => {
      getWs(storeHandler, onStateChange)
    }, delay)
  }

  currentWs.onerror = (error) => {
    console.error('[WS] ❌ Error:', error)
    onStateChange(false, false)
  }

  return currentWs
}

function safeCloseWs(): void {
  if (!wsInstance) return

  // 如果正在连接中，等待连接失败或成功后再关闭
  if (wsInstance.readyState === WebSocket.CONNECTING) {
    const closeOnOpen = () => {
      wsInstance?.removeEventListener('open', closeOnOpen)
      wsInstance?.removeEventListener('close', closeOnOpen)
      safeCloseWs()
    }
    wsInstance.addEventListener('open', closeOnOpen)
    wsInstance.addEventListener('close', closeOnOpen)
    return
  }

  // 清除所有回调，防止旧连接的回调被触发
  wsInstance.onopen = null
  wsInstance.onclose = null
  wsInstance.onmessage = null
  wsInstance.onerror = null
  
  try {
    wsInstance.close()
  } catch (e) {
    console.warn('[WS] Error closing socket:', e)
  }
  wsInstance = null
}

function closeWs(): void {
  intentionalClose = true
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  console.log('[WS] closeWs called, closing existing wsInstance:', !!wsInstance)
  safeCloseWs()
  wsMessageHandler = null
  reconnectAttempts = 0
  // 清理待处理消息队列
  pendingMessages = []
}

/** 从 useStore 读取当前编辑器数据，发送 init_scene 给后端 */
export function sendInitScene() {
  const state = useStore.getState()
  const sceneData = {
    landmarks: state.landmarks.map(({ position: _pos, ...rest }) => rest),
    storylets: state.storylets,
    characters: state.characters,
    world_state_definition: state.worldStateDefinition,
    shared_context: state.sharedContext,
    action_library: state.actionLibrary,
    expression_library: state.expressionLibrary,
    prop_library: state.propLibrary,
    location_library: state.locationLibrary,
  }

  // 始终先缓存，确保 onopen 时一定能拿到
  pendingSceneData = sceneData

  // 如果连接已打开，直接发送
  if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
    wsInstance.send(JSON.stringify({ type: 'init_scene', data: sceneData }))
    console.log(`[WS] 📤 init_scene sent: ${sceneData.landmarks.length} landmarks, ${sceneData.storylets.length} storylets, ${sceneData.characters.length} characters, ${sceneData.action_library.length} actions, ${sceneData.expression_library.length} expressions, ${sceneData.prop_library.length} props, ${sceneData.location_library.length} locations`)
    pendingSceneData = null
  }
}

// ── Store 实现 ────────────────────────────────────────────────────────────────
export const usePlayStore = create<PlayState>()(
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
    connecting: false,
    backendReady: false, // 后端已准备好接收 init_scene
    sentInitScene: false, // 是否已发送 init_scene
    _snapshotStack: [],
    debugLogs: [],
    isPlayerTurn: false,
    gameLogEntries: [],
    pipelineEvents: [],

    // 位置系统初始状态
    locations: [],
    playerLocation: '',
    entityLocations: {},
    characters: [],
    props: [],

    setDebugOpen: (open) => set((s) => { s.debugOpen = open }),
    clearDebugLogs: () => set((s) => { s.debugLogs = [] }),
    clearPipelineEvents: () => set((s) => { s.pipelineEvents = [] }),
    setSentInitScene: (v) => set((s) => { s.sentInitScene = v }),

    initFromWSD: (_wsd, _firstLandmarkId) => {
      get().connect()
    },

    connect: (forceNew: boolean = false) => {
      const s = get()
      console.log('[WS] connect() called, forceNew:', forceNew, 'current state - connected:', s.connected, 'connecting:', s.connecting)
      // 如果强制新建，先断开旧连接并清理旧消息
      if (forceNew && (s.connected || s.connecting)) {
        console.log('[WS] forceNew=true and already connected/connecting, calling closeWs()')
        closeWs()
        set((st) => { st.connected = false; st.connecting = false })
      }
      if (!forceNew && (s.connected || s.connecting)) {
        console.log('[WS] Skipping connect - already connected or connecting')
        return
      }
      reconnectAttempts = 0
      intentionalClose = false
      set((st) => { st.connected = false; st.connecting = true })
      getWs(
        (data) => get()._handleWsMessage(data),
        (connected, connecting) => set((st) => { st.connected = connected; st.connecting = connecting }),
        forceNew,
      )
    },

    disconnect: () => {
      closeWs()
      set((s) => { s.connected = false; s.connecting = false; s.backendReady = false })
    },

    _sendWs: (data) => {
      const ws = wsInstance
      console.log('[WS] _sendWs called, ws:', !!ws, ws ? ws.readyState : 'N/A', 'message type:', (data as any).type)
      if (!ws) {
        console.warn('[WS] ⚠️ No WebSocket instance, queueing message:', (data as any).type)
        pendingMessages.push(data)
        return
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data))
      } else if (ws.readyState === WebSocket.CONNECTING) {
        console.log('[WS] WebSocket connecting, queueing message:', (data as any).type)
        pendingMessages.push(data)
      } else {
        console.warn('[WS] ⚠️ WebSocket not open (state:', ws.readyState, '), queueing message:', (data as any).type)
        pendingMessages.push(data)
      }
    },

    _handleWsMessage: (data) => {
      if (data.type === 'chat') {
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
      } else if (data.type === 'player_turn') {
        console.log('[WS] 🎮 Player turn')
        set((s) => {
          s.isPlayerTurn = true
          s.isLoading = false
        })
      } else if (data.type === 'state_update') {
        console.log('[WS] 🔄 State update received')
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
          s.debugLogs.push({
            id: `dbg_${Date.now()}_${s.debugLogs.length}`,
            event: ld.event,
            component: ld.data.component || '',
            model: ld.data.model,
            temperature: ld.data.temperature,
            max_tokens: ld.data.max_tokens,
            messages: ld.data.messages,
            content: ld.data.content,
            ts: ld.ts,
          })
        })
      } else if (data.type === 'ready') {
        console.log('[WS] ✅ Backend ready signal received')
        set((s) => {
          s.backendReady = true
        })
      } else if (data.type === 'location_update') {
        console.log('[WS] 📍 Location update received')
        set((s) => {
          if ((data as WsLocationUpdate).player_location) {
            s.playerLocation = (data as WsLocationUpdate).player_location
          }
          if ((data as WsLocationUpdate).entity_locations) {
            s.entityLocations = { ...(data as WsLocationUpdate).entity_locations }
          }
        })
      } else if (data.type === 'location_info') {
        console.log('[WS] 📍 Location info received')
        const locInfo = data as WsLocationInfo
        set((s) => {
          s.locations = locInfo.locations || []
          s.playerLocation = locInfo.player_location || ''
          s.entityLocations = locInfo.entity_locations || {}
          // 更新角色列表
          if ((data as any).characters) {
            s.characters = (data as any).characters
          }
          // 更新物品列表
          if ((data as any).props) {
            s.props = (data as any).props
          }
        })
      } else if (data.type === 'pipeline_event') {
        const pe = data as WsPipelineEvent
        set((s) => {
          s.pipelineEvents.push({ ...pe, ts: Date.now() })
        })
      } else if (data.type === 'game_log') {
        console.log('[WS] 📋 GameLog received:', (data as WsGameLog).entries?.length, 'entries')
        set((s) => {
          s.gameLogEntries = (data as WsGameLog).entries || []
        })
      } else if (data.type === 'beat_plan_refresh') {
        console.log('[WS] 🔄 Beat plan refresh triggered:', (data as WsBeatPlanRefresh).reason)
        // 设置 loading 状态，让 UI 显示正在生成中
        set((s) => {
          s.isLoading = true
        })
      }
    },

    sendMessage: (text) => {
      const s = get()
      if (s.isLoading || s.gameEnded) return

      const isSilence = !text.trim()
      const displayText = isSilence ? '……' : text

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
        st.messages.push({
          id: uid(),
          role: 'player',
          speech: displayText,
          isSilence,
          timestamp: Date.now(),
        })
        st.isLoading = true
        st.isPlayerTurn = false
      })

      get()._sendWs({ type: 'player_input', text })
    },

    moveToLocation: (locationId) => {
      const s = get()
      if (s.isLoading || s.gameEnded) return

      console.log('[PlayStore] Moving to location:', locationId)
      get()._sendWs({ type: 'move_location', location_id: locationId })
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
        s.gameLogEntries = []
        s.debugLogs = []
        s.pipelineEvents = []
        s.backendReady = false // 重置 backendReady
        s.sentInitScene = false // 重置 sentInitScene
      })
      // 重连会触发后端发送新的 ready 信号
      get().disconnect()
      setTimeout(() => get().connect(true), 100)
    },

    setQuality: (key, value) => {
      set((s) => { s.worldState.qualities[key] = value })
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

// 在 store 创建后赋值，避免初始化顺序错误
playStoreInstance = usePlayStore

// 如果是开发环境，暴露到全局用于调试
if (process.env.NODE_ENV === 'development') {
  ;(window as any).usePlayStore = usePlayStore
}