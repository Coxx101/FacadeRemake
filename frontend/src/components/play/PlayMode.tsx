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
  const currentLandmark = usePlayStore((s) => s.currentLandmark)

  const statusText = connected ? 'CONNECTED' : connecting ? 'WAITING...' : 'DISCONNECTED'
  const dotColor = connected ? '#00AA00' : connecting ? '#b8860b' : '#FF0000'

  return (
    <div className="conn-banner">
      <span className="conn-title">FACADE REMAKE</span>
      {currentStorylet?.title && (
        <div className="storylet-chip">Storylet: {currentStorylet.title}</div>
      )}
      {currentLandmark && (
        <div className="storylet-chip" style={{ color:'#000080', background:'#d0e8ff' }}>
          {currentLandmark.title} · {currentLandmark.phase_tag}
        </div>
      )}
      <div className="conn-status">
        <div className="conn-dot" style={{ background: dotColor }} />
        {statusText}
      </div>
    </div>
  )
}

// ── PlayMode 主体 ────────────────────────────────────────────────────────────
export default function PlayMode() {
  const messages = usePlayStore((s) => s.messages)
  const isLoading = usePlayStore((s) => s.isLoading)
  const connected = usePlayStore((s) => s.connected)
  const currentStorylet = usePlayStore((s) => s.currentStorylet)
  const connecting = usePlayStore((s) => s.connecting)
  const backendReady = usePlayStore((s) => s.backendReady)
  const sentInitScene = usePlayStore((s) => s.sentInitScene)
  const setSentInitScene = usePlayStore((s) => s.setSentInitScene)
  const [connectionFailed, setConnectionFailed] = useState(false)
  
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
      // 位置系统重置
      locations: [],
      playerLocation: '',
      entityLocations: {},
      characters: [],
      props: [],
    })
    setSentInitScene(false)
    setConnectionFailed(false)
    
    // 强制创建新会话，确保每次进入 Play 模式都是全新的游戏
    const state = usePlayStore.getState()
    console.log('[PlayMode] Current state - connected:', state.connected, 'connecting:', state.connecting, 'backendReady:', state.backendReady)
    // 重要：重置 backendReady，确保等待新的 ready 信号
    usePlayStore.setState({ backendReady: false })
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

  // 后端 ready 后发送场景数据（等待后端准备好再发送）
  useEffect(() => {
    console.log('[PlayMode] Effect: backendReady:', backendReady, 'connected:', connected, 'sentInitScene:', sentInitScene)
    if (backendReady && connected && !sentInitScene) {
      setSentInitScene(true)
      setConnectionFailed(false)
      console.log('[PlayMode] Sending init_scene (backend ready)...')
      sendInitScene()
    }
  }, [backendReady]) // 主要依赖 backendReady 的变化

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
    <div
      className="app-wrapper bevel-out"
      data-play-mode
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        margin: '6px',
        background: '#C0C0C0',
      }}>

      {/* ── OUTER WINDOW TITLE BAR ── */}
      <div className="title-bar">
        <div className="win-icon">F</div>
        <span>FacadeRemake — Play Mode</span>
        <span style={{ fontFamily:'"Courier New",monospace', fontSize:'10px', opacity:0.7, fontWeight:400, marginLeft:'4px' }}>
          v2.0 [Retro Edition]
        </span>
        <span className="new-badge pulse-badge" style={{
          background:'#FF0000', color:'#FFFF00', fontSize:'9px',
          padding:'1px 5px', letterSpacing:'0.08em',
          fontFamily:'"Arial Black",sans-serif',
          animation:'pulse-glow 1.5s ease-in-out infinite',
        }}>NEW!</span>
        <div className="title-bar-btns">
          <div className="title-bar-btn" title="minimize">_</div>
          <div className="title-bar-btn" title="maximize">□</div>
          <div className="title-bar-btn" title="close" style={{ background:'#c02020', color:'#fff', fontWeight:900 }}>✕</div>
        </div>
      </div>

      {/* Marquee 滚动公告栏 — 90s */}
      <div className="marquee-bar" role="marquee" aria-live="polite">
        <div className="marquee-inner">
          <span style={{color:'#FFFF00'}}>★ WELCOME TO FACADE REMAKE ★</span>
          <span style={{color:'#00FF00'}}>◆ 角色：TRIP &amp; GRACE ◆</span>
          <span style={{color:'#FF8000'}}>▲ INTERACTIVE NARRATIVE ▲</span>
          <span style={{color:'#80FFFF'}}>◎ WebSocket ENABLED ◎</span>
          <span style={{color:'#FFFF00'}}>★ WELCOME TO FACADE REMAKE ★</span>
        </div>
      </div>

      {/* 连接状态横幅 */}
      <ConnectionBanner />

      <div className="hr-groove" />

      {/* 三栏主体 */}
      <div className="main-body" style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, gap: '2px', background: '#808080' }}>
        <LeftPanel />
        <div className="col-mid" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#C0C0C0' }}>
          <SceneStage />
          <NarrativeBox messages={messages} isLoading={isLoading} />
          <CommandBar />
        </div>
        <RightPanel />
      </div>

      {/* Construction 条纹 */}
      <div className="construction-bar" role="presentation" />

      {/* ── STATUS BAR ── */}
      <div className="status-bar">
        <div className="status-cell">
          <span style={{ color: connected ? '#00AA00' : '#808080' }}>●</span>
          {connected ? 'CONNECTED' : 'DISCONNECTED'}
        </div>
        <div className="status-cell">
          TURN: <strong>{usePlayStore.getState().turn}</strong>
        </div>
        <div className="status-cell">
          {currentStorylet?.title ? (
            <><span style={{color:'#800080'}}>{currentStorylet.title}</span></>
          ) : 'NO STORYLET'}
        </div>
        <div className="status-cell" style={{ marginLeft: 'auto' }}>
          <span style={{ fontFamily:"'Special Elite','Courier New',monospace" }} id="status-time">{}</span>
        </div>
      </div>
    </div>
  )
}