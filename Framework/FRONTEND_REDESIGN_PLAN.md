# FacadeRemake 前端 Play 界面改版方案

> **目标**：将 Play 模式重设计为参考 `gemini-code-1777135165823.html` 的三栏布局，采用日间模式（白底）主题，同时确保与后端 `ws_server.py` 的 WebSocket 协议完全对接。本文档供 Trae 直接实施。

***

## 一、总体布局规划

### 1.1 参考布局（来源：gemini-code HTML）

```
┌──────────────────────────────────────────────────────────────┐
│  TOOLBAR（模式切换，保留现有 Toolbar 逻辑）                      │
├────────────┬────────────────────────────────┬────────────────┤
│            │    SCENE STAGE（角色立绘区）      │                │
│  LEFT      │  ┌────────────────────────────┐ │   RIGHT        │
│  COLUMN    │  │  char portrait × 2        │ │   COLUMN       │
│            │  └────────────────────────────┘ │                │
│  • 时间/   ├────────────────────────────────┤ │  • GAME LOG    │
│    场景    │    NARRATIVE BOX（对话流）       │ │    (系统事件)  │
│            │                                │ │                │
│  • WORLD   ├────────────────────────────────┤ │  • DEBUG       │
│    STATE   │    COMMAND BAR（输入栏）        │ │    PANEL       │
│            │                                │ │    (可折叠)    │
└────────────┴────────────────────────────────┴────────────────┘
```

### 1.2 列宽定义

| 区域              | 宽度            | 说明           |
| --------------- | ------------- | ------------ |
| 左栏 `.col-left`  | `260px` 固定    | 场景信息 + 世界状态  |
| 中栏 `.col-mid`   | `flex: 1` 自适应 | 舞台 + 对话 + 输入 |
| 右栏 `.col-right` | `300px` 固定    | 游戏日志 + Debug |

### 1.3 中栏垂直比例

```
scene-stage     : flex 2.2  → 约 40% 高度（立绘舞台）
narrative-box   : flex 1.8  → 约 34% 高度（对话流）
command-bar     : 固定 56px → 输入栏
```

***

## 二、日间模式（白底）色彩规范

### 2.1 CSS 变量定义（替换全部原有深色变量）

```css
:root {
  /* 背景层次 */
  --bg-page:       #f5f4f0;    /* 页面底色，米白 */
  --bg-panel:      #ffffff;    /* 面板白 */
  --bg-surface:    #f0ede8;    /* 次级面板，浅暖灰 */
  --bg-stage:      #e8e4dd;    /* 舞台底色 */
  --bg-input:      #ffffff;    /* 输入框白 */

  /* 边框 */
  --border:        #d4cec5;    /* 主边框，暖灰 */
  --border-light:  #e8e4dd;    /* 浅边框 */

  /* 文字 */
  --text:          #1a1814;    /* 主文本，近黑 */
  --text-muted:    #6b655c;    /* 次要文本 */
  --text-dim:      #9e9690;    /* 弱化文本 */

  /* 角色主色 */
  --trip-color:    #c0392b;    /* Trip 深红 */
  --grace-color:   #2563a8;    /* Grace 深蓝 */
  --player-color:  #1a6b40;    /* 玩家深绿 */
  --narrator-color: #6b5c3e;   /* 旁白棕褐 */

  /* 系统色 */
  --accent:        #4a6fa5;    /* 强调蓝 */
  --accent-hover:  #3a5f95;    /* 强调蓝悬停 */
  --good:          #218a45;    /* 成功绿 */
  --warn:          #b8860b;    /* 警告金 */
  --danger:        #c0392b;    /* 危险红 */
  --storylet-tag:  #7b3fa0;    /* Storylet 紫 */
  --landmark-tag:  #2563a8;    /* Landmark 蓝 */

  /* 阴影 */
  --shadow-sm:     0 1px 3px rgba(0,0,0,0.08);
  --shadow-md:     0 2px 8px rgba(0,0,0,0.12);
}
```

### 2.2 主题映射：深色 → 浅色对照表

