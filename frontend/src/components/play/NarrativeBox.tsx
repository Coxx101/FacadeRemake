/**
 * NarrativeBox — 对话流主体（白底风格）
 * 风格参考互动小说（Ink / Twine）：白底黑字，行间距宽松，打字机渐入
 */
import { useEffect, useRef, useState, memo, useCallback } from 'react'
import type { ChatMessage, MessageRole } from '../../store/usePlayStore'

// ── 角色颜色配置 ──────────────────────────────────────────────────────────────
const ROLE_COLOR: Record<MessageRole, string> = {
  narrator: '#6b5c3e',   // 棕褐，旁白
  trip:     '#c0392b',   // 深红，Trip
  grace:    '#2563a8',   // 深蓝，Grace
  player:   '#1a6b40',   // 深绿，玩家
  system:   '#7b3fa0',   // 紫色，系统
}

const ROLE_LABEL: Record<MessageRole, string> = {
  narrator: '',
  trip:     'Trip',
  grace:    'Grace',
  player:   '你',
  system:   'SYSTEM',
}

// ── 打字机效果 ────────────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 22, enabled = true) {
  const [displayed, setDisplayed] = useState(enabled ? '' : text)
  const [done, setDone] = useState(!enabled)

  useEffect(() => {
    if (!enabled) { setDisplayed(text); setDone(true); return }
    setDisplayed('')
    setDone(false)
    if (!text) { setDone(true); return }

    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(interval)
        setDone(true)
      }
    }, speed)
    return () => clearInterval(interval)
  }, [text, speed, enabled])

  return { displayed, done }
}

// ── 单条消息 ──────────────────────────────────────────────────────────────────
interface MessageItemProps {
  msg: ChatMessage
  isLast: boolean
}

const MessageItem = memo(({ msg, isLast }: MessageItemProps) => {
  const isNarrator = msg.role === 'narrator'
  const isSystem = msg.role === 'system'
  const isPlayer = msg.role === 'player'
  const color = ROLE_COLOR[msg.role]
  const label = msg.speakerName ?? ROLE_LABEL[msg.role]

  // system 消息子类型分类
  const systemType = isSystem
    ? (msg.speech?.startsWith('[Storylet]') ? 'storylet'
      : msg.speech?.startsWith('[进入新阶段') ? 'landmark'
      : msg.speech?.startsWith('[Debug]') ? 'debug'
      : msg.speech?.startsWith('[LLM]') ? 'llm'
      : 'plain')
    : null

  // system 消息不需要打字机效果，直接显示
  const skipTypewriter = isSystem
  const { displayed: speechDisplayed, done: speechDone } = useTypewriter(
    msg.speech ?? '', 20, isLast && !skipTypewriter
  )
  const { displayed: actionDisplayed } = useTypewriter(
    msg.action ?? '', 18, isLast && speechDone && !skipTypewriter
  )

  return (
    <div
      style={{
        padding: (isNarrator || isSystem) ? '8px 0' : '12px 0',
        borderBottom: '1px solid var(--border-light)',
        animation: 'fadeSlideIn 0.3s ease',
      }}
    >
      {/* system 消息（独立样式） */}
      {isSystem && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          {/* 左侧色条 */}
          <span style={{
            width: '3px',
            height: '14px',
            borderRadius: '2px',
            flexShrink: 0,
            background: systemType === 'storylet' ? 'var(--storylet-tag)'
              : systemType === 'landmark' ? 'var(--landmark-tag)'
              : systemType === 'debug' ? 'var(--warn)'
              : systemType === 'llm' ? 'var(--danger)'
              : '#6b655c',
          }} />
          <span style={{
            fontSize: '12px',
            color: systemType === 'storylet' ? 'var(--storylet-tag)'
              : systemType === 'landmark' ? 'var(--landmark-tag)'
              : systemType === 'debug' ? 'var(--warn)'
              : systemType === 'llm' ? 'var(--danger)'
              : 'var(--text-muted)',
            letterSpacing: '0.02em',
            fontFamily: "'Menlo', 'Consolas', monospace",
          }}>
            {msg.speech}
          </span>
        </div>
      )}

      {/* 旁白 */}
      {!isSystem && isNarrator && (
        <p style={{
          margin: 0,
          color: 'var(--narrator-color)',
          fontStyle: 'italic',
          fontSize: '15px',
          lineHeight: '1.9',
          letterSpacing: '0.01em',
        }}>
          {speechDisplayed}
        </p>
      )}

      {/* 角色发言 */}
      {!isNarrator && !isSystem && (
        <div>
          {/* 说话人标签 */}
          {label && (
            <div style={{
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                color: color,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                {label}
              </span>
              {isPlayer && (
                <span style={{
                  fontSize: '10px',
                  color: msg.isSilence ? 'rgba(26,107,64,0.35)' : 'rgba(26,107,64,0.5)',
                  fontStyle: 'italic',
                }}>
                  {msg.isSilence ? '（沉默）' : '（你说）'}
                </span>
              )}
            </div>
          )}

          {/* 台词 */}
          {msg.speech && (
            <p style={{
              margin: '0 0 4px 0',
              color: isPlayer
                ? (msg.isSilence ? 'rgba(26,107,64,0.4)' : 'var(--text)')
                : 'var(--text)',
              fontSize: '15px',
              lineHeight: '1.8',
              paddingLeft: isPlayer ? '12px' : '12px',
              paddingRight: isPlayer ? '0' : '0',
              borderLeft: isPlayer ? 'none' : `2px solid ${color}40`,
              borderRight: isPlayer ? `2px solid ${color}40` : 'none',
              textAlign: isPlayer ? 'right' : 'left',
              fontStyle: msg.isSilence ? 'italic' : undefined,
            }}>
              {speechDisplayed}
            </p>
          )}

          {/* 动作描述 */}
          {msg.action && (isLast ? speechDone : true) && (
            <p style={{
              margin: '2px 0 0 12px',
              color: `${color}80`,
              fontSize: '13px',
              fontStyle: 'italic',
              lineHeight: '1.6',
            }}>
              *{isLast ? actionDisplayed : msg.action}*
            </p>
          )}
        </div>
      )}
    </div>
  )
})

// ── 打字指示器 ────────────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            background: 'var(--text-dim)',
            animation: `typingBounce 1.2s ${i * 0.2}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  )
}

// ── NarrativeBox 主体 ──────────────────────────────────────────────────────────
interface NarrativeBoxProps {
  messages: ChatMessage[]
  isLoading: boolean
}

export default function NarrativeBox({ messages, isLoading }: NarrativeBoxProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // 滚到底部（直接操作 scrollTop，避免 scrollIntoView 的布局抖动）
  const scrollToBottom = useCallback(() => {
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  // 消息数量或加载状态变化时滚底
  useEffect(() => {
    // 用 requestAnimationFrame 确保在 DOM 更新后执行
    const raf = requestAnimationFrame(scrollToBottom)
    return () => cancelAnimationFrame(raf)
  }, [messages.length, isLoading, scrollToBottom])

  return (
    <div ref={containerRef} style={{
      flex: 1.8,
      overflowY: 'auto',
      padding: '20px 32px 16px',
      background: 'var(--bg-panel)',
      scrollbarWidth: 'thin',
      scrollbarColor: 'var(--border) var(--bg-surface)',
    }}>
      {messages.map((msg, i) => (
        <MessageItem
          key={msg.id}
          msg={msg}
          isLast={i === messages.length - 1}
        />
      ))}

      {isLoading && <TypingIndicator />}

      <div ref={bottomRef} style={{ height: '60px' }} />
    </div>
  )
}