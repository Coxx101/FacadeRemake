/**
 * InputBar — 底部输入栏
 * Enter 发送，Shift+Enter 换行，支持发送 / 回退 / 重置
 */
import { useRef, useCallback, useState, useEffect } from 'react'
import { Send, RotateCcw, Undo2 } from 'lucide-react'
import { usePlayStore } from '../../store/usePlayStore'

export default function InputBar() {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isLoading = usePlayStore((s) => s.isLoading)
  const sendMessage = usePlayStore((s) => s.sendMessage)
  const rollback = usePlayStore((s) => s.rollback)
  const resetGame = usePlayStore((s) => s.resetGame)
  const snapshotCount = usePlayStore((s) => s._snapshotStack.length)

  const canSend = !isLoading
  const canRollback = snapshotCount > 0 && !isLoading

  // 响应结束后自动聚焦输入框
  const prevLoading = useRef(isLoading)
  useEffect(() => {
    if (prevLoading.current && !isLoading) {
      textareaRef.current?.focus()
    }
    prevLoading.current = isLoading
  }, [isLoading])

  const handleSend = useCallback(() => {
    if (isLoading) return
    const t = text.trim()
    sendMessage(t || '')  // 空输入 = 保持沉默
    setText('')
    textareaRef.current?.focus()
  }, [text, isLoading, sendMessage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleReset = useCallback(() => {
    if (!confirm('重置游戏？对话历史和世界状态将回到初始。')) return
    resetGame(undefined as any, '')
    setText('')
    textareaRef.current?.focus()
  }, [resetGame])

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '8px 14px', borderRadius: '6px',
    border: 'none', cursor: 'pointer',
    fontSize: '13px', fontWeight: 500,
    transition: 'opacity 0.15s, background 0.15s',
    flexShrink: 0,
  }

  return (
    <div style={{
      borderTop: '1px solid #1e2235',
      background: '#0d0f1a',
      padding: '12px 20px 16px',
    }}>
      {/* 提示文字行 */}
      <div style={{
        fontSize: '11px', color: '#3a4060', marginBottom: '8px',
        letterSpacing: '0.02em',
      }}>
        Enter 发送 · Shift+Enter 换行
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
        {/* 输入框 */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="你想说什么……"
          rows={2}
          disabled={isLoading}
          style={{
            flex: 1,
            background: '#131625',
            border: '1px solid #2e3250',
            borderRadius: '8px',
            color: '#e8eaf2',
            fontSize: '14px',
            lineHeight: '1.6',
            padding: '10px 14px',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            transition: 'border-color 0.15s',
            opacity: isLoading ? 0.6 : 1,
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#4f6ef7' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#2e3250' }}
        />

        {/* 按钮组 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* 发送 */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            style={{
              ...btnBase,
              background: canSend ? '#4f6ef7' : '#1e2235',
              color: canSend ? '#fff' : '#3a4060',
              cursor: canSend ? 'pointer' : 'not-allowed',
            }}
            onMouseEnter={(e) => { if (canSend) { e.currentTarget.style.background = '#6b8aff' } }}
            onMouseLeave={(e) => { if (canSend) { e.currentTarget.style.background = '#4f6ef7' } }}
          >
            <Send size={14} />
            发送
          </button>

          <div style={{ display: 'flex', gap: '6px' }}>
            {/* 回退 */}
            <button
              onClick={rollback}
              disabled={!canRollback}
              title={`回退到上一步（${snapshotCount} 步可回退）`}
              style={{
                ...btnBase,
                flex: 1,
                justifyContent: 'center',
                background: canRollback ? '#2a1f3d' : '#131625',
                color: canRollback ? '#a78bfa' : '#3a4060',
                cursor: canRollback ? 'pointer' : 'not-allowed',
                fontSize: '12px',
                padding: '7px 10px',
              }}
              onMouseEnter={(e) => { if (canRollback) { e.currentTarget.style.background = '#3d2d5e'; e.currentTarget.style.color = '#c4b5fd' } }}
              onMouseLeave={(e) => { if (canRollback) { e.currentTarget.style.background = '#2a1f3d'; e.currentTarget.style.color = '#a78bfa' } }}
            >
              <Undo2 size={13} />
              回退{snapshotCount > 0 ? ` (${snapshotCount})` : ''}
            </button>

            {/* 重置 */}
            <button
              onClick={handleReset}
              title="重置游戏"
              style={{
                ...btnBase,
                flex: 1,
                justifyContent: 'center',
                background: '#1a1020',
                color: '#6a4060',
                fontSize: '12px',
                padding: '7px 10px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#3a1525'; e.currentTarget.style.color = '#f87171' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#1a1020'; e.currentTarget.style.color = '#6a4060' }}
            >
              <RotateCcw size={13} />
              重置
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
