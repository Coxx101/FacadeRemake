"""
World State 模块
管理游戏世界的状态变量
"""
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field


@dataclass
class WorldState:
    """世界状态容器 — v2.0 统一管理数值/标记/关系/实体位置"""
    qualities: Dict[str, float] = field(default_factory=dict)
    flags: Dict[str, Any] = field(default_factory=dict)
    relationships: Dict[str, float] = field(default_factory=dict)
    # v2.0: 实体位置映射 { entity_id: location_id }
    # entity_id 可以是角色 ID（"trip", "grace"）、物品 ID（"wine_glass"）、或特殊键 "player"
    entity_positions: Dict[str, str] = field(default_factory=dict)

    # ── 位置管理（v2.0）──────────────────────────────────────────────

    def get_entity_position(self, entity_id: str) -> str:
        """获取实体当前位置，无记录返回空字符串"""
        return self.entity_positions.get(entity_id, "")

    def set_entity_position(self, entity_id: str, location_id: str):
        """设置实体位置"""
        self.entity_positions[entity_id] = location_id

    def get_entities_at(self, location_id: str) -> list[str]:
        """获取某位置的所有实体 ID 列表"""
        return [eid for eid, lid in self.entity_positions.items() if lid == location_id]

    def get_player_location(self) -> str:
        """快捷：获取玩家位置"""
        return self.get_entity_position("player")

    def set_player_location(self, location_id: str):
        """快捷：设置玩家位置"""
        self.set_entity_position("player", location_id)
    
    def get_quality(self, key: str, default: float = 0.0) -> float:
        """获取数值型变量"""
        return self.qualities.get(key, default)
    
    def set_quality(self, key: str, value: float):
        """设置数值型变量"""
        self.qualities[key] = value
    
    def get_flag(self, key: str, default: Any = None) -> Any:
        """获取标记型变量"""
        return self.flags.get(key, default)
    
    def set_flag(self, key: str, value: Any):
        """设置标记型变量"""
        self.flags[key] = value
    
    def get_relationship(self, key: str, default: float = 0.0) -> float:
        """获取关系数值"""
        return self.relationships.get(key, default)
    
    def set_relationship(self, key: str, value: float):
        """设置关系数值"""
        self.relationships[key] = value
    
    def get_all_qualities(self) -> Dict[str, float]:
        """获取所有数值型变量"""
        return self.qualities.copy()
    
    def get_all_flags(self) -> Dict[str, Any]:
        """获取所有标记型变量"""
        return self.flags.copy()
    
    def get_all_relationships(self) -> Dict[str, float]:
        """获取所有关系数值"""
        return self.relationships.copy()
    
    def apply_effect(self, effect: Dict[str, Any]):
        """应用一个效果到世界状态"""
        key = effect.get("key")
        op = effect.get("op")
        value = effect.get("value")
        
        if op == "=":
            if isinstance(value, bool):
                self.set_flag(key, value)
            elif isinstance(value, (int, float)):
                self.set_quality(key, float(value))
            else:
                # 字符串值存为 flag
                self.set_flag(key, value)
        elif op == "move":
            # v2.0: 移动实体 { "key": "trip", "op": "move", "value": "kitchen" }
            self.set_entity_position(key, str(value))
        elif op == "+":
            current = self.get_quality(key, 0.0)
            self.set_quality(key, current + float(value))
        elif op == "-":
            current = self.get_quality(key, 0.0)
            self.set_quality(key, current - float(value))
        elif op == "max":
            current = self.get_quality(key, 0.0)
            self.set_quality(key, max(current, float(value)))
        elif op == "min":
            current = self.get_quality(key, 0.0)
            self.set_quality(key, min(current, float(value)))
    
    def check_condition(self, condition: Dict[str, Any]) -> bool:
        """检查一个条件是否满足（None flag/quality 视为 False/0）"""
        cond_type = condition.get("type")
        key = condition.get("key")
        op = condition.get("op")
        value = condition.get("value")
        
        if cond_type == "quality_check":
            current = self.get_quality(key)
            target = float(value)
        elif cond_type == "flag_check":
            current = self.get_flag(key)
            target = value
            # 未初始化的 flag 对于布尔比较视为 False
            if current is None and isinstance(target, bool):
                current = False
            # 诊断打印
            if key == "arrived":
                print(f"  [check_cond] arrived: current={current!r} target={target!r} flags={dict(self.flags)!r}")
        elif cond_type == "relationship_check":
            current = self.get_relationship(key)
            target = float(value)
        else:
            return False
        
        if op == "==":
            return current == target
        elif op == "!=":
            return current != target
        elif op == ">=":
            return current >= target
        elif op == "<=":
            return current <= target
        elif op == ">":
            return current > target
        elif op == "<":
            return current < target
        
        return False
    
    def to_dict(self) -> Dict[str, Any]:
        """序列化为字典"""
        return {
            "qualities": self.qualities.copy(),
            "flags": self.flags.copy(),
            "relationships": self.relationships.copy(),
            "entity_positions": self.entity_positions.copy(),
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "WorldState":
        """从字典反序列化"""
        return cls(
            qualities=data.get("qualities", {}),
            flags=data.get("flags", {}),
            relationships=data.get("relationships", {}),
            entity_positions=data.get("entity_positions", {}),
        )

    def get_display_values(self) -> List[Dict[str, Any]]:
        """返回格式化的状态值列表，供前端展示。

        返回格式：[{"key": "tension", "value": 5.0, "max": 10, "label": "tension"}, ...]
        label 由外部 WSD 提供，此处仅返回原始 key。
        """
        result = []
        for key, current_val in self.qualities.items():
            result.append({"key": key, "value": current_val, "max": 10, "label": key})
        return result

    def compute_beat_delta(self,
                           effect_trends: Dict[str, Dict[str, Any]],
                           accumulated_delta: Dict[str, float],
                           player_input: str = "",
                           defusing_keywords: List[str] = None) -> Dict[str, int]:
        """根据 Storylet 效果大纲 + 上下文，计算 beat 级即时状态变化。

        Args:
            effect_trends: Storylet.get_effect_trends() 返回的趋势信息
            accumulated_delta: 本 Storylet 已累计的状态变化
            player_input: 玩家当前输入（空=没说话）
            defusing_keywords: 缓解气氛的关键词列表（由调用方从配置传入）

        Returns:
            实际 delta 字典，如 {"tension": 1, "grace_comfort": -1}
        """
        defusing_keywords = defusing_keywords or []
        
        delta = {}
        player_is_defusing = any(kw in player_input for kw in defusing_keywords) if player_input else False

        for key, trend_info in effect_trends.items():
            trend = trend_info.get("trend", "rising")
            lo, hi = trend_info.get("range", [0, 1])
            
            if trend == "set":
                continue  # set 类型不需要增量计算

            remaining = hi - accumulated_delta.get(key, 0)
            
            if remaining <= 0:
                # 已达上限，不再变化
                continue

            if player_is_defusing:
                # 玩家在缓解：逆趋势调整，允许小幅反向
                delta[key] = -1
            elif not player_input:
                # 玩家没说话：按趋势小幅推进
                delta[key] = min(1, remaining)
            else:
                # 玩家说了话但无特殊语义：正常推进
                delta[key] = min(1, remaining)

            # 确保 delta 不超出剩余空间
            if delta[key] > remaining:
                delta[key] = remaining

        return delta
