import { useState, useCallback } from 'react'
import {
  Plus, FileText, Pencil, Play, Trash2, FolderOpen,
  LayoutDashboard, Clock, MoreHorizontal,
} from 'lucide-react'
import { useProjectStore } from '../store/useProjectStore'
import { useStore } from '../store/useStore'
import type { AppMode } from '../types'

interface StartScreenProps {
  onEnterProject: (mode: AppMode) => void
}

export default function StartScreen({ onEnterProject }: StartScreenProps) {
  const projects = useProjectStore((s) => s.projects)
  const createProject = useProjectStore((s) => s.createProject)
  const deleteProject = useProjectStore((s) => s.deleteProject)
  const loadFromJSON = useStore((s) => s.loadFromJSON)

  // ── 新建项目对话框 ──
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  const handleCreate = useCallback(() => {
    const name = newName.trim()
    if (!name) return
    const project = createProject(name, newDesc.trim())
    // 创建空项目，不加载默认数据
    useStore.setState({ currentProjectId: project.id })
    setNewName('')
    setNewDesc('')
    setShowNewDialog(false)
    onEnterProject('design')
  }, [newName, newDesc, createProject, onEnterProject])

  const handleEnterDesign = useCallback((projectId: string) => {
    const project = useProjectStore.getState().getProject(projectId)
    if (!project) return
    const { snapshot } = project
    loadFromJSON(
      snapshot.landmarks,
      snapshot.storylets,
      snapshot.characters,
      snapshot.sharedContext,
      snapshot.worldStateDefinition,
      snapshot.actionLibrary,
      snapshot.expressionLibrary,
      snapshot.propLibrary,
      snapshot.locationLibrary,
    )
    useStore.setState({ currentProjectId: projectId })
    onEnterProject('design')
  }, [loadFromJSON, onEnterProject])

  const handleEnterPlay = useCallback((projectId: string) => {
    const project = useProjectStore.getState().getProject(projectId)
    if (!project) return
    const { snapshot } = project
    loadFromJSON(
      snapshot.landmarks,
      snapshot.storylets,
      snapshot.characters,
      snapshot.sharedContext,
      snapshot.worldStateDefinition,
      snapshot.actionLibrary,
      snapshot.expressionLibrary,
      snapshot.propLibrary,
      snapshot.locationLibrary,
    )
    useStore.setState({ currentProjectId: projectId })
    onEnterProject('play')
  }, [loadFromJSON, onEnterProject])

  const handleDelete = useCallback((e: React.MouseEvent, projectId: string, projectName: string) => {
    e.stopPropagation()
    if (window.confirm(`确认删除「${projectName}」？\n\n此操作不可撤销。`)) {
      deleteProject(projectId)
    }
  }, [deleteProject])

  // ── 导入 JSON 文件创建项目 ──
  const handleImportJSON = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string)
          // 用文件名（去掉扩展名）作为项目名
          const projName = file.name.replace(/\.json$/i, '') || '导入的项目'
          const project = createProject(projName, '从 JSON 文件导入')
          // 覆盖默认数据为导入的数据
          const layout: Array<{ id: string; position: { x: number; y: number } }> = data.landmarks_layout ?? []
          const lms = (data.landmarks ?? []).map((l: any) => {
            const pos = layout.find((p) => p.id === l.id)?.position
            return pos ? { ...l, position: pos } : l
          })
          useProjectStore.getState().saveProjectSnapshot(project.id, {
            landmarks: lms,
            storylets: data.storylets ?? [],
            characters: data.characters ?? project.snapshot.characters,
            sharedContext: data.shared_context ?? project.snapshot.sharedContext,
            worldStateDefinition: data.world_state_definition ?? project.snapshot.worldStateDefinition,
            actionLibrary: data.action_library ?? project.snapshot.actionLibrary,
            expressionLibrary: data.expression_library ?? project.snapshot.expressionLibrary,
            propLibrary: data.prop_library ?? project.snapshot.propLibrary,
            locationLibrary: data.location_library ?? project.snapshot.locationLibrary,
          })
          // 同时加载到主 store
          useStore.getState().loadFromJSON(
            lms,
            data.storylets ?? [],
            data.characters,
            data.shared_context,
            data.world_state_definition,
            data.action_library,
            data.expression_library,
            data.prop_library,
            data.location_library,
          )
          useStore.setState({ currentProjectId: project.id })
          onEnterProject('design')
        } catch {
          alert('JSON 文件解析失败，请检查格式')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }, [createProject, onEnterProject])

  const [expandedMenuId, setExpandedMenuId] = useState<string | null>(null)

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: '#C0C0C0', overflow: 'hidden',
    }}>
      {/* 品牌栏 — 90s title bar */}
      <header className="title-bar" style={{
        height: '60px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '0 12px',
      }}>
        <LayoutDashboard size={18} color="#ffffff" strokeWidth={2.2} />
        <span style={{ color: '#fff', fontWeight: 700 }}>
          Facade<span style={{ color: '#FFFF00' }}>Studio</span>
        </span>
        <span style={{ marginLeft: '12px', color: '#fff', fontSize: '13px', fontFamily: '"Courier New",monospace', opacity: 0.8 }}>
          交互叙事编辑器
        </span>
      </header>

      {/* ── 主内容区 ── */}
      <main style={{
        flex: 1, overflow: 'auto', padding: '40px 32px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        {/* 欢迎区域 */}
        <div style={{
          textAlign: 'center', marginBottom: '48px', maxWidth: '520px',
          animation: 'fadeIn 0.4s ease-out',
        }}>
          <h1 style={{
            color: 'var(--text-primary)', fontSize: '32px',
            fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '12px',
            lineHeight: 1.2,
          }}>
            开始你的故事
          </h1>
          <p style={{
            color: 'var(--text-secondary)', fontSize: '15px',
            lineHeight: 1.6,
          }}>
            创建新的交互叙事世界，或继续编辑已有的故事项目。
          </p>
        </div>

        {/* 操作按钮行 */}
        <div style={{
          display: 'flex', gap: '12px', marginBottom: '40px',
          animation: 'fadeIn 0.5s ease-out',
        }}>
          <ActionButton
            icon={<Plus size={16} />}
            label="新建项目"
            color="var(--accent-blue)"
            onClick={() => setShowNewDialog(true)}
          />
          <ActionButton
            icon={<FolderOpen size={16} />}
            label="导入 JSON"
            color="var(--accent-gold)"
            onClick={handleImportJSON}
          />
        </div>

        {/* 项目列表 */}
        <div style={{
          width: '100%', maxWidth: '800px',
          animation: 'fadeIn 0.6s ease-out',
        }}>
          {projects.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '16px',
              }}>
                <h2 style={{
                  color: 'var(--text-secondary)', fontSize: '13px',
                  fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  我的项目
                </h2>
                <span style={{
                  color: 'var(--text-muted)', fontSize: '12px',
                }}>
                  {projects.length} 个项目
                </span>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                gap: '12px',
              }}>
                {projects
                  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                  .map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      expandedMenuId={expandedMenuId}
                      onToggleMenu={() =>
                        setExpandedMenuId((prev) => prev === project.id ? null : project.id)
                      }
                      onCloseMenu={() => setExpandedMenuId(null)}
                      onEnterDesign={() => handleEnterDesign(project.id)}
                      onEnterPlay={() => handleEnterPlay(project.id)}
                      onDelete={(e) => handleDelete(e, project.id, project.name)}
                    />
                  ))}
              </div>
            </>
          )}
        </div>
      </main>

      {/* ── 新建项目对话框 ── */}
      {showNewDialog && (
        <ModalOverlay onClick={() => setShowNewDialog(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'var(--bg-card)', borderRadius: '12px',
            border: '1px solid var(--border-default)',
            padding: '28px', width: '100%', maxWidth: '420px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            animation: 'fadeIn 0.2s ease-out',
          }}>
            <h2 style={{
              color: 'var(--text-primary)', fontSize: '18px',
              fontWeight: 700, marginBottom: '20px',
            }}>
              新建故事世界
            </h2>
            <label style={{
              display: 'block', marginBottom: '16px',
            }}>
              <span style={{
                color: 'var(--text-secondary)', fontSize: '13px',
                fontWeight: 600, display: 'block', marginBottom: '6px',
              }}>
                项目名称 <span style={{ color: 'var(--accent-red)' }}>*</span>
              </span>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                placeholder="例如：回家吃饭"
                style={{
                  width: '100%', padding: '10px 12px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px', fontSize: '14px',
                }}
              />
            </label>
            <label style={{
              display: 'block', marginBottom: '24px',
            }}>
              <span style={{
                color: 'var(--text-secondary)', fontSize: '13px',
                fontWeight: 600, display: 'block', marginBottom: '6px',
              }}>
                简介（可选）
              </span>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleCreate() }}
                placeholder="简要描述故事设定..."
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px', fontSize: '14px',
                  resize: 'vertical',
                }}
              />
            </label>
            <div style={{
              display: 'flex', gap: '10px', justifyContent: 'flex-end',
            }}>
              <button onClick={() => setShowNewDialog(false)} style={{
                padding: '8px 20px', borderRadius: '8px',
                background: 'transparent', border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer',
              }}>
                取消
              </button>
              <button onClick={handleCreate} disabled={!newName.trim()} style={{
                padding: '8px 20px', borderRadius: '8px',
                background: newName.trim() ? 'var(--accent-blue)' : 'var(--border-default)',
                border: 'none', color: '#fff', fontSize: '13px', fontWeight: 600,
                cursor: newName.trim() ? 'pointer' : 'not-allowed',
                transition: 'opacity 0.15s',
                opacity: newName.trim() ? 1 : 0.5,
              }}>
                创建
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}

