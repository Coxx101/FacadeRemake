import { defineConfig, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { spawn, type ChildProcess } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── 后端进程管理 ──────────────────────────────────────────────────────────────
let backendProcess: ChildProcess | null = null

function startBackend() {
  if (backendProcess) return

  const wsDir = path.resolve(__dirname, '../prototype')

  console.log('')
  console.log('  ┌─────────────────────────────────────────────┐')
  console.log('  │  Starting Python backend...                 │')
  console.log('  │  python ws_server.py  (port 8000)           │')
  console.log('  └─────────────────────────────────────────────┘')
  console.log('')

  backendProcess = spawn('python', ['ws_server.py'], {
    cwd: wsDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
    env: { ...process.env },
  })

  backendProcess.stdout?.on('data', (data: Buffer) => {
    const text = data.toString()
    if (text.includes('Uvicorn running') || text.includes('ws://localhost')) {
      console.log(`  [Backend] ${text.trim()}`)
    }
  })

  backendProcess.stderr?.on('data', (data: Buffer) => {
    const text = data.toString()
    if (text.includes('ERROR') || text.includes('Traceback') || text.includes('ImportError')) {
      console.error(`  [Backend] ${text.trim()}`)
    }
  })

  backendProcess.on('error', (err) => {
    console.error('  [Backend] Failed to start:', err.message)
    backendProcess = null
  })

  backendProcess.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.log(`  [Backend] Exited with code ${code}`)
    }
    backendProcess = null
  })
}

function stopBackend() {
  if (!backendProcess) return
  console.log('')
  console.log('  [Backend] Stopping...')
  backendProcess.kill()
  backendProcess = null
}

// ── Vite 插件：dev server 启动时拉起后端，关闭时杀掉 ──────────────────────────
function backendLauncher() {
  return {
    name: 'backend-launcher',
    configureServer(server: ViteDevServer) {
      // dev server 就绪后启动后端
      server.httpServer?.once('listening', () => {
        startBackend()
      })

      // dev server 关闭时杀后端
      server.httpServer?.on('close', () => {
        stopBackend()
      })
    },
  }
}

// ── Vite 配置 ──────────────────────────────────────────────────────────────────
export default defineConfig({
  plugins: [react(), tailwindcss(), backendLauncher()],
})

// Ctrl+C 兜底
process.on('SIGINT', () => { stopBackend(); process.exit(0) })
process.on('SIGTERM', () => { stopBackend(); process.exit(0) })
