/**
 * DebugPanel — 右侧调试面板
 * 显示并可编辑：当前 Landmark / Storylet / WorldState / 内心独白 / LLM 调试日志
 */
import { useState, useRef, useEffect } from 'react'
import { ChevronRight, ChevronDown, Bug, X, Trash2, Send, MessageSquare, ArrowDownCircle } from 'lucide-react'
import { usePlayStore } from '../../store/usePlayStore'
import type { LlmDebugEntry } from '../../store/usePlayStore'
import { useStore } from '../../store/useStore'

// ── 颜色 ──────────────────────────────────────────────────────────────────────
const C = {
  bg: '#0d0f1a',
  surface: '#131625',
  border: '#1e2235',
  muted: '#4a5070',
  text: '#c8cce0',
  textDim: '#6a7090',
  accent: '#4f6ef7',
  trip: '#e8b86a',
  grace: '#a8d4b0',
  quality: '#7eb8f7',
  flag: '#a78bfa',
  relationship: '#f47eb8',
  good: '#4ade80',
  warn: '#facc15',
  danger: '#f87171',
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

// ── 数值条（qualities / relationships）────────────────────────────────────────
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
              background: '#1e2235', border: '1px solid #2e3250',
              color: color, borderRadius: '4px',
              fontSize: '12px', padding: '1px 4px',
            }}
          />
          <span style={{ fontSize: '10px', color: C.muted }}>/{max}</span>
        </div>
      </div>
      {/* 滑块 */}
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: barColor, cursor: 'pointer' }}
      />
      {/* 进度条（视觉装饰） */}
      <div style={{ height: '3px', background: '#1e2235', borderRadius: '2px', marginTop: '2px' }}>
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
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '6px',
      }}
    >
      <span style={{ fontSize: '12px', color: boolVal ? C.text : C.muted }}>{label}</span>
      <button
        onClick={() => onChange(!boolVal)}
        style={{
          width: '34px', height: '18px', borderRadius: '9px',
          border: 'none', cursor: 'pointer',
          background: boolVal ? C.flag : '#2e3250',
          position: 'relative', transition: 'background 0.2s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.3)' }}
        onMouseLeave={(e) => { e.currentTarget.style.filter = 'none' }}
      >
        <span style={{
          position: 'absolute', top: '2px',
          left: boolVal ? '16px' : '2px',
          width: '14px', height: '14px',
          borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s',
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
      border: `1px solid ${isReq ? '#2a3050' : `${color}40`}`,
      borderRadius: '4px',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '6px',
          padding: '5px 8px', background: isReq ? '#111420' : `${color}08`,
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
        <div style={{ padding: '6px 8px', background: '#0a0c16', maxHeight: '300px', overflowY: 'auto' }}>
          {isReq && entry.messages && entry.messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: '6px' }}>
              <div style={{ fontSize: '9px', color: C.muted, fontWeight: 600, marginBottom: '2px', textTransform: 'uppercase' }}>
                {msg.role}
              </div>
              <pre style={{
                margin: 0, padding: '4px 6px', borderRadius: '3px',
                background: '#131625', color: C.text,
                fontSize: '11px', lineHeight: '1.6', whiteSpace: 'pre-wrap',
                wordBreak: 'break-word', fontFamily: 'inherit',
                borderLeft: `2px solid ${msg.role === 'system' ? C.flag : msg.role === 'assistant' ? color : '#3a4060'}`,
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
  const [autoScroll, setAutoScroll] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  // 自动滚到底部
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [debugLogs, autoScroll])

  // 按请求-响应对分组
  const requestCount = debugLogs.filter((l) => l.event === 'llm_request').length

  return (
    <Section title={`LLM 日志 (${requestCount})`} color={C.muted} defaultOpen={true}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: C.muted, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            style={{ margin: 0, accentColor: C.accent }}
          />
          自动滚底
        </label>
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
      <div
        ref={containerRef}
        style={{
          maxHeight: '400px',
          overflowY: 'auto',
        }}>
        }}
      >
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

// ── DebugPanel 主体 ────────────────────────────────────────────────────────────
export default function DebugPanel() {
  const debugOpen = usePlayStore((s) => s.debugOpen)
  const setDebugOpen = usePlayStore((s) => s.setDebugOpen)
  const worldState = usePlayStore((s) => s.worldState)
  const currentLandmark = usePlayStore((s) => s.currentLandmark)
  const currentStorylet = usePlayStore((s) => s.currentStorylet)
  const turn = usePlayStore((s) => s.turn)
  const messages = usePlayStore((s) => s.messages)
  const setQuality = usePlayStore((s) => s.setQuality)
  const setFlag = usePlayStore((s) => s.setFlag)
  const setRelationship = usePlayStore((s) => s.setRelationship)

  // Design store 数据（WSD 定义 + landmarks + storylets）
  const wsd = useStore((s) => s.worldStateDefinition)

  // 收集最近几条有内心独白的消息
  const thoughtMsgs = [...messages].reverse().filter((m) => m.thought).slice(0, 3).reverse()

  // 折叠按钮（收起时只显示 tab）
  if (!debugOpen) {
    return (
      <button
        onClick={() => setDebugOpen(true)}
        title="打开调试面板"
        style={{
          position: 'absolute', top: '12px', right: '12px',
          background: '#131625', border: '1px solid #1e2235',
          borderRadius: '8px', padding: '6px 10px',
          cursor: 'pointer', color: C.muted,
          display: 'flex', alignItems: 'center', gap: '5px',
          fontSize: '12px', zIndex: 20,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#1e2235'; e.currentTarget.style.color = C.accent }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#131625'; e.currentTarget.style.color = C.muted }}
      >
        <Bug size={14} />
        Debug
      </button>
    )
  }

  return (
    <div style={{
      width: '280px',
      flexShrink: 0,
      background: C.bg,
      borderLeft: `1px solid ${C.border}`,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      fontSize: '12px',
    }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
        position: 'sticky', top: 0, background: C.bg, zIndex: 5,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: C.accent }}>
          <Bug size={13} />
          <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em' }}>DEBUG</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: C.muted }}>Turn {turn}</span>
          <button
            onClick={() => setDebugOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '2px' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.muted }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ── 叙事状态 ── */}
      <Section title="叙事状态" color={C.accent}>
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', color: C.muted, marginBottom: '3px' }}>当前 Landmark</div>
          {currentLandmark?.title ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <Chip label={currentLandmark.title} color={currentLandmark.is_ending ? C.danger : C.accent} />
              {currentLandmark.phase_tag && <Chip label={currentLandmark.phase_tag} color={C.muted} />}
            </div>
          ) : (
            <span style={{ color: C.muted, fontStyle: 'italic' }}>—</span>
          )}
        </div>
        <div>
          <div style={{ fontSize: '11px', color: C.muted, marginBottom: '3px' }}>当前 Storylet</div>
          {currentStorylet?.title ? (
            <div>
              <Chip label={currentStorylet.title} color={C.warn} />
              {currentStorylet.narrative_goal && (
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: C.textDim, fontStyle: 'italic', lineHeight: '1.5' }}>
                  {currentStorylet.narrative_goal}
                </p>
              )}
            </div>
          ) : (
            <span style={{ color: C.muted, fontStyle: 'italic' }}>—</span>
          )}
        </div>
      </Section>

      {/* ── Qualities ── */}
      {wsd.qualities.length > 0 && (
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

      {/* ── Relationships ── */}
      {wsd.relationships.length > 0 && (
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

      {/* ── Flags ── */}
      {wsd.flags.length > 0 && (
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

      {/* ── 内心独白 ── */}
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

      {/* ── LLM 调试日志 ── */}
      <LlmLogSection />

      {/* 底部留白 */}
      <div style={{ height: '20px' }} />
    </div>
  )
}
