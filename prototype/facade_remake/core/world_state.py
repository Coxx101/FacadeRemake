"""
World State 模块
管理游戏世界的状态变量
"""
from typing import Dict, Any, Optional
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
