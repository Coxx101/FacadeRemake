"""
FacadeRemake WebSocket Server - v2.0
LLM 驱动的互动叙事后端，基于 GameEngine 重构版

变更：
  - 新增 "game_log" 事件处理（前端右栏 GameLog 展示）
  - 状态快照适配 v2.0 架构
"""
import sys
import os
import json
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, os.path.dirname(__file__))

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

        self.engine: Optional[GameEngine] = None
        self.event_loop: Optional[GameEventLoop] = None
        self.scene_loaded = False
        print(f"[Session] 创建新会话: {self.session_id}")

    def _init_engine(self, provider: Optional[str] = None):
        print(f"[Engine] 开始初始化 (会话: {self.session_id})")
        try:
            from pathlib import Path
            try:
                from dotenv import load_dotenv
                prototype_dir = Path(__file__).resolve().parent
                env_local = prototype_dir / ".env.local"
                env_file = prototype_dir / ".env"
                if env_local.exists():
                    load_dotenv(env_local)
                elif env_file.exists():
                    load_dotenv(env_file)
            except ImportError:
                pass

            env_provider = os.getenv("LLM_PROVIDER", "openai")
            effective_provider = provider or env_provider

            self.engine = GameEngine(
                debug_mode=True,
                provider=effective_provider,
                scenario_config=None
            )

            # 注入调试回调
            ws_ref = self.ws
            loop_ref = self._loop

            def _ws_debug_callback(event_type: str, payload: dict):
                try:
                    msg = {"type": "llm_debug", "event": event_type, "data": payload}
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

            print(f"[Engine] GameEngine 初始化成功 (provider={effective_provider})")
            return True
        except Exception as e:
            print(f"[Engine] 初始化失败: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _init_event_loop(self):
        if not self.engine:
            return False

        self.event_loop = GameEventLoop(self.engine)

        @self.event_loop.on("character_speaking")
        def _on_character_speaking(speaker: str, text: str, actions: str = "", thought: str = ""):
            message = {"type": "chat", "role": speaker, "speech": text}
            if actions:
                message["action"] = actions
            if thought:
                message["thought"] = thought
            self.send_message(message)

        @self.event_loop.on("narrator_text")
        def _on_narrator_text(text: str):
            self.send_message({"type": "chat", "role": "narrator", "speech": text})

        @self.event_loop.on("waiting_for_player")
        def _on_waiting_for_player():
            self.send_message({"type": "player_turn"})

        @self.event_loop.on("storylet_entered")
        def _on_storylet_entered(storylet_title: str, narrative_goal: str):
            self.send_message({
                "type": "chat", "role": "system",
                "speech": f"[Storylet] {storylet_title} — {narrative_goal[:60]}",
            })

        @self.event_loop.on("state_change")
        def _on_state_change(state: dict):
            self.send_state_update()

        @self.event_loop.on("game_ended")
        def _on_game_ended():
            self.game_ended = True
            self.send_message({"type": "state_update", "game_ended": True})

        # ── v2.0 新增: GameLog 事件 ──
        @self.event_loop.on("game_log")
        def _on_game_log(entries: list):
            self.send_message({
                "type": "game_log",
                "entries": entries
            })

        print("[EventLoop] GameEventLoop 初始化成功")
        return True

    def init_scene(self, scene_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        messages: List[Dict[str, Any]] = []

        try:
            if not self.engine:
                messages.append({"type": "error", "message": "游戏引擎未初始化"})
                messages.append(self._get_state_snapshot())
                return messages

            landmarks = scene_data.get("landmarks", [])

            if not landmarks:
                messages.append({
                    "type": "chat", "role": "system",
                    "speech": "[提示] 该项目尚未配置任何 Landmark 节点。请先在 Design 模式中创建叙事蓝图。",
                })
                messages.append(self._get_state_snapshot())
                return messages

            self.engine.container.init_from_scene_data(scene_data)
            self.engine.world_state = self.engine.container.world_state
            self.engine.director = self.engine.container.director
            self.engine.update_characters_from_container()

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

            if self.event_loop:
                self._loop.create_task(self.event_loop.start())

            messages.append(self._get_state_snapshot())
            messages.append(self._get_location_snapshot())
            return messages

        except Exception as e:
            print(f"[init_scene] 初始化失败: {e}")
            import traceback
            traceback.print_exc()
            messages.append({"type": "error", "message": f"场景初始化失败: {str(e)}"})
            return messages

    def handle_player_input(self, player_input: str):
        if not self.engine:
            return
        try:
            self.engine.handle_player_input(player_input)
        except Exception as e:
            print(f"[PlayerInput] 处理失败: {e}")
            import traceback
            traceback.print_exc()

    def handle_player_silence(self):
        if not self.engine:
            return
        try:
            self.engine.handle_player_silence()
        except Exception as e:
            print(f"[PlayerSilence] 处理失败: {e}")

    def _get_state_snapshot(self) -> Dict[str, Any]:
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

    def _get_location_snapshot(self) -> Dict[str, Any]:
        if not self.engine or not self.engine.location_manager:
            return {
                "type": "location_info",
                "locations": [],
                "player_location": "",
                "entity_locations": {},
            }

        location_summary = self.engine.location_manager.get_location_summary()

        characters = []
        if self.engine and self.engine._character_agents:
            for char_id in self.engine._character_agents.keys():
                char_name = char_id.split("_", 1)[-1].replace("_", " ").title()
                characters.append({"id": char_id, "name": char_name})

        return {
            "type": "location_info",
            "locations": location_summary.get("locations", []),
            "player_location": location_summary.get("player_location", ""),
            "entity_locations": location_summary.get("entity_locations", {}),
            "characters": characters,
        }

    def send_state_update(self):
        try:
            self.ws.send_json(self._get_state_snapshot())
            self.ws.send_json(self._get_location_snapshot())
        except Exception as e:
            print(f"[send_state_update] 失败: {e}")

    def send_message(self, message: Dict[str, Any]):
        try:
            self._loop.call_soon_threadsafe(
                self._loop.create_task,
                self.ws.send_json(message)
            )
        except Exception as e:
            print(f"[send_message] 失败: {e}")

    def handle_move_location(self, location_id: str):
        if not self.engine:
            return

        try:
            success, message, location_summary = self.engine.handle_move_location(location_id)

            self.ws.send_json({
                "type": "location_update",
                "player_location": location_summary.get("player_location", ""),
                "entity_locations": location_summary.get("entity_locations", {}),
            })

            if success:
                self.ws.send_json({
                    "type": "chat", "role": "narrator", "speech": message,
                })
                self.ws.send_json({
                    "type": "beat_plan_refresh",
                    "reason": "player_moved",
                    "message": message,
                })

        except Exception as e:
            print(f"[MoveLocation] 处理失败: {e}")
            import traceback
            traceback.print_exc()

    async def run(self):
        try:
            await self.ws.accept()
            print("[WS] 客户端已连接")

            if not self._init_engine():
                await self.ws.send_json({
                    "type": "error", "message": "游戏引擎初始化失败"
                })
                await self.ws.close()
                return

            await self.ws.send_json({"type": "ready", "message": "后端已准备好"})

            while True:
                data = await self.ws.receive_json()
                message_type = data.get("type")

                if message_type == "init_scene":
                    scene_data = data.get("data", {})
                    self._init_event_loop()
                    responses = self.init_scene(scene_data)
                    for response in responses:
                        await self.ws.send_json(response)

                elif message_type == "player_input":
                    text = data.get("text", "")
                    self.handle_player_input(text)
                    state_snapshot = self._get_state_snapshot()
                    if state_snapshot:
                        await self.ws.send_json(state_snapshot)

                elif message_type == "player_silence":
                    self.handle_player_silence()

                elif message_type == "move_location":
                    location_id = data.get("location_id", "")
                    self.handle_move_location(location_id)

                elif message_type == "disconnect":
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
    return {"status": "ok", "service": "facade_remake", "version": "2.0"}


@app.websocket("/ws/play")
async def websocket_endpoint(websocket: WebSocket):
    session_id = websocket.query_params.get("session_id", None)
    session = GameSession(websocket, session_id)
    await session.run()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
