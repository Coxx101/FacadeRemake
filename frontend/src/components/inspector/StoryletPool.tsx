import { useState } from 'react'
import { Pin } from 'lucide-react'
import type { Landmark, Storylet } from '../../types'
import { useStore } from '../../store/useStore'

const BLANK_STORYLET: Omit<Storylet, 'id'> = {
  title: '',
  phase_tags: [],
  narrative_goal: '',
  conditions: [],
  llm_trigger: undefined,
  content: {},
  effects: [],
  conditional_effects: [],
  repeatability: 'never',
  cooldown: undefined,
  sticky: false,
  priority_override: undefined,
  salience: { base: 5, modifiers: [] },
  choices_hint: [],
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
      borderTop: '1px solid #2e3250',
      background: '#131828',
      maxHeight: collapsed ? '44px' : '280px',
      transition: 'max-height 0.2s ease',
      overflow: 'hidden',
    }}>
      {/* 头部 */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', cursor: 'pointer', userSelect: 'none',
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#4a5070', fontSize: '12px', transition: 'transform 0.2s', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)' }}>▼</span>
          <span style={{ color: '#8891b0', fontSize: '12px', fontWeight: 600 }}>
            Storylet Pool
          </span>
          <span style={{
            background: '#1e2a4a', color: '#4f6ef7', fontSize: '10px',
            padding: '1px 6px', borderRadius: '3px', fontWeight: 700,
          }}>
            {poolStorylets.length}
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); createNew() }}
          style={{
            padding: '3px 10px', background: '#1e2a4a',
            border: '1px solid #2e3a60', borderRadius: '5px',
            color: '#4f6ef7', fontSize: '11px', cursor: 'pointer',
          }}
        >
          + 新建
        </button>
      </div>

      {/* 卡片列表 */}
      {!collapsed && (
        <div style={{ overflow: 'auto', maxHeight: '230px', padding: '0 10px 10px' }}>
          {poolStorylets.length === 0 ? (
            <div style={{
              textAlign: 'center', color: '#4a5070', fontSize: '12px',
              padding: '20px', border: '1px dashed #2e3250', borderRadius: '6px',
            }}>
              此阶段暂无 Storylet<br />
              <span style={{ color: '#4f6ef7', cursor: 'pointer' }} onClick={createNew}>点击新建</span>
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

  const condCount = storylet.conditions.length + (storylet.llm_trigger ? 1 : 0)

  return (
    <div style={{
      background: '#1a1d27', border: '1px solid #2e3250',
      borderRadius: '7px', padding: '9px 11px',
      display: 'flex', flexDirection: 'column', gap: '5px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
          {storylet.sticky && (
            <span title="sticky"><Pin size={11} color="#f5a623" /></span>
          )}
          <span style={{
            color: '#e8eaf0', fontSize: '12px', fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {storylet.title || storylet.id}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button onClick={onEdit} style={cardBtn('#4f6ef7')}>编辑</button>
          {confirmDelete ? (
            <>
              <button
                onClick={() => { onDelete(); setConfirmDelete(false) }}
                style={cardBtn('#e74c3c')}
              >确认</button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={cardBtn('#4a5070')}
              >取消</button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)} style={cardBtn('#e74c3c', 0.6)}>删</button>
          )}
        </div>
      </div>

      {storylet.narrative_goal && (
        <div style={{
          color: '#8891b0', fontSize: '11px', lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {storylet.narrative_goal}
        </div>
      )}

      {/* 徽章行 */}
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
        <Badge color="#4f6ef7" label={`base ${storylet.salience.base}`} />
        {condCount > 0 && <Badge color="#f1c40f" label={`cond ${condCount}`} />}
        {storylet.llm_trigger && <Badge color="#2ecc71" label="llm_trigger" />}
        {storylet.repeatability !== 'never' && <Badge color="#e67e22" label={storylet.repeatability} />}
      </div>
    </div>
  )
}

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span style={{
      background: `${color}18`, color, fontSize: '10px',
      padding: '1px 5px', borderRadius: '3px', fontWeight: 600,
    }}>
      {label}
    </span>
  )
}

function cardBtn(color: string, opacity = 1): React.CSSProperties {
  return {
    padding: '2px 8px',
    background: `${color}15`, border: `1px solid ${color}40`,
    borderRadius: '4px', color: color, fontSize: '11px',
    cursor: 'pointer', opacity,
  }
}