| 原深色用途 | 原深色值                 | 新浅色值                |
| ----- | -------------------- | ------------------- |
| 页面背景  | `#0a0c14`            | `var(--bg-page)`    |
| 面板背景  | `#0d0f1a`, `#131625` | `var(--bg-panel)`   |
| 次级面板  | `#0a0a0a`            | `var(--bg-surface)` |
| 主边框   | `#1e2235`            | `var(--border)`     |
| 主文本   | `#e8eaf2`            | `var(--text)`       |
| 次要文本  | `#c8cce0`            | `var(--text-muted)` |
| 弱化文本  | `#4a5070`, `#6a7090` | `var(--text-dim)`   |
| 滚动条   | `#2e3250`            | `#d4cec5`           |

***

## 三、各组件改版说明

### 3.1 `PlayMode.tsx` — 主布局重构

**改动目标**：从"左:对话 / 右:Debug"二栏改为三栏布局。

**新骨架结构**：

```tsx
// 文件：frontend/src/components/play/PlayMode.tsx

return (
  <div style={{
    flex: 1, display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    background: 'var(--bg-page)',
  }}>
    {/* 连接状态横幅（极细） */}
    <ConnectionBanner />

    {/* 三栏主体 */}
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, gap: '1px', background: 'var(--border)' }}>

      {/* 左栏 */}
      <LeftPanel />

      {/* 中栏 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-page)' }}>
        <SceneStage />
        <NarrativeBox />
        <CommandBar />
      </div>

      {/* 右栏 */}
      <RightPanel />

    </div>
  </div>
)
```

**关键细节**：

- 用 `gap: '1px'` + 父背景 `var(--border)` 模拟分割线，三栏各自白底，形成细线分隔
- 不再使用 `debugOpen` 控制整体布局，Debug 折叠时右栏宽度缩小至 `40px`（只显示 icon tab）

***

### 3.2 `LeftPanel.tsx`（新建组件）

**位置**：`frontend/src/components/play/LeftPanel.tsx`

**功能**：

1. **顶部**：实时时间显示（模仿参考 HTML 的时钟）
2. **场景位置**：当前 Landmark 名称（从 `usePlayStore.currentLandmark` 读取）
3. **世界状态**：qualities（进度条）+ relationships（进度条）+ flags（开关），可编辑（绑定现有 `setQuality` / `setFlag` / `setRelationship`）

**数据来源**（全部来自 `usePlayStore` + `useStore`）：

- `usePlayStore((s) => s.currentLandmark)` → 场景名
- `usePlayStore((s) => s.currentStorylet)` → 当前 Storylet
- `usePlayStore((s) => s.worldState)` → 运行时值
- `usePlayStore((s) => s.turn)` → 当前回合
- `useStore((s) => s.worldStateDefinition)` → WSD 定义（key/label/min/max）

**布局结构**：

```
┌─────────────────────┐
│  ⏰ 12:34:00
  2026.04.29      │  ← 实时时钟
├─────────────────────┤
│ LOCATIONS            │
│ ▶ Living Room        │  ← currentLandmark.title
│   Turn 7             │  ← turn
│   [storylet tag]     │  ← currentStorylet.title
├─────────────────────┤
│ WORLD STATE          │
│ TRIP TENSION  ████░  │  ← NumberBar (可拖动)
│ GRACE TRUST   ██░░░  │
│ secrets_revealed ●   │  ← FlagToggle
└─────────────────────┘
```

**样式要求**：

- 背景 `var(--bg-panel)`，右侧边框 `1px solid var(--border)`
- Panel Header 使用白底黑字上横条：`background: var(--text); color: var(--bg-panel); padding: 4px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em`
- 时钟字体：`font-family: 'Special Elite', 'Courier New', monospace; font-size: 2.5rem; color: var(--text)`

**实时时钟代码**：

```tsx
function LiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const hhmm = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const date = now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\//g, '.')
  const weekday = ['SUN','MON','TUE','WED','THU','FRI','SAT'][now.getDay()]
  return (
    <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)', textAlign: 'center', background: 'var(--bg-surface)' }}>
      <div style={{ fontFamily: "'Special Elite','Courier New',monospace", fontSize: '2.5rem', lineHeight: 1, letterSpacing: '-1px', color: 'var(--text)' }}>
        {hhmm}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '6px', letterSpacing: '0.08em' }}>
        {date} {weekday}
      </div>
    </div>
  )
}
```

***

### 3.3 `SceneStage.tsx`（新建组件）

**位置**：`frontend/src/components/play/SceneStage.tsx`

