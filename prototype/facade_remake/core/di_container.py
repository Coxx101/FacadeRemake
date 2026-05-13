"""
依赖注入容器 - 集中管理所有模块实例，消除循环依赖
支持动态角色管理，不再硬编码角色名称
"""
from typing import Optional, Dict, Any, List
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
        self._input_parser = None
        self._story_selector = None
        self._director = None
        # 动态角色管理器 - 支持任意数量的自定义角色
        self._character_agents: Dict[str, Any] = {}
        self._storylet_manager = None
        self._landmark_manager = None
        self._location_manager = None
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
    def input_parser(self):
        if self._input_parser is None:
            from agents.input_parser import InputParser as CoreInputParser
            self._input_parser = CoreInputParser(
                llm_client=self.llm_client,
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
            self._landmark_manager = LandmarkManager()
        return self._landmark_manager

    @property
    def location_manager(self):
        if self._location_manager is None:
            from core.location_manager import LocationManager
            self._location_manager = LocationManager()
        return self._location_manager

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

    # ─── 动态角色管理接口 ──────────────────────────────────────────────────────

    def get_character_agent(self, character_id: str):
        """获取指定角色的 Agent"""
        if character_id not in self._character_agents:
            # 如果场景配置中存在该角色，尝试从配置创建
            if self._scenario_config:
                self._create_character_agent_from_config(character_id)
            else:
                raise ValueError(f"角色 '{character_id}' 未注册")
        return self._character_agents.get(character_id)

    def register_character_agent(self, character_id: str, agent):
        """注册角色 Agent"""
        self._character_agents[character_id] = agent

    def unregister_character_agent(self, character_id: str):
        """注销角色 Agent"""
        if character_id in self._character_agents:
            del self._character_agents[character_id]

    def list_characters(self) -> List[str]:
        """获取所有已注册角色的 ID 列表"""
        return list(self._character_agents.keys())

    def has_character(self, character_id: str) -> bool:
        """检查角色是否已注册"""
        return character_id in self._character_agents

    def clear_characters(self):
        """清除所有角色 Agent"""
        self._character_agents.clear()

    def _create_character_agent_from_config(self, name: str):
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
        self._character_agents[name] = agent
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
            # 如果没有 scenario_config，跳过加载（数据将通过 init_from_scene_data 传入）
            return
        
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
        self._character_agents.clear()
        self._director = None
        self._input_parser = None
        self._story_selector = None

    def init_from_scene_data(self, scene_data):
        """从前端发送的场景数据初始化"""
        # 初始化 WorldState
        from core.world_state import WorldState
        self._world_state = WorldState()
        ws = self._world_state
        
        # 从 world_state_definition 初始化
        wsd = scene_data.get('world_state_definition', {})
        for quality in wsd.get('qualities', []):
            ws.set_quality(quality['key'], quality.get('initial', 0))
        for flag in wsd.get('flags', []):
            ws.set_flag(flag['key'], flag.get('initial', False))
        for rel in wsd.get('relationships', []):
            ws.set_relationship(rel['key'], rel.get('initial', 0))
        
        # 加载 Storylets
        self.storylet_manager.load_from_dicts(scene_data.get('storylets', []))
        
        # 加载 Landmarks
        self.landmark_manager.load_from_dicts(scene_data.get('landmarks', []))
        
        # 保存共享上下文
        self._shared_context = scene_data.get('shared_context', {})
        
        # 保存库数据
        self._action_library = scene_data.get('action_library', [])
        self._expression_library = scene_data.get('expression_library', [])
        self._prop_library = scene_data.get('prop_library', [])
        self._location_library = scene_data.get('location_library', [])

        # 初始化位置管理器
        self._init_location_manager(scene_data)
        
        # 获取角色数据（需要在初始化位置前先获取）
        characters = scene_data.get('characters', [])
        
        # 将角色放置在初始位置
        self._init_entity_locations(characters)
        
        # 动态创建角色 Agent（支持任意数量的自定义角色）
        from agents.character_agent import CharacterAgent
        
        # 先清除旧角色
        self.clear_characters()
        for char in characters:
            char_id = char.get('id')
            if char_id:
                agent = CharacterAgent(self.llm_client, char_id, char, None)
                agent.set_debug(self.debug_mode)
                self.register_character_agent(char_id, agent)
        
        # 更新 director 和 input_parser 使用新数据
        self._director = None
        self._input_parser = None
        self._story_selector = None

    def _init_location_manager(self, scene_data: Dict) -> None:
        """初始化位置管理器"""
        # 加载地点数据
        locations = scene_data.get('location_library', [])
        if locations:
            self.location_manager.load_from_dicts(locations)
            # 初始化玩家位置为第一个地点
            self.location_manager.initialize_player_location()
        else:
            # 如果没有地点库，创建一个默认地点
            self.location_manager.load_from_dicts([
                {"id": "default", "label": "默认地点", "adjacent": []}
            ])
            self.location_manager.initialize_player_location("default")

    def _init_entity_locations(self, characters: List[Dict]) -> None:
        """初始化实体位置"""
        # 将所有角色放置在玩家初始位置
        player_loc = self.location_manager.get_player_location()
        if player_loc:
            for char in characters:
                char_id = char.get('id')
                if char_id:
                    self.location_manager.set_entity_location(char_id, player_loc)