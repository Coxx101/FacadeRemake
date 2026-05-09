/**
 * PlayMode — Play 模式主布局（白底风格三栏布局）
 * 左：LeftPanel（时钟+场景+世界状态）
 * 中：SceneStage + NarrativeBox + CommandBar
 * 右：RightPanel（GAME LOG + Debug）
 */
import { useEffect, useRef, useState } from 'react'
import LeftPanel from './LeftPanel'
import SceneStage from './SceneStage'
import NarrativeBox from './NarrativeBox'
import CommandBar from './CommandBar'
import RightPanel from './RightPanel'
import { usePlayStore, sendInitScene } from '../../store/usePlayStore'

// ── 连接状态横幅组件 ──────────────────────────────────────────────────────────
function ConnectionBanner() {
  const connected = usePlayStore((s) => s.connected)
  const connecting = usePlayStore((s) => s.connecting)
  const currentStorylet = usePlayStore((s) => s.currentStorylet)

  const statusColor = connected ? 'var(--good)' : connecting ? 'var(--warn)' : 'var(--danger)'

  return (
    <div style={{
      height: '32px',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: '12px',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      <span style={{
        fontFamily: "'Special Elite','Courier New',monospace",
        fontSize: '13px',
        fontWeight: 700,
        color: 'var(--text)',
        letterSpacing: '0.1em',
      }}>
        FACADE REMAKE
      </span>
      {currentStorylet?.title && (
        <span style={{
          fontSize: '11px',
          color: 'var(--storylet-tag)',
          padding: '1px 8px',
          background: '#f5f0fc',
          borderRadius: '10px',
          border: '1px solid #e8dff5',
        }}>
          {currentStorylet.title}
        </span>
      )}
      <span style={{
        marginLeft: 'auto',
        fontSize: '11px',
        color: statusColor,
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
      }}>
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: statusColor,
          display: 'inline-block',
          boxShadow: connected ? '0 0 5px var(--good)' : connecting ? '0 0 5px var(--warn)' : 'none',
          animation: connecting ? 'pulse 1s ease-in-out infinite' : 'none',
        }} />
        {connected ? 'Connected' : connecting ? 'Connecting…' : 'Disconnected'}
      </span>
    </div>
  )
}

// ── PlayMode 主体 ────────────────────────────────────────────────────────────
export default function PlayMode() {
  const messages = usePlayStore((s) => s.messages)
  const isLoading = usePlayStore((s) => s.isLoading)
  const connected = usePlayStore((s) => s.connected)
  const connecting = usePlayStore((s) => s.connecting)
  const [connectionFailed, setConnectionFailed] = useState(false)
  
  // 使用 ref 来跟踪是否已经发送过 init_scene
  const sentRef = useRef(false)
  // 使用 ref 来跟踪组件是否已卸载（防止 StrictMode 双重渲染问题）
  const mountedRef = useRef(true)
  // 使用 ref 来跟踪是否已经开始连接（防止 StrictMode 创建多个连接）
  const connectingRef = useRef(false)

  // 首次进入 Play 模式时，清空旧状态并确保连接
  useEffect(() => {
    mountedRef.current = true
    connectingRef.current = true
    console.log('[PlayMode] Mounting, clearing state and connecting...')
    
    usePlayStore.setState({
      messages: [],
      worldState: { qualities: {}, flags: {}, relationships: {} },
      currentLandmarkId: '',
      currentStoryletId: null,
      currentLandmark: null,
      currentStorylet: null,
      turn: 0,
      _snapshotStack: [],
      isLoading: false,
      gameEnded: false,
      isPlayerTurn: false,
    })
    sentRef.current = false
    setConnectionFailed(false)
    
    // 强制创建新会话，确保每次进入 Play 模式都是全新的游戏
    const state = usePlayStore.getState()
    console.log('[PlayMode] Current state - connected:', state.connected, 'connecting:', state.connecting)
    state.connect(true)  // 传入 true 强制新建会话
    
    // 设置连接超时检测
    const timeout = setTimeout(() => {
      if (!mountedRef.current) return  // 组件已卸载，不更新状态
      const currentState = usePlayStore.getState()
      if (!currentState.connected && currentState.connecting) {
        setConnectionFailed(true)
        console.warn('[WS] 连接超时，请检查后端服务器是否已启动')
      }
    }, 5000)
    
    return () => {
      console.log('[PlayMode] Unmounting, clearing timeout and disconnecting...')
      mountedRef.current = false
      connectingRef.current = false
      clearTimeout(timeout)
      // 清理时断开连接，防止 StrictMode 导致多个连接
      usePlayStore.getState().disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 连接就绪后发送场景数据（如果尚未发送）
  useEffect(() => {
    console.log('[PlayMode] Connected changed:', connected, 'sentRef.current:', sentRef.current)
    if (connected && !sentRef.current) {
      sentRef.current = true
      setConnectionFailed(false)
      console.log('[PlayMode] Sending init_scene...')
      sendInitScene()
    }
  }, [connected])

  // 连接失败时显示提示
  if (connectionFailed) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-page)',
        padding: '20px',
      }}>
        <div style={{
          padding: '40px',
          background: 'var(--bg-surface)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          textAlign: 'center',
          maxWidth: '400px',
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px',
          }}>🔌</div>
          <h2 style={{
            margin: '0 0 12px 0',
            color: 'var(--text)',
            fontSize: '18px',
          }}>后端服务器未启动</h2>
          <p style={{
            color: 'var(--text-muted)',
            fontSize: '14px',
            margin: '0 0 20px 0',
            lineHeight: '1.5',
          }}>
            无法连接到游戏服务器。请先启动后端服务，然后刷新页面重试。
          </p>
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
          }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 24px',
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              刷新重试
            </button>
            <button
              onClick={() => {
                // 尝试打开启动脚本
                window.open('/start.bat', '_blank')
              }}
              style={{
                padding: '10px 24px',
                background: 'var(--bg-surface)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              启动服务器
            </button>
          </div>
          <div style={{
            marginTop: '20px',
            padding: '12px',
            background: '#f8f9fa',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#666',
            textAlign: 'left',
          }}>
            <strong>手动启动方法：</strong>
            <div style={{ marginTop: '8px', whiteSpace: 'pre-wrap' }}>
1. 打开命令提示符
2. 切换到目录：cd e:\FacadeRemake\prototype
3. 运行：python -m uvicorn ws_server:app --host 0.0.0.0 --port 8000
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div data-play-mode style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: 'var(--bg-page)',
    }}>
      {/* 连接状态横幅 */}
      <ConnectionBanner />

      {/* 三栏主体 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, gap: '1px', background: 'var(--border)' }}>
        {/* 左栏 */}
        <LeftPanel />

        {/* 中栏 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-page)' }}>
          <SceneStage />
          <NarrativeBox messages={messages} isLoading={isLoading} />
          <CommandBar />
        </div>

        {/* 右栏 */}
        <RightPanel />
      </div>
    </div>
  )
}