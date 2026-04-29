"""
统一日志与监控模块
"""
import logging
import sys
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum
from dataclasses import dataclass, field


class LogLevel(Enum):
    DEBUG = logging.DEBUG
    INFO = logging.INFO
    WARNING = logging.WARNING
    ERROR = logging.ERROR
    CRITICAL = logging.CRITICAL


@dataclass
class LogEntry:
    timestamp: datetime
    level: LogLevel
    module: str
    message: str
    context: Dict[str, Any] = field(default_factory=dict)


class GameLogger:
    def __init__(self, name: str = "FacadeRemake", level: LogLevel = LogLevel.DEBUG):
        self._logger = logging.getLogger(name)
        self._logger.setLevel(level.value)
        self._logger.handlers.clear()

        formatter = logging.Formatter(
            '%(asctime)s [%(levelname)s] %(name)s:%(module)s - %(message)s'
        )

        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        console_handler.setLevel(level.value)
        self._logger.addHandler(console_handler)

        file_handler = logging.FileHandler(f'{name.lower()}.log', encoding='utf-8')
        file_handler.setFormatter(formatter)
        file_handler.setLevel(logging.DEBUG)
        self._logger.addHandler(file_handler)

        self._metrics = {
            "llm_calls": 0,
            "storylet_switches": 0,
            "beat_plan_generations": 0,
            "state_changes": 0,
            "errors": 0,
            "warnings": 0,
        }
        self._timers = {}

    def debug(self, message: str, module: str = "", **context):
        if module:
            message = f"[{module}] {message}"
        if context:
            message += f" | {context}"
        self._logger.debug(message)

    def info(self, message: str, module: str = "", **context):
        if module:
            message = f"[{module}] {message}"
        if context:
            message += f" | {context}"
        self._logger.info(message)

    def warning(self, message: str, module: str = "", **context):
        self._metrics["warnings"] += 1
        if module:
            message = f"[{module}] {message}"
        if context:
            message += f" | {context}"
        self._logger.warning(message)

    def error(self, message: str, module: str = "", exception: Optional[Exception] = None, **context):
        self._metrics["errors"] += 1
        if module:
            message = f"[{module}] {message}"
        if context:
            message += f" | {context}"
        if exception:
            self._logger.error(f"{message}\nException: {exception}", exc_info=True)
        else:
            self._logger.error(message)

    def critical(self, message: str, module: str = "", exception: Optional[Exception] = None, **context):
        self._metrics["errors"] += 1
        if module:
            message = f"[{module}] {message}"
        if context:
            message += f" | {context}"
        if exception:
            self._logger.critical(f"{message}\nException: {exception}", exc_info=True)
        else:
            self._logger.critical(message)

    def increment_metric(self, key: str, value: int = 1):
        if key in self._metrics:
            self._metrics[key] += value
        else:
            self._metrics[key] = value

    def record_llm_call(self, provider: str, success: bool = True):
        self._metrics["llm_calls"] += 1

    def record_storylet_switch(self, old_storylet: str, new_storylet: str):
        self._metrics["storylet_switches"] += 1
        self.info(f"Storylet 切换: {old_storylet} -> {new_storylet}", module="narrative")

    def record_beat_plan_generation(self, beat_count: int):
        self._metrics["beat_plan_generations"] += 1
        self.debug(f"BeatPlan 生成完成，{beat_count} 个 beats", module="director")

    def record_state_change(self, delta: Dict[str, Any]):
        self._metrics["state_changes"] += 1
        self.debug(f"状态变化: {delta}", module="state")

    def start_timer(self, name: str):
        self._timers[name] = datetime.now()

    def stop_timer(self, name: str) -> float:
        if name in self._timers:
            elapsed = (datetime.now() - self._timers[name]).total_seconds()
            del self._timers[name]
            return elapsed
        return 0.0

    def get_metrics(self) -> Dict[str, int]:
        return self._metrics.copy()

    def reset_metrics(self):
        self._metrics = {k: 0 for k in self._metrics.keys()}

    def log_metrics(self):
        metrics_str = ", ".join(f"{k}: {v}" for k, v in self._metrics.items())
        self.info(f"指标汇总: {metrics_str}", module="monitoring")


_global_logger = None


def get_logger(name: str = "FacadeRemake") -> GameLogger:
    global _global_logger
    if _global_logger is None:
        _global_logger = GameLogger(name)
    return _global_logger


def debug_print(message: str, module: str = ""):
    get_logger().debug(message, module)


def debug_enabled() -> bool:
    return _global_logger is not None and _global_logger._logger.level <= logging.DEBUG