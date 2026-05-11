/**
 * LocationPanel — 位置面板组件
 * 显示动态地点列表、各位置的角色/物品分布，支持点击移动
 */
import { useMemo } from 'react'
import { usePlayStore } from '../../store/usePlayStore'
import { useStore } from '../../store/useStore'

// 实体徽章组件
function EntityBadge({ name, type }: { name: string; type: 'character' | 'prop' }) {
  const colors = {
    character: { bg: '#e8f4fd', text: '#1a73e8', border: '#c2e3ff' },
    prop: { bg: '#fef3e2', text: '#f57c00', border: '#ffe0b2' },
  }
  const color = colors[type]

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 6px',
      fontSize: '10px',
      fontWeight: 500,
      background: color.bg,
      color: color.text,
      border: `1px solid ${color.border}`,
      borderRadius: '4px',
      margin: '2px',
    }}>
      {type === 'character' ? '👤' : '📦'} {name}
    </span>
  )
}

// 地点项组件
function LocationItem({
  location,
  isCurrentLocation,
  charactersAtLocation,
  propsAtLocation,
  onMove,
  isAdjacent,
}: {
  location: { id: string; label: string; adjacent: string[] }
  isCurrentLocation: boolean
  charactersAtLocation: Array<{ id: string; name: string }>
  propsAtLocation: Array<{ id: string; name: string }>
  onMove: () => void
  isAdjacent: boolean
}) {
  const canMove = !isCurrentLocation && isAdjacent
  const hasEntities = charactersAtLocation.length > 0 || propsAtLocation.length > 0

  return (
    <div style={{
      padding: '8px 10px',
      marginBottom: '6px',
      borderRadius: '6px',
      background: isCurrentLocation ? 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' : 'var(--bg-surface)',
      border: isCurrentLocation ? '1px solid #81c784' : '1px solid var(--border)',
      cursor: canMove ? 'pointer' : 'default',
      transition: 'all 0.2s ease',
      opacity: canMove ? 1 : (isCurrentLocation ? 1 : 0.6),
    }}
      onClick={canMove ? onMove : undefined}
      onMouseEnter={canMove ? (e) => {
        e.currentTarget.style.transform = 'translateX(2px)'
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
      } : undefined}
      onMouseLeave={canMove ? (e) => {
        e.currentTarget.style.transform = 'translateX(0)'
        e.currentTarget.style.boxShadow = 'none'
      } : undefined}
    >
      {/* 地点名称行 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: hasEntities ? '6px' : 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          {isCurrentLocation && (
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#4caf50',
              boxShadow: '0 0 6px #4caf50',
            }} />
          )}
          <span style={{
            fontSize: '13px',
            fontWeight: isCurrentLocation ? 600 : 400,
            color: isCurrentLocation ? '#2e7d32' : 'var(--text)',
          }}>
            {location.label}
          </span>
        </div>
        {canMove && (
          <span style={{
            fontSize: '10px',
            color: 'var(--primary)',
            fontWeight: 500,
          }}>
            前往 →
          </span>
        )}
        {isCurrentLocation && (
          <span style={{
            fontSize: '10px',
            color: '#4caf50',
            fontWeight: 500,
          }}>
            当前位置
          </span>
        )}
        {!isCurrentLocation && !isAdjacent && (
          <span style={{
            fontSize: '10px',
            color: 'var(--text-dim)',
          }}>
            距离较远
          </span>
        )}
      </div>

      {/* 实体列表 */}
      {hasEntities && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '2px',
        }}>
          {charactersAtLocation.map((char) => (
            <EntityBadge key={char.id} name={char.name} type="character" />
          ))}
          {propsAtLocation.map((prop) => (
            <EntityBadge key={prop.id} name={prop.name} type="prop" />
          ))}
        </div>
      )}
    </div>
  )
}

