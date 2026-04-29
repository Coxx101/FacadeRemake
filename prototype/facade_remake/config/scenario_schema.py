"""场景配置 Schema - 定义完整的场景元素库和配置结构"""
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any


@dataclass
class ActionEntry:
    """行为库条目"""
    id: str                    # "walk_to"
    label: str                 # "走到"
    description: str           # "从当前位置移动到目标地点"
    parameters: List[str]      # 需要的参数，如 ["target_location"]


@dataclass
class ExpressionEntry:
    """表情库条目"""
    id: str                    # "happy"
    label: str                 # "开心"
    blendshape_name: str       # "smile" (映射到数字人)


@dataclass
class PropEntry:
    """物品库条目"""
    id: str                    # "wine_glass"
    label: str                 # "酒杯"
    can_pick_up: bool = True   # 是否可拾取


@dataclass
class LocationEntry:
    """地点库条目"""
    id: str                    # "living_room"
    label: str                 # "客厅"
    adjacent: List[str] = field(default_factory=list)  # 相邻地点


@dataclass
class SceneConstraints:
    """场景约束配置"""
    location_description: str      # "公寓客厅，三个大学好友做客"
    forbidden_actions: List[str]   # 禁止动作，如 ["离开", "暴力", "亲密行为"]
    forbidden_targets: List[str]  # 禁止目标的角色名列表
    
    can_leave_location: bool = False  # 玩家能否离开当前场景
    allowed_props: List[str] = field(default_factory=list)  # 允许使用的物品（空=全部允许）


@dataclass
class WorldStateDisplayConfig:
    """WorldState 显示配置 - 用于 LLM 提示词"""
    quality_displays: List[Dict[str, str]]  # [{key: "tension", label: "紧张度"}]
    flag_displays: List[Dict[str, str]]     # [{key: "secret_revealed", label: "秘密揭露"}]


@dataclass
class CharacterConfig:
    """角色配置"""
    id: str
    name: str
    identity: str
    personality: str
    background: List[str]
    secret_knowledge: List[str]
    ng_words: List[str] = field(default_factory=list)
    monologue_templates: List[Dict] = field(default_factory=list)
    default_location: str = "living_room"  # 默认位置


@dataclass
class NarrativeGoal:
    """叙事目标"""
    id: str
    name: str
    description: str
    beats: List[Dict[str, Any]]


@dataclass
class ScenarioConfig:
    """完整场景配置"""
    id: str
    name: str
    setting_name: str
    setting_description: str
    conflict_summary: str
    
    # 元素库
    action_library: List[ActionEntry]
    expression_library: List[ExpressionEntry]
    prop_library: List[PropEntry]
    location_library: List[LocationEntry]
    
    # 场景内容
    characters: List[CharacterConfig]
    narrative_goals: List[NarrativeGoal]
    world_state_schema: Dict[str, Any]
    
    # 场景约束
    scene_constraints: SceneConstraints
    
    # WorldState 显示配置
    world_state_display: WorldStateDisplayConfig
    
    # 叙事内容数据
    storylets: List[Dict[str, Any]] = field(default_factory=list)  # Storylet 列表
    landmarks: List[Dict[str, Any]] = field(default_factory=list)  # Landmark 列表