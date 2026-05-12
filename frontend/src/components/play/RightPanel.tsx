/**
 * RightPanel — 90s Retro 右栏
 * mockup 结构：GAME LOG + HIT COUNTER + 可折叠 DEBUG PANEL
 */
import { useState } from 'react'
import { Bug, Trash2, ChevronDown, ChevronRight, Send, ArrowDownCircle } from 'lucide-react'
import { usePlayStore } from '../../store/usePlayStore'
import { useStore } from '../../store/useStore'
import type { ChatMessage, LlmDebugEntry } from '../../store/usePlayStore'

// ── log 类型色 ──
const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  storylet: { bg: '#f0e0ff', fg: '#800080' },
  landmark: { bg: '#d0e8ff', fg: '#000080' },
  llm:      { bg: '#FFFFCC', fg: '#6b4800' },
  state:    { bg: '#d0ffe0', fg: '#006600' },
  system:   { bg: '#e8e8e8', fg: '#444444' },
}

function getSysType(speech: string | undefined): string {
  if (!speech) return 'system'
  if (speech.startsWith('[Storylet]')) return 'storylet'
  if (speech.startsWith('[进入新阶段')) return 'landmark'
  if (speech.startsWith('[LLM]')) return 'llm'
  if (speech.startsWith('[Debug]')) return 'system'
  return 'state'
}

