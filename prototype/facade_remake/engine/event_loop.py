"""
GameEventLoop - 异步事件循环
管理所有 asyncio 逻辑：双轨道（input/push/consumer）、事件队列、任务管理
支持事件订阅机制，用于 WebSocket 集成
"""
import asyncio
from typing import Optional, Callable, Dict, List, Any

from engine.game_engine import GameEngine, PLAYER_TURN_TIMEOUT, calc_reading_delay
from engine.output import (
    game_banner, waiting_for_player, reading_delay_info, nudge_message,
    game_over, game_interrupted, player_input_prompt,
    narrator_text, character_speaking_hint
)


class GameEventLoop:
    def __init__(self, engine: GameEngine):
        self.engine = engine
        self.engine.event_loop = self

        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self.event_queue: Optional[asyncio.Queue] = None
        self.pending_beat_task: Optional[asyncio.Task] = None
        self.beat_plan_ready: Optional[asyncio.Event] = None
        self.beat_done_event: Optional[asyncio.Event] = None
        
        # 事件监听器
        self._listeners: Dict[str, List[Callable[..., None]]] = {}

    def on(self, event_name: str):
        """注册事件监听器（支持装饰器语法）"""
        def decorator(handler: Callable[..., None]):
            if event_name not in self._listeners:
                self._listeners[event_name] = []
            self._listeners[event_name].append(handler)
            return handler
        return decorator

    def emit(self, event_name: str, *args, **kwargs):
        """触发事件"""
        if event_name in self._listeners:
            for handler in self._listeners[event_name]:
                try:
                    handler(*args, **kwargs)
                except Exception as e:
                    self.engine.logger.error(f"事件处理错误: {e}", module="event", exception=e)

    def notify_beat_done(self):
        if self._loop and self.beat_done_event:
            self._loop.call_soon_threadsafe(self.beat_done_event.set)

    def stop(self):
        """停止事件循环"""
        self.engine.game_ended = True
        if self.pending_beat_task and not self.pending_beat_task.done():
            self.pending_beat_task.cancel()

    async def start(self):
        self._loop = asyncio.get_running_loop()
        self.event_queue = asyncio.Queue()
        self.beat_plan_ready = asyncio.Event()
        self.beat_done_event = asyncio.Event()

        self.engine._loop = self._loop

        self.engine.logger.info("FacadeRemake 原型启动", module="game")
        game_banner()

        self.engine._trigger_initial_storylet()

        await asyncio.gather(
            self._player_input_loop(),
            self._narrative_push_loop(),
            self._event_consumer(),
        )

    def run(self):
        asyncio.run(self.start())

    async def _player_input_loop(self):
        while not self.engine.game_ended:
            try:
                player_input = await self._loop.run_in_executor(
                    None, player_input_prompt
                )

                if not player_input:
                    if self.engine._player_turn_active:
                        await self.event_queue.put({"type": "player_silence"})
                        await asyncio.sleep(0.5)
                    elif self.engine.current_beat_plan and self.engine.beat_index < len(self.engine.current_beat_plan):
                        await self.event_queue.put({"type": "auto_beat"})
                    continue

                if player_input.lower() == "quit":
                    game_over()
                    self.engine.game_ended = True
                    if self.pending_beat_task and not self.pending_beat_task.done():
                        self.pending_beat_task.cancel()
                    return

                if player_input.lower() == "status":
                    self.engine._show_status()
                    continue

                await self.event_queue.put({
                    "type": "player_input",
                    "content": player_input,
                })

            except (KeyboardInterrupt, EOFError):
                game_interrupted()
                self.engine.game_ended = True
                if self.pending_beat_task and not self.pending_beat_task.done():
                    self.pending_beat_task.cancel()
                return

    async def _narrative_push_loop(self):
        while not self.engine.game_ended:
            try:
                if not self.engine.current_beat_plan or self.engine.beat_index >= len(self.engine.current_beat_plan):
                    await asyncio.sleep(0.5)
                    continue

                current_beat = self.engine.current_beat_plan[self.engine.beat_index]

                if current_beat.get("speaker") == "player_turn":
                    self.engine.beat_index += 1
                    self.engine._player_turn_active = True
                    waiting_for_player()
                    # 触发等待玩家事件
                    self.emit("waiting_for_player")
                    try:
                        await asyncio.wait_for(
                            self._wait_for_player_during_turn(),
                            timeout=PLAYER_TURN_TIMEOUT
                        )
                    except asyncio.TimeoutError:
                        if not self.engine._player_turn_active:
                            continue
                        nudge_speaker = self.engine._pick_nudge_speaker()
                        display_name = {"trip": "Trip", "grace": "Grace"}.get(nudge_speaker, nudge_speaker)
                        nudge_message(display_name)
                        self.engine.conversation_history.append(f"{nudge_speaker}: 你怎么不说话了？")
                        try:
                            await asyncio.wait_for(
                                self._wait_for_player_during_turn(),
                                timeout=30.0
                            )
                        except asyncio.TimeoutError:
                            if self.engine.debug_mode:
                                self.engine.logger.debug("玩家长时间未输入，视为保持沉默", module="narrative")
                            if self.engine._player_turn_active:
                                await self.event_queue.put({"type": "player_silence"})
                        except asyncio.CancelledError:
                            pass
                    if self.engine._player_turn_active:
                        self.engine._player_turn_active = False
                    continue

                if current_beat.get("speaker") == "narrator":
                    content = current_beat.get("content", "")
                    narrator_text(content)
                    self.engine.beat_index += 1
                    continue

                urgency = current_beat.get("urgency", "medium")

                speaker = current_beat.get("speaker", "trip")
                display_name = {"trip": "Trip", "grace": "Grace"}.get(speaker, speaker)
                character_speaking_hint(display_name)

                self.beat_done_event.clear()

                await self.event_queue.put({"type": "auto_beat"})

                try:
                    self.pending_beat_task = asyncio.create_task(
                        self.beat_done_event.wait()
                    )
                    await self.pending_beat_task
                except asyncio.CancelledError:
                    continue

                delay = calc_reading_delay(self.engine.last_beat_char_count, urgency)
                if self.engine.debug_mode:
                    reading_delay_info(self.engine.last_beat_char_count, delay)
                try:
                    self.pending_beat_task = asyncio.create_task(asyncio.sleep(delay))
                    await self.pending_beat_task
                except asyncio.CancelledError:
                    continue

            except asyncio.CancelledError:
                return
            except Exception as e:
                self.engine.logger.error(f"叙事推进错误: {e}", module="narrative", exception=e)
                await asyncio.sleep(1)

    async def _wait_for_player_during_turn(self):
        while self.engine._player_turn_active and not self.engine.game_ended:
            await asyncio.sleep(0.3)

    async def _event_consumer(self):
        while not self.engine.game_ended:
            event = await self.event_queue.get()
            try:
                if event["type"] == "player_input":
                    await self._loop.run_in_executor(None, self.engine.handle_player_input, event["content"])
                elif event["type"] == "player_silence":
                    await self._loop.run_in_executor(None, self.engine.handle_player_silence)
                elif event["type"] == "auto_beat":
                    await self._loop.run_in_executor(None, self.engine.handle_auto_beat)
            except Exception as e:
                self.engine.logger.error(f"事件消费错误: {e}", module="event", exception=e)