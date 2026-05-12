/**
 * NarrativeBox — 90s Retro 对话流
 * mockup 风格为基础：交替行背景 + 角色徽章 + 旁白黄底 + 系统蓝条
 */
import { useEffect, useRef, useState, memo, useCallback } from 'react'
import type { ChatMessage, MessageRole } from '../../store/usePlayStore'

// ── 角色颜色 ──
const ROLE_COLOR: Record<MessageRole, string> = {
  narrator: '#4a3000',
  trip:     '#c0392b',
  grace:    '#000080',
  player:   '#006600',
  system:   '#800080',
}
const ROLE_LABEL: Record<MessageRole, string> = {
  narrator: 'NARR',
  trip:     'TRIP',
  grace:    'GRACE',
  player:   'YOU',
  system:   'SYS',
}
// system 子类型颜色
const SYSTYPE_COLORS: Record<string, string> = {
  storylet: '#800080', landmark: '#000080',
  debug: '#FF0000', llm: '#b8860b', plain: '#808080',
}
const SYSTYPE_BGS: Record<string, string> = {
  storylet: '#f0e0ff', landmark: '#d0e8ff',
  debug: '#ffe0e0', llm: '#FFFFCC', plain: '#e8e8e8',
}

// ── 打字机效果 ──
function useTypewriter(text: string, speed = 22, enabled = true) {
  const [displayed, setDisplayed] = useState(enabled ? '' : text)
  const [done, setDone] = useState(!enabled)
  useEffect(() => {
    if (!enabled) { setDisplayed(text); setDone(true); return }
    setDisplayed(''); setDone(false)
    if (!text) { setDone(true); return }
    let i = 0
    const t = setInterval(() => { i++; setDisplayed(text.slice(0, i)); if (i >= text.length) { clearInterval(t); setDone(true) } }, speed)
    return () => clearInterval(t)
  }, [text, speed, enabled])
  return { displayed, done }
}

// ── 单条消息 ──
const MessageItem = memo(({ msg, isLast, index }: { msg: ChatMessage; isLast: boolean; index: number }) => {
  const role = msg.role
  const isNarrator = role === 'narrator'
  const isSystem = role === 'system'
  const color = ROLE_COLOR[role]
  const label = msg.speakerName ?? ROLE_LABEL[role]
  const even = index % 2 === 0

  const systemType = isSystem
    ? (msg.speech?.startsWith('[Storylet]') ? 'storylet' : msg.speech?.startsWith('[进入新阶段') ? 'landmark'
      : msg.speech?.startsWith('[Debug]') ? 'debug' : msg.speech?.startsWith('[LLM]') ? 'llm' : 'plain')
    : null

  const skip = isSystem
  const { displayed: speechDisp, done: speechDone } = useTypewriter(msg.speech ?? '', 20, isLast && !skip)
  const { displayed: actionDisp } = useTypewriter(msg.action ?? '', 18, isLast && speechDone && !skip)

  return (
    <div className="msg-row" style={{
      background: isNarrator ? '#FFFFCC' : isSystem ? '#f0f0ff' : even ? '#ffffff' : '#F8F8F8',
      borderLeft: isSystem ? '3px solid #000080' : 'none',
    }}>
      {/* ── SYS ── */}
      {isSystem && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <span className="msg-role-badge" style={{ color: '#800080' }}>SYS</span>
          <span className="bevel-out" style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '1px 6px', fontSize: '10px', fontFamily: '"Courier New",monospace',
            background: SYSTYPE_BGS[systemType!] || '#e8e8e8',
            color: SYSTYPE_COLORS[systemType!] || '#808080',
            fontWeight: 700, letterSpacing: '0.06em',
          }}>
            <span style={{
              width: '6px', height: '6px',
              background: SYSTYPE_COLORS[systemType!] || '#808080',
              flexShrink: 0,
            }} />
            {systemType?.toUpperCase()}
          </span>
          <span style={{ fontSize: '11px', color: '#444', fontFamily: '"Courier New",monospace' }}>
            {msg.speech?.replace(/^\[.*?\]\s*/, '')}
          </span>
        </div>
      )}

      {/* ── NARRATOR ── */}
      {!isSystem && isNarrator && (
        <>
          <span className="msg-role-badge" style={{ color }}>NARR</span>
          <em className="msg-text" style={{ color: '#4a3000', fontSize: '13px' }}>
            {speechDisp}
          </em>
        </>
      )}

      {/* ── CHARACTER / PLAYER ── */}
      {!isNarrator && !isSystem && (
        <>
          <span className="msg-role-badge" style={{ color }}>{label}</span>
          <div style={{ flex: 1 }}>
            {msg.speech && (
              <div className="bevel-out" style={{
                padding: '6px 8px',
                background: role === 'player' ? '#f0fff0' : '#ffffff',
                marginBottom: msg.action ? '4px' : 0,
              }}>
                <p style={{
                  margin: 0, color: '#000',
                  fontSize: '13px', lineHeight: 1.55,
                  fontFamily: '"MS Sans Serif", sans-serif',
                  fontStyle: msg.isSilence ? 'italic' : undefined,
                }}>
                  {speechDisp}
                </p>
              </div>
            )}
            {msg.action && (isLast ? speechDone : true) && (
              <p style={{ margin: '2px 0 0 6px', color, fontSize: '11px', fontStyle: 'italic', lineHeight: 1.4 }}>
                *{isLast ? actionDisp : msg.action}*
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
})
MessageItem.displayName = 'MessageItem'

// ── 打字指示器 ──
function TypingIndicator() {
  return (
    <div style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
      <span style={{ fontFamily: '"Courier New",monospace', fontSize: '10px', color: '#808080', letterSpacing: '0.08em' }}>WAITING</span>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          display: 'inline-block', width: '5px', height: '5px',
          background: '#808080',
          animation: `typingBounce 1.2s ${i * 0.2}s ease-in-out infinite`,
        }} />
      ))}
    </div>
  )
}

// ── 主体 ──
export default function NarrativeBox({ messages, isLoading }: {
  messages: ChatMessage[]; isLoading: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    const raf = requestAnimationFrame(scrollToBottom)
    return () => cancelAnimationFrame(raf)
  }, [messages.length, isLoading, scrollToBottom])

  return (
    <div ref={containerRef} style={{
      flex: 1.8, overflowY: 'auto', minHeight: 0,
      background: '#ffffff',
      border: '2px solid',
      borderColor: '#808080 #ffffff #ffffff #808080',
    }}>
      {/* sticky panel-header */}
      <div className="panel-header" style={{ position: 'sticky', top: 0, zIndex: 5 }}>
        📜 NARRATIVE / DIALOGUE STREAM
        <span style={{ marginLeft: 'auto', fontSize: '9px', fontFamily: '"Courier New",monospace', fontWeight: 400, opacity: 0.8 }}>↓ 最新</span>
      </div>
      <div style={{ padding: '4px 0' }}>
        {messages.map((msg, i) => (
          <MessageItem key={msg.id} msg={msg} isLast={i === messages.length - 1} index={i} />
        ))}
        {isLoading && <div style={{ padding: '4px 8px' }}><TypingIndicator /></div>}
        <div ref={bottomRef} style={{ height: '40px' }} />
      </div>
    </div>
  )
}