**功能**：显示两个角色的立绘占位框（参考 gemini-code HTML）

**样式要求**：

- 背景 `var(--bg-stage)`，带格子纹理（参考 HTML 的 `background-image: linear-gradient`）
- 格子线改为浅色：`rgba(0,0,0,0.06)`
- 顶部 Panel Header 条：显示当前 Landmark 标题（`"THE STAGE / {currentLandmark?.title ?? 'Loading...'}"`)
- 两个角色立绘框（180×240）：
  - Trip 框：左边框 `3px solid var(--trip-color)`，阴影 `8px 8px 0 rgba(0,0,0,0.1)`
  - Grace 框：左边框 `3px solid var(--grace-color)`
  - 框内占位文字（深灰底）

**说话状态指示**（可选增强）：

- 当最新消息 role 为 `trip` 时，Trip 立绘框顶部显示说话气泡指示
- 当最新消息 role 为 `grace` 时，Grace 框同理
- 根据 `usePlayStore((s) => s.messages[s.messages.length - 1])` 判断

**代码骨架**：

```tsx
// frontend/src/components/play/SceneStage.tsx
import { usePlayStore } from '../../store/usePlayStore'

export default function SceneStage() {
  const currentLandmark = usePlayStore((s) => s.currentLandmark)
  const lastMsg = usePlayStore((s) => s.messages[s.messages.length - 1])

  return (
    <div style={{
      flex: 2.2,
      position: 'relative',
      background: 'var(--bg-stage)',
      backgroundImage: [
        'linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px)',
        'linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)',
      ].join(','),
      backgroundSize: '60px 60px',
      border: '1px solid var(--border)',
      display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
      overflow: 'hidden',
    }}>
      {/* Stage Header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        background: 'var(--text)', color: 'var(--bg-panel)',
        padding: '4px 10px', fontSize: '11px', fontWeight: 700,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        zIndex: 10,
      }}>
        THE STAGE / {currentLandmark?.title ?? '—'}
      </div>

      {/* 角色容器 */}
      <div style={{ display: 'flex', gap: '60px', paddingBottom: '30px', zIndex: 5 }}>
        <CharPortrait
          name="TRIP"
          color="var(--trip-color)"
          speaking={lastMsg?.role === 'trip'}
        />
        <CharPortrait
          name="GRACE"
          color="var(--grace-color)"
          speaking={lastMsg?.role === 'grace'}
        />
      </div>
    </div>
  )
}

function CharPortrait({ name, color, speaking }: { name: string; color: string; speaking: boolean }) {
  return (
    <div style={{
      width: '160px', height: '220px',
      border: `3px solid ${color}`,
      background: 'var(--bg-surface)',
      position: 'relative',
      boxShadow: speaking
        ? `0 0 0 3px ${color}40, 8px 8px 0 rgba(0,0,0,0.1)`
        : '8px 8px 0 rgba(0,0,0,0.08)',
      transition: 'box-shadow 0.3s',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* 说话指示 */}
      {speaking && (
        <div style={{
          position: 'absolute', top: '-10px', left: '50%',
          transform: 'translateX(-50%)',
          width: '8px', height: '8px',
          borderRadius: '50%', background: color,
          animation: 'speakingPulse 0.8s ease-in-out infinite',
        }} />
      )}
      {/* 角色标签 */}
      <div style={{
        position: 'absolute', top: '-28px', width: '100%',
        textAlign: 'center', fontFamily: "'Special Elite','Courier New',monospace",
        fontSize: '14px', fontWeight: 700, letterSpacing: '2px', color,
      }}>
        {name}
      </div>
      {/* 占位内容 */}
      <div style={{
        width: '90%', height: '90%',
        background: 'var(--bg-surface)',
        border: `1px dashed var(--border)`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-dim)', fontSize: '12px', textAlign: 'center',
      }}>
        {name}<br />
        <span style={{ fontSize: '10px', marginTop: '4px', opacity: 0.6 }}>立绘占位</span>
      </div>
    </div>
  )
}
```

***

### 3.4 `NarrativeBox.tsx`（重构现有 `ChatLog.tsx`）

**说明**：将现有 `ChatLog.tsx` 重命名为 `NarrativeBox.tsx`，调整为白底风格。功能逻辑不变（打字机效果、消息渲染、自动滚底保留）。

