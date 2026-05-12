/**
 * LocationPanel — 90s Retro 位置面板
 * 显示地点列表、角色/物品分布，支持点击移动
 */
import { useMemo } from 'react'
import { usePlayStore } from '../../store/usePlayStore'
import { useStore } from '../../store/useStore'

// ── 实体徽章（90s bevel）──
function EntityBadge({ name, type }: { name: string; type: 'character' | 'prop' }) {
  const isChar = type === 'character'
  return (
    <span className="bevel-out" style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      padding: '1px 6px', fontSize: '10px',
      background: isChar ? '#d0e8ff' : '#fff0d0',
      color: isChar ? '#000080' : '#804000',
      fontFamily: '"MS Sans Serif", sans-serif',
      margin: '2px',
    }}>
      {isChar ? '👤' : '📦'} {name}
    </span>
  )
}

// ── 地点项 ──
function LocationItem({ location, isCurrentLocation, entitiesAtLoc, onMove, isAdjacent }: {
  location: { id: string; label: string; adjacent: string[] }
  isCurrentLocation: boolean
  entitiesAtLoc: Array<{ id: string; name: string }>
  onMove: () => void
  isAdjacent: boolean
}) {
  const canMove = !isCurrentLocation && isAdjacent
  const hasEntities = entitiesAtLoc.length > 0

  return (
    <div className={isCurrentLocation ? 'bevel-in' : 'bevel-out'} style={{
      padding: '6px 8px',
      marginBottom: '4px',
      background: isCurrentLocation ? '#FFFFCC' : '#C0C0C0',
      cursor: canMove ? 'pointer' : 'default',
      opacity: isCurrentLocation ? 1 : isAdjacent ? 1 : 0.6,
    }} onClick={canMove ? onMove : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isCurrentLocation && (
            <div style={{ width: '8px', height: '8px', border: '1px solid', borderColor: '#808080 #ffffff #ffffff #808080', background: '#00FF00' }} />
          )}
          <span style={{
            fontSize: '12px', fontWeight: isCurrentLocation ? 700 : 400,
            color: isCurrentLocation ? '#000080' : '#000',
            fontFamily: '"MS Sans Serif", sans-serif',
            textTransform: isCurrentLocation ? 'uppercase' : 'none',
          }}>
            {location.label}
          </span>
        </div>
        <span style={{ fontSize: '10px', color: canMove ? '#0000FF' : isCurrentLocation ? '#00AA00' : '#808080', fontWeight: 600 }}>
          {canMove ? '前往 ▶' : isCurrentLocation ? '当前' : '较远'}
        </span>
      </div>
      {hasEntities && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1px', marginTop: '4px' }}>
          {entitiesAtLoc.map((e) => (
            <EntityBadge key={e.id} name={e.name}
              type={e.id.startsWith('char_') ? 'character' : 'prop'} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── 主组件 ──
export default function LocationPanel() {
  const locations = usePlayStore((s) => s.locations)
  const playerLocation = usePlayStore((s) => s.playerLocation)
  const entityLocations = usePlayStore((s) => s.entityLocations)
  const playCharacters = usePlayStore((s) => s.characters)
  const playProps = usePlayStore((s) => s.props)
  const moveToLocation = usePlayStore((s) => s.moveToLocation)
  const isLoading = usePlayStore((s) => s.isLoading)
  const editorCharacters = useStore((s) => s.characters)
  const editorProps = useStore((s) => s.propLibrary)

  const characters = useMemo(() =>
    playCharacters.length > 0 ? playCharacters : editorCharacters.map((c) => ({ id: c.id, name: c.name })),
    [playCharacters, editorCharacters])

  const props = useMemo(() =>
    playProps.length > 0 ? playProps : editorProps.map((p) => ({ id: p.id, name: p.label })),
    [playProps, editorProps])

  const displayLocations = locations

  const currentPlayerLocation = useMemo(() => {
    if (playerLocation) return playerLocation
    if (displayLocations.length > 0) return displayLocations[0].id
    return ''
  }, [playerLocation, displayLocations])

  const getAdjacent = (locId: string): string[] => {
    const loc = displayLocations.find((l) => l.id === locId)
    if (!loc) return []
    const visited = new Set<string>()
    const queue = [...(loc.adjacent || [])]
    while (queue.length > 0) {
      const cur = queue.shift()!
      if (visited.has(cur)) continue
      visited.add(cur)
      const adj = displayLocations.find((l) => l.id === cur)
      if (adj) queue.push(...(adj.adjacent || []))
    }
    return Array.from(visited)
  }

  const getEntitiesAt = (locId: string) => {
    const ids = Object.entries(entityLocations).filter(([, l]) => l === locId).map(([id]) => id)
    return ids.map((id) => {
      const c = characters.find((x) => x.id === id)
      if (c) return { id, name: c.name }
      const p = props.find((x) => x.id === id)
      if (p) return { id, name: p.name }
      return { id, name: id }
    })
  }

  if (displayLocations.length === 0) {
    return (
      <div style={{ padding: '8px', borderBottom: '2px solid', borderColor: '#808080 #ffffff #ffffff #808080' }}>
        <div className="bevel-out" style={{ textAlign: 'center', padding: '16px 8px', background: '#C0C0C0', color: '#808080', fontSize: '11px' }}>
          <div style={{ fontSize: '20px', marginBottom: '4px' }}>📍</div>
          暂无位置数据<br />
          <span style={{ fontSize: '10px' }}>请在编辑器中配置场景位置</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '6px 8px', borderBottom: '2px solid', borderColor: '#808080 #ffffff #ffffff #808080', maxHeight: '240px', overflowY: 'auto' }}>
      {displayLocations.map((location) => {
        const isCurrent = location.id === currentPlayerLocation
        const isAdj = getAdjacent(currentPlayerLocation).includes(location.id) || isCurrent
        return (
          <LocationItem key={location.id}
            location={location}
            isCurrentLocation={isCurrent}
            entitiesAtLoc={getEntitiesAt(location.id)}
            onMove={() => !isLoading && moveToLocation(location.id)}
            isAdjacent={isAdj}
          />
        )
      })}
      <div style={{ fontSize: '10px', color: '#808080', textAlign: 'center', marginTop: '4px', fontFamily: '"Courier New",monospace' }}>
        点击相邻地点进行移动
      </div>
    </div>
  )
}
