"""
FacadeRemake 原型入口
"""
import argparse
from core.di_container import DIContainer
from agents.llm_client import PROVIDER_PRESETS
from data import DINNER_PARTY_SCENARIO
from engine.game_engine import GameEngine
from engine.event_loop import GameEventLoop


def main():
    parser = argparse.ArgumentParser(description='FacadeRemake 原型')
    parser.add_argument('--debug', action='store_true', default=True)
    parser.add_argument('--no-debug', action='store_true')
    parser.add_argument('--provider', type=str, default=None,
                        choices=list(PROVIDER_PRESETS.keys()),
                        help='LLM Provider (openai / deepseek)')
    args = parser.parse_args()

    debug_mode = not args.no_debug
    engine = GameEngine(debug_mode=debug_mode, provider=args.provider, scenario_config=DINNER_PARTY_SCENARIO)
    event_loop = GameEventLoop(engine)
    event_loop.run()


if __name__ == "__main__":
    main()