**主要样式变更**：

```tsx
// 容器背景色变更
background: 'var(--bg-panel)'
// 滚动条颜色
scrollbarColor: 'var(--border) var(--bg-surface)'

// 角色颜色映射（ROLE_COLOR）
const ROLE_COLOR = {
  narrator: '#6b5c3e',   // 棕褐旁白
  trip:     '#c0392b',   // 深红
  grace:    '#2563a8',   // 深蓝
  player:   '#1a6b40',   // 深绿
  system:   '#7b3fa0',   // 紫色
}

// 消息分割线
borderBottom: '1px solid var(--border-light)'

// 台词文字主色
color: 'var(--text)'

// 旁白斜体色
color: 'var(--narrator-color)'

// 玩家消息右对齐（新增）
// isPlayer 时：将消息整体右对齐，带绿色左边框变为右边框
paddingRight: isPlayer ? '0' : '12px'
paddingLeft: isPlayer ? '12px' : '0'
borderRight: isPlayer ? `2px solid ${color}40` : 'none'
borderLeft: isPlayer ? 'none' : `2px solid ${color}40`

// system 消息的色条颜色调整（深色变量改为浅色语义色）
storylet  → 'var(--storylet-tag)'
landmark  → 'var(--landmark-tag)'
debug     → 'var(--warn)'
```

**新增动画 CSS**（在组件内 `<style>` 标签）：

```css
@keyframes speakingPulse {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50%       { transform: scale(1.4); opacity: 1; }
}
@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
  30%           { transform: translateY(-4px); opacity: 0.8; }
}
```

**打字指示器颜色调整**：

```tsx
// 浅色模式下点状指示器
background: 'var(--text-dim)'
```

***

### 3.5 `CommandBar.tsx`（重构现有 `InputBar.tsx`）

**说明**：将 `InputBar.tsx` 重命名为 `CommandBar.tsx`，样式改为日间模式，参考 gemini-code HTML 的 `command-bar` 结构。

**布局变更**：

```
┌─────────────────────────────────────────────────────────┐
│  INPUT  │  你想说什么……                      [发送] [↩] │
└─────────────────────────────────────────────────────────┘
```

说明：

- 左侧 `INPUT` 标签：`background: var(--text); color: var(--bg-panel); padding: 0 14px; font-size: 12px; font-weight: 700; font-family: 'Special Elite',monospace`
- 中间输入框：单行（非多行），`background: var(--bg-input); border: none; color: var(--text)`
- 右侧按钮组：三个按钮（发送/回退/重置）在一行排列，不再垂直堆叠

**完整代码改写**：

