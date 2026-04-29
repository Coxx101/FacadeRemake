/**
 * RightPanel — 右栏组件（白底风格）
 * 包含：GAME LOG（系统事件日志） + DEBUG PANEL（可折叠）
 */
import { useState } from 'react'
import { Bug, ChevronDown, ChevronRight, X, Trash2, Send, ArrowDownCircle } from 'lucide-react'
import { usePlayStore } from '../../store/usePlayStore'
import type { LlmDebugEntry, ChatMessage } from '../../store/usePlayStore'
import { useStore } from '../../store/useStore'

// ── 颜色常量 ────────────────────────────────────────────────────────────────────
const C = {
  bg: 'var(--bg-panel)',
  surface: 'var(--bg-surface)',
  border: 'var(--border)',
  muted: 'var(--text-dim)',
  text: 'var(--text)',
  textDim: 'var(--text-muted)',
  accent: 'var(--accent)',
  trip: 'var(--trip-color)',
  grace: 'var(--grace-color)',
  quality: 'var(--landmark-tag)',
  flag: 'var(--storylet-tag)',
  relationship: '#b04a7a',
  good: 'var(--good)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
}

// ── 折叠区块 ──────────────────────────────────────────────────────────────────
function Section({
  title, color = C.accent, children, defaultOpen = true,
}: {
  title: string; color?: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer',
          color: C.textDim, fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = C.text }}
        onMouseLeave={(e) => { e.currentTarget.style.color = C.textDim }}
      >
        {open
          ? <ChevronDown size={12} style={{ color }} />
          : <ChevronRight size={12} style={{ color }} />
        }
        <span style={{ color }}>{title}</span>
      </button>
      {open && <div style={{ padding: '0 14px 12px' }}>{children}</div>}
    </div>
  )
}

// ── Chip 小标签 ───────────────────────────────────────────────────────────────
function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '10px',
      background: `${color}20`, color, fontSize: '11px', fontWeight: 500,
    }}>
      {label}
    </span>
  )
}

// ── 数值条 ────────────────────────────────────────────────────────────────────
function NumberBar({
  label, value, min = 0, max = 10, color, onChange,
}: {
  label: string; value: number; min?: number; max?: number; color: string;
  onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  const barColor = pct > 70 ? C.danger : pct > 40 ? C.warn : C.good

  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px', color: C.text }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)))
            }}
            style={{
              width: '38px', textAlign: 'center',
              background: C.surface, border: `1px solid ${C.border}`,
              color: color, borderRadius: '4px',
              fontSize: '12px', padding: '1px 4px',
            }}
          />
          <span style={{ fontSize: '10px', color: C.muted }}>/{max}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: barColor, cursor: 'pointer' }}
      />
      <div style={{ height: '3px', background: C.surface, borderRadius: '2px', marginTop: '2px' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '2px', transition: 'width 0.2s' }} />
      </div>
    </div>
  )
}

