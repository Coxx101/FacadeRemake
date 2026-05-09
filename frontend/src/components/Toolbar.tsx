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
      transitions: [],
      max_storylets: 5,
      narrative_constraints: { allowed_storylet_tags: [id], forbidden_reveals: [] },
      world_state_effects_on_enter: [],
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
    <header style={{
      height: '52px', flexShrink: 0,
      background: '#1e2130', borderBottom: '1px solid #2e3250',
      display: 'flex', alignItems: 'center', padding: '0 16px', gap: '12px',
      userSelect: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px' }}>
        <button
          onClick={() => setMode('home')}
          title="返回首页"
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'transparent', border: 'none',
            cursor: 'pointer', padding: '0',
          }}
        >
          <LayoutDashboard size={20} color="#4f6ef7" strokeWidth={2.2} />
          <span style={{ color: '#e8eaf0', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.02em' }}>
            Facade<span style={{ color: '#4f6ef7' }}>Studio</span>
          </span>
        </button>
      </div>

      <div style={{ display: 'flex', background: '#131828', border: '1px solid #2e3250', borderRadius: '8px', overflow: 'hidden' }}>
        {(['design', 'play'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: '6px 18px', background: mode === m ? '#4f6ef7' : 'none',
            border: 'none', color: mode === m ? '#fff' : '#8891b0',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            {m === 'design' ? <Wrench size={13} /> : <Gamepad2 size={13} />}
            {m === 'design' ? 'Design' : 'Play'}
          </button>
        ))}
      </div>

      {mode === 'design' && (
        <>
          <div style={{ width: '1px', height: '24px', background: '#2e3250', margin: '0 4px' }} />
          <ToolButton icon={<Plus size={14} />} label="新建 Landmark" onClick={handleAddLandmark} color="#4f6ef7" />
          <ToolButton icon={<Trash2 size={14} />} label="删除选中节点" onClick={handleDeleteSelected} color="#e74c3c"
            disabled={!selectedLandmarkId} />
          <div style={{ width: '1px', height: '24px', background: '#2e3250', margin: '0 4px' }} />
          <ToolButton icon={<Undo2 size={14} />} label="撤销 (Ctrl+Z)" onClick={handleUndo} color="#8891b0"
            disabled={_undoCount === 0} />
          <ToolButton icon={<Redo2 size={14} />} label="重做 (Ctrl+Shift+Z)" onClick={handleRedo} color="#8891b0"
            disabled={_redoCount === 0} />
          <div style={{ width: '1px', height: '24px', background: '#2e3250', margin: '0 4px' }} />
          <div style={{ display: 'flex', background: '#131828', border: '1px solid #2e3250', borderRadius: '8px', overflow: 'hidden' }}>
            <button onClick={() => setRightPanel('inspector')} style={{
              padding: '5px 12px', background: rightPanel === 'inspector' ? '#4f6ef7' : 'none',
              border: 'none', color: rightPanel === 'inspector' ? '#fff' : '#8891b0',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}><LayoutDashboard size={13} /> 蓝图</button>
            <button onClick={() => setRightPanel('characters')} style={{
              padding: '5px 12px', background: rightPanel === 'characters' ? '#f5a623' : 'none',
              border: 'none', color: rightPanel === 'characters' ? '#fff' : '#8891b0',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}><Users size={13} /> 角色</button>
            <button onClick={() => setRightPanel('worldstate')} style={{
              padding: '5px 12px', background: rightPanel === 'worldstate' ? '#e67e22' : 'none',
              border: 'none', color: rightPanel === 'worldstate' ? '#fff' : '#8891b0',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}><Globe size={13} /> 变量</button>
            <button onClick={() => setRightPanel('library')} style={{
              padding: '5px 12px', background: rightPanel === 'library' ? '#27ae60' : 'none',
              border: 'none', color: rightPanel === 'library' ? '#fff' : '#8891b0',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}><Package size={13} /> 资源库</button>
          </div>
          <div style={{ width: '1px', height: '24px', background: '#2e3250', margin: '0 4px' }} />
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
    <button onClick={onClick} disabled={disabled} title={label} style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '5px 12px', background: 'rgba(255,255,255,0.04)',
      border: '1px solid #2e3250', borderRadius: '6px',
      color: disabled ? '#4a5070' : color, fontSize: '12px', fontWeight: 500,
      cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s', opacity: disabled ? 0.5 : 1,
    }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
