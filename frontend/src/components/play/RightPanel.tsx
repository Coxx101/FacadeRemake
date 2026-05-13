/**
 * RightPanel — 90s Retro 右栏
 * mockup 结构：GAME LOG + HIT COUNTER + 可折叠 DEBUG PANEL
 */
import { useState } from 'react'
import { Bug, Trash2, ChevronDown, ChevronRight, Send, ArrowDownCircle } from 'lucide-react'
import { usePlayStore } from '../../store/usePlayStore'
import { useStore } from '../../store/useStore'
import type { ChatMessage, LlmDebugEntry, PipelineEvent } from '../../store/usePlayStore'

// ── log 类型色 ──
const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  storylet: { bg: '#f0e0ff', fg: '#800080' },
  landmark: { bg: '#d0e8ff', fg: '#000080' },
  state:    { bg: '#d0ffe0', fg: '#006600' },
  system:   { bg: '#e8e8e8', fg: '#444444' },
}

// ── 流水线颜色 ──
const PIPELINE_COLORS: Record<string, string> = {
  pass: '#00AA00', warn: '#b8860b', block: '#FF0000', changed: '#0000FF',
  on_goal: '#00AA00', off_goal: '#b8860b',
  complete: '#00AA00', in_progress: '#808080', triggered: '#FF0000',
}

