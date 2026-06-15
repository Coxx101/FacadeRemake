# FacadeRemake 项目环境配置指南

> 交互叙事编辑器 - 基于 LLM 的互动叙事游戏引擎

---

## 一、系统环境要求

### 1.1 操作系统要求

| 系统 | 版本要求 | 推荐程度 |
|------|----------|----------|
| Windows | Windows 10 20H2 或更高 | ✅ 推荐 |
| macOS | macOS 12+ | ⚠️ 测试有限 |
| Linux | Ubuntu 20.04+ | ⚠️ 测试有限 |

### 1.2 硬件配置建议

| 配置项 | 最低要求 | 推荐配置 |
|--------|----------|----------|
| CPU | Intel i5 / AMD Ryzen 5 | Intel i7 / AMD Ryzen 7 |
| 内存 | 8 GB RAM | 16 GB RAM |
| 存储 | 10 GB 可用空间 | 20 GB 可用空间 |
| 网络 | 稳定互联网连接 | 高速网络（用于 LLM API 调用） |

---

## 二、必备软件安装指南

### 2.1 Node.js

**版本要求**: Node.js 20.x LTS 或更高（推荐 20.10.0+）

#### Windows 安装步骤：

1. 访问 [Node.js 官网](https://nodejs.org/)
2. 下载 **LTS 版本**（推荐 20.x）
3. 运行安装程序，**务必勾选 "Add to PATH" 选项**
4. 完成安装后，**重启终端**

#### 验证安装：

```bash
node --version   # 应显示 v20.x.x 或更高
npm --version    # 应显示 10.x.x 或更高
```

### 2.2 Python

**版本要求**: Python 3.10+

#### Windows 安装步骤：

1. 访问 [Python 官网](https://www.python.org/)
2. 下载 Python 3.10 或更高版本
3. 运行安装程序，**勾选 "Add Python to PATH"**
4. 完成安装后，**重启终端**

#### 验证安装：

```bash
python --version  # 应显示 Python 3.10.x 或更高
pip --version     # 应显示对应版本
```

### 2.3 Git（可选）

**用途**: 代码版本管理

#### 安装步骤：

1. 访问 [Git 官网](https://git-scm.com/)
2. 下载并安装 Git for Windows
3. 安装完成后打开终端验证：

```bash
git --version
```

---

## 三、项目克隆与依赖安装

### 3.1 获取项目代码

如果尚未获取代码，使用以下命令克隆：

```bash
git clone <repository-url>
cd FacadeRemake
```

### 3.2 安装前端依赖

```bash
cd frontend
npm install
```

### 3.3 安装后端依赖

```bash
cd prototype

# 创建虚拟环境（推荐）
python -m venv .venv

# 激活虚拟环境
# Windows PowerShell
.venv\Scripts\Activate.ps1
# Windows Command Prompt
.venv\Scripts\activate.bat

# 安装依赖
pip install -r requirements.txt
```

---

## 四、环境变量配置

### 4.1 创建环境配置文件

在 `prototype` 目录下创建 `.env.local` 文件：

```ini
# ──────────────────────────────────────────────────────────────
# LLM 配置 - 必填
# ──────────────────────────────────────────────────────────────

# 选择 LLM 提供商 (openai 或 deepseek)
LLM_PROVIDER=deepseek

# DeepSeek API Key (推荐，免费额度充足)
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# 或使用 OpenAI API Key
# OPENAI_API_KEY=your_openai_api_key_here

# ──────────────────────────────────────────────────────────────
# 可选配置
# ──────────────────────────────────────────────────────────────

# 指定模型（默认使用预设值）
# LLM_MODEL=gpt-4o-mini
# LLM_BASE_URL=https://api.deepseek.com

# 调试模式
# DEBUG=true
```

### 4.2 API Key 获取方法

| 提供商 | 官网地址 | 免费额度 |
|--------|----------|----------|
| DeepSeek | [platform.deepseek.com](https://platform.deepseek.com/) | ✅ 有免费额度 |
| OpenAI | [platform.openai.com](https://platform.openai.com/) | ❌ 需付费 |

---

## 五、项目启动

### 5.1 自动启动（推荐）

前端启动时会自动拉起后端服务：

```bash
cd frontend
npm run dev
```

**预期输出**:

```
  ┌─────────────────────────────────────────────────────┐
  │  Starting Python backend...                         │
  │  python ws_server.py  (port 8000)                   │
  └─────────────────────────────────────────────────────┘

  [Backend] Uvicorn running on http://0.0.0.0:8000

  VITE v6.5.0  ready in 1234 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### 5.2 手动启动（调试用）

**终端 1 - 启动后端**:

```bash
cd prototype
python ws_server.py
```

**终端 2 - 启动前端**:

```bash
cd frontend
npm run dev
```

---

## 六、访问项目

启动成功后，在浏览器中访问：

| 服务 | URL | 说明 |
|------|-----|------|
| 前端应用 | http://localhost:5173 | 主应用入口 |
| 后端健康检查 | http://localhost:8000/api/health | 验证后端是否正常 |

---

## 七、常见问题排查

### 7.1 npm 命令不可用

**问题**: `npm : 无法将“npm”项识别为 cmdlet`

**解决方案**:

1. 确认 Node.js 安装时勾选了 "Add to PATH"
2. 重启终端或电脑
3. 手动添加环境变量：
   - 打开系统属性 → 高级 → 环境变量
   - 在 PATH 中添加 `C:\Program Files\nodejs\`

### 7.2 vite 不是内部或外部命令

**问题**: `'vite' 不是内部或外部命令`

**解决方案**:

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### 7.3 rollup 依赖错误

**问题**: `Cannot find module @rollup/rollup-win32-x64-msvc`

**解决方案**:

```bash
cd frontend
rm -rf node_modules package-lock.json
npm config set registry https://registry.npmmirror.com/
npm install
```

### 7.4 LLM API Key 错误

**问题**: `未提供 API Key`

**解决方案**:

1. 确认 `.env.local` 文件已创建在 `prototype` 目录下
2. 检查 API Key 是否正确填写
3. 确保环境变量名称正确（如 `DEEPSEEK_API_KEY`）

### 7.5 端口占用

**问题**: `Address already in use`

**解决方案**:

```bash
# Windows - 查找占用端口的进程
netstat -ano | findstr :8000
taskkill /F /PID <进程ID>
```

---

## 八、验证环境配置

### 8.1 基础验证

```bash
# 检查 Node.js
node --version

# 检查 Python
python --version

# 检查后端服务
curl http://localhost:8000/api/health
# 预期输出: {"status": "ok", "service": "facade_remake", "version": "2.0"}

# 检查前端服务
curl http://localhost:5173
# 预期输出: HTML 内容
```

### 8.2 功能验证

1. 打开浏览器访问 http://localhost:5173
2. 点击「新建项目」按钮
3. 创建一个简单的叙事蓝图
4. 进入 Play 模式，验证 LLM 响应是否正常

---

## 九、项目结构说明

```
FacadeRemake/
├── frontend/           # React 前端
│   ├── src/           # 源代码
│   │   ├── components/ # UI 组件
│   │   ├── store/      # 状态管理
│   │   └── data/       # 数据配置
│   └── vite.config.ts  # Vite 配置（含后端自动启动）
├── prototype/          # Python 后端
│   ├── facade_remake/  # 核心业务模块
│   │   ├── engine/     # 游戏引擎
│   │   ├── agents/     # AI 代理
│   │   └── core/       # 核心组件
│   └── ws_server.py    # WebSocket 服务入口
└── Framework/          # 文档与设计说明
```

---

## 十、技术支持

如果遇到问题，请检查：

1. Node.js 版本 >= 20.x
2. Python 版本 >= 3.10
3. LLM API Key 已正确配置
4. 网络连接正常

---

**文档版本**: v1.0  
**最后更新**: 2026年6月