import { useState, useCallback } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useStore, type StoreState } from '../../store/useStore'
import type {
  ActionEntry,
  ExpressionEntry,
  PropEntry,
  LocationEntry,
} from '../../types'
import ImageUpload from '../shared/ImageUpload'

type LibraryTab = 'actions' | 'expressions' | 'props' | 'locations'

// ── 新增项 ID 计数器（模块级，避免重置）──
let _idCounter = 0
const _nextId = (prefix: string) => `${prefix}_${Date.now()}_${_idCounter++}`

// ── 90s Library 输入框样式 ──
const libInputStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '2px solid',
  borderColor: '#808080 #ffffff #ffffff #808080',
  boxShadow: 'inset 1px 1px 0 #404040, inset -1px -1px 0 #dfdfdf',
  borderRadius: '0',
  color: '#000',
  fontSize: '11px',
  padding: '3px 6px',
  outline: 'none',
  width: '100%',
  fontFamily: '"MS Sans Serif", sans-serif',
}

export default function LibraryPanel() {
  const [activeTab, setActiveTab] = useState<LibraryTab>('actions')
  const inspectorWidth = useStore((s: StoreState) => s.inspectorWidth)

  const actionLibrary = useStore((s: StoreState) => s.actionLibrary)
  const expressionLibrary = useStore((s: StoreState) => s.expressionLibrary)
  const propLibrary = useStore((s: StoreState) => s.propLibrary)
  const locationLibrary = useStore((s: StoreState) => s.locationLibrary)
  
  const addAction = useStore((s: StoreState) => s.addAction)
  const updateAction = useStore((s: StoreState) => s.updateAction)
  const deleteAction = useStore((s: StoreState) => s.deleteAction)
  
  const addExpression = useStore((s: StoreState) => s.addExpression)
  const updateExpression = useStore((s: StoreState) => s.updateExpression)
  const deleteExpression = useStore((s: StoreState) => s.deleteExpression)
  
  const addProp = useStore((s: StoreState) => s.addProp)
  const updateProp = useStore((s: StoreState) => s.updateProp)
  const deleteProp = useStore((s: StoreState) => s.deleteProp)
  
  const addLocation = useStore((s: StoreState) => s.addLocation)
  const updateLocation = useStore((s: StoreState) => s.updateLocation)
  const deleteLocation = useStore((s: StoreState) => s.deleteLocation)

  // 位置编辑器需要的其他数据
  const characters = useStore((s: StoreState) => s.characters)
  const characterIds = characters.map(c => c.id)
  const propIds = propLibrary.map(p => p.id)

  // 新增动作
  const handleAddAction = useCallback(() => {
    addAction({
      id: _nextId('action'), label: '新动作', description: '', parameters: [],
    })
  }, [addAction])

  // 新增表情
  const handleAddExpression = useCallback(() => {
    addExpression({
      id: _nextId('expr'), label: '新表情', animation_name: '',
    })
  }, [addExpression])

  // 新增物品
  const handleAddProp = useCallback(() => {
    addProp({
      id: _nextId('prop'), label: '新物品',
    })
  }, [addProp])

  // 新增地点
  const handleAddLocation = useCallback(() => {
    addLocation({
      id: _nextId('loc'), label: '新地点', adjacent: [], description: '', characters: [], props: [],
    })
  }, [addLocation])

  const renderActions = () => (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleAddAction} style={{
          background: '#C0C0C0', border: '2px solid', borderColor: '#ffffff #808080 #808080 #ffffff',
          padding: '6px 12px', borderRadius: '0', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px'
        }}>
          <Plus size={16} />
          添加动作
        </button>
      </div>
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {actionLibrary.map((action: ActionEntry) => (
          <ActionItem
            key={action.id}
            action={action}
            onUpdate={updateAction}
            onDelete={deleteAction}
          />
        ))}
        {actionLibrary.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: '#808080', fontSize: '14px' }}>
            暂无动作，请点击右上角添加
          </div>
        )}
      </div>
    </div>
  )

  const renderExpressions = () => (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleAddExpression} style={{
          background: '#C0C0C0', border: '2px solid', borderColor: '#ffffff #808080 #808080 #ffffff',
          padding: '6px 12px', borderRadius: '0', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px'
        }}>
          <Plus size={16} />
          添加表情
        </button>
      </div>
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {expressionLibrary.map((expr: ExpressionEntry) => (
          <ExpressionItem
            key={expr.id}
            expression={expr}
            onUpdate={updateExpression}
            onDelete={deleteExpression}
          />
        ))}
        {expressionLibrary.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: '#808080', fontSize: '14px' }}>
            暂无表情，请点击右上角添加
          </div>
        )}
      </div>
    </div>
  )

  const renderProps = () => (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleAddProp} style={{
          background: '#C0C0C0', border: '2px solid', borderColor: '#ffffff #808080 #808080 #ffffff',
          padding: '6px 12px', borderRadius: '0', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px'
        }}>
          <Plus size={16} />
          添加物品
        </button>
      </div>
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {propLibrary.map((prop: PropEntry) => (
          <PropItem
            key={prop.id}
            prop={prop}
            onUpdate={updateProp}
            onDelete={deleteProp}
          />
        ))}
        {propLibrary.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: '#808080', fontSize: '14px' }}>
            暂无物品，请点击右上角添加
          </div>
        )}
      </div>
    </div>
  )

  const renderLocations = () => (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleAddLocation} style={{
          background: '#C0C0C0', border: '2px solid', borderColor: '#ffffff #808080 #808080 #ffffff',
          padding: '6px 12px', borderRadius: '0', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px'
        }}>
          <Plus size={16} />
          添加地点
        </button>
      </div>
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {locationLibrary.map((loc: LocationEntry) => (
          <LocationItem
            key={loc.id}
            location={loc}
            onUpdate={updateLocation}
            onDelete={deleteLocation}
            allLocations={locationLibrary}
            characterIds={characterIds}
            propIds={propIds}
          />
        ))}
        {locationLibrary.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: '#808080', fontSize: '14px' }}>
            暂无地点，请点击右上角添加
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="bevel-out" style={{
      width: inspectorWidth, flexShrink: 0,
      height: '100%', display: 'flex', flexDirection: 'column',
      background: '#C0C0C0',
    }}>
      <div className="panel-header">
        <h2 style={{ margin: 0, fontSize: '12px', fontWeight: 700 }}>资源库</h2>
      </div>
      
      <div style={{
        display: 'flex', padding: '4px 6px', gap: '3px',
        borderBottom: '2px solid #808080',
      }}>
        <TabButton active={activeTab === 'actions'} onClick={() => setActiveTab('actions')}>
          动作库
        </TabButton>
        <TabButton active={activeTab === 'expressions'} onClick={() => setActiveTab('expressions')}>
          表情库
        </TabButton>
        <TabButton active={activeTab === 'props'} onClick={() => setActiveTab('props')}>
          物品库
        </TabButton>
        <TabButton active={activeTab === 'locations'} onClick={() => setActiveTab('locations')}>
          地点库
        </TabButton>
      </div>

      {activeTab === 'actions' && renderActions()}
      {activeTab === 'expressions' && renderExpressions()}
      {activeTab === 'props' && renderProps()}
      {activeTab === 'locations' && renderLocations()}
    </div>
  )
}

