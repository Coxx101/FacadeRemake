/**
 * ChatLog — 对话流主体
 * 风格参考互动小说（Ink / Twine）：黑底白字，行间距宽松，打字机渐入
 */
import { useEffect, useRef, useState, memo, useCallback } from 'react'
import type { ChatMessage, MessageRole } from '../../store/usePlayStore'

// ── 角色颜色配置 ──────────────────────────────────────────────────────────────
const ROLE_COLOR: Record<MessageRole, string> = {
  narrator: '#8a8fa8',   // 灰蓝，旁白
  trip:     '#e8b86a',   // 琥珀黄，Trip
  grace:    '#a8d4b0',   // 淡绿，Grace
  player:   '#7eb8f7',   // 淡蓝，玩家
  system:   '#6a6e8a',   // 暗灰，系统
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
        borderBottom: '1px solid rgba(255,255,255,0.04)',
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
            background: systemType === 'storylet' ? '#a78bfa'
              : systemType === 'landmark' ? '#60a5fa'
              : systemType === 'debug' ? '#fbbf24'
              : systemType === 'llm' ? '#f87171'
              : '#3a4060',
          }} />
          <span style={{
            fontSize: '12px',
            color: systemType === 'storylet' ? '#a78bfa90'
              : systemType === 'landmark' ? '#60a5fa90'
              : systemType === 'debug' ? '#fbbf2490'
              : systemType === 'llm' ? '#f8717190'
              : '#6a6e8a',
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
          color: color,
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
                  color: msg.isSilence ? 'rgba(126,184,247,0.35)' : 'rgba(126,184,247,0.5)',
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
                ? (msg.isSilence ? 'rgba(126,184,247,0.4)' : 'rgba(126,184,247,0.9)')
                : '#e8eaf2',
              fontSize: '15px',
              lineHeight: '1.8',
              paddingLeft: isPlayer ? '0' : '12px',
              borderLeft: isPlayer ? 'none' : `2px solid ${color}40`,
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
            background: '#4a5070',
            animation: `typingBounce 1.2s ${i * 0.2}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  )
}

// ── ChatLog 主体 ──────────────────────────────────────────────────────────────
interface ChatLogProps {
  messages: ChatMessage[]
  isLoading: boolean
}

export default function ChatLog({ messages, isLoading }: ChatLogProps) {
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
      flex: 1,
      overflowY: 'auto',
      padding: '32px 40px 16px',
      scrollbarWidth: 'thin',
      scrollbarColor: '#2e3250 transparent',
    }}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>

      {messages.map((msg, i) => (
        <MessageItem
          key={msg.id}
          msg={msg}
          isLast={i === messages.length - 1}
        />
      ))}

      {isLoading && <TypingIndicator />}

      <div ref={bottomRef} style={{ height: '80px' }} />
    </div>
  )
}