// ── GAME LOG（v2.0: 使用 gameLogEntries）──
function GameLog() {
  const gameLogEntries = usePlayStore((s) => s.gameLogEntries)
  return (
    <div className="game-log">
      {gameLogEntries.length === 0 ? (
        <div className="log-entry" style={{ color: '#808080', fontStyle: 'italic' }}>
          <div className="log-msg">等待系统事件…</div>
        </div>
      ) : (
        gameLogEntries.map((entry) => {
          const isLandmark = entry.completion_status === 'landmark_switch'
          const c = isLandmark ? TYPE_COLORS.landmark : TYPE_COLORS.storylet
          return (
            <div key={`${entry.storylet_id}_${entry.turn}`} className="log-entry"
              style={{ borderLeft: `3px solid ${c.fg}` }}>
              <div className="log-turn">T{entry.turn}</div>
              <div className="log-msg">
                <span className="log-type" style={{ background: c.bg, color: c.fg }}>
                  {isLandmark ? 'PHASE' : 'DONE'}
                </span>
                <strong>{entry.title}</strong>
                <div style={{ fontSize: '0.85em', color: '#555', marginTop: 2 }}>{entry.summary}</div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ── v2.0 DEBUG PANEL ──

function DebugPanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const [tab, setTab] = useState<'pipeline' | 'llm' | 'state'>('pipeline')
  const connected = usePlayStore((s) => s.connected)
  const connecting = usePlayStore((s) => s.connecting)
  const isLoading = usePlayStore((s) => s.isLoading)
  const turn = usePlayStore((s) => s.turn)

  return (
    <div className="debug-section" style={{ flex: open ? 1 : '0 0 auto', flexShrink: open ? 1 : 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, transition: 'none' }}>
      <button className="debug-toggle" onClick={onToggle} aria-expanded={open} style={{ flexShrink: 0 }}>
        <span>{open ? '▼' : '▶'}</span>
        <Bug size={11} /> DEBUG
        <span style={{ marginLeft: 'auto', fontSize: '9px', fontFamily: '"Courier New",monospace' }}>
          [CLICK TO {open ? 'COLLAPSE' : 'EXPAND'}]
        </span>
      </button>
      {open && (
        <div className="debug-body" style={{ flex: 1, overflowY: 'auto', maxHeight: 'none' }}>
          {/* ── 状态行 ── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap', fontSize: '10px', fontFamily: '"Courier New",monospace' }}>
            <span style={{ color: connected ? '#00AA00' : connecting ? '#b8860b' : '#FF0000', fontWeight: 600 }}>
              {connected ? 'WS' : connecting ? 'CNT' : 'OFF'}
            </span>
            <span style={{ color: isLoading ? '#FF0000' : '#000' }}>T{turn}</span>
          </div>

          {/* ── Tab 栏 ── */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 6 }}>
            {(['pipeline', 'llm', 'state'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{
                  padding: '3px 8px', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                  background: tab === t ? '#000' : '#d4d0cc', color: tab === t ? '#fff' : '#000',
                  border: '1px solid #808080', fontFamily: '"Courier New",monospace',
                  textTransform: 'uppercase',
                }}>
                {t === 'pipeline' ? '📡 流水线' : t === 'llm' ? '🤖 LLM' : '📊 状态'}
              </button>
            ))}
          </div>

          {tab === 'pipeline' && <PipelineTab />}
          {tab === 'llm' && <LlmTab />}
          {tab === 'state' && <StateTab />}
        </div>
      )}
    </div>
  )
}

// ── Tab 1: 流水线 ──
function PipelineTab() {
  const events = usePlayStore((s) => s.pipelineEvents)
  const clear = usePlayStore((s) => s.clearPipelineEvents)

  // 按 turn 分组
  const grouped = events.reduce((acc, e) => {
    const key = e.turn || 0
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {} as Record<number, PipelineEvent[]>)

  return (
    <div style={{ overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: '9px', color: '#808080', fontFamily: '"Courier New",monospace' }}>{events.length} events</span>
        {events.length > 0 && (
          <button onClick={clear} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Trash2 size={10} color="#808080" />
          </button>
        )}
      </div>
      {Object.entries(grouped).reverse().map(([t, evts]) => (
        <TurnCard key={t} turn={Number(t)} events={evts} />
      ))}
      {events.length === 0 && (
        <div style={{ fontSize: '10px', color: '#808080', fontStyle: 'italic', textAlign: 'center', padding: 10 }}>
          等待流水线事件…
        </div>
      )}
    </div>
  )
}

function TurnCard({ turn, events }: { turn: number; events: PipelineEvent[] }) {
  const [open, setOpen] = useState(false)
  const color = PIPELINE_COLORS[events[events.length - 1]?.result] || '#808080'
  return (
    <div style={{ marginBottom: 3, border: `1px solid ${color}`, borderLeft: `4px solid ${color}` }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 6px', background: '#e8e8e8', border: 'none',
        cursor: 'pointer', fontSize: '10px', fontFamily: '"Courier New",monospace', fontWeight: 600,
      }}>
        {open ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
        ▼ Turn {turn} ({events.length}步)
      </button>
      {open && (
        <div style={{ padding: '4px 6px', background: '#f4f4f4' }}>
          {events.map((e, i) => {
            const c = PIPELINE_COLORS[e.result] || '#808080'
            return (
              <div key={i} style={{
                display: 'flex', gap: 6, alignItems: 'flex-start',
                padding: '2px 0', borderBottom: '1px dotted #d0d0d0',
                fontFamily: '"Courier New",monospace', fontSize: '9px',
              }}>
                <span style={{ color: c, fontWeight: 700, minWidth: 50 }}>[{e.step}]</span>
                <span style={{ color: '#444', flex: 1 }}>{e.detail}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Tab 2: LLM 日志 ──
function LlmTab() {
  const logs = usePlayStore((s) => s.debugLogs)
  const clear = usePlayStore((s) => s.clearDebugLogs)

  // 按 component 分组
  const grouped = logs.reduce((acc, e) => {
    const comp = e.component || 'other'
    if (!acc[comp]) acc[comp] = []
    acc[comp].push(e)
    return acc
  }, {} as Record<string, LlmDebugEntry[]>)

  return (
    <div style={{ overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: '9px', color: '#808080', fontFamily: '"Courier New",monospace' }}>{logs.length} calls</span>
        {logs.length > 0 && (
          <button onClick={clear} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Trash2 size={10} color="#808080" />
          </button>
        )}
      </div>
      {logs.length === 0 ? (
        <div style={{ fontSize: '10px', color: '#808080', fontStyle: 'italic', textAlign: 'center', padding: 10 }}>
          等待 LLM 调用…
        </div>
      ) : (
        Object.entries(grouped).map(([comp, entries]) => (
          <LlmGroup key={comp} component={comp} entries={entries} />
        ))
      )}
    </div>
  )
}

function LlmGroup({ component, entries }: { component: string; entries: LlmDebugEntry[] }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ marginBottom: 6 }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 6px', background: '#d4d0cc', border: '1px solid #808080',
        cursor: 'pointer', fontSize: '10px', fontFamily: '"Courier New",monospace', fontWeight: 700,
      }}>
        {open ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
        [{component}] ({entries.length})
      </button>
      {open && (
        <div>
          {entries.slice(-20).map(e => <LlmItem key={e.id} entry={e} />)}
        </div>
      )}
    </div>
  )
}

function LlmItem({ entry }: { entry: LlmDebugEntry }) {
  const [open, setOpen] = useState(false)
  const isReq = entry.event === 'llm_request'
  const label = isReq ? 'REQ' : 'RES'
  const color = isReq ? '#0000FF' : '#00AA00'
  return (
    <div style={{ marginBottom: 2, border: '1px solid #d0d0d0' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 4,
        padding: '2px 4px', background: '#fff', border: 'none',
        cursor: 'pointer', color, fontSize: '9px', fontWeight: 600,
        fontFamily: '"Courier New",monospace',
      }}>
        {isReq ? <Send size={8} /> : <ArrowDownCircle size={8} />}
        {label}
        {entry.model && <span style={{ color: '#808080', fontWeight: 400 }}>{entry.model}</span>}
        {open ? <ChevronDown size={8} style={{ marginLeft: 'auto' }} /> : <ChevronRight size={8} style={{ marginLeft: 'auto' }} />}
      </button>
      {open && (
        <div style={{ padding: '4px 6px', background: '#f8f8f8', maxHeight: 300, overflowY: 'auto', fontFamily: '"Courier New",monospace', fontSize: '9px' }}>
          {isReq && entry.messages?.map((m, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <div style={{ color: '#808080', fontWeight: 600, fontSize: '8px' }}>{m.role}</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#000', lineHeight: 1.3 }}>{m.content}</pre>
            </div>
          ))}
          {!isReq && entry.content && (
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color, lineHeight: 1.3 }}>{entry.content}</pre>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab 3: 状态 ──
function StateTab() {
  const worldState = usePlayStore((s) => s.worldState)
  const setQuality = usePlayStore((s) => s.setQuality)
  const setFlag = usePlayStore((s) => s.setFlag)
  const setRelationship = usePlayStore((s) => s.setRelationship)
  const wsd = useStore((s) => s.worldStateDefinition)

  return (
    <div style={{ overflowY: 'auto' }}>
      {(wsd?.qualities?.length || wsd?.flags?.length || wsd?.relationships?.length) ? (
        <>
          {wsd.qualities?.map(q => (
            <div key={q.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 4px', borderBottom: '1px dotted #d0d0d0', fontSize: '10px' }}>
              <span style={{ fontFamily: '"Courier New",monospace', color: '#444' }}>{q.label}</span>
              <input type="number" value={worldState.qualities[q.key] ?? q.initial} min={q.min ?? 0} max={q.max ?? 10}
                onChange={e => { const v = Number(e.target.value); if (!isNaN(v)) setQuality(q.key, Math.max(q.min ?? 0, Math.min(q.max ?? 10, v))) }}
                style={{ width: 42, textAlign: 'center', fontFamily: '"Courier New",monospace', fontSize: '10px', border: '1px solid #808080', background: '#fff', padding: '1px 2px' }} />
            </div>
          ))}
          {wsd.flags?.map(f => (
            <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 4px', borderBottom: '1px dotted #d0d0d0', fontSize: '10px' }}>
              <span style={{ fontFamily: '"Courier New",monospace', color: '#444' }}>{f.label}</span>
              <button onClick={() => setFlag(f.key, !worldState.flags[f.key])}
                style={{ fontFamily: '"Courier New",monospace', fontSize: '10px', fontWeight: 700, border: '1px solid #808080', background: worldState.flags[f.key] ? '#00FF00' : '#C0C0C0', color: '#000', padding: '0 4px', cursor: 'pointer', width: 42 }}>
                {String(!!worldState.flags[f.key])}
              </button>
            </div>
          ))}
          {wsd.relationships?.map(r => (
            <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 4px', borderBottom: '1px dotted #d0d0d0', fontSize: '10px' }}>
              <span style={{ fontFamily: '"Courier New",monospace', color: '#444' }}>{r.label}</span>
              <input type="number" value={worldState.relationships[r.key] ?? r.initial} min={r.min ?? 0} max={r.max ?? 10}
                onChange={e => { const v = Number(e.target.value); if (!isNaN(v)) setRelationship(r.key, Math.max(r.min ?? 0, Math.min(r.max ?? 10, v))) }}
                style={{ width: 42, textAlign: 'center', fontFamily: '"Courier New",monospace', fontSize: '10px', border: '1px solid #808080', background: '#fff', padding: '1px 2px' }} />
            </div>
          ))}
        </>
      ) : (
        <div style={{ fontSize: '10px', color: '#808080', fontStyle: 'italic', textAlign: 'center', padding: 10 }}>
          暂无 WSD 定义
        </div>
      )}
    </div>
  )
}

// ── RightPanel ──
export default function RightPanel() {
  const [debugOpen, setDebugOpen] = useState(false)
  const [gameLogH, setGameLogH] = useState(200)

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const panel = (e.target as HTMLElement).closest('[data-right-panel]') as HTMLElement
    if (!panel) return
    const totalH = panel.clientHeight
    const startY = e.clientY
    const startH = gameLogH
    const onMove = (ev: MouseEvent) => {
      const dy = ev.clientY - startY
      setGameLogH(Math.max(40, Math.min(totalH - 100, startH + dy)))
    }
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div data-right-panel style={{
      width: '240px', height: '100%', minHeight: 0, flexShrink: 0,
      background: '#C0C0C0',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div className="panel-header">
        📋 GAME LOG
        <span style={{ marginLeft: 'auto', fontFamily: '"Courier New",monospace', fontSize: '9px', fontWeight: 400 }}>SYSTEM EVENTS</span>
      </div>
      <div style={{
        height: debugOpen ? gameLogH : undefined,
        flex: debugOpen ? undefined : '1 1 auto',
        overflowY: 'auto', minHeight: 0,
      }}>
        <GameLog />
      </div>

      {debugOpen && (
        <div
          onMouseDown={startResize}
          style={{
            height: 6, cursor: 'ns-resize', background: '#808080',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <div style={{ width: 30, height: 2, background: '#fff', borderRadius: 1 }} />
        </div>
      )}

      <DebugPanel open={debugOpen} onToggle={() => setDebugOpen(!debugOpen)} />
    </div>
  )
}