```tsx
// frontend/src/components/play/CommandBar.tsx
import { useRef, useCallback, useState, useEffect } from 'react'
import { Send, Undo2, RotateCcw } from 'lucide-react'
import { usePlayStore } from '../../store/usePlayStore'

export default function CommandBar() {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const isLoading = usePlayStore((s) => s.isLoading)
  const gameEnded = usePlayStore((s) => s.gameEnded)
  const sendMessage = usePlayStore((s) => s.sendMessage)
  const rollback = usePlayStore((s) => s.rollback)
  const resetGame = usePlayStore((s) => s.resetGame)
  const snapshotCount = usePlayStore((s) => s._snapshotStack.length)

  const canSend = !isLoading && !gameEnded
  const canRollback = snapshotCount > 0 && !isLoading

  // 响应结束后自动聚焦
  const prevLoading = useRef(isLoading)
  useEffect(() => {
    if (prevLoading.current && !isLoading) inputRef.current?.focus()
    prevLoading.current = isLoading
  }, [isLoading])

  const handleSend = useCallback(() => {
    if (!canSend) return
    sendMessage(text.trim())
    setText('')
    inputRef.current?.focus()
  }, [text, canSend, sendMessage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSend() }
  }, [handleSend])

  const handleReset = useCallback(() => {
    if (!confirm('重置游戏？对话历史和世界状态将回到初始。')) return
    resetGame(undefined as any, '')
    setText('')
    inputRef.current?.focus()
  }, [resetGame])

  return (
    <div style={{
      height: '52px',
      display: 'flex',
      borderTop: '1px solid var(--border)',
      background: 'var(--bg-input)',
      flexShrink: 0,
    }}>
      {/* INPUT 标签 */}
      <div style={{
        background: 'var(--text)', color: 'var(--bg-panel)',
        padding: '0 14px',
        fontFamily: "'Special Elite','Courier New',monospace",
        fontSize: '12px', fontWeight: 700,
        display: 'flex', alignItems: 'center',
        letterSpacing: '0.08em', flexShrink: 0,
        opacity: canSend ? 1 : 0.5,
      }}>
        INPUT
      </div>

      {/* 输入框 */}
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          gameEnded ? '游戏已结束' :
          isLoading ? '等待回应中…' :
          '你想说什么……（直接回车 = 保持沉默）'
        }
        disabled={!canSend}
        style={{
          flex: 1,
          background: 'transparent', border: 'none',
          color: 'var(--text)', fontSize: '14px',
          padding: '0 14px', outline: 'none',
          fontFamily: 'inherit',
          opacity: canSend ? 1 : 0.5,
        }}
      />

      {/* 加载指示器 */}
      {isLoading && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '3px',
          padding: '0 10px', flexShrink: 0,
        }}>
          {[0,1,2].map((i) => (
            <span key={i} style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: 'var(--text-dim)',
              animation: `typingBounce 1.2s ${i * 0.2}s ease-in-out infinite`,
              display: 'inline-block',
            }} />
          ))}
        </div>
      )}

      {/* 按钮区 */}
      <div style={{ display: 'flex', borderLeft: '1px solid var(--border)', flexShrink: 0 }}>
        {/* 发送 */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          title="发送（Enter）"
          style={btnStyle(canSend, 'var(--accent)', '#fff')}
          onMouseEnter={(e) => { if (canSend) e.currentTarget.style.background = 'var(--accent-hover)' }}
          onMouseLeave={(e) => { if (canSend) e.currentTarget.style.background = 'var(--accent)' }}
        >
          <Send size={14} />
        </button>

        {/* 回退 */}
        <button
          onClick={rollback}
          disabled={!canRollback}
          title={`回退（${snapshotCount} 步）`}
          style={btnStyle(canRollback, 'transparent', canRollback ? 'var(--storylet-tag)' : 'var(--text-dim)', true)}
          onMouseEnter={(e) => { if (canRollback) e.currentTarget.style.background = '#f0eaf8' }}
          onMouseLeave={(e) => { if (canRollback) e.currentTarget.style.background = 'transparent' }}
        >
          <Undo2 size={14} />
          {snapshotCount > 0 && <span style={{ fontSize: '11px' }}>{snapshotCount}</span>}
        </button>

        {/* 重置 */}
        <button
          onClick={handleReset}
          title="重置游戏"
          style={btnStyle(true, 'transparent', 'var(--text-dim)', true)}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = 'var(--danger)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)' }}
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  )
}

function btnStyle(enabled: boolean, bg: string, color: string, hasBorderLeft = false): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
    padding: '0 16px', border: 'none',
    borderLeft: hasBorderLeft ? '1px solid var(--border)' : 'none',
    background: enabled ? bg : 'transparent',
    color: enabled ? color : 'var(--text-dim)',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: '13px', transition: 'background 0.15s, color 0.15s',
    height: '100%', minWidth: '44px',
  }
}
```

***

### 3.6 `RightPanel.tsx`（新建组件）

**位置**：`frontend/src/components/play/RightPanel.tsx`

**功能**：

1. **上半部：GAME LOG**（系统事件日志）
   - 展示 `role === 'system'` 的消息（Storylet 切换、Landmark 推进等）
   - 也展示最近几条 LLM Debug 事件摘要
2. **下半部：DEBUG PANEL**（折叠版）
   - 将现有 `DebugPanel.tsx` 内容迁移至此
   - 默认折叠，点击展开
   - 折叠时只显示 `Bug` 图标 + `DEBUG` 文字的 Header 条

**GAME LOG 样式**：

```
┌─────────────────────────┐
│ GAME LOG                │   ← 黑色 Header 条
├─────────────────────────┤
│ Turn 1  Storylet 切换   │   ← 每条一行，字体 monospace
│ Turn 3  进入新阶段       │   ← 颜色根据 system 子类型
│ Turn 5  LLM × 2 调用    │   ← LLM 调用摘要
└─────────────────────────┘
```

