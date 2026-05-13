/**
 * LocationPanel — v2.0
 * 90s Retro 位置面板：bevel 按钮风格，醒目当前位置标记
 */
import { useMemo, useState } from 'react'
import { usePlayStore } from '../../store/usePlayStore'
import { useStore } from '../../store/useStore'

function getAdjacentAll(locId: string, locations: Array<{ id: string; adjacent: string[] }>): Set<string> {
  const visited = new Set<string>()
  const queue = [locId]
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (visited.has(cur)) continue
    visited.add(cur)
    const loc = locations.find(l => l.id === cur)
    if (loc) queue.push(...(loc.adjacent || []))
  }
  return visited
}

export default function LocationPanel() {
  const locations = usePlayStore(s => s.locations)
  const playerLocation = usePlayStore(s => s.playerLocation)
  const entityLocations = usePlayStore(s => s.entityLocations)
  const playChars = usePlayStore(s => s.characters)
  const playProps = usePlayStore(s => s.props)
  const moveToLocation = usePlayStore(s => s.moveToLocation)
  const isLoading = usePlayStore(s => s.isLoading)
  const edChars = useStore(s => s.characters)
  const edProps = useStore(s => s.propLibrary)

  const chars = useMemo(() =>
    playChars.length > 0 ? playChars : edChars.map(c => ({ id: c.id, name: c.name })),
    [playChars, edChars])
  const props = useMemo(() =>
    playProps.length > 0 ? playProps : edProps.map(p => ({ id: p.id, name: p.label })),
    [playProps, edProps])

  const current = playerLocation || (locations.length > 0 ? locations[0].id : '')
  const reachable = useMemo(() => getAdjacentAll(current, locations), [current, locations])

  const entitiesAt = (locId: string) =>
    Object.entries(entityLocations)
      .filter(([, l]) => l === locId)
      .map(([id]) => {
        const c = chars.find(x => x.id === id)
        if (c) return { id, name: c.name, type: 'character' as const }
        const p = props.find(x => x.id === id)
        if (p) return { id, name: p.name, type: 'prop' as const }
        return { id, name: id, type: 'prop' as const }
      })

  if (locations.length === 0) {
    return (
      <div className="bevel-out" style={{ margin: '4px 6px', padding: '16px 8px', textAlign: 'center', background: '#C0C0C0', color: '#808080', fontSize: '11px' }}>
        <div style={{ fontSize: '20px', marginBottom: '4px' }}>📍</div>
        暂无位置数据<br />
        <span style={{ fontSize: '10px' }}>请在编辑器中配置场景位置</span>
      </div>
    )
  }

  return (
    <div style={{ padding: '4px 6px', maxHeight: '260px', overflowY: 'auto', overflowX: 'hidden' }}>
      {locations.map(loc => {
        const here = loc.id === current
        const canGo = !here && reachable.has(loc.id)
        const ents = entitiesAt(loc.id)

        return <LocationRow key={loc.id} {...{ loc, here, canGo, ents, isLoading, moveToLocation }} />
      })}

    </div>
  )
}

// ── LocationRow（独立组件，支持按压状态）──
function LocationRow({ loc, here, canGo, ents, isLoading, moveToLocation }: {
  loc: { id: string; label: string }
  here: boolean
  canGo: boolean
  ents: Array<{ id: string; name: string; type: 'character' | 'prop' }>
  isLoading: boolean
  moveToLocation: (id: string) => void
}) {
  const [pressed, setPressed] = useState(false)
  const bevel = here ? 'bevel-in' : pressed ? 'bevel-in' : 'bevel-out'

  return (
    <div style={{ marginBottom: '4px' }}>
      <div
        className={bevel}
        role={canGo ? 'button' : undefined}
        tabIndex={canGo ? 0 : undefined}
        onClick={canGo && !isLoading ? () => moveToLocation(loc.id) : undefined}
        onKeyDown={canGo && !isLoading ? (e) => { if (e.key === 'Enter') moveToLocation(loc.id) } : undefined}
        onMouseDown={canGo ? () => setPressed(true) : undefined}
        onMouseUp={canGo ? () => setPressed(false) : undefined}
        onMouseLeave={canGo ? () => setPressed(false) : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '6px 8px',
          background: here ? '#FFFFCC' : canGo ? '#C0C0C0' : '#D4D0CC',
          cursor: canGo ? 'pointer' : 'default',
          opacity: here || canGo ? 1 : 0.55,
          userSelect: 'none',
        }}
      >
        {/* LED 指示器 */}
        <div style={{
          width: '10px', height: '10px', flexShrink: 0,
          border: '2px solid',
          borderColor: here ? '#00AA00 #ffffff #ffffff #00AA00' : canGo ? '#0000FF #ffffff #ffffff #0000FF' : '#808080 #ffffff #ffffff #808080',
          background: here ? '#00FF00' : canGo ? '#C0C0FF' : '#808080',
        }} />

        <span style={{
          flex: 1, fontSize: '12px', fontWeight: here ? 700 : 400,
          color: here ? '#000080' : '#000',
          fontFamily: '"MS Sans Serif", sans-serif',
          textTransform: 'uppercase',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {loc.label}
        </span>

        {here ? (
          <span className="loc-tag-current">当前位置</span>
        ) : canGo ? (
          <span className="loc-tag-go">前往</span>
        ) : (
          <span className="loc-tag-far">较远</span>
        )}
      </div>

      {ents.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', padding: '2px 4px 2px 22px' }}>
          {ents.map(e => (
            <span key={e.id} className="bevel-out" style={{
              display: 'inline-flex', alignItems: 'center', gap: '2px',
              padding: '1px 6px', fontSize: '9px',
              background: e.type === 'character' ? '#D0E8FF' : '#FFF0D0',
              color: e.type === 'character' ? '#000080' : '#804000',
              fontFamily: '"MS Sans Serif", sans-serif',
            }}>
              {e.type === 'character' ? '👤' : '📦'} {e.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
