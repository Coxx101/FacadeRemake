"""
LLM 客户端模块
封装 LLM 调用，支持多 Provider 切换
"""
import os
from typing import Optional, Dict, Any, List
from pathlib import Path

# 加载 .env 文件
try:
    from dotenv import load_dotenv
    current_file = Path(__file__).resolve()
    # llm_client.py -> agents/ -> facade_remake/ -> prototype/
    project_root = current_file.parent.parent.parent
    env_local = project_root / ".env.local"
    env_file = project_root / ".env"
    if env_local.exists():
        load_dotenv(env_local, override=True)
    elif env_file.exists():
        load_dotenv(env_file, override=True)
    else:
        load_dotenv(override=True)
except ImportError:
    pass


# ── Provider 预设配置 ───────────────────────────────────
PROVIDER_PRESETS = {
    "openai": {
        "base_url": None,
        "model": "gpt-4o-mini",
        "env_key": "OPENAI_API_KEY",
    },
    "deepseek": {
        "base_url": "https://api.deepseek.com",
        "model": "deepseek-chat",
        "env_key": "DEEPSEEK_API_KEY",
    },
}


class LLMClient:
    """LLM 客户端 - 支持多 Provider 切换"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        provider: Optional[str] = None,
    ):
        self.debug = False
        self.on_debug: Optional[callable] = None

        # 解析 provider（默认 deepseek）
        provider_name = provider or os.getenv("LLM_PROVIDER", "deepseek").lower()
        preset = PROVIDER_PRESETS.get(provider_name)

        if preset:
            self.provider = provider_name
            self.api_key = (
                os.getenv("LLM_API_KEY")
                or api_key
                or os.getenv(preset["env_key"])
            )
            self.base_url = (
                os.getenv("LLM_BASE_URL")
                or base_url
                or preset["base_url"]
            )
            self.model = (
                os.getenv("LLM_MODEL")
                or model
                or preset["model"]
            )
        else:
            self.provider = provider_name
            self.api_key = os.getenv("LLM_API_KEY") or api_key
            self.base_url = base_url
            self.model = model or "gpt-3.5-turbo"

        if not self.api_key:
            available = ", ".join(PROVIDER_PRESETS.keys())
            raise RuntimeError(
                f"未提供 API Key。\n"
                f"  方法 1: 设置 LLM_PROVIDER={available} 并配置对应的 _API_KEY 环境变量\n"
                f"  方法 2: 设置 LLM_API_KEY 环境变量\n"
                f"  方法 3: 构造时传入 api_key 参数"
            )

        import openai
        client_kwargs: Dict[str, Any] = {"api_key": self.api_key, "timeout": 60.0}
        if self.base_url:
            client_kwargs["base_url"] = self.base_url
        self.client = openai.OpenAI(**client_kwargs)

    def _emit_debug(self, event_type: str, payload: Dict):
        if self.debug:
            print(payload.get("_print", ""))
        if self.on_debug:
            clean = {k: v for k, v in payload.items() if not k.startswith("_")}
            self.on_debug(event_type, clean)

    def chat_completion(self, messages: List[Dict[str, str]],
                       temperature: float = 0.7,
                       max_tokens: Optional[int] = None,
                       debug_tag: str = "",
                       **extra_kwargs) -> str:
        """
        调用聊天补全 API

        Args:
            debug_tag: 组件标签，如 "InputParser/Gate1", "Director/BeatPlan"
        """
        log_messages = [{"role": msg.get("role", "?"), "content": msg.get("content", "")} for msg in messages]

        self._emit_debug("llm_request", {
            "_print": f"\n{'='*60}\n[LLM] model={self.model}, temp={temperature}, max_tokens={max_tokens}\n"
                      + "\n".join(f"  [{m['role'].upper()}] {m['content']}" for m in log_messages)
                      + "\n" + "-" * 60,
            "model": self.model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": log_messages,
            "component": debug_tag,
        })

        kwargs = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature
        }
        if max_tokens is not None:
            kwargs["max_tokens"] = max_tokens
        kwargs.update(extra_kwargs)
        
        try:
            response = self.client.chat.completions.create(**kwargs)
            content = response.choices[0].message.content

            self._emit_debug("llm_response", {
                "_print": f"  [LLM Response] {content}\n  {'-'*60}",
                "content": content,
                "component": debug_tag,
            })

            return content
        except Exception as e:
            print(f"[LLM] API 调用失败: {e}")
            import traceback
            traceback.print_exc()
            # 返回一个默认的 beat plan，让系统可以继续运行
            return '[{"speaker": "trip", "addressee": "player", "intent": "等待玩家反应", "urgency": "medium", "world_state_delta": {}, "state_change_hint": "气氛微妙"}]'

    def call_llm(self, prompt: str, max_tokens: Optional[int] = None,
                 temperature: float = 0.3, debug_tag: str = "") -> str:
        """单 prompt 调用（用于简单评估）"""
        messages = [{"role": "user", "content": prompt}]
        return self.chat_completion(messages, temperature=temperature, max_tokens=max_tokens, debug_tag=debug_tag)