**GAME LOG 数据来源**：从 `usePlayStore.messages` 过滤 `role === 'system'` 的条目，结合 `turn` 字段显示序号。

**完整代码骨架**：

```tsx
// frontend/src/components/play/RightPanel.tsx
import { useRef, useEffect } from 'react'
import { Bug, ChevronDown, ChevronRight } from 'lucide-react'
import { usePlayStore } from '../../store/usePlayStore'
// 从现有 DebugPanel 导入内部子组件（Section, NumberBar, FlagToggle 等）
// 或直接将 DebugPanel 内容内联进来

export default function RightPanel() {
  const [debugOpen, setDebugOpen] = useState(false)  // 默认折叠
  // ... 其余逻辑见 3.7
}
```

***

### 3.7 `DebugPanel.tsx` — 迁移至 `RightPanel` 下半部

**改动说明**：

- 不再作为独立右侧栏，而是内嵌在 `RightPanel.tsx` 的折叠区
- 所有子组件（`Section`, `NumberBar`, `FlagToggle`, `ThoughtCard`, `LlmLogSection`）保留但样式适配白底主题

**白底样式适配**：

```ts
// 深色常量 → 白底常量
const C = {
  bg:          'var(--bg-panel)',
  surface:     'var(--bg-surface)',
  border:      'var(--border)',
  muted:       'var(--text-dim)',
  text:        'var(--text)',
  textDim:     'var(--text-muted)',
  accent:      'var(--accent)',
  trip:        'var(--trip-color)',
  grace:       'var(--grace-color)',
  quality:     '#2563a8',
  flag:        'var(--storylet-tag)',
  relationship: '#b04a7a',
  good:        'var(--good)',
  warn:        'var(--warn)',
  danger:      'var(--danger)',
}

// input[type=number] 样式
background: 'var(--bg-surface)', border: '1px solid var(--border)',
color: 'var(--text)'

// 折叠按钮 hover
onMouseEnter → color: 'var(--text)'
onMouseLeave → color: 'var(--text-dim)'

// LLM 日志面板背景
background: 'var(--bg-surface)'

// 滚动条
scrollbarColor: 'var(--border) var(--bg-panel)'
```

***

### 3.8 全局主题变量注入

**文件**：`frontend/src/index.css`（或 `frontend/src/styles/globals.css`）

在文件顶部添加如下 CSS 变量定义（替换或追加）：

