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

export default function LibraryPanel() {
  const [activeTab, setActiveTab] = useState<LibraryTab>('actions')
  
  // 状态和操作
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
          background: '#45475a', color: '#cdd6f4', border: 'none',
          padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
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
          <div style={{ padding: '32px', textAlign: 'center', color: '#6c7086', fontSize: '14px' }}>
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
          background: '#45475a', color: '#cdd6f4', border: 'none',
          padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
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
          <div style={{ padding: '32px', textAlign: 'center', color: '#6c7086', fontSize: '14px' }}>
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
          background: '#45475a', color: '#cdd6f4', border: 'none',
          padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
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
          <div style={{ padding: '32px', textAlign: 'center', color: '#6c7086', fontSize: '14px' }}>
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
          background: '#45475a', color: '#cdd6f4', border: 'none',
          padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
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
          <div style={{ padding: '32px', textAlign: 'center', color: '#6c7086', fontSize: '14px' }}>
            暂无地点，请点击右上角添加
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: '#1e1e2e', color: '#cdd6f4',
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #313244' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>资源库</h2>
      </div>
      
      <div style={{
        display: 'flex', gap: '4px', padding: '12px 16px',
        background: '#181825', borderBottom: '1px solid #313244'
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
      style={{
        background: active ? '#4f6ef7' : 'transparent',
        color: active ? '#fff' : '#a6adc8',
        border: 'none',
        padding: '6px 12px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 500,
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
    <div style={{ background: '#313244', borderRadius: '8px', padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <input
          value={action.label}
          onChange={(e) => onUpdate(action.id, { label: e.target.value })}
          placeholder="动作名称"
          style={{
            background: '#181825', border: '1px solid #313244',
            color: '#cdd6f4', borderRadius: '6px', padding: '8px 10px',
            width: '100%', fontSize: '13px'
          }}
        />
        <button onClick={() => onDelete(action.id)} style={{
          background: '#f38ba833', color: '#f38ba8', border: 'none',
          padding: '4px 8px', borderRadius: '4px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px'
        }}>
          <Trash2 size={14} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', color: '#a6adc8', marginBottom: '4px' }}>描述</div>
        <textarea
          value={action.description}
          onChange={(e) => onUpdate(action.id, { description: e.target.value })}
          placeholder="描述这个动作"
          rows={2}
          style={{
            background: '#181825', border: '1px solid #313244',
            color: '#cdd6f4', borderRadius: '6px', padding: '8px 10px',
            width: '100%', fontSize: '13px', resize: 'vertical'
          }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontSize: '12px', color: '#a6adc8', marginBottom: '4px' }}>参数（用逗号分隔）</div>
        <input
          value={action.parameters.join(', ')}
          onChange={(e) => onUpdate(action.id, { parameters: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
          placeholder="param1, param2"
          style={{
            background: '#181825', border: '1px solid #313244',
            color: '#cdd6f4', borderRadius: '6px', padding: '8px 10px',
            width: '100%', fontSize: '13px'
          }}
        />
      </div>
      <div style={{ fontSize: '12px', color: '#6c7086', marginTop: '8px' }}>ID: {action.id}</div>
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
    <div style={{ background: '#313244', borderRadius: '8px', padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <input
          value={expression.label}
          onChange={(e) => onUpdate(expression.id, { label: e.target.value })}
          placeholder="表情名称"
          style={{
            background: '#181825', border: '1px solid #313244',
            color: '#cdd6f4', borderRadius: '6px', padding: '8px 10px',
            width: '100%', fontSize: '13px'
          }}
        />
        <button onClick={() => onDelete(expression.id)} style={{
          background: '#f38ba833', color: '#f38ba8', border: 'none',
          padding: '4px 8px', borderRadius: '4px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px'
        }}>
          <Trash2 size={14} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontSize: '12px', color: '#a6adc8', marginBottom: '4px' }}>动画名称</div>
        <input
          value={expression.animation_name}
          onChange={(e) => onUpdate(expression.id, { animation_name: e.target.value })}
          placeholder="animation_name"
          style={{
            background: '#181825', border: '1px solid #313244',
            color: '#cdd6f4', borderRadius: '6px', padding: '8px 10px',
            width: '100%', fontSize: '13px'
          }}
        />
      </div>
      <div style={{ fontSize: '12px', color: '#6c7086', marginTop: '8px' }}>ID: {expression.id}</div>
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
    <div style={{ background: '#313244', borderRadius: '8px', padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <input
          value={prop.label}
          onChange={(e) => onUpdate(prop.id, { label: e.target.value })}
          placeholder="物品名称"
          style={{
            background: '#181825', border: '1px solid #313244',
            color: '#cdd6f4', borderRadius: '6px', padding: '8px 10px',
            width: '100%', fontSize: '13px'
          }}
        />
        <button onClick={() => onDelete(prop.id)} style={{
          background: '#f38ba833', color: '#f38ba8', border: 'none',
          padding: '4px 8px', borderRadius: '4px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px'
        }}>
          <Trash2 size={14} />
        </button>
      </div>
      <div style={{ fontSize: '12px', color: '#6c7086', marginTop: '8px' }}>ID: {prop.id}</div>
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
    <div style={{ background: '#313244', borderRadius: '8px', padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <input
          value={location.label}
          onChange={(e) => onUpdate(location.id, { label: e.target.value })}
          placeholder="地点名称"
          style={{
            background: '#181825', border: '1px solid #313244',
            color: '#cdd6f4', borderRadius: '6px', padding: '8px 10px',
            width: '100%', fontSize: '13px'
          }}
        />
        <button onClick={() => onDelete(location.id)} style={{
          background: '#f38ba833', color: '#f38ba8', border: 'none',
          padding: '4px 8px', borderRadius: '4px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px'
        }}>
          <Trash2 size={14} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontSize: '12px', color: '#a6adc8', marginBottom: '4px' }}>相邻地点（用逗号分隔）</div>
        <input
          value={(location.adjacent || []).join(', ')}
          onChange={(e) => onUpdate(location.id, { adjacent: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
          placeholder="living_room, kitchen"
          style={{
            background: '#181825', border: '1px solid #313244',
            color: '#cdd6f4', borderRadius: '6px', padding: '8px 10px',
            width: '100%', fontSize: '13px'
          }}
        />
      </div>
      <div style={{ fontSize: '12px', color: '#6c7086', marginTop: '8px' }}>ID: {location.id}</div>
    </div>
  )
}