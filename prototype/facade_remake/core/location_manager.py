"""
位置管理器 - RPG游戏核心模块
管理玩家和实体的位置空间，支持地点移动和可见性检查
"""
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, field


@dataclass
class Location:
    """地点定义"""
    id: str
    label: str
    adjacent: List[str] = field(default_factory=list)
    description: str = ""
    # 该地点可互动的角色列表
    characters: List[str] = field(default_factory=list)
    # 该地点的物品列表
    props: List[str] = field(default_factory=list)


class LocationManager:
    """位置管理器"""

    def __init__(self):
        self._locations: Dict[str, Location] = {}
        # 玩家当前位置
        self._player_location: str = ""
        # 实体位置映射: entity_id -> location_id
        self._entity_locations: Dict[str, str] = {}

    def load_from_dicts(self, locations: List[Dict]) -> None:
        """从字典列表加载地点数据"""
        self._locations.clear()
        for loc_data in locations:
            loc_id = loc_data.get('id', '')
            if loc_id:
                self._locations[loc_id] = Location(
                    id=loc_id,
                    label=loc_data.get('label', loc_id),
                    adjacent=loc_data.get('adjacent', []),
                    description=loc_data.get('description', ''),
                    characters=loc_data.get('characters', []),
                    props=loc_data.get('props', []),
                )

    def get_location(self, location_id: str) -> Optional[Location]:
        """获取地点信息"""
        return self._locations.get(location_id)

    def get_all_locations(self) -> List[Dict]:
        """获取所有地点"""
        return [
            {
                "id": loc.id,
                "label": loc.label,
                "adjacent": loc.adjacent,
            }
            for loc in self._locations.values()
        ]

    def get_player_location(self) -> str:
        """获取玩家当前位置"""
        return self._player_location

    def set_player_location(self, location_id: str) -> bool:
        """设置玩家位置"""
        if location_id not in self._locations:
            return False
        old_location = self._player_location
        self._player_location = location_id
        return True

    def get_entity_location(self, entity_id: str) -> Optional[str]:
        """获取实体位置"""
        return self._entity_locations.get(entity_id)

    def set_entity_location(self, entity_id: str, location_id: str) -> bool:
        """设置实体位置"""
        if location_id not in self._locations:
            return False
        self._entity_locations[entity_id] = location_id
        return True

    def get_all_entity_locations(self) -> Dict[str, str]:
        """获取所有实体位置"""
        return dict(self._entity_locations)

    def is_adjacent(self, from_location: str, to_location: str) -> bool:
        """检查两个位置是否相邻"""
        if from_location == to_location:
            return True
        loc = self._locations.get(from_location)
        if not loc:
            return False
        return to_location in loc.adjacent

    def can_move_to(self, from_location: str, to_location: str) -> bool:
        """检查是否可以移动到目标位置"""
        return self.is_adjacent(from_location, to_location)

    def move_player(self, to_location: str) -> tuple[bool, str]:
        """
        移动玩家到目标位置
        返回: (success, message)
        """
        if not self._player_location:
            # 如果玩家还没有位置，设置初始位置
            if to_location in self._locations:
                self._player_location = to_location
                return True, f"到达 {self._locations[to_location].label}"
            return False, "目标位置不存在"

        if not self.can_move_to(self._player_location, to_location):
            return False, f"无法从 {self._player_location} 移动到 {to_location}"

        old_loc = self._locations.get(self._player_location)
        new_loc = self._locations.get(to_location)
        self._player_location = to_location

        if old_loc and new_loc:
            return True, f"从 {old_loc.label} 移动到 {new_loc.label}"
        return True, f"移动到 {to_location}"

    def get_entities_at_location(self, location_id: str) -> Dict[str, List[str]]:
        """获取指定位置的所有实体"""
        result: Dict[str, List[str]] = {"characters": [], "props": []}

        for entity_id, loc_id in self._entity_locations.items():
            if loc_id == location_id:
                # 根据 entity_id 前缀判断类型
                if entity_id.startswith("char_") or entity_id in self._get_all_character_ids():
                    result["characters"].append(entity_id)
                else:
                    result["props"].append(entity_id)

        # 也添加静态定义的实体
        loc = self._locations.get(location_id)
        if loc:
            result["characters"].extend(loc.characters)
            result["props"].extend(loc.props)

        return result

    def _get_all_character_ids(self) -> Set[str]:
        """获取所有角色ID"""
        char_ids = set()
        for loc in self._locations.values():
            char_ids.update(loc.characters)
        return char_ids

    def get_visible_entities(self, location_id: str) -> List[Dict]:
        """获取指定位置可见的所有实体信息（用于前端显示）"""
        entities = self.get_entities_at_location(location_id)
        result = []

        for char_id in entities["characters"]:
            result.append({
                "id": char_id,
                "name": self._format_entity_name(char_id),
                "type": "character"
            })

        for prop_id in entities["props"]:
            result.append({
                "id": prop_id,
                "name": self._format_entity_name(prop_id),
                "type": "prop"
            })

        return result

    def _format_entity_name(self, entity_id: str) -> str:
        """格式化实体名称"""
        # 移除前缀下划线，转为可读名称
        name = entity_id.split("_", 1)[-1] if "_" in entity_id else entity_id
        return name.replace("_", " ").title()

    def get_location_summary(self) -> Dict:
        """获取位置摘要（用于前端初始化）"""
        return {
            "locations": self.get_all_locations(),
            "player_location": self._player_location,
            "entity_locations": self.get_all_entity_locations(),
        }

    def initialize_player_location(self, location_id: str = None) -> None:
        """初始化玩家位置（如果未设置）"""
        if not self._player_location and self._locations:
            if location_id and location_id in self._locations:
                self._player_location = location_id
            else:
                # 默认设置为第一个地点
                self._player_location = next(iter(self._locations.keys()), "")

    def place_entity_at_starting_location(self, entity_id: str, location_id: str = None) -> None:
        """将实体放置在起始位置"""
        if location_id and location_id in self._locations:
            self._entity_locations[entity_id] = location_id
        elif self._player_location:
            # 放置在玩家位置
            self._entity_locations[entity_id] = self._player_location
        elif self._locations:
            # 放置在第一个地点
            first_loc = next(iter(self._locations.keys()))
            self._entity_locations[entity_id] = first_loc
