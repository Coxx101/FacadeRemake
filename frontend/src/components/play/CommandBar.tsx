/**
 * CommandBar — 底部输入栏（白底风格）
 * Enter 发送，支持发送 / 回退 / 重置
 */
import { useRef, useCallback, useState, useEffect } from 'react'
import { Send, Undo2, RotateCcw } from 'lucide-react'
import { usePlayStore } from '../../store/usePlayStore'

export default function CommandBar() {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const isLoading = usePlayStore((s) => s.isLoading)
  const gameEnded = usePlayStore((s) => s.gameEnded)
  const sendMessage = usePlayStore((s) => s.sendMessage)
  const rollback = usePlayStore((s) => s.rollback)
  const resetGame = usePlayStore((s) => s.resetGame)
  const snapshotCount = usePlayStore((s) => s._snapshotStack.length)

  const canSend = !isLoading && !gameEnded
  const canRollback = snapshotCount > 0 && !isLoading

  // 响应结束后自动聚焦
  const prevLoading = useRef(isLoading)
  useEffect(() => {
    if (prevLoading.current && !isLoading) inputRef.current?.focus()
    prevLoading.current = isLoading
  }, [isLoading])

  const handleSend = useCallback(() => {
    if (!canSend) return
    sendMessage(text.trim())
    setText('')
    inputRef.current?.focus()
  }, [text, canSend, sendMessage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSend() }
  }, [handleSend])

  const handleReset = useCallback(() => {
    if (!confirm('重置游戏？对话历史和世界状态将回到初始。')) return
    resetGame(undefined as any, '')
    setText('')
    inputRef.current?.focus()
  }, [resetGame])

  const btnStyle = (enabled: boolean, bg: string, color: string, hasBorderLeft = false): React.CSSProperties => {
    return {
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
      padding: '0 14px', border: 'none',
      borderLeft: hasBorderLeft ? '2px solid #808080' : 'none',
      background: enabled ? bg : '#C0C0C0',
      borderRight: '2px solid #808080',
      borderTop: '2px solid #ffffff',
      borderBottom: '2px solid #808080',
      color: enabled ? color : '#808080',
      cursor: enabled ? 'pointer' : 'not-allowed',
      fontSize: '11px', fontWeight: 600,
      fontFamily: '"MS Sans Serif", sans-serif',
      height: '100%', minWidth: '40px',
    }
  }

  return (
    <div style={{
      height: '42px',
      display: 'flex',
      borderTop: '2px solid #ffffff',
      background: '#C0C0C0',
      flexShrink: 0,
    }}>
      {/* INPUT 标签 — 90s terminal style */}
      <div style={{
        background: '#000000', color: '#00FF00',
        padding: '0 12px',
        fontFamily: "'Special Elite','Courier New',monospace",
        fontSize: '12px', fontWeight: 700,
        display: 'flex', alignItems: 'center',
        letterSpacing: '0.1em', flexShrink: 0,
        borderRight: '2px solid #808080',
        opacity: canSend ? 1 : 0.5,
      }}>
        INPUT&gt;
      </div>

      {/* 输入框 — 90s bevel-in */}
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          gameEnded ? '游戏已结束' :
          isLoading ? '等待回应中…' :
          '你想说什么……（直接回车 = 保持沉默）'
        }
        disabled={!canSend}
        style={{
          flex: 1,
          background: '#ffffff',
          border: '2px solid',
          borderColor: '#808080 #ffffff #ffffff #808080',
          boxShadow: 'inset 1px 1px 0 #404040, inset -1px -1px 0 #dfdfdf',
          color: '#000', fontSize: '13px',
          padding: '0 10px', outline: 'none',
          fontFamily: '"MS Sans Serif", sans-serif',
          opacity: canSend ? 1 : 0.5,
          margin: '4px 4px',
        }}
      />

      {/* 加载指示器 */}
      {isLoading && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '3px',
          padding: '0 10px', flexShrink: 0,
        }}>
          {[0,1,2].map((i) => (
            <span key={i} style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: 'var(--text-dim)',
              animation: `typingBounce 1.2s ${i * 0.2}s ease-in-out infinite`,
              display: 'inline-block',
            }} />
          ))}
        </div>
      )}

      {/* 按钮区 */}
      <div style={{ display: 'flex', borderLeft: '1px solid var(--border)', flexShrink: 0 }}>
        {/* 发送 */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          title="发送（Enter）"
          style={btnStyle(canSend, 'var(--accent)', '#fff')}
          onMouseEnter={(e) => { if (canSend) e.currentTarget.style.background = 'var(--accent-hover)' }}
          onMouseLeave={(e) => { if (canSend) e.currentTarget.style.background = 'var(--accent)' }}
        >
          <Send size={14} />
        </button>

        {/* 回退 */}
        <button
          onClick={rollback}
          disabled={!canRollback}
          title={`回退（${snapshotCount} 步）`}
          style={btnStyle(canRollback, 'transparent', canRollback ? 'var(--storylet-tag)' : 'var(--text-dim)', true)}
          onMouseEnter={(e) => { if (canRollback) e.currentTarget.style.background = '#f0eaf8' }}
          onMouseLeave={(e) => { if (canRollback) e.currentTarget.style.background = 'transparent' }}
        >
          <Undo2 size={14} />
          {snapshotCount > 0 && <span style={{ fontSize: '11px' }}>{snapshotCount}</span>}
        </button>

        {/* 重置 */}
        <button
          onClick={handleReset}
          title="重置游戏"
          style={btnStyle(true, 'transparent', 'var(--text-dim)', true)}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = 'var(--danger)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)' }}
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  )
}