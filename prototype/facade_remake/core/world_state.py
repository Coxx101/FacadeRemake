"""
World State 模块
管理游戏世界的状态变量
"""
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field


@dataclass
class WorldState:
    """世界状态容器"""
    qualities: Dict[str, float] = field(default_factory=dict)
    flags: Dict[str, Any] = field(default_factory=dict)
    relationships: Dict[str, float] = field(default_factory=dict)
    
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
        """检查一个条件是否满足"""
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
            "relationships": self.relationships.copy()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "WorldState":
        """从字典反序列化"""
        return cls(
            qualities=data.get("qualities", {}),
            flags=data.get("flags", {}),
            relationships=data.get("relationships", {})
        )

    def get_display_values(self) -> List[Dict[str, Any]]:
        """返回格式化的状态值列表，供前端展示。

        返回格式：[
            {"key": "tension", "value": 5.0, "max": 10, "label": "张力", "icon": "⚡"},
            ...
        ]
        """
        display_map = {
            "tension": {"label": "张力", "icon": "⚡", "max": 10},
            "grace_comfort": {"label": "Grace 舒适度", "icon": "💔", "max": 10},
            "trip_comfort": {"label": "Trip 舒适度", "icon": "💔", "max": 10},
            "marriage_tension": {"label": "婚姻张力", "icon": "⚡", "max": 10},
        }
        result = []
        for key, current_val in self.qualities.items():
            meta = display_map.get(key, {"label": key, "icon": "📊", "max": 10})
            result.append({
                "key": key,
                "value": current_val,
                "max": meta["max"],
                "label": meta["label"],
                "icon": meta["icon"],
            })
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
            defusing_keywords: 缓解气氛的关键词列表（可选）

        Returns:
            实际 delta 字典，如 {"tension": 1, "grace_comfort": -1}
        """
        if not defusing_keywords:
            defusing_keywords = ["冷静", "别吵", "算了", "没事", "缓一缓", "消消气",
                                  "不好意思", "抱歉", "对不起", "好吧", "行了"]
        
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
