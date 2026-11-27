"""Offline CharacterAgent and play-protocol regression tests."""
import json
import os
import unittest
from unittest.mock import AsyncMock, patch

import httpx
import openai
from fastapi.testclient import TestClient

# ws_server loads the application's existing import layout.
from ws_server import GameEventLoop, app
from agents.character_agent import CharacterAgent
from agents.director import DirectorAgent
from agents.llm_client import LLMClient


class FakeModel:
    """Exercise the real Pydantic AI pipeline without an API key or network."""

    def __init__(self, *replies):
        self.replies = iter(replies)
        self.requests = []
        self.make_client = openai.AsyncOpenAI

    def client(self, **kwargs):
        return self.make_client(
            **kwargs, http_client=httpx.AsyncClient(transport=httpx.MockTransport(self.respond))
        )

    def respond(self, request):
        self.requests.append(json.loads(request.content))
        reply = next(self.replies)
        if isinstance(reply, Exception):
            raise reply
        message = {"role": "assistant", "content": reply}
        return httpx.Response(200, json={
            "id": "chatcmpl-test", "object": "chat.completion", "created": 1,
            "model": self.requests[-1]["model"],
            "choices": [{"index": 0, "message": message, "finish_reason": "stop"}],
        })


def response(dialogue, action=""):
    return json.dumps({"thought": "", "dialogue": dialogue, "action": action}, ensure_ascii=False)


class CharacterOutputTests(unittest.IsolatedAsyncioTestCase):
    async def generate(self, fake, ng_words=None):
        with patch("openai.OpenAI"), patch("openai.AsyncOpenAI", side_effect=fake.client):
            llm = LLMClient(api_key="fake", provider="openai")
            agent = CharacterAgent(llm, "trip", {"ng_words": ng_words or []})
            return await agent.generate_response("你好", {}, {})

    async def test_valid_fields_and_existing_action_filter(self):
        fake = FakeModel(response("请进。", "invented[]look_at[player]say[]smirk"))
        result = await self.generate(fake)
        self.assertEqual(result, {
            "thought": "", "dialogue": "请进。", "actions": "look_at[player]say[]smirk",
        })
        self.assertEqual(len(fake.requests), 1)

    async def test_retry_for_missing_field(self):
        fake = FakeModel('{"dialogue":"未校验的台词"}', response("请进。"))
        self.assertEqual((await self.generate(fake))["dialogue"], "请进。")
        self.assertEqual(len(fake.requests), 2)

    async def test_invalid_output_is_not_displayed(self):
        fake = FakeModel("不是 JSON", '{"thought":"","dialogue":[],"action":""}')
        self.assertEqual(await self.generate(fake), {
            "thought": "", "dialogue": "……", "actions": "",
        })
        self.assertEqual(len(fake.requests), 2)

    async def test_forbidden_output_is_not_displayed_even_after_retry(self):
        fake = FakeModel(response("卧底", "say[]"), response("卧底", "say[]"))
        self.assertEqual((await self.generate(fake, ["卧底"]))["dialogue"], "……")
        self.assertEqual(len(fake.requests), 2)

    async def test_provider_timeout_uses_fallback(self):
        fake = FakeModel(httpx.ReadTimeout("simulated"))
        self.assertEqual((await self.generate(fake))["dialogue"], "……")
        self.assertEqual(len(fake.requests), 1)


class PlayProtocolTests(unittest.TestCase):
    def test_character_beat_reaches_websocket_client(self):
        fake = FakeModel(response("欢迎。", "say[]"))
        scene = {
            "landmarks": [{"id": "lm_1", "title": "开场", "phase_tag": "start"}],
            "storylets": [{
                "id": "opening", "title": "招待", "narrative_goal": "打招呼",
                "phase_tags": ["start"], "content": {},
            }],
            "characters": [{"id": "trip", "name": "Trip"}],
            "action_library": [{"id": "say", "label": "说话"}],
        }
        plan = [{"speaker": "trip", "intent": "打招呼"}, {"speaker": "player_turn"}]
        with (
            patch.dict(os.environ, {"LLM_API_KEY": "fake", "LLM_PROVIDER": "openai"}),
            patch("openai.OpenAI"),
            patch("openai.AsyncOpenAI", side_effect=fake.client),
            patch.object(GameEventLoop, "_player_input_loop", new_callable=AsyncMock),
            patch.object(DirectorAgent, "generate_beat_plan", return_value=plan),
            TestClient(app) as client,
            client.websocket_connect("/ws/play") as ws,
        ):
            self.assertEqual(ws.receive_json()["type"], "ready")
            ws.send_json({"type": "init_scene", "data": scene})
            # The reader also sees state and pipeline/debug messages.
            for _ in range(20):
                event = ws.receive_json()
                if event.get("type") == "error":
                    self.fail(event)
                if event.get("type") == "chat" and event.get("role") == "trip":
                    break
            else:
                self.fail("no character beat received")
            self.assertEqual(event, {
                "type": "chat", "role": "trip", "speech": "欢迎。", "action": "say[]",
            })


if __name__ == "__main__":
    unittest.main()