```css
/* ── FacadeRemake Day Mode Theme ──────────────────────── */
:root {
  --bg-page:        #f5f4f0;
  --bg-panel:       #ffffff;
  --bg-surface:     #f0ede8;
  --bg-stage:       #e8e4dd;
  --bg-input:       #ffffff;
  --border:         #d4cec5;
  --border-light:   #ece9e4;
  --text:           #1a1814;
  --text-muted:     #6b655c;
  --text-dim:       #9e9690;
  --trip-color:     #c0392b;
  --grace-color:    #2563a8;
  --player-color:   #1a6b40;
  --narrator-color: #6b5c3e;
  --accent:         #4a6fa5;
  --accent-hover:   #3a5f95;
  --good:           #218a45;
  --warn:           #b8860b;
  --danger:         #c0392b;
  --storylet-tag:   #7b3fa0;
  --landmark-tag:   #2563a8;
  --shadow-sm:      0 1px 3px rgba(0,0,0,0.08);
  --shadow-md:      0 2px 8px rgba(0,0,0,0.12);
}

/* 字体引入 */
@import url('https://fonts.googleapis.com/css2?family=Special+Elite&display=swap');

/* 全局滚动条 */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--border) var(--bg-surface);
}

@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
  30%           { transform: translateY(-4px); opacity: 0.8; }
}
@keyframes speakingPulse {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50%      { transform: scale(1.4); opacity: 1; }
}
@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

***

### 3.9 `ConnectionBanner.tsx`（新建微组件）

替代现有标题装饰栏，改为极细横幅：

```tsx
// 内联在 PlayMode.tsx 或单独文件
function ConnectionBanner() {
  const connected = usePlayStore((s) => s.connected)
  const currentStorylet = usePlayStore((s) => s.currentStorylet)
  
  return (
    <div style={{
      height: '32px', display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: '12px',
      background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      <span style={{
        fontFamily: "'Special Elite',monospace",
        fontSize: '13px', fontWeight: 700,
        color: 'var(--text)', letterSpacing: '0.1em',
      }}>
        FACADE REMAKE
      </span>
      {currentStorylet?.title && (
        <span style={{
          fontSize: '11px', color: 'var(--storylet-tag)',
          padding: '1px 8px', background: '#f5f0fc',
          borderRadius: '10px', border: '1px solid #e8dff5',
        }}>
          {currentStorylet.title}
        </span>
      )}
      <span style={{
        marginLeft: 'auto', fontSize: '11px',
        color: connected ? 'var(--good)' : 'var(--danger)',
        display: 'flex', alignItems: 'center', gap: '5px',
      }}>
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: connected ? 'var(--good)' : 'var(--danger)',
          display: 'inline-block',
          boxShadow: connected ? '0 0 5px var(--good)' : 'none',
        }} />
        {connected ? 'Connected' : 'Connecting…'}
      </span>
    </div>
  )
}
```

***

## 四、WebSocket 协议对接核查

### 4.1 后端 → 前端消息类型（无需改动）

| 消息 type                                          | 触发时机        | 前端处理位置                          |
| ------------------------------------------------ | ----------- | ------------------------------- |
| `chat` (role: narrator/trip/grace/player/system) | 每次对话回合      | `NarrativeBox` 渲染               |
| `state_update`                                   | 每次对话回合结束    | `usePlayStore._handleWsMessage` |
| `llm_debug`                                      | 每次 LLM 调用前后 | `usePlayStore.debugLogs`        |
| `error`                                          | 异常时         | 控制台 + `isLoading=false`         |

### 4.2 前端 → 后端消息类型（无需改动）

| 消息 type            | 何时发送                | 发送函数                                 |
| ------------------ | ------------------- | ------------------------------------ |
| `init_scene`       | 连接建立后               | `sendInitScene()`                    |
| `player_input`     | 玩家按 Enter           | `sendMessage(text)`                  |
| `debug_worldstate` | Debug 修改 WorldState | `setQuality/setFlag/setRelationship` |
| `reset`            | 点击重置                | `resetGame()`                        |

**结论：WebSocket 协议无需任何改动**，`usePlayStore.ts` 逻辑完全保留，只改视图层。

### 4.3 已知后端字段 → 前端显示映射

| 后端字段                              | 前端显示位置                                |
| --------------------------------- | ------------------------------------- |
| `current_landmark.title`          | `SceneStage` header + `LeftPanel` 场景名 |
| `current_landmark.phase_tag`      | `LeftPanel` Chip 标签                   |
| `current_storylet.title`          | `ConnectionBanner` Storylet 标签        |
| `current_storylet.narrative_goal` | `LeftPanel` 说明文字                      |
| `turn`                            | `LeftPanel` Turn 计数                   |
| `world_state.qualities`           | `LeftPanel` NumberBar                 |
| `world_state.flags`               | `LeftPanel` FlagToggle                |
| `world_state.relationships`       | `LeftPanel` NumberBar                 |
| `game_ended`                      | `CommandBar` 禁用状态 + 提示文字              |

***

## 五、文件变更清单

### 5.1 新建文件

| 文件路径                                            | 说明                           |
| ----------------------------------------------- | ---------------------------- |
| `frontend/src/components/play/LeftPanel.tsx`    | 左栏：时钟 + 场景 + 世界状态            |
| `frontend/src/components/play/SceneStage.tsx`   | 中栏上：立绘舞台                     |
| `frontend/src/components/play/NarrativeBox.tsx` | 中栏中：对话流（原 ChatLog.tsx 改名重写）  |
| `frontend/src/components/play/CommandBar.tsx`   | 中栏下：输入栏（原 InputBar.tsx 改名重写） |
| `frontend/src/components/play/RightPanel.tsx`   | 右栏：日志 + Debug 折叠             |

### 5.2 修改文件

| 文件路径                                          | 改动                          |
| --------------------------------------------- | --------------------------- |
| `frontend/src/components/play/PlayMode.tsx`   | 重构为三栏布局，引入新子组件              |
| `frontend/src/index.css`                      | 注入 CSS 变量 + 全局动画 + 字体引入     |
| `frontend/src/components/play/DebugPanel.tsx` | 样式变量替换为白底，或将内容迁入 RightPanel |

### 5.3 保留不变（零改动）

| 文件路径                                        | 说明                         |
| ------------------------------------------- | -------------------------- |
| `frontend/src/store/usePlayStore.ts`        | 完整保留                       |
| `frontend/src/store/useStore.ts`            | 完整保留                       |
| `prototype/ws_server.py`                    | 后端无改动                      |
| `frontend/src/components/play/ChatLog.tsx`  | 可删除（由 NarrativeBox.tsx 替代） |
| `frontend/src/components/play/InputBar.tsx` | 可删除（由 CommandBar.tsx 替代）   |

***

## 六、实施顺序建议

1. **Step 1**：在 `frontend/src/index.css` 注入 CSS 变量（基础）
2. **Step 2**：新建 `NarrativeBox.tsx`（从 ChatLog.tsx 复制，改颜色）
3. **Step 3**：新建 `CommandBar.tsx`（从 InputBar.tsx 重写）
4. **Step 4**：新建 `SceneStage.tsx`（全新）
5. **Step 5**：新建 `LeftPanel.tsx`（从 DebugPanel WorldState 部分提取并扩展）
6. **Step 6**：新建 `RightPanel.tsx`（整合 GameLog + DebugPanel）
7. **Step 7**：重构 `PlayMode.tsx`（引入三栏布局）
8. **Step 8**：类型检查 `tsc --noEmit` + 启动 dev server 验证

***

## 七、预期视觉效果

```
┌──────────────────────────────────────────────────────────────────────┐
│ FACADE REMAKE   [Storylet: 初次寒暄]          ● Connected             │  ← 32px 横幅
├────────────┬──────────────────────────────────────┬──────────────────┤
│ 13:45      │ THE STAGE / Living Room               │ GAME LOG         │
│ 2026.04.29 │ ┌──────────────────────────────────┐  │ ─────────────── │
│ WED        │ │   TRIP  [●]      GRACE            │  │ T1 [Storylet]  │
├────────────┤ │  ┌────────┐   ┌────────┐         │  │    初次寒暄     │
│ LOCATIONS  │ │  │  立绘  │   │  立绘  │         │  │ T3 [Landmark]  │
│ Living Room│ │  │  占位  │   │  占位  │         │  │    进入阶段2   │
│ Turn 7     │ └──┴────────┴───┴────────┴─────────┘  ├────────────────┤
│ [初次寒暄] ├──────────────────────────────────────┤ ▼ DEBUG (折叠)  │
├────────────┤ TRIP                                  │                  │
│ WORLD STATE│   "噢，你终于来了！"                  │                  │
│ 张力  ████░│ ─────────────────────────────────── │                  │
│ 信任  ██░░░│ GRACE                                 │                  │
│ 秘密 ○     │   "我没那么说过，Trip。"              │                  │
└────────────┴──────────────────────────────────────┴──────────────────┤
│  INPUT  │  你想说什么……（直接回车 = 保持沉默）     [发送] [↩3] [↺]  │
└──────────────────────────────────────────────────────────────────────┘
```

***

## 八、注意事项

1. **不要修改** **`usePlayStore.ts`**：所有数据逻辑不变，仅改视图层
2. **CSS 变量优先**：所有颜色通过 CSS 变量引用，不要硬编码颜色值到组件
3. **Tailwind 冲突处理**：项目使用 Tailwind v4，与上述 CSS 变量方案兼容，但建议 Play 模式组件全部使用 inline style + CSS 变量，避免与 Design 模式的 Tailwind 类名产生冲突
4. **`Special Elite`** **字体**：仅用于 `INPUT` 标签、时钟、角色名等装饰性文字，正文使用系统字体栈
5. **左栏 WorldState 编辑**：`NumberBar` 和 `FlagToggle` 需要继续绑定 `setQuality`/`setFlag`/`setRelationship`，这些操作会通过 WebSocket 同步到后端
6. **Design 模式不受影响**：本次改动仅涉及 `components/play/` 下的文件，Design 模式、Home 模式均不需要更改

***

*文档生成时间：2026-04-29*\
*后端版本：ws\_server.py（BeatPlan-only 架构）*\
*前端技术栈：React 18 + TypeScript + Tailwind v4 + Zustand*
