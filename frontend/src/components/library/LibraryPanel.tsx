import { useState, useCallback } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useStore, type StoreState } from '../../store/useStore'
import type {
  ActionEntry,
  ExpressionEntry,
  PropEntry,
  LocationEntry,
} from '../../types'

type LibraryTab = 'actions' | 'expressions' | 'props' | 'locations'

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

  // 新增动作
  const handleAddAction = useCallback(() => {
    const id = `action_${Date.now()}`
    addAction({
      id,
      label: '新动作',
      description: '',
      parameters: [],
    })
  }, [addAction])

  // 新增表情
  const handleAddExpression = useCallback(() => {
    const id = `expr_${Date.now()}`
    addExpression({
      id,
      label: '新表情',
      animation_name: '',
    })
  }, [addExpression])

  // 新增物品
  const handleAddProp = useCallback(() => {
    const id = `prop_${Date.now()}`
    addProp({
      id,
      label: '新物品',
    })
  }, [addProp])

  // 新增地点
  const handleAddLocation = useCallback(() => {
    const id = `loc_${Date.now()}`
    addLocation({
      id,
      label: '新地点',
      adjacent: [],
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
        <span style={{ fontSize: '11px' }}>动作 · {action.id}</span>
        <button onClick={() => onDelete(action.id)}
          className="title-bar-btn" style={{ width: '16px', height: '14px', fontSize: '9px' }}
        >×</button>
      </div>

      {/* 名称 */}
      <div style={{ marginBottom: '6px' }}>
        <div style={{ color: '#000', fontSize: '11px', fontWeight: 600, marginBottom: '2px', fontFamily: '"MS Sans Serif",sans-serif' }}>名称</div>
        <input value={action.label} onChange={(e) => onUpdate(action.id, { label: e.target.value })}
          placeholder="动作名称"
          style={libInputStyle}
        />
      </div>

      {/* 描述 */}
      <div style={{ marginBottom: '6px' }}>
        <div style={{ color: '#000', fontSize: '11px', fontWeight: 600, marginBottom: '2px', fontFamily: '"MS Sans Serif",sans-serif' }}>描述</div>
        <textarea value={action.description} onChange={(e) => onUpdate(action.id, { description: e.target.value })}
          rows={2} placeholder="描述这个动作"
          style={{ ...libInputStyle, resize: 'vertical' }}
        />
      </div>

      {/* 参数 */}
      <div>
        <div style={{ color: '#000', fontSize: '11px', fontWeight: 600, marginBottom: '2px', fontFamily: '"MS Sans Serif",sans-serif' }}>参数（逗号分隔）</div>
        <input value={action.parameters.join(', ')}
          onChange={(e) => onUpdate(action.id, { parameters: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
          placeholder="param1, param2"
          style={libInputStyle}
        />
      </div>
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
        <span style={{ fontSize: '11px' }}>表情 · {expression.id}</span>
        <button onClick={() => onDelete(expression.id)}
          className="title-bar-btn" style={{ width: '16px', height: '14px', fontSize: '9px' }}
        >×</button>
      </div>
      <div style={{ marginBottom: '6px' }}>
        <div style={{ color: '#000', fontSize: '11px', fontWeight: 600, marginBottom: '2px', fontFamily: '"MS Sans Serif",sans-serif' }}>名称</div>
        <input value={expression.label} onChange={(e) => onUpdate(expression.id, { label: e.target.value })}
          placeholder="表情名称" style={libInputStyle} />
      </div>
      <div>
        <div style={{ color: '#000', fontSize: '11px', fontWeight: 600, marginBottom: '2px', fontFamily: '"MS Sans Serif",sans-serif' }}>动画名称</div>
        <input value={expression.animation_name} onChange={(e) => onUpdate(expression.id, { animation_name: e.target.value })}
          placeholder="animation_name" style={libInputStyle} />
      </div>
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
        <span style={{ fontSize: '11px' }}>物品 · {prop.id}</span>
        <button onClick={() => onDelete(prop.id)}
          className="title-bar-btn" style={{ width: '16px', height: '14px', fontSize: '9px' }}
        >×</button>
      </div>
      <div>
        <div style={{ color: '#000', fontSize: '11px', fontWeight: 600, marginBottom: '2px', fontFamily: '"MS Sans Serif",sans-serif' }}>名称</div>
        <input value={prop.label} onChange={(e) => onUpdate(prop.id, { label: e.target.value })}
          placeholder="物品名称" style={libInputStyle} />
      </div>
    </div>
  )
}

function LocationItem({
  location,
  onUpdate,
  onDelete,
}: {
  location: LocationEntry,
  onUpdate: (id: string, patch: Partial<LocationEntry>) => void,
  onDelete: (id: string) => void,
}) {
  return (
    <div className="bevel-out" style={{ background: '#C0C0C0', padding: '10px', marginBottom: '6px' }}>
      <div className="panel-header" style={{ margin: '-10px -10px 8px', padding: '4px 8px', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px' }}>地点 · {location.id}</span>
        <button onClick={() => onDelete(location.id)}
          className="title-bar-btn" style={{ width: '16px', height: '14px', fontSize: '9px' }}
        >×</button>
      </div>
      <div style={{ marginBottom: '6px' }}>
        <div style={{ color: '#000', fontSize: '11px', fontWeight: 600, marginBottom: '2px', fontFamily: '"MS Sans Serif",sans-serif' }}>名称</div>
        <input value={location.label} onChange={(e) => onUpdate(location.id, { label: e.target.value })}
          placeholder="地点名称" style={libInputStyle} />
      </div>
      <div>
        <div style={{ color: '#000', fontSize: '11px', fontWeight: 600, marginBottom: '2px', fontFamily: '"MS Sans Serif",sans-serif' }}>相邻地点（逗号分隔）</div>
        <input value={(location.adjacent || []).join(', ')}
          onChange={(e) => onUpdate(location.id, { adjacent: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
          placeholder="living_room, kitchen" style={libInputStyle} />
      </div>
    </div>
  )
}