// ── Flag 开关 ─────────────────────────────────────────────────────────────────
function FlagToggle({
  label, value, onChange,
}: {
  label: string; value: boolean | string | number; onChange: (v: boolean) => void
}) {
  const boolVal = value === true || value === 'true'
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
      <span style={{ fontSize: '12px', color: boolVal ? C.text : C.muted }}>{label}</span>
      <button
        onClick={() => onChange(!boolVal)}
        style={{
          width: '34px', height: '18px', borderRadius: '9px',
          border: 'none', cursor: 'pointer',
          background: boolVal ? C.flag : C.surface,
          position: 'relative', transition: 'background 0.2s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.1)' }}
        onMouseLeave={(e) => { e.currentTarget.style.filter = 'none' }}
      >
        <span style={{
          position: 'absolute', top: '2px',
          left: boolVal ? '16px' : '2px',
          width: '14px', height: '14px',
          borderRadius: '50%', background: 'white',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  )
}

// ── 内心独白卡片 ──────────────────────────────────────────────────────────────
function ThoughtCard({ name, thought, color }: { name: string; thought: string; color: string }) {
  return (
    <div style={{
      background: `${color}0a`, border: `1px solid ${color}25`,
      borderRadius: '6px', padding: '8px 10px', marginBottom: '6px',
    }}>
      <div style={{ fontSize: '10px', color: `${color}80`, fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {name} — 内心
      </div>
      <p style={{ margin: 0, fontSize: '12px', color: C.textDim, fontStyle: 'italic', lineHeight: '1.7' }}>
        {thought}
      </p>
    </div>
  )
}

// ── LLM 日志单条 ──────────────────────────────────────────────────────────
function LlmLogItem({ entry, color }: { entry: LlmDebugEntry; color: string }) {
  const [open, setOpen] = useState(false)
  const isReq = entry.event === 'llm_request'
  const label = isReq ? 'REQUEST' : 'RESPONSE'
  const icon = isReq ? <Send size={10} /> : <ArrowDownCircle size={10} />

  return (
    <div style={{
      marginBottom: '4px',
      border: `1px solid ${isReq ? C.border : `${color}40`}`,
      borderRadius: '4px',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '6px',
          padding: '5px 8px', background: isReq ? C.surface : `${color}08`,
          border: 'none', cursor: 'pointer', color: isReq ? C.textDim : color,
          fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {icon}
        <span>{label}</span>
        {entry.model && <span style={{ color: C.muted, fontWeight: 400, textTransform: 'none' }}>{entry.model}</span>}
        {entry.temperature != null && <span style={{ color: C.muted, fontWeight: 400, textTransform: 'none' }}>t={entry.temperature}</span>}
        {open ? <ChevronDown size={10} style={{ marginLeft: 'auto' }} /> : <ChevronRight size={10} style={{ marginLeft: 'auto' }} />}
      </button>
      {open && (
        <div style={{ padding: '6px 8px', background: C.surface, maxHeight: '200px', overflowY: 'auto', scrollbarWidth: 'thin' }}>
          {isReq && entry.messages && entry.messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: '6px' }}>
              <div style={{ fontSize: '9px', color: C.muted, fontWeight: 600, marginBottom: '2px', textTransform: 'uppercase' }}>
                {msg.role}
              </div>
              <pre style={{
                margin: 0, padding: '4px 6px', borderRadius: '3px',
                background: C.bg, color: C.text,
                fontSize: '11px', lineHeight: '1.6', whiteSpace: 'pre-wrap',
                wordBreak: 'break-word', fontFamily: 'inherit',
                borderLeft: `2px solid ${msg.role === 'system' ? C.flag : msg.role === 'assistant' ? color : C.muted}`,
              }}>
                {msg.content}
              </pre>
            </div>
          ))}
          {!isReq && entry.content && (
            <pre style={{
              margin: 0, padding: '4px 6px', borderRadius: '3px',
              background: `${color}10`, color: color,
              fontSize: '11px', lineHeight: '1.6', whiteSpace: 'pre-wrap',
              wordBreak: 'break-word', fontFamily: 'inherit',
              borderLeft: `2px solid ${color}`,
            }}>
              {entry.content}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

// ── LLM 日志区块 ──────────────────────────────────────────────────────────
function LlmLogSection() {
  const debugLogs = usePlayStore((s) => s.debugLogs)
  const clearDebugLogs = usePlayStore((s) => s.clearDebugLogs)

  const requestCount = debugLogs.filter((l) => l.event === 'llm_request').length

  return (
    <Section title={`LLM 日志 (${requestCount})`} color={C.muted} defaultOpen={true}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <button
          onClick={clearDebugLogs}
          title="清空日志"
          style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            cursor: 'pointer', color: C.muted, padding: '2px',
            display: 'flex', alignItems: 'center',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = C.danger }}
          onMouseLeave={(e) => { e.currentTarget.style.color = C.muted }}
        >
          <Trash2 size={11} />
        </button>
      </div>
      <div style={{ maxHeight: '200px', overflowY: 'auto', scrollbarWidth: 'thin' }}>
        {debugLogs.length === 0 ? (
          <div style={{ fontSize: '11px', color: C.muted, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
            等待 LLM 调用...
          </div>
        ) : (
          debugLogs.map((entry) => (
            <LlmLogItem
              key={entry.id}
              entry={entry}
              color={entry.event === 'llm_request' ? C.accent : C.good}
            />
          ))
        )}
      </div>
    </Section>
  )
}

// ── GAME LOG 组件 ──────────────────────────────────────────────────────────
function GameLog() {
  const messages = usePlayStore((s) => s.messages)
  const turn = usePlayStore((s) => s.turn)

  // 过滤 system 消息
  const systemMessages: ChatMessage[] = messages.filter(m => m.role === 'system')
  
  // 获取最近的几条
  const recentMessages = systemMessages.slice(-10)

  // 获取 LLM 调用统计
  const llmCount = messages.filter(m => m.role === 'system' && m.speech?.startsWith('[LLM]')).length

  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      {/* Header */}
      <div style={{
        background: C.text, color: C.bg,
        padding: '4px 10px', fontSize: '11px', fontWeight: 700,
        letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        GAME LOG
      </div>
      
      {/* 内容 */}
      <div style={{ padding: '10px 12px', maxHeight: '200px', overflowY: 'auto', scrollbarWidth: 'thin' }}>
        {recentMessages.length === 0 ? (
          <div style={{ fontSize: '11px', color: C.muted, fontStyle: 'italic', textAlign: 'center' }}>
            等待事件...
          </div>
        ) : (
          recentMessages.map((msg, i) => {
            const systemType = msg.speech?.startsWith('[Storylet]') ? 'storylet'
              : msg.speech?.startsWith('[进入新阶段') ? 'landmark'
              : msg.speech?.startsWith('[LLM]') ? 'llm'
              : 'plain'
            
            const color = systemType === 'storylet' ? C.flag
              : systemType === 'landmark' ? C.quality
              : systemType === 'llm' ? C.good
              : C.muted

            return (
              <div key={msg.id} style={{ 
                fontSize: '11px', 
                color,
                fontFamily: "'Menlo', 'Consolas', monospace",
                padding: '2px 0',
                borderBottom: i < recentMessages.length - 1 ? `1px solid ${C.border}` : 'none',
              }}>
                {msg.speech}
              </div>
            )
          })
        )}
        
        {/* LLM 统计 */}
        {llmCount > 0 && (
          <div style={{ 
            marginTop: '8px', 
            paddingTop: '8px', 
            borderTop: `1px solid ${C.border}`,
            fontSize: '10px',
            color: C.muted,
          }}>
            LLM 调用: {llmCount} 次
          </div>
        )}
      </div>
    </div>
  )
}

// ── RightPanel 主体 ──────────────────────────────────────────────────────────
export default function RightPanel() {
  const [debugOpen, setDebugOpen] = useState(false)
  const worldState = usePlayStore((s) => s.worldState)
  const currentLandmark = usePlayStore((s) => s.currentLandmark)
  const currentStorylet = usePlayStore((s) => s.currentStorylet)
  const turn = usePlayStore((s) => s.turn)
  const messages = usePlayStore((s) => s.messages)
  const setQuality = usePlayStore((s) => s.setQuality)
  const setFlag = usePlayStore((s) => s.setFlag)
  const setRelationship = usePlayStore((s) => s.setRelationship)

  const wsd = useStore((s) => s.worldStateDefinition)

  const thoughtMsgs = [...messages].reverse().filter((m) => m.thought).slice(0, 3).reverse()

  return (
    <div style={{
      width: debugOpen ? '300px' : '40px',
      background: C.bg,
      borderLeft: `1px solid ${C.border}`,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      scrollbarWidth: 'thin',
      flexShrink: 0,
      transition: 'width 0.3s',
    }}>
      {/* 折叠/展开按钮 */}
      <button
        onClick={() => setDebugOpen(!debugOpen)}
        title="切换调试面板"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '10px', borderBottom: `1px solid ${C.border}`,
          background: C.surface, border: 'none', cursor: 'pointer',
          color: debugOpen ? C.accent : C.textDim,
          transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = C.accent }}
        onMouseLeave={(e) => { e.currentTarget.style.color = debugOpen ? C.accent : C.textDim }}
      >
        {debugOpen ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        {debugOpen && (
          <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', marginLeft: '4px' }}>
            DEBUG
          </span>
        )}
      </button>

      {/* 展开内容 */}
      {debugOpen && (
        <>
          {/* GAME LOG */}
          <GameLog />

          {/* 叙事状态 */}
          <Section title="叙事状态" color={C.accent}>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: C.muted, marginBottom: '3px' }}>Turn {turn}</div>
              {currentLandmark?.title && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <Chip label={currentLandmark.title} color={currentLandmark.is_ending ? C.danger : C.accent} />
                  {currentLandmark.phase_tag && <Chip label={currentLandmark.phase_tag} color={C.muted} />}
                </div>
              )}
            </div>
            {currentStorylet?.title && (
              <div>
                <div style={{ fontSize: '11px', color: C.muted, marginBottom: '3px' }}>当前 Storylet</div>
                <Chip label={currentStorylet.title} color={C.warn} />
              </div>
            )}
          </Section>

          {/* Qualities */}
          {wsd?.qualities?.length > 0 && (
            <Section title="品质" color={C.quality}>
              {wsd.qualities.map((q) => (
                <NumberBar
                  key={q.key}
                  label={q.label}
                  value={worldState.qualities[q.key] ?? q.initial}
                  min={q.min ?? 0}
                  max={q.max ?? 10}
                  color={C.quality}
                  onChange={(v) => setQuality(q.key, v)}
                />
              ))}
            </Section>
          )}

          {/* Relationships */}
          {wsd?.relationships?.length > 0 && (
            <Section title="关系" color={C.relationship}>
              {wsd.relationships.map((r) => (
                <NumberBar
                  key={r.key}
                  label={r.label}
                  value={worldState.relationships[r.key] ?? r.initial}
                  min={r.min ?? 0}
                  max={r.max ?? 10}
                  color={C.relationship}
                  onChange={(v) => setRelationship(r.key, v)}
                />
              ))}
            </Section>
          )}

          {/* Flags */}
          {wsd?.flags?.length > 0 && (
            <Section title="标记" color={C.flag}>
              {wsd.flags.map((f) => (
                <FlagToggle
                  key={f.key}
                  label={f.label}
                  value={worldState.flags[f.key] ?? f.initial}
                  onChange={(v) => setFlag(f.key, v)}
                />
              ))}
            </Section>
          )}

          {/* 内心独白 */}
          {thoughtMsgs.length > 0 && (
            <Section title="内心独白" color={C.trip} defaultOpen={true}>
              {thoughtMsgs.map((m) => (
                <ThoughtCard
                  key={m.id}
                  name={m.speakerName ?? ''}
                  thought={m.thought!}
                  color={m.role === 'trip' ? C.trip : C.grace}
                />
              ))}
            </Section>
          )}

          {/* LLM 日志 */}
          <LlmLogSection />

          <div style={{ height: '20px' }} />
        </>
      )}
    </div>
  )
}