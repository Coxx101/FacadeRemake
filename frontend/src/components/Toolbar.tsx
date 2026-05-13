import { useEffect, useCallback } from 'react'
import {
  Plus, Trash2, Undo2, Redo2, FolderOpen, Save, Gamepad2,
  LayoutDashboard, Users, Wrench, AlertTriangle, Globe, Package,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { useProjectStore } from '../store/useProjectStore'
import type { Landmark } from '../types'
import type { StoreState } from '../store/useStore'

function generateId(prefix: string, existing: string[]): string {
  let n = existing.length + 1
  while (existing.includes(`${prefix}${n}`)) n++
  return `${prefix}${n}`
}

export default function Toolbar() {
  const mode = useStore((s: StoreState) => s.mode)
  const setMode = useStore((s: StoreState) => s.setMode)
  const isDirty = useStore((s: StoreState) => s.isDirty)
  const landmarks = useStore((s: StoreState) => s.landmarks)
  const storylets = useStore((s: StoreState) => s.storylets)
  const addLandmark = useStore((s: StoreState) => s.addLandmark)
  const deleteLandmark = useStore((s: StoreState) => s.deleteLandmark)
  const selectedLandmarkId = useStore((s: StoreState) => s.selectedLandmarkId)
  const loadFromJSON = useStore((s: StoreState) => s.loadFromJSON)
  const markClean = useStore((s: StoreState) => s.markClean)

  // 新建 Landmark
  const handleAddLandmark = () => {
    const id = generateId('lm', landmarks.map((l: Landmark) => l.id))
    const nonEnding = landmarks.filter((l: Landmark) => !l.is_ending)
    const newLandmark: Landmark = {
      id,
      title: `新节点 — ${id}`,
      description: '',
      phase_tag: id,
      is_ending: false,
      ending_content: '',
      transitions: [], narrative_constraints: { forbidden_reveals: [] },
      fallback_storylet: undefined,
      position: { x: 120 + nonEnding.length * 280, y: 220 },
    }
    addLandmark(newLandmark)
  }

  const handleSave = () => {
    const sharedContext = useStore.getState().sharedContext
    const chars = useStore.getState().characters
    const wsd = useStore.getState().worldStateDefinition
    const currentProjectId = useStore.getState().currentProjectId
    const actionLibrary = useStore.getState().actionLibrary
    const expressionLibrary = useStore.getState().expressionLibrary
    const propLibrary = useStore.getState().propLibrary
    const locationLibrary = useStore.getState().locationLibrary
    const data = {
      landmarks: landmarks.map(({ position: _pos, ...rest }: Landmark) => rest),
      landmarks_layout: landmarks.map((l: Landmark) => ({ id: l.id, position: l.position })),
      storylets,
      characters: chars,
      shared_context: sharedContext,
      world_state_definition: wsd,
      action_library: actionLibrary,
      expression_library: expressionLibrary,
      prop_library: propLibrary,
      location_library: locationLibrary,
    }
    // 下载 JSON 文件
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'facade_data.json'; a.click()
    URL.revokeObjectURL(url)
    markClean()
    // 同步到 localStorage 项目快照
    if (currentProjectId) {
      useProjectStore.getState().saveProjectSnapshot(currentProjectId, {
        landmarks,
        storylets,
        characters: chars,
        sharedContext,
        worldStateDefinition: wsd,
        actionLibrary,
        expressionLibrary,
        propLibrary,
        locationLibrary,
      })
    }
  }

  const handleLoad = () => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string)
          const layout: Array<{ id: string; position: { x: number; y: number } }> =
            data.landmarks_layout ?? []
          const lms: Landmark[] = (data.landmarks ?? []).map((l: Landmark) => {
            const pos = layout.find((p) => p.id === l.id)?.position
            return pos ? { ...l, position: pos } : l
          })
          loadFromJSON(lms, data.storylets ?? [], data.characters, data.shared_context, data.world_state_definition)
        } catch {
          alert('JSON 文件解析失败，请检查格式')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleDeleteSelected = () => {
    if (!selectedLandmarkId) return
    const lm = landmarks.find((l) => l.id === selectedLandmarkId)
    if (!lm) return
    const name = lm.title || lm.id
    if (window.confirm(`确认删除「${name}」？\n\n该节点的所有出边也将被移除。`)) {
      deleteLandmark(selectedLandmarkId)
    }
  }

  const handleExportUnity = () => {
    const unityData = {
      _comment: 'FacadeRemake Unity 导入数据',
      landmarks: landmarks.map(({ position: _p, ...rest }: Landmark) => rest),
      storylets,
    }
    const blob = new Blob([JSON.stringify(unityData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'facade_unity_export.json'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── 右侧面板切换 ──
  const rightPanel = useStore((s: StoreState) => s.rightPanel)
  const setRightPanel = useStore((s: StoreState) => s.setRightPanel)
  const characters = useStore((s: StoreState) => s.characters)
  const wsd = useStore((s: StoreState) => s.worldStateDefinition)
  const actionLibrary = useStore((s: StoreState) => s.actionLibrary)
  const expressionLibrary = useStore((s: StoreState) => s.expressionLibrary)
  const propLibrary = useStore((s: StoreState) => s.propLibrary)
  const locationLibrary = useStore((s: StoreState) => s.locationLibrary)

  // ── 撤销 / 重做 ──
  const _undoCount = useStore((s: StoreState) => s._undoCount)
  const _redoCount = useStore((s: StoreState) => s._redoCount)

  const handleUndo = useCallback(() => useStore.getState().undo(), [])
  const handleRedo = useCallback(() => useStore.getState().redo(), [])

  // Ctrl+Z / Ctrl+Shift+Z 快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useStore.getState().undo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        useStore.getState().redo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        useStore.getState().redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <header
      className="title-bar"
      style={{
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 6px',
        gap: '12px',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px' }}>
        <button
          onClick={() => setMode('home')}
          title="返回首页"
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'transparent', border: 'none',
            cursor: 'pointer', padding: '0',
            fontFamily: '"MS Sans Serif", "Arial Black", sans-serif',
            fontSize: '15px', fontWeight: 700,
          }}
        >
          <LayoutDashboard size={16} color="#ffffff" strokeWidth={2.2} />
          <span style={{ color: '#fff', letterSpacing: '0.05em' }}>
            Facade<span style={{ color: '#FFFF00' }}>Studio</span>
          </span>
        </button>
      </div>

      <div className="bevel-out" style={{ display: 'flex', overflow: 'hidden', padding: '1px' }}>
        {(['design', 'play'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: '2px 14px',
            background: mode === m ? '#000080' : '#C0C0C0',
            border: 'none',
            color: mode === m ? '#fff' : '#000',
            fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '4px',
            fontFamily: '"MS Sans Serif", sans-serif',
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.borderStyle = 'inset'
            e.currentTarget.style.borderColor = '#808080 #ffffff #ffffff #808080'
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.borderStyle = 'outset'
            e.currentTarget.style.borderColor = '#ffffff #808080 #808080 #ffffff'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderStyle = 'outset'
            e.currentTarget.style.borderColor = '#ffffff #808080 #808080 #ffffff'
          }}
        >
            {m === 'design' ? <Wrench size={12} /> : <Gamepad2 size={12} />}
            {m === 'design' ? 'Design' : 'Play'}
          </button>
        ))}
      </div>

      {mode === 'design' && (
        <>
          <div className="bevel-in" style={{ width: '1px', height: '24px', margin: '0 4px' }} />
          <ToolButton icon={<Plus size={14} />} label="新建 Landmark" onClick={handleAddLandmark} color="#0000FF" />
          <ToolButton icon={<Trash2 size={14} />} label="删除选中节点" onClick={handleDeleteSelected} color="#FF0000"
            disabled={!selectedLandmarkId} />
          <div className="bevel-in" style={{ width: '1px', height: '24px', margin: '0 4px' }} />
          <ToolButton icon={<Undo2 size={14} />} label="撤销 (Ctrl+Z)" onClick={handleUndo} color="#444444"
            disabled={_undoCount === 0} />
          <ToolButton icon={<Redo2 size={14} />} label="重做 (Ctrl+Shift+Z)" onClick={handleRedo} color="#444444"
            disabled={_redoCount === 0} />
          <div className="bevel-in" style={{ width: '1px', height: '24px', margin: '0 4px' }} />
          <div className="bevel-out" style={{ display: 'flex', overflow: 'hidden', padding: '1px' }}>
            <button onClick={() => setRightPanel('inspector')} style={{
              padding: '2px 10px',
              background: rightPanel === 'inspector' ? '#0000FF' : '#C0C0C0',
              border: 'none',
              color: rightPanel === 'inspector' ? '#fff' : '#000',
              fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              fontFamily: '"MS Sans Serif", sans-serif',
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.borderStyle = 'inset'
              e.currentTarget.style.borderColor = '#808080 #ffffff #ffffff #808080'
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.borderStyle = 'outset'
              e.currentTarget.style.borderColor = '#ffffff #808080 #808080 #ffffff'
            }}
          ><LayoutDashboard size={12} /> 蓝图</button>
            <button onClick={() => setRightPanel('characters')} style={{
              padding: '2px 10px',
              background: rightPanel === 'characters' ? '#FF0000' : '#C0C0C0',
              border: 'none',
              color: rightPanel === 'characters' ? '#fff' : '#000',
              fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              fontFamily: '"MS Sans Serif", sans-serif',
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.borderStyle = 'inset'
              e.currentTarget.style.borderColor = '#808080 #ffffff #ffffff #808080'
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.borderStyle = 'outset'
              e.currentTarget.style.borderColor = '#ffffff #808080 #808080 #ffffff'
            }}
          ><Users size={12} /> 角色</button>
            <button onClick={() => setRightPanel('worldstate')} style={{
              padding: '2px 10px',
              background: rightPanel === 'worldstate' ? '#FFFF00' : '#C0C0C0',
              border: 'none',
              color: rightPanel === 'worldstate' ? '#000' : '#000',
              fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              fontFamily: '"MS Sans Serif", sans-serif',
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.borderStyle = 'inset'
              e.currentTarget.style.borderColor = '#808080 #ffffff #ffffff #808080'
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.borderStyle = 'outset'
              e.currentTarget.style.borderColor = '#ffffff #808080 #808080 #ffffff'
            }}
          ><Globe size={12} /> 变量</button>
            <button onClick={() => setRightPanel('library')} style={{
              padding: '2px 10px',
              background: rightPanel === 'library' ? '#00AA00' : '#C0C0C0',
              border: 'none',
              color: rightPanel === 'library' ? '#fff' : '#000',
              fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              fontFamily: '"MS Sans Serif", sans-serif',
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.borderStyle = 'inset'
              e.currentTarget.style.borderColor = '#808080 #ffffff #ffffff #808080'
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.borderStyle = 'outset'
              e.currentTarget.style.borderColor = '#ffffff #808080 #808080 #ffffff'
            }}
          ><Package size={12} /> 资源库</button>
          </div>
          <div className="bevel-in" style={{ width: '1px', height: '24px', margin: '0 4px' }} />
          <ToolButton icon={<FolderOpen size={14} />} label="导入 JSON" onClick={handleLoad} color="#8891b0" />
          <ToolButton icon={<Save size={14} />} label={isDirty ? '保存 JSON（有修改）' : '保存 JSON'} onClick={handleSave} color={isDirty ? '#2ecc71' : '#8891b0'} />
          {isDirty && <AlertTriangle size={14} color="#2ecc71" style={{ marginLeft: '-6px' }} title="有未保存的修改" />}
          <ToolButton icon={<Gamepad2 size={14} />} label="导出 Unity" onClick={handleExportUnity} color="#9b59b6" />
        </>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ color: '#4a5070', fontSize: '11px' }}>
          {landmarks.length} 节点 · {storylets.length} storylets · {characters.length} 角色 · {wsd.qualities.length + wsd.flags.length + wsd.relationships.length} 变量 · {actionLibrary.length + expressionLibrary.length + propLibrary.length + locationLibrary.length} 资源
        </span>
        {isDirty && (
          <span style={{ background: 'rgba(46,204,113,0.15)', color: '#2ecc71', fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
            未保存
          </span>
        )}
      </div>
    </header>
  )
}

function ToolButton({ icon, label, onClick, color, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; color: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={disabled ? 'bevel-out' : 'bevel-out'}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '3px 10px',
        background: disabled ? '#C0C0C0' : '#C0C0C0',
        border: '2px solid',
        borderColor: disabled ? '#ffffff #808080 #808080 #ffffff' : '#ffffff #808080 #808080 #ffffff',
        color: disabled ? '#808080' : color,
        fontSize: '11px', fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: '"MS Sans Serif", sans-serif',
        userSelect: 'none',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseDown={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = '#808080 #ffffff #ffffff #808080'
          e.currentTarget.style.transform = 'translate(1px, 1px)'
        }
      }}
      onMouseUp={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = '#ffffff #808080 #808080 #ffffff'
          e.currentTarget.style.transform = 'translate(0, 0)'
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = '#ffffff #808080 #808080 #ffffff'
          e.currentTarget.style.transform = 'translate(0, 0)'
        }
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
