/**
 * PlayMode — Play 模式主布局
 * 左：ChatLog | 右：DebugPanel（可折叠）
 * 下：InputBar
 */
import { useEffect, useRef } from 'react'
import ChatLog from './ChatLog'
import DebugPanel from './DebugPanel'
import InputBar from './InputBar'
import { usePlayStore, sendInitScene } from '../../store/usePlayStore'

export default function PlayMode() {
  const messages = usePlayStore((s) => s.messages)
  const isLoading = usePlayStore((s) => s.isLoading)
  const debugOpen = usePlayStore((s) => s.debugOpen)
  const connect = usePlayStore((s) => s.connect)
  const connected = usePlayStore((s) => s.connected)
  const sentRef = useRef(false)

  // 首次进入 Play 模式时，清空旧状态、断开旧连接、重建 WebSocket 连接
  useEffect(() => {
    // 清空旧的 PlayStore 状态
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
      connected: false,
    })
    sentRef.current = false
    // 断开旧连接确保状态干净
    usePlayStore.getState().disconnect()
    // 建立新连接
    connect()
    return () => {
      // 离开 Play 模式时不断开，保持连接
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 连接就绪后发送场景数据（确保 useStore 数据已加载完毕）
  useEffect(() => {
    if (connected && !sentRef.current) {
      sentRef.current = true
      // 延迟一帧确保 useStore 已被 StartScreen 的 loadFromJSON 更新
      requestAnimationFrame(() => {
        sendInitScene()
      })
    }
  }, [connected])

  return (
    <div data-play-mode style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: '#0a0c14',
      position: 'relative',
    }}>
      {/* 主内容区 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* 左：对话流 */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}>
          {/* 标题装饰栏 */}
          <div style={{
            padding: '14px 40px 0',
            borderBottom: '1px solid #1a1d2e',
            display: 'flex',
            alignItems: 'baseline',
            gap: '12px',
            paddingBottom: '12px',
          }}>
            <span style={{
              fontSize: '13px',
              fontWeight: 700,
              color: '#3a4060',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}>
              FacadeRemake
            </span>
            <span style={{ fontSize: '11px', color: '#2a3050', letterSpacing: '0.05em' }}>
              互动叙事原型
            </span>
            {/* 连接状态 */}
            <span style={{
              fontSize: '10px',
              color: connected ? '#4ade80' : '#f87171',
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: connected ? '#4ade80' : '#f87171',
                display: 'inline-block',
                boxShadow: connected ? '0 0 6px #4ade8060' : 'none',
              }} />
              {connected ? '已连接' : '连接中…'}
            </span>
          </div>

          <ChatLog messages={messages} isLoading={isLoading} />
        </div>

        {/* 右：Debug 面板 */}
        {debugOpen && <DebugPanel />}
      </div>

      {/* 底部：输入栏 */}
      <InputBar />

      {/* Debug 面板收起时的浮动按钮（absolute 定位，保持 pointerEvents 正常） */}
      {!debugOpen && <DebugPanel />}
    </div>
  )
}