// --- 子组件 ---

function TabButton({ children, active, onClick }: {
  children: React.ReactNode,
  active: boolean,
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={active ? 'bevel-in' : 'bevel-out'}
      style={{
        flex: 1, minWidth: 0,
        background: active ? '#ffffff' : '#C0C0C0',
        color: active ? '#000080' : '#000',
        padding: '4px 0',
        cursor: 'pointer',
        fontSize: '11px',
        fontWeight: 600,
        fontFamily: '"MS Sans Serif", sans-serif',
      }}
    >
      {children}
    </button>
  )
}

function ActionItem({
  action,
  onUpdate,
  onDelete,
}: {
  action: ActionEntry,
  onUpdate: (id: string, patch: Partial<ActionEntry>) => void,
  onDelete: (id: string) => void,
}) {
  return (
    <div className="bevel-out" style={{ background: '#C0C0C0', padding: '10px', marginBottom: '6px' }}>
      {/* 标题行 */}
      <div className="panel-header" style={{ margin: '-10px -10px 8px', padding: '4px 8px', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px' }}>动作</span>
        <button onClick={() => onDelete(action.id)}
          className="title-bar-btn" style={{ width: '16px', height: '14px', fontSize: '9px' }}
        >×</button>
      </div>

      {/* ID（LLM 命令名） */}
      <Field label="ID（LLM 命令名，如 walk_to）">
        <input value={action.id} onChange={(e) => onUpdate(action.id, { id: e.target.value })}
          placeholder="walk_to" style={libInputStyle} />
      </Field>

      {/* 名称 */}
      <Field label="名称">
        <input value={action.label} onChange={(e) => onUpdate(action.id, { label: e.target.value })}
          placeholder="动作名称" style={libInputStyle} />
      </Field>

      {/* 描述 */}
      <Field label="描述">
        <textarea value={action.description} onChange={(e) => onUpdate(action.id, { description: e.target.value })}
          rows={2} placeholder="描述这个动作" style={{ ...libInputStyle, resize: 'vertical' }} />
      </Field>

      {/* 参数 */}
      <Field label="参数（逗号分隔）">
        <input value={action.parameters.join(', ')}
          onChange={(e) => onUpdate(action.id, { parameters: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
          placeholder="param1, param2" style={libInputStyle} />
      </Field>
    </div>
  )
}

function ExpressionItem({
  expression,
  onUpdate,
  onDelete,
}: {
  expression: ExpressionEntry,
  onUpdate: (id: string, patch: Partial<ExpressionEntry>) => void,
  onDelete: (id: string) => void,
}) {
  return (
    <div className="bevel-out" style={{ background: '#C0C0C0', padding: '10px', marginBottom: '6px' }}>
      <div className="panel-header" style={{ margin: '-10px -10px 8px', padding: '4px 8px', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px' }}>表情</span>
        <button onClick={() => onDelete(expression.id)}
          className="title-bar-btn" style={{ width: '16px', height: '14px', fontSize: '9px' }}
        >×</button>
      </div>
      <Field label="ID（LLM 命令名，如 happy）">
        <input value={expression.id} onChange={(e) => onUpdate(expression.id, { id: e.target.value })}
          placeholder="happy" style={libInputStyle} />
      </Field>
      <Field label="名称">
        <input value={expression.label} onChange={(e) => onUpdate(expression.id, { label: e.target.value })}
          placeholder="表情名称" style={libInputStyle} />
      </Field>
      <Field label="动画名称">
        <input value={expression.animation_name} onChange={(e) => onUpdate(expression.id, { animation_name: e.target.value })}
          placeholder="animation_name" style={libInputStyle} />
      </Field>
    </div>
  )
}

function PropItem({
  prop,
  onUpdate,
  onDelete,
}: {
  prop: PropEntry,
  onUpdate: (id: string, patch: Partial<PropEntry>) => void,
  onDelete: (id: string) => void,
}) {
  return (
    <div className="bevel-out" style={{ background: '#C0C0C0', padding: '10px', marginBottom: '6px' }}>
      <div className="panel-header" style={{ margin: '-10px -10px 8px', padding: '4px 8px', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px' }}>物品</span>
        <button onClick={() => onDelete(prop.id)}
          className="title-bar-btn" style={{ width: '16px', height: '14px', fontSize: '9px' }}
        >×</button>
      </div>
      <Field label="ID（LLM 命令名，如 wine_glass）">
        <input value={prop.id} onChange={(e) => onUpdate(prop.id, { id: e.target.value })}
          placeholder="wine_glass" style={libInputStyle} />
      </Field>
      <Field label="名称">
        <input value={prop.label} onChange={(e) => onUpdate(prop.id, { label: e.target.value })}
          placeholder="物品名称" style={libInputStyle} />
      </Field>
    </div>
  )
}

function LocationItem({
  location,
  onUpdate,
  onDelete,
  allLocations,
  characterIds,
  propIds,
}: {
  location: LocationEntry,
  onUpdate: (id: string, patch: Partial<LocationEntry>) => void,
  onDelete: (id: string) => void,
  allLocations: LocationEntry[],
  characterIds: string[],
  propIds: string[],
}) {
  const toggleAdjacent = (lid: string) => {
    const current = location.adjacent || []
    const next = current.includes(lid) ? current.filter(x => x !== lid) : [...current, lid]
    onUpdate(location.id, { adjacent: next })
  }
  const toggleCharacters = (cid: string) => {
    const current = location.characters || []
    const next = current.includes(cid) ? current.filter(x => x !== cid) : [...current, cid]
    onUpdate(location.id, { characters: next })
  }
  const toggleProps = (pid: string) => {
    const current = location.props || []
    const next = current.includes(pid) ? current.filter(x => x !== pid) : [...current, pid]
    onUpdate(location.id, { props: next })
  }

  return (
    <div className="bevel-out" style={{ background: '#C0C0C0', padding: '10px', marginBottom: '6px' }}>
      <div className="panel-header" style={{ margin: '-10px -10px 8px', padding: '4px 8px', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px' }}>📍 地点</span>
        <button onClick={() => onDelete(location.id)}
          className="title-bar-btn" style={{ width: '16px', height: '14px', fontSize: '9px' }}
        >×</button>
      </div>

      {/* ID */}
      <Field label="ID（LLM 命令名，如 kitchen）">
        <input value={location.id} onChange={(e) => onUpdate(location.id, { id: e.target.value })}
          placeholder="kitchen" style={libInputStyle} />
      </Field>

      {/* 名称 */}
      <Field label="名称">
        <input value={location.label} onChange={(e) => onUpdate(location.id, { label: e.target.value })}
          placeholder="如：厨房" style={libInputStyle} />
      </Field>

      {/* 描述 */}
      <Field label="场景描述（叙事上下文）">
        <textarea value={location.description || ''}
          onChange={(e) => onUpdate(location.id, { description: e.target.value })}
          placeholder="如：干净整洁的开放式厨房，灶台上还放着今晚的食材"
          rows={2}
          style={{ ...libInputStyle, resize: 'vertical' }}
        />
      </Field>

      {/* 背景图 */}
      <Field label="场景背景图">
        <ImageUpload
          value={location.background_url}
          onChange={(url) => onUpdate(location.id, { background_url: url })}
          width={200} height={110}
          placeholder="上传背景图"
        />
      </Field>

      {/* 相邻地点 */}
      <Field label={`相邻地点（${(location.adjacent || []).length} 个）`}>
        <div className="bevel-in" style={{
          background: '#fff', maxHeight: 110, overflowY: 'auto',
          padding: '4px 6px', fontSize: '11px',
        }}>
          {allLocations.filter(l => l.id !== location.id).map(loc => (
            <label key={loc.id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '2px 0', cursor: 'pointer',
            }}>
              <input type="checkbox"
                checked={(location.adjacent || []).includes(loc.id)}
                onChange={() => toggleAdjacent(loc.id)}
                style={{ accentColor: '#000080' }}
              />
              <span>{loc.label}</span>
              <span style={{ color: '#808080', fontSize: 10, marginLeft: 'auto' }}>{loc.id}</span>
            </label>
          ))}
          {allLocations.length <= 1 && (
            <span style={{ color: '#808080', fontStyle: 'italic' }}>暂无其他地点可连接</span>
          )}
        </div>
      </Field>

      {/* 角色 */}
      <Field label={`可互动角色（${(location.characters || []).length} 个）`}>
        <div className="bevel-in" style={{
          background: '#fff', maxHeight: 90, overflowY: 'auto',
          padding: '4px 6px', fontSize: '11px',
        }}>
          {characterIds.length > 0 ? characterIds.map(cid => (
            <label key={cid} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '2px 0', cursor: 'pointer',
            }}>
              <input type="checkbox"
                checked={(location.characters || []).includes(cid)}
                onChange={() => toggleCharacters(cid)}
                style={{ accentColor: '#000080' }}
              />
              <span>{cid}</span>
            </label>
          )) : (
            <span style={{ color: '#808080', fontStyle: 'italic' }}>暂无可选角色</span>
          )}
        </div>
      </Field>

      {/* 物品 */}
      <Field label={`物品（${(location.props || []).length} 个）`}>
        <div className="bevel-in" style={{
          background: '#fff', maxHeight: 90, overflowY: 'auto',
          padding: '4px 6px', fontSize: '11px',
        }}>
          {propIds.length > 0 ? propIds.map(pid => (
            <label key={pid} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '2px 0', cursor: 'pointer',
            }}>
              <input type="checkbox"
                checked={(location.props || []).includes(pid)}
                onChange={() => toggleProps(pid)}
                style={{ accentColor: '#000080' }}
              />
              <span>{pid}</span>
            </label>
          )) : (
            <span style={{ color: '#808080', fontStyle: 'italic' }}>暂无可选物品</span>
          )}
        </div>
      </Field>
    </div>
  )
}

// ── 表单字段包装 ──
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ color: '#000', fontSize: '11px', fontWeight: 600, marginBottom: 2, fontFamily: '"MS Sans Serif",sans-serif' }}>
        {label}
      </div>
      {children}
    </div>
  )
}