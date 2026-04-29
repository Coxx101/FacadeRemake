"""
依赖注入容器 - 集中管理所有模块实例，消除循环依赖
"""
from typing import Optional
import sys
import os

# 添加 facade_remake 目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.scenario_schema import ScenarioConfig


class DIContainer:
    def __init__(self, debug_mode: bool = False, provider: Optional[str] = None,
                 scenario_config: Optional[ScenarioConfig] = None):
        self.debug_mode = debug_mode
        self._provider = provider
        self._scenario_config = scenario_config

        self._llm_client = None
        self._world_state = None
        self._condition_store = None
        self._input_parser = None
        self._story_selector = None
        self._director = None
        self._trip_agent = None
        self._grace_agent = None
        self._storylet_manager = None
        self._landmark_manager = None
        self._state_manager = None
        self._logger = None

    @property
    def llm_client(self):
        if self._llm_client is None:
            from agents.llm_client import LLMClient
            self._llm_client = LLMClient(provider=self._provider)
        return self._llm_client

    @property
    def world_state(self):
        if self._world_state is None:
            from core.world_state import WorldState
            self._world_state = WorldState()
        return self._world_state

    @property
    def condition_store(self):
        if self._condition_store is None:
            from agents.input_parser import SemanticConditionStore
            self._condition_store = SemanticConditionStore()
        return self._condition_store

    @property
    def input_parser(self):
        if self._input_parser is None:
            from agents.input_parser import InputParser as CoreInputParser
            self._input_parser = CoreInputParser(
                llm_client=self.llm_client,
                condition_store=self.condition_store,
                scenario_config=self._scenario_config
            )
        return self._input_parser

    @property
    def storylet_manager(self):
        if self._storylet_manager is None:
            from core.storylet import StoryletManager
            self._storylet_manager = StoryletManager(llm_client=self.llm_client)
        return self._storylet_manager

    @property
    def landmark_manager(self):
        if self._landmark_manager is None:
            from core.landmark import LandmarkManager
            self._landmark_manager = LandmarkManager(llm_client=self.llm_client)
        return self._landmark_manager

    @property
    def story_selector(self):
        if self._story_selector is None:
            from agents.story_selector import StorySelector
            self._story_selector = StorySelector(
                self.storylet_manager,
                self.landmark_manager,
                llm_client=self.llm_client,
                scenario_config=self._scenario_config
            )
        return self._story_selector

    @property
    def director(self):
        if self._director is None:
            from agents.director import create_director
            self._director = create_director(
                llm_client=self.llm_client,
                debug_mode=self.debug_mode,
                scenario_config=self._scenario_config
            )
        return self._director

    @property
    def trip_agent(self):
        if self._trip_agent is None:
            from agents.character_agent import CharacterAgent
            self._trip_agent = self._create_character_agent("trip")
        return self._trip_agent

    @property
    def grace_agent(self):
        if self._grace_agent is None:
            from agents.character_agent import CharacterAgent
            self._grace_agent = self._create_character_agent("grace")
        return self._grace_agent

    @property
    def state_manager(self):
        if self._state_manager is None:
            from core.state_manager import StateManager
            self._state_manager = StateManager(self.world_state)
        return self._state_manager

    @property
    def logger(self):
        if self._logger is None:
            from core.logging import GameLogger, LogLevel
            level = LogLevel.DEBUG if self.debug_mode else LogLevel.INFO
            self._logger = GameLogger("FacadeRemake", level=level)
        return self._logger

    def _create_character_agent(self, name: str):
        """从 scenario_config 创建角色 Agent"""
        from agents.character_agent import CharacterAgent
        from dataclasses import asdict
        
        # 从 scenario_config 获取角色配置
        character_config = None
        if self._scenario_config:
            for char in self._scenario_config.characters:
                if char.id == name:
                    character_config = asdict(char)
                    break
        
        # 如果 scenario_config 未提供角色配置，抛出错误（强制配置化）
        if not character_config:
            raise ValueError(
                f"未找到角色 '{name}' 的配置。\n"
                f"请通过 scenario_config 参数提供角色配置。"
            )
        
        agent = CharacterAgent(self.llm_client, name, character_config, self._scenario_config)
        agent.set_debug(self.debug_mode)
        return agent

    def init_world_state(self):
        """从 scenario_config 初始化世界状态"""
        ws = self.world_state
        
        if self._scenario_config:
            schema = self._scenario_config.world_state_schema
            # 从 schema 初始化 qualities
            for quality in schema.get("qualities", []):
                ws.set_quality(quality, 0)
            # 从 schema 初始化 flags
            for flag in schema.get("flags", []):
                ws.set_flag(flag, False)
        else:
            # 兜底：如果没有 schema，使用默认值
            ws.set_quality("tension", 0)
            ws.set_flag("arrived", False)

    def load_data(self):
        """从 scenario_config 加载 Storylets 和 Landmarks"""
        if not self._scenario_config:
            raise ValueError(
                "scenario_config 未提供，无法加载数据。\n"
                "请在创建 DIContainer 时提供 scenario_config 参数。"
            )
        
        # 从 scenario_config 获取 storylets（如果有）
        storylets = getattr(self._scenario_config, 'storylets', None)
        landmarks = getattr(self._scenario_config, 'landmarks', None)
        
        if storylets:
            self.storylet_manager.load_from_dicts(storylets)
        if landmarks:
            self.landmark_manager.load_from_dicts(landmarks)

    def configure_scenario(self, scenario_config: ScenarioConfig):
        """配置场景，并清除依赖 scenario_config 的缓存单例"""
        self._scenario_config = scenario_config
        # 清除依赖 scenario_config 的已缓存单例，让它们下次访问时用新配置重建
        self._trip_agent = None
        self._grace_agent = None
        self._director = None
        self._input_parser = None
        self._story_selector = None