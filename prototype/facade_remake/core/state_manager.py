"""
状态管理器模块 - 封装状态操作，提供事务性更新能力
"""
from typing import Dict, Any, Optional, List, Callable
from contextlib import contextmanager
from copy import deepcopy

from core.world_state import WorldState


class StateTransaction:
    def __init__(self, state_manager: 'StateManager'):
        self._state_manager = state_manager
        self._original_state = None
        self._delta_log = []

    def begin(self):
        self._original_state = deepcopy(self._state_manager.world_state.to_dict())

    def commit(self):
        self._state_manager._log_transaction(self._delta_log)
        self._original_state = None
        self._delta_log = []

    def rollback(self):
        if self._original_state is not None:
            self._state_manager.world_state = WorldState.from_dict(self._original_state)
        self._original_state = None
        self._delta_log = []

    def apply_delta(self, delta: Dict[str, Any], hint: str = ""):
        self._delta_log.append({"delta": delta, "hint": hint})
        self._state_manager.apply_raw_delta(delta, hint)


class StateManager:
    def __init__(self, world_state: Optional[WorldState] = None):
        self.world_state = world_state or WorldState()
        self._change_listeners: List[Callable] = []
        self._transaction_stack: List[StateTransaction] = []
        self._history = []

    @contextmanager
    def transaction(self):
        transaction = StateTransaction(self)
        transaction.begin()
        self._transaction_stack.append(transaction)

        try:
            yield transaction
            transaction.commit()
        except Exception as e:
            transaction.rollback()
            raise e
        finally:
            self._transaction_stack.pop()

    def add_change_listener(self, listener: Callable[[Dict[str, Any], str], None]):
        self._change_listeners.append(listener)

    def remove_change_listener(self, listener: Callable):
        if listener in self._change_listeners:
            self._change_listeners.remove(listener)

    def _notify_listeners(self, delta: Dict[str, Any], hint: str):
        for listener in self._change_listeners:
            try:
                listener(delta, hint)
            except Exception:
                pass

    def _log_transaction(self, delta_log: List[Dict]):
        if delta_log:
            self._history.append({
                "turn": len(self._history),
                "changes": delta_log
            })

    def get_quality(self, key: str, default: float = 0.0) -> float:
        return self.world_state.get_quality(key, default)

    def set_quality(self, key: str, value: float):
        old_value = self.world_state.get_quality(key, 0.0)
        delta = {key: value - old_value} if value != old_value else {}
        self.world_state.set_quality(key, value)
        if delta:
            self._notify_listeners(delta, f"{key} 变为 {value}")

    def modify_quality(self, key: str, delta: float, hint: str = ""):
        current = self.world_state.get_quality(key, 0.0)
        new_value = current + delta
        self.world_state.set_quality(key, new_value)
        self._notify_listeners({key: delta}, hint)

    def get_flag(self, key: str, default: Any = None) -> Any:
        return self.world_state.get_flag(key, default)

    def set_flag(self, key: str, value: Any, hint: str = ""):
        old_value = self.world_state.get_flag(key)
        if old_value != value:
            self.world_state.set_flag(key, value)
            self._notify_listeners({key: value}, hint)

    def toggle_flag(self, key: str):
        current = self.world_state.get_flag(key, False)
        self.set_flag(key, not current, f"{key} 切换为 {not current}")

    def get_relationship(self, key: str, default: float = 0.0) -> float:
        return self.world_state.get_relationship(key, default)

    def set_relationship(self, key: str, value: float):
        old_value = self.world_state.get_relationship(key, 0.0)
        delta = {key: value - old_value} if value != old_value else {}
        self.world_state.set_relationship(key, value)
        if delta:
            self._notify_listeners(delta, f"关系 {key} 变为 {value}")

    def apply_effect(self, effect: Dict[str, Any], hint: str = ""):
        self.world_state.apply_effect(effect)
        self._notify_listeners(effect, hint)

    def apply_raw_delta(self, delta: Dict[str, Any], hint: str = ""):
        actual = {}
        for key, val in delta.items():
            if isinstance(val, (int, float)):
                current = self.world_state.get_quality(key, 0)
                self.world_state.set_quality(key, current + val)
                actual[key] = val
        if actual:
            self._notify_listeners(actual, hint)

    def check_condition(self, condition: Dict[str, Any]) -> bool:
        return self.world_state.check_condition(condition)

    def to_dict(self) -> Dict[str, Any]:
        return self.world_state.to_dict()

    def get_history(self, limit: int = 10) -> List[Dict]:
        return self._history[-limit:]

    def reset(self):
        self.world_state = WorldState()
        self._history = []


_global_state_manager = None


def get_global_state_manager() -> StateManager:
    global _global_state_manager
    if _global_state_manager is None:
        _global_state_manager = StateManager()
    return _global_state_manager