// 主组件
export default function LocationPanel() {
  const locations = usePlayStore((s) => s.locations)
  const playerLocation = usePlayStore((s) => s.playerLocation)
  const entityLocations = usePlayStore((s) => s.entityLocations)
  const playCharacters = usePlayStore((s) => s.characters)
  const playProps = usePlayStore((s) => s.props)
  const moveToLocation = usePlayStore((s) => s.moveToLocation)
  const isLoading = usePlayStore((s) => s.isLoading)

  // 从 useStore 获取编辑器配置的角色列表（用于初始化显示）
  const editorCharacters = useStore((s) => s.characters)
  const editorProps = useStore((s) => s.propLibrary)
  // 从 useStore 获取初始位置库（用于检查项目是否有位置数据）
  const locationLibrary = useStore((s) => s.locationLibrary)

  // 合并编辑器角色和运行时角色
  const characters = useMemo(() => {
    if (playCharacters.length > 0) {
      return playCharacters
    }
    // 回退到编辑器角色
    return editorCharacters.map((c) => ({ id: c.id, name: c.name }))
  }, [playCharacters, editorCharacters])

  // 合并编辑器物品和运行时物品
  const props = useMemo(() => {
    if (playProps.length > 0) {
      return playProps
    }
    // 回退到编辑器物品
    return editorProps.map((p) => ({ id: p.id, name: p.label }))
  }, [playProps, editorProps])

  // 仅使用后端运行时数据，不回退到编辑器的 locationLibrary
  // 如果后端 locations 为空，显示空状态而非默认场景
  const displayLocations = locations

  // 获取当前玩家位置（如果后端没提供，使用第一个地点或编辑器设置）
  const currentPlayerLocation = useMemo(() => {
    if (playerLocation) return playerLocation
    if (displayLocations.length > 0) return displayLocations[0].id
    return ''
  }, [playerLocation, displayLocations])

  // 获取某个位置的相邻地点
  const getAdjacentLocations = (locationId: string): string[] => {
    const loc = displayLocations.find((l) => l.id === locationId)
    if (!loc) return []
    // 递归获取所有可达位置（包括相邻的相邻）
    const visited = new Set<string>()
    const queue = [...(loc.adjacent || [])]
    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)
      const adjacentLoc = displayLocations.find((l) => l.id === current)
      if (adjacentLoc) {
        queue.push(...(adjacentLoc.adjacent || []))
      }
    }
    return Array.from(visited)
  }

  // 获取某地点的角色
  const getCharactersAtLocation = (locationId: string) => {
    const charIds = Object.entries(entityLocations)
      .filter(([, loc]) => loc === locationId)
      .map(([id]) => id)
    return characters.filter((c) => charIds.includes(c.id))
  }

  // 获取某地点的物品
  const getPropsAtLocation = (locationId: string) => {
    const propIds = Object.entries(entityLocations)
      .filter(([, loc]) => loc === locationId)
      .map(([id]) => id)
    return props.filter((p) => propIds.includes(p.id))
  }

  // 获取某地点的所有实体（包括角色和物品，基于ID前缀）
  const getAllEntitiesAtLocation = (locationId: string) => {
    const entitiesAtLoc: Array<{ id: string; name: string }> = []

    // 检查实体位置
    for (const [entityId, loc] of Object.entries(entityLocations)) {
      if (loc === locationId) {
        // 尝试在characters和props中查找
        const char = characters.find((c) => c.id === entityId)
        if (char) {
          entitiesAtLoc.push(char)
        } else {
          const prop = props.find((p) => p.id === entityId)
          if (prop) {
            entitiesAtLoc.push(prop)
          }
        }
      }
    }

    return entitiesAtLoc
  }

  // 过滤掉不在场景中的角色（基于entityLocations中是否有记录）
  const activeEntityIds = useMemo(() => new Set(Object.keys(entityLocations)), [entityLocations])

  if (displayLocations.length === 0) {
    return (
      <div style={{
        padding: '12px 14px',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{
          background: 'var(--text)',
          color: 'var(--bg-panel)',
          padding: '4px 10px',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: '10px',
        }}>
          LOCATIONS
        </div>
        <div style={{
          textAlign: 'center',
          padding: '20px 10px',
          color: 'var(--text-dim)',
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.5 }}>📍</div>
          <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
            暂无位置数据
          </div>
          <div style={{ fontSize: '11px', opacity: 0.7 }}>
            请在编辑器中配置场景位置
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      padding: '12px 14px',
      borderTop: '1px solid var(--border)',
    }}>
      {/* Panel Header */}
      <div style={{
        background: 'var(--text)',
        color: 'var(--bg-panel)',
        padding: '4px 10px',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        marginBottom: '10px',
      }}>
        LOCATIONS
      </div>

      {/* 当前位置指示 */}
      <div style={{
        fontSize: '11px',
        color: 'var(--text-dim)',
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#4caf50',
        }} />
        当前位置: {displayLocations.find((l) => l.id === currentPlayerLocation)?.label || '—'}
      </div>

      {/* 地点列表 */}
      <div style={{
        maxHeight: '280px',
        overflowY: 'auto',
      }}>
        {displayLocations.map((location) => {
          const isCurrentLocation = location.id === currentPlayerLocation
          const isAdjacent = getAdjacentLocations(currentPlayerLocation).includes(location.id) || isCurrentLocation
          const entitiesAtLoc = getAllEntitiesAtLocation(location.id)

          // 分离角色和物品
          const charsAtLoc = entitiesAtLoc.filter((e) =>
            characters.some((c) => c.id === e.id)
          )
          const propsAtLoc = entitiesAtLoc.filter((e) =>
            props.some((p) => p.id === e.id)
          )

          return (
            <LocationItem
              key={location.id}
              location={location}
              isCurrentLocation={isCurrentLocation}
              charactersAtLocation={charsAtLoc}
              propsAtLocation={propsAtLoc}
              onMove={() => !isLoading && moveToLocation(location.id)}
              isAdjacent={isAdjacent}
            />
          )
        })}
      </div>

      {/* 提示文字 */}
      <div style={{
        fontSize: '10px',
        color: 'var(--text-dim)',
        marginTop: '10px',
        textAlign: 'center',
      }}>
        点击相邻地点进行移动
      </div>
    </div>
  )
}
