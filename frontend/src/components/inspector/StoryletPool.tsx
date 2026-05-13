import { useState } from 'react'
import { Pin } from 'lucide-react'
import type { Landmark, Storylet } from '../../types'
import { useStore } from '../../store/useStore'

const BLANK_STORYLET: Omit<Storylet, 'id'> = {
  title: '',
  phase_tags: [],
  narrative_goal: '',
  conditions: [],
  content: {},
  effects: [],
  conditional_effects: [],
  repeatability: 'never',
  cooldown: undefined,
  sticky: false,
  priority_override: undefined,
  salience: { base: 5, modifiers: [] },
  on_interrupt: 'pause',
  completion_trigger: undefined,
  force_wrap_up: undefined,
}

export default function StoryletPool({ landmark }: { landmark: Landmark }) {
  const [collapsed, setCollapsed] = useState(false)
  const storylets = useStore((s) => s.storylets)
  const openStoryletModal = useStore((s) => s.openStoryletModal)
  const deleteStorylet = useStore((s) => s.deleteStorylet)
  const saveStorylet = useStore((s) => s.saveStorylet)

  const poolStorylets = storylets.filter((sl) =>
    sl.phase_tags.includes(landmark.phase_tag)
  )

  const createNew = () => {
    const id = `sl_${landmark.phase_tag}_${Date.now()}`
    const newSl: Storylet = {
      ...BLANK_STORYLET,
      id,
      phase_tags: [landmark.phase_tag],
    }
    saveStorylet(newSl)
    openStoryletModal(id)
  }

  return (
    <div style={{
      borderTop: '2px solid #808080',
      background: '#C0C0C0',
      maxHeight: collapsed ? '40px' : '280px',
      transition: 'max-height 0.2s ease',
      overflow: 'hidden',
    }}>
      {/* 头部 */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px', cursor: 'pointer', userSelect: 'none',
          fontFamily: '"MS Sans Serif", sans-serif',
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#000', fontSize: '12px', transition: 'transform 0.2s', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)' }}>▼</span>
          <span style={{ color: '#000', fontSize: '12px', fontWeight: 600 }}>
            Storylet Pool
          </span>
          <span className="bevel-out" style={{
            background: '#d0d0ff', color: '#000080', fontSize: '10px',
            padding: '1px 6px', fontWeight: 700,
          }}>
            {poolStorylets.length}
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); createNew() }}
          className="bevel-out"
          style={{
            padding: '2px 8px', background: '#C0C0C0',
            color: '#0000FF', fontSize: '11px', cursor: 'pointer',
          }}
        >
          + 新建
        </button>
      </div>

      {/* 卡片列表 */}
      {!collapsed && (
        <div style={{ overflow: 'auto', maxHeight: '230px', padding: '0 8px 8px' }}>
          {poolStorylets.length === 0 ? (
            <div className="bevel-out" style={{
              textAlign: 'center', color: '#808080', fontSize: '12px',
              padding: '16px', background: '#d0d0d0',
            }}>
              此阶段暂无 Storylet<br />
              <span style={{ color: '#0000FF', cursor: 'pointer', textDecoration: 'underline' }} onClick={createNew}>点击新建</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {poolStorylets.map((sl) => (
                <StoryletCard
                  key={sl.id}
                  storylet={sl}
                  onEdit={() => openStoryletModal(sl.id)}
                  onDelete={() => deleteStorylet(sl.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StoryletCard({
  storylet,
  onEdit,
  onDelete,
}: {
  storylet: Storylet
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const condCount = storylet.conditions.length

  return (
    <div className="bevel-out" style={{
      background: '#C0C0C0',
      padding: '8px 10px',
      display: 'flex', flexDirection: 'column', gap: '5px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
          {storylet.sticky && (
            <span title="sticky"><Pin size={11} color="#800080" /></span>
          )}
          <span style={{
            color: '#000', fontSize: '12px', fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontFamily: '"MS Sans Serif", sans-serif',
          }}>
            {storylet.title || storylet.id}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button onClick={onEdit} style={cardBtn('#0000FF')}>编辑</button>
          {confirmDelete ? (
            <>
              <button
                onClick={() => { onDelete(); setConfirmDelete(false) }}
                style={cardBtn('#FF0000')}
              >确认</button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={cardBtn('#808080')}
              >取消</button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)} style={cardBtn('#FF0000', 0.6)}>删</button>
          )}
        </div>
      </div>

      {storylet.narrative_goal && (
        <div style={{
          color: '#444', fontSize: '11px', lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {storylet.narrative_goal}
        </div>
      )}

      {/* 徽章行 */}
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
        <Badge color="#0000FF" label={`base ${storylet.salience.base}`} />
        {condCount > 0 && <Badge color="#FF8000" label={`cond ${condCount}`} />}
        {storylet.repeatability !== 'never' && <Badge color="#FF8000" label={storylet.repeatability} />}
      </div>
    </div>
  )
}

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span className="bevel-out" style={{
      background: '#C0C0C0', color, fontSize: '10px',
      padding: '1px 5px', fontWeight: 600,
    }}>
      {label}
    </span>
  )
}

function cardBtn(color: string, opacity = 1): React.CSSProperties {
  return {
    padding: '2px 6px',
    background: '#C0C0C0', border: '2px solid',
    borderColor: '#ffffff #808080 #808080 #ffffff',
    color: color, fontSize: '11px',
    cursor: 'pointer', opacity,
    fontFamily: '"MS Sans Serif", sans-serif',
  }
}
