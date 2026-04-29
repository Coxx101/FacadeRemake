"""
WebSocket 连接测试脚本
用于验证后端服务器是否正常运行
"""
import asyncio
import websockets
import json
import sys

async def test_connection():
    try:
        async with websockets.connect("ws://localhost:8000/ws/play") as websocket:
            print("✅ 成功连接到 WebSocket 服务器")
            
            # 发送测试场景数据
            test_data = {
                "type": "init_scene",
                "data": {
                    "landmarks": [
                        {
                            "id": "lm_1",
                            "title": "测试场景",
                            "description": "测试场景描述",
                            "phase_tag": "test",
                            "is_ending": False,
                            "transitions": [],
                        }
                    ],
                    "storylets": [
                        {
                            "id": "storylet_1",
                            "title": "测试故事",
                            "narrative_goal": "测试目标",
                            "phase_tags": ["test"],
                            "content": {
                                "director_note": "这是一个测试故事。欢迎来到测试场景。",
                            },
                            "effects": [],
                            "conditional_effects": [],
                        }
                    ],
                    "characters": [
                        {"id": "trip", "name": "Trip"},
                        {"id": "grace", "name": "Grace"},
                    ],
                    "world_state_definition": {
                        "qualities": [{"key": "tension", "label": "紧张度", "initial": 0}],
                        "flags": [{"key": "test_flag", "label": "测试标记", "initial": False}],
                        "relationships": [],
                    },
                },
            }
            
            print("📤 发送 init_scene...")
            await websocket.send(json.dumps(test_data))
            
            # 接收响应
            print("\n📥 等待响应...")
            for i in range(5):
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=3)
                    data = json.loads(response)
                    print(f"消息 {i+1}: type={data.get('type')}")
                    if data.get('type') == 'chat':
                        print(f"  角色: {data.get('role')}, 内容: {data.get('speech', '')[:50]}...")
                    elif data.get('type') == 'state_update':
                        print(f"  world_state: {data.get('world_state', {})}")
                except asyncio.TimeoutError:
                    print("超时，等待更多消息...")
                    break
            
            print("\n✅ 测试完成")
            
    except Exception as e:
        print(f"❌ 连接失败: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("=" * 60)
    print("WebSocket 连接测试")
    print("=" * 60)
    success = asyncio.run(test_connection())
    sys.exit(0 if success else 1)