// ── 子组件 ──

function ActionButton({
  icon, label, color, onClick,
}: {
  icon: React.ReactNode
  label: string
  color: string
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="bevel-out" style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '8px 18px',
      background: '#C0C0C0',
      color, fontSize: '13px', fontWeight: 600,
      cursor: 'pointer',
      fontFamily: '"MS Sans Serif", sans-serif',
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#d4d0cc'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#C0C0C0'
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function ProjectCard({
  project, expandedMenuId, onToggleMenu, onCloseMenu,
  onEnterDesign, onEnterPlay, onDelete,
}: {
  project: import('../types').StoryProjectMeta
  expandedMenuId: string | null
  onToggleMenu: () => void
  onCloseMenu: () => void
  onEnterDesign: () => void
  onEnterPlay: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const stats = {
    landmarks: project.snapshot.landmarks.length,
    storylets: project.snapshot.storylets.length,
    characters: project.snapshot.characters.length,
  }
  const updatedAt = formatRelativeTime(project.updatedAt)
  const isMenuOpen = expandedMenuId === project.id

  // 点击卡片外部关闭菜单
  const handleCardClick = () => {
    if (isMenuOpen) {
      onCloseMenu()
    }
  }

  return (
    <div
      onClick={handleCardClick}
      className="bevel-out"
      style={{
        background: 'var(--bg-card)',
        padding: '16px',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {/* 顶部：名称 + 更多按钮 */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', marginBottom: '8px',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            color: 'var(--text-primary)', fontSize: '15px',
            fontWeight: 700, marginBottom: '4px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {project.name}
          </h3>
          {project.description && (
            <p style={{
              color: 'var(--text-muted)', fontSize: '12px',
              lineHeight: 1.4,
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {project.description}
            </p>
          )}
        </div>
        <div style={{ position: 'relative', marginLeft: '8px', flexShrink: 0 }}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleMenu()
            }}
            style={{
              width: '28px', height: '28px', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none',
              color: 'var(--text-muted)', cursor: 'pointer',
              borderRadius: '6px',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <MoreHorizontal size={16} />
          </button>
          {/* 下拉菜单 */}
          {isMenuOpen && (
            <DropdownMenu onClose={onCloseMenu}>
              <DropdownItem icon={<Pencil size={14} />} label="编辑" onClick={() => { onCloseMenu(); onEnterDesign() }} />
              <DropdownItem icon={<Play size={14} />} label="游玩" onClick={() => { onCloseMenu(); onEnterPlay() }} />
              <div style={{ height: '1px', background: 'var(--border-default)', margin: '4px 0' }} />
              <DropdownItem icon={<Trash2 size={14} />} label="删除" color="var(--accent-red)" onClick={(e) => { onCloseMenu(); onDelete(e) }} />
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* 统计信息 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        marginBottom: '16px',
      }}>
        <StatBadge label={`${stats.landmarks} 节点`} />
        <StatBadge label={`${stats.storylets} 片段`} />
        <StatBadge label={`${stats.characters} 角色`} />
      </div>

      {/* 底部：时间 + 操作按钮 */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          color: 'var(--text-muted)', fontSize: '11px',
          display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          <Clock size={12} />
          {updatedAt}
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <MiniButton icon={<Pencil size={12} />} label="编辑" onClick={(e) => { e.stopPropagation(); onEnterDesign() }} />
          <MiniButton icon={<Play size={12} />} label="游玩" onClick={(e) => { e.stopPropagation(); onEnterPlay() }} color="var(--accent-green)" />
        </div>
      </div>
    </div>
  )
}

function StatBadge({ label }: { label: string }) {
  return (
    <span className="bevel-out" style={{
      padding: '2px 8px',
      color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 500,
    }}>
      {label}
    </span>
  )
}

function MiniButton({
  icon, label, color = 'var(--text-secondary)', onClick,
}: {
  icon: React.ReactNode
  label: string
  color?: string
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <button
      onClick={onClick}
      className="bevel-out"
      style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        padding: '3px 8px',
        background: '#C0C0C0',
        color, fontSize: '11px', fontWeight: 600,
        cursor: 'pointer',
        fontFamily: '"MS Sans Serif", sans-serif',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#d4d0cc' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#C0C0C0' }}
    >
      {icon}
      {label}
    </button>
  )
}

function DropdownMenu({
  children, onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="bevel-out"
      style={{
        position: 'absolute', top: '36px', right: 0,
        background: '#C0C0C0',
        padding: '4px',
        minWidth: '120px', zIndex: 100,
        animation: 'fadeIn 0.1s ease-out',
      }}
    >
      {children}
      {/* 点击外部关闭 */}
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: -1,
        }}
        onClick={(e) => { e.stopPropagation(); onClose() }}
      />
    </div>
  )
}

function DropdownItem({
  icon, label, color = 'var(--text-secondary)', onClick,
}: {
  icon: React.ReactNode
  label: string
  color?: string
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        width: '100%', padding: '5px 10px',
        background: '#C0C0C0', border: 'none',
        color,
        fontSize: '12px', fontWeight: 500, cursor: 'pointer',
        textAlign: 'left',
        fontFamily: '"MS Sans Serif", sans-serif',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#d4d0cc' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#C0C0C0' }}
    >
      {icon}
      {label}
    </button>
  )
}

function ModalOverlay({
  children, onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
    >
      {children}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bevel-out" style={{
      textAlign: 'center', padding: '60px 20px',
      maxWidth: '480px',
      margin: '0 auto',
      background: '#C0C0C0',
    }}>
      <FileText size={40} color="#808080" style={{ marginBottom: '16px', opacity: 0.5 }} />
      <h3 style={{
        color: '#000', fontSize: '16px',
        fontWeight: 600, marginBottom: '8px',
      }}>
        还没有项目
      </h3>
      <p style={{
        color: '#444', fontSize: '13px',
        lineHeight: 1.5,
      }}>
        点击上方的「新建项目」按钮创建你的第一个交互叙事世界，
        或「导入 JSON」加载已有的故事数据。
      </p>
    </div>
  )
}

// ── 工具函数 ──

function formatRelativeTime(isoString: string): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  if (diffHour < 24) return `${diffHour} 小时前`
  if (diffDay < 30) return `${diffDay} 天前`
  // 超过 30 天显示日期
  return new Date(isoString).toLocaleDateString('zh-CN', {
    month: 'short', day: 'numeric',
  })
}
