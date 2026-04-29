/**
 * PlayMode — Play 模式主布局（白底风格三栏布局）
 * 左：LeftPanel（时钟+场景+世界状态）
 * 中：SceneStage + NarrativeBox + CommandBar
 * 右：RightPanel（GAME LOG + Debug）
 */
import { useEffect, useRef } from 'react'
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
  const sentRef = useRef(false)

  // 首次进入 Play 模式时，清空旧状态并确保连接
  useEffect(() => {
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
    })
    sentRef.current = false
    // 如果尚未连接/未在连接中，启动连接（不暴力 disconnect）
    const state = usePlayStore.getState()
    if (!state.connected && !state.connecting) {
      state.connect()
    }
    return () => {
      // 离开 Play 模式时不断开，保持连接
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 连接就绪后发送场景数据（如果尚未发送）
  useEffect(() => {
    if (connected && !sentRef.current) {
      sentRef.current = true
      sendInitScene()
    }
  }, [connected])

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