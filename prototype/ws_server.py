"""
FacadeRemake WebSocket Server
LLM 驱动的互动叙事后端
基于 GameEngine 重构版 - 实现 beatplan 触发机制的解耦设计
"""
import sys
import os
import json
import asyncio
import subprocess
from datetime import datetime
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, os.path.dirname(__file__))

# 导入核心游戏引擎组件（参考 main.py 的架构）
try:
    from facade_remake.engine.game_engine import GameEngine
    from facade_remake.engine.event_loop import GameEventLoop
    print("[Import] 成功导入 GameEngine 和 GameEventLoop")
except Exception as e:
    print(f"[Import] 导入失败: {e}")
    import traceback
    traceback.print_exc()
    raise

app = FastAPI(title="FacadeRemake WebSocket")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 游戏服务进程（用于重启）
game_process = None


class GameSession:
    """一个 WebSocket 连接对应的游戏会话"""

    def __init__(self, ws: WebSocket, session_id: str = None):
        self.session_id = session_id or f"session_{id(self)}_{hash(ws)}_{datetime.now().timestamp()}"
        self.ws = ws
        self._ws_ready = True
        self.turn = 0
        self.game_ended = False

        self._loop = asyncio.get_running_loop()

        # 使用 GameEngine 管理所有游戏逻辑（解耦设计）
        self.engine: Optional[GameEngine] = None
        self.event_loop: Optional[GameEventLoop] = None

        # 场景数据是否已加载
        self.scene_loaded = False
        print(f"[Session] 创建新会话: {self.session_id}")

    def _init_engine(self, provider: Optional[str] = None):
        """初始化 GameEngine - 延迟到场景数据到达后再完整初始化"""
        print(f"[Engine] 开始初始化 GameEngine (会话: {self.session_id})")
        try:
            from pathlib import Path
            print("[Engine] 导入 pathlib 成功")
            
            try:
                from dotenv import load_dotenv
                prototype_dir = Path(__file__).resolve().parent
                env_local = prototype_dir / ".env.local"
                env_file = prototype_dir / ".env"
                if env_local.exists():
                    load_dotenv(env_local)
                    print("[Engine] 加载 .env.local")
                elif env_file.exists():
                    load_dotenv(env_file)
                    print("[Engine] 加载 .env")
                else:
                    print("[Engine] 未找到 .env 文件")
            except ImportError:
                print("[Engine] dotenv 未安装，跳过")

            env_provider = os.getenv("LLM_PROVIDER", "openai")
            effective_provider = provider or env_provider
            print(f"[Engine] 使用 LLM Provider: {effective_provider}")

            # 创建 GameEngine，但不传入 scenario_config（场景数据由前端传入）
            print("[Engine] 创建 GameEngine 实例...")
            self.engine = GameEngine(
                debug_mode=True,
                provider=effective_provider,
                scenario_config=None
            )
            print("[Engine] GameEngine 实例创建成功")

            # 注入 on_debug 回调
            ws_ref = self.ws
            loop_ref = self._loop
            import time as _time

            def _ws_debug_callback(event_type: str, payload: dict):
                try:
                    msg = {
                        "type": "llm_debug",
                        "event": event_type,
                        "data": payload,
                        "ts": _time.time(),
                    }

                    async def _do_send():
                        try:
                            await ws_ref.send_json(msg)
                        except Exception:
                            pass

                    coro = _do_send()
                    loop_ref.call_soon_threadsafe(loop_ref.create_task, coro)
                except Exception as e:
                    print(f"[debug-ws] 推送失败: {e}")

            if self.engine.llm_client:
                self.engine.llm_client.on_debug = _ws_debug_callback
                self.engine.llm_client.debug = True
                print("[Engine] 注入调试回调成功")

            print(f"[Engine] GameEngine 初始化成功 (provider={effective_provider}, 会话: {self.session_id})")
            return True
        except Exception as e:
            print(f"[Engine] GameEngine 初始化失败: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _init_event_loop(self):
        """初始化 GameEventLoop，绑定事件回调"""
        if not self.engine:
            print("[Error] GameEngine 未初始化")
            return False

        self.event_loop = GameEventLoop(self.engine)

        # 注册事件处理器
        @self.event_loop.on("character_speaking")
        def _on_character_speaking(speaker: str, text: str, actions: str = "", thought: str = ""):
            message = {
                "type": "chat",
                "role": speaker,
                "speech": text,
            }
            if actions:
                message["action"] = actions
            if thought:
                message["thought"] = thought
            self.send_message(message)

        @self.event_loop.on("narrator_text")
        def _on_narrator_text(text: str):
            self.send_message({
                "type": "chat",
                "role": "narrator",
                "speech": text,
            })

        @self.event_loop.on("waiting_for_player")
        def _on_waiting_for_player():
            self.send_message({"type": "player_turn"})

        @self.event_loop.on("storylet_entered")
        def _on_storylet_entered(storylet_title: str, narrative_goal: str):
            self.send_message({
                "type": "chat",
                "role": "system",
                "speech": f"[Storylet] {storylet_title} — {narrative_goal[:60]}",
            })

        @self.event_loop.on("state_change")
        def _on_state_change(state: dict):
            self.send_state_update()

        @self.event_loop.on("game_ended")
        def _on_game_ended():
            self.game_ended = True
            self.send_message({
                "type": "state_update",
                "game_ended": True,
            })

        print("[EventLoop] GameEventLoop 初始化成功")
        return True

    def _init_agents_from_scene(self, characters: List[Dict[str, Any]], scene_data: Dict[str, Any]):
        """根据前端传来的角色配置初始化 CharacterAgent 和 Director"""
        if not self.engine or not self.engine.container:
            print("[Error] Engine 未初始化")
            return False

        try:
            # 调用 container 的 init_from_scene_data 方法
            self.engine.container.init_from_scene_data(scene_data)

            # 更新 engine 的引用
            self.engine.director = self.engine.container.director
            
            # 同步角色列表
            self.engine.update_characters_from_container()

            print("[Agents] 角色代理初始化成功")
            return True
        except Exception as e:
            print(f"[Agents] 角色代理初始化失败: {e}")
            import traceback
            traceback.print_exc()
            return False

    def init_scene(self, scene_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """根据前端传来的场景数据初始化游戏场景"""
        messages: List[Dict[str, Any]] = []

        try:
            # 检查 engine 是否已初始化
            if not self.engine:
                messages.append({
                    "type": "error",
                    "message": "游戏引擎未初始化",
                })
                messages.append(self._get_state_snapshot())
                return messages

            landmarks = scene_data.get("landmarks", [])

            if not landmarks:
                messages.append({
                    "type": "chat",
                    "role": "system",
                    "speech": "[提示] 该项目尚未配置任何 Landmark 节点。请先在 Design 模式中创建叙事蓝图。",
                })
                messages.append(self._get_state_snapshot())
                return messages

            # 使用 container 的 init_from_scene_data 方法初始化所有数据
            self.engine.container.init_from_scene_data(scene_data)

            # 更新 engine 的引用
            self.engine.world_state = self.engine.container.world_state
            self.engine.director = self.engine.container.director
            
            # 同步角色列表
            self.engine.update_characters_from_container()

            # 设置初始 Landmark
            first_landmark = None
            for lm in landmarks:
                if not lm.get("is_ending", False):
                    first_landmark = lm["id"]
                    break
            if first_landmark is None and landmarks:
                first_landmark = landmarks[0]["id"]

            if first_landmark:
                self.engine.landmark_manager.set_current(first_landmark, self.engine.world_state)

            self.scene_loaded = True

            # 启动事件循环处理（event_loop.start() 内部会调用 _trigger_initial_storylet）
            if self.event_loop:
                self._loop.create_task(self.event_loop.start())

            messages.append(self._get_state_snapshot())
            return messages

        except Exception as e:
            print(f"[init_scene] 初始化失败: {e}")
            import traceback
            traceback.print_exc()
            messages.append({
                "type": "error",
                "message": f"场景初始化失败: {str(e)}",
            })
            return messages

    def handle_player_input(self, player_input: str):
        """处理玩家输入"""
        if not self.engine:
            print("[Error] Engine 未初始化")
            return

        try:
            self.engine.handle_player_input(player_input)
        except Exception as e:
            print(f"[PlayerInput] 处理失败: {e}")
            import traceback
            traceback.print_exc()

    def handle_player_silence(self):
        """处理玩家沉默"""
        if not self.engine:
            print("[Error] Engine 未初始化")
            return

        try:
            self.engine.handle_player_silence()
        except Exception as e:
            print(f"[PlayerSilence] 处理失败: {e}")
            import traceback
            traceback.print_exc()

    def _get_state_snapshot(self) -> Dict[str, Any]:
        """获取当前状态快照"""
        if not self.engine:
            return {
                "type": "state_update",
                "world_state": {"qualities": {}, "flags": {}, "relationships": {}},
                "current_landmark_id": "",
                "current_storylet_id": None,
                "turn": 0,
                "game_ended": False,
            }

        return {
            "type": "state_update",
            "world_state": {
                "qualities": self.engine.world_state.get_all_qualities(),
                "flags": self.engine.world_state.get_all_flags(),
                "relationships": self.engine.world_state.get_all_relationships(),
            },
            "current_landmark_id": self.engine.landmark_manager.current_landmark_id or "",
            "current_storylet_id": self.engine.current_storylet.id if self.engine.current_storylet else None,
            "turn": self.engine.current_turn,
            "game_ended": self.engine.game_ended,
        }

    def send_state_update(self):
        """发送状态更新"""
        try:
            self.ws.send_json(self._get_state_snapshot())
        except Exception as e:
            print(f"[send_state_update] 失败: {e}")

    def send_message(self, message: Dict[str, Any]):
        """发送消息到客户端"""
        try:
            self._loop.call_soon_threadsafe(
                self._loop.create_task,
                self.ws.send_json(message)
            )
        except Exception as e:
            print(f"[send_message] 失败: {e}")

    async def run(self):
        """运行游戏会话"""
        try:
            await self.ws.accept()
            print("[WS] 客户端已连接")

            # 初始化引擎（不带场景配置）
            if not self._init_engine():
                print(f"[Session] 引擎初始化失败，关闭连接: {self.session_id}")
                await self.ws.send_json({
                    "type": "error",
                    "message": "游戏引擎初始化失败，请检查后端日志"
                })
                await self.ws.close()
                return

            while True:
                data = await self.ws.receive_json()
                message_type = data.get("type")
                print(f"[WS] 收到消息: {message_type}")

                if message_type == "init_scene":
                    scene_data = data.get("data", {})
                    print(f"[WS] 处理 init_scene: {len(scene_data.get('landmarks', []))} landmarks, {len(scene_data.get('storylets', []))} storylets")
                    print(f"[WS] self.engine 状态: {self.engine is not None}")

                    # 初始化事件循环（在场景数据到达后）
                    self._init_event_loop()

                    # 初始化场景
                    responses = self.init_scene(scene_data)
                    print(f"[WS] init_scene 返回 {len(responses)} 条消息")
                    for response in responses:
                        print(f"[WS] 发送: {response.get('type', 'unknown')}, keys: {list(response.keys())}")
                        await self.ws.send_json(response)

                elif message_type == "player_input":
                    text = data.get("text", "")
                    print(f"[WS] 收到玩家输入: {text[:50]}")
                    self.handle_player_input(text)
                    
                    # 发送状态更新
                    state_snapshot = self._get_state_snapshot()
                    if state_snapshot:
                        await self.ws.send_json(state_snapshot)

                elif message_type == "player_silence":
                    print("[WS] 收到玩家沉默")
                    self.handle_player_silence()

                elif message_type == "disconnect":
                    print("[WS] 客户端请求断开")
                    break

        except WebSocketDisconnect:
            print("[WS] 客户端断开连接")
        except Exception as e:
            print(f"[WS] 会话错误: {e}")
            import traceback
            traceback.print_exc()
        finally:
            if self.event_loop:
                self.event_loop.stop()


@app.get("/api/health")
async def health_check():
    """健康检查端点 - 检查游戏服务是否正常运行"""
    return {"status": "ok", "service": "facade_remake", "version": "1.0"}


@app.websocket("/ws/play")
async def websocket_endpoint(websocket: WebSocket):
    # 获取会话ID（如果客户端提供）
    session_id = websocket.query_params.get("session_id", None)
    print(f"[WS] 新连接，会话ID: {session_id or '自动生成'}")
    
    session = GameSession(websocket, session_id)
    await session.run()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)