// ── GAME LOG ──
function GameLog() {
  const messages = usePlayStore((s) => s.messages)
  const turn = usePlayStore((s) => s.turn)
  const systemMessages = messages.filter(m => m.role === 'system').slice(-30)

  return (
    <div className="game-log">
      {systemMessages.length === 0 ? (
        <div className="log-entry" style={{ color: '#808080', fontStyle: 'italic' }}>
          <div className="log-msg">等待系统事件…</div>
        </div>
      ) : (
        systemMessages.map((msg, i) => {
          const type = getSysType(msg.speech)
          const c = TYPE_COLORS[type] || TYPE_COLORS.system
          const cleanText = msg.speech?.replace(/^\[.*?\]\s*/, '') || ''
          const lastTurn = i === systemMessages.length - 1 && turn > 0
          return (
            <div key={msg.id} className="log-entry"
              style={lastTurn ? { background: '#fff8d0' } : undefined}>
              <div className={`log-turn ${lastTurn ? 'blink' : ''}`} style={lastTurn ? { color:'#FF0000', animation:'blink 1s step-end infinite' } : undefined}>
                T{turn || '?'}
              </div>
              <div className="log-msg">
                <span className="log-type" style={{ background: c.bg, color: c.fg }}>
                  {type.toUpperCase()}
                </span>
                {cleanText}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ── DEBUG PANEL（含 WorldState 编辑 + LLM 日志）──
function DebugPanel() {
  const [open, setOpen] = useState(false)
  const connected = usePlayStore((s) => s.connected)
  const connecting = usePlayStore((s) => s.connecting)
  const isLoading = usePlayStore((s) => s.isLoading)
  const messages = usePlayStore((s) => s.messages)
  const turn = usePlayStore((s) => s.turn)
  const worldState = usePlayStore((s) => s.worldState)
  const setQuality = usePlayStore((s) => s.setQuality)
  const setFlag = usePlayStore((s) => s.setFlag)
  const setRelationship = usePlayStore((s) => s.setRelationship)
  const debugLogs = usePlayStore((s) => s.debugLogs)
  const clearDebugLogs = usePlayStore((s) => s.clearDebugLogs)
  const wsd = useStore((s) => s.worldStateDefinition)

  const wsState = connected ? 'CONNECTED' : connecting ? 'CONNECTING' : 'DISCONNECTED'
  const wsColor = connected ? '#00AA00' : connecting ? '#b8860b' : '#FF0000'

  return (
    <div className="debug-section" style={{ maxHeight: open ? '600px' : '28px' }}>
      <button className="debug-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{open ? '▼' : '▶'}</span>
        <Bug size={11} /> DEBUG PANEL
        <span style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: 400, fontFamily: '"Courier New",monospace' }}>
          [CLICK TO {open ? 'COLLAPSE' : 'EXPAND'}]
        </span>
      </button>
      <div className="debug-body" style={{ display: open ? 'block' : 'none' }}>
        {/* ── 运行状态 ── */}
        <div className="panel-header-black" style={{ fontSize:'9px', padding:'2px 8px', margin:'-6px -8px 6px' }}>STATUS</div>
        <div className="debug-entry"><span className="debug-key">ws</span><span className="debug-val" style={{ color: wsColor }}>{wsState}</span></div>
        <div className="debug-entry"><span className="debug-key">loading</span><span className="debug-val" style={{ color: isLoading ? '#FF0000' : '#000' }}>{String(isLoading)}</span></div>
        <div className="debug-entry"><span className="debug-key">turn</span><span className="debug-val">{turn}</span></div>
        <div className="debug-entry"><span className="debug-key">messages</span><span className="debug-val">{messages.length}</span></div>

        {/* ── World State ── */}
        {(wsd?.qualities?.length || wsd?.flags?.length || wsd?.relationships?.length) ? (
          <>
            <div className="panel-header-black" style={{ fontSize:'9px', padding:'2px 8px', margin:'6px -8px 6px' }}>WORLD STATE</div>
            {wsd.qualities?.map(q => (
              <div key={q.key} className="debug-entry">
                <span className="debug-key">{q.label}</span>
                <input type="number" value={worldState.qualities[q.key] ?? q.initial} min={q.min??0} max={q.max??10}
                  onChange={e => { const v = Number(e.target.value); if (!isNaN(v)) setQuality(q.key, Math.max(q.min??0, Math.min(q.max??10, v))) }}
                  style={{ width:'42px', textAlign:'center', fontFamily:'"Courier New",monospace', fontSize:'10px', border:'1px solid #808080', background:'#fff', padding:'1px 2px' }} />
              </div>
            ))}
            {wsd.flags?.map(f => (
              <div key={f.key} className="debug-entry">
                <span className="debug-key">{f.label}</span>
                <button onClick={() => setFlag(f.key, !worldState.flags[f.key])}
                  style={{ fontFamily:'"Courier New",monospace', fontSize:'10px', fontWeight:700, border:'1px solid #808080', background: worldState.flags[f.key] ? '#00FF00' : '#C0C0C0', color:'#000', padding:'0 4px', cursor:'pointer' }}>
                  {String(!!worldState.flags[f.key])}
                </button>
              </div>
            ))}
            {wsd.relationships?.map(r => (
              <div key={r.key} className="debug-entry">
                <span className="debug-key">{r.label}</span>
                <input type="number" value={worldState.relationships[r.key] ?? r.initial} min={r.min??0} max={r.max??10}
                  onChange={e => { const v = Number(e.target.value); if (!isNaN(v)) setRelationship(r.key, Math.max(r.min??0, Math.min(r.max??10, v))) }}
                  style={{ width:'42px', textAlign:'center', fontFamily:'"Courier New",monospace', fontSize:'10px', border:'1px solid #808080', background:'#fff', padding:'1px 2px' }} />
              </div>
            ))}
          </>
        ) : null}

        {/* ── LLM 日志 ── */}
        <div className="panel-header-black" style={{ fontSize:'9px', padding:'2px 8px', margin:'6px -8px 6px', display:'flex', justifyContent:'space-between' }}>
          <span>LLM LOG ({debugLogs.length})</span>
          <button onClick={clearDebugLogs} style={{ background:'none', border:'none', color:'#fff', cursor:'pointer', fontSize:'9px', padding:0, fontFamily:'"Courier New",monospace' }} title="清空">
            <Trash2 size={10} />
          </button>
        </div>
        {debugLogs.length === 0 ? (
          <div style={{ fontSize:'10px', color:'#808080', fontStyle:'italic', textAlign:'center', padding:'6px 0' }}>等待 LLM 调用…</div>
        ) : (
          debugLogs.slice(-10).map(e => <LlmLogItem key={e.id} entry={e} />)
        )}
      </div>
    </div>
  )
}

// ── LLM 日志单条 ──
function LlmLogItem({ entry }: { entry: LlmDebugEntry }) {
  const [open, setOpen] = useState(false)
  const isReq = entry.event === 'llm_request'
  const label = isReq ? 'REQ' : 'RES'
  const color = isReq ? '#0000FF' : '#00AA00'
  return (
    <div style={{ marginBottom:'3px', border:'1px solid #808080', overflow:'hidden' }}>
      <button onClick={() => setOpen(!open)} style={{
        width:'100%', display:'flex', alignItems:'center', gap:'4px',
        padding:'3px 6px', background:'#d4d0cc', border:'none',
        cursor:'pointer', color, fontSize:'10px', fontWeight:600,
        fontFamily:'"Courier New",monospace', textTransform:'uppercase',
      }}>
        {isReq ? <Send size={9} /> : <ArrowDownCircle size={9} />}
        {label} {entry.model && <span style={{color:'#808080', fontWeight:400, textTransform:'none'}}>{entry.model}</span>}
        {open ? <ChevronDown size={9} style={{marginLeft:'auto'}} /> : <ChevronRight size={9} style={{marginLeft:'auto'}} />}
      </button>
      {open && (
        <div style={{ padding:'4px 6px', background:'#e8e8e8', maxHeight:'140px', overflowY:'auto', fontFamily:'"Courier New",monospace', fontSize:'10px' }}>
          {isReq && entry.messages?.map((m,i) => (
            <div key={i} style={{marginBottom:'4px'}}>
              <div style={{color:'#808080', fontSize:'9px', fontWeight:600}}>{m.role}</div>
              <pre style={{margin:0, whiteSpace:'pre-wrap', wordBreak:'break-word', color:'#000', lineHeight:1.4}}>{m.content?.slice(0,300)}</pre>
            </div>
          ))}
          {!isReq && entry.content && (
            <pre style={{margin:0, whiteSpace:'pre-wrap', wordBreak:'break-word', color:color, lineHeight:1.4}}>{entry.content?.slice(0,500)}</pre>
          )}
        </div>
      )}
    </div>
  )
}

// ── RightPanel ──
export default function RightPanel() {
  return (
    <div style={{
      width: '240px', flexShrink: 0,
      background: '#C0C0C0',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>

      {/* ── GAME LOG ── */}
      <div className="panel-header">
        📋 GAME LOG
        <span style={{ marginLeft:'auto', fontFamily:'"Courier New",monospace', fontSize:'9px', fontWeight:400 }}>SYSTEM EVENTS</span>
      </div>
      <GameLog />

      <div className="hr-groove" />

      {/* ── DEBUG PANEL ── */}
      <DebugPanel />

    </div>
  )
}
