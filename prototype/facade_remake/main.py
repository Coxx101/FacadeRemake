"""
FacadeRemake 原型主程序
最小可行原型 - 命令行界面
"""
import sys
import json
from typing import List, Dict, Any

from core.world_state import WorldState
from core.storylet import StoryletManager
from core.landmark import LandmarkManager
from core.story_selector import StorySelector
from agents.llm_client import LLMClient, InputParser, CharacterAgent
from agents.director import DirectorAgent, create_director
from data.default_storylets import DEFAULT_STORYLETS
from data.default_landmarks import DEFAULT_LANDMARKS


class FacadeRemakeGame:
    """游戏主类"""
    def __init__(self, debug_mode: bool = True):
        # 调试模式
        self.debug_mode = debug_mode

        # 初始化世界状态
        self.world_state = WorldState()
        self._init_world_state()

        # 初始化 LLM 客户端（必须在管理器之前）
        self.llm_client = LLMClient()
        self.input_parser = InputParser(self.llm_client)
        
        # 加载角色配置
        try:
            from config.characters import CHARACTER_PROFILES
            self.trip_agent = CharacterAgent(
                self.llm_client, 
                "trip", 
                CHARACTER_PROFILES.get("trip", {})
            )
            self.grace_agent = CharacterAgent(
                self.llm_client, 
                "grace", 
                CHARACTER_PROFILES.get("grace", {})
            )
        except ImportError:
            # 如果配置文件不存在，使用默认配置
            self.trip_agent = CharacterAgent(self.llm_client, "trip")
            self.grace_agent = CharacterAgent(self.llm_client, "grace")

        # 初始化管理器
        self.storylet_manager = StoryletManager(llm_client=self.llm_client)
        self.landmark_manager = LandmarkManager(llm_client=self.llm_client)

        # 加载数据
        self._load_data()

        # 初始化选择器
        self.story_selector = StorySelector(
            self.storylet_manager,
            self.landmark_manager,
            llm_client=self.llm_client
        )

        # ── 初始化导演 Agent（IBSEN 风格）───────────────────
        self.director = create_director(
            llm_client=self.llm_client,
            debug_mode=debug_mode
        )

        # 游戏状态
        self.current_turn = 0
        self.conversation_history: List[str] = []
        self.current_storylet = None
        self.storylet_turn_count = 0
        self.storylet_start_turn = 0  # 记录当前 storylet 开始回合
        self.landmark_start_turn = 0   # 记录当前 landmark 开始回合
        self.game_ended = False

        # 设置初始 Landmark
        self.landmark_manager.set_current("lm_1_arrive", self.world_state)
    
    def _init_world_state(self):
        """初始化世界状态（Facade 原版剧情）"""
        # 数值型
        self.world_state.set_quality("tension", 0)

        # 标记
        self.world_state.set_flag("arrived", False)
        self.world_state.set_flag("drinks_started", False)
        self.world_state.set_flag("renovation_fight", False)
        self.world_state.set_flag("trip_confessed", False)
        self.world_state.set_flag("grace_exposed", False)
        self.world_state.set_flag("secrets_revealed", False)
        self.world_state.set_flag("trip_detail_revealed", False)
        self.world_state.set_flag("grace_detail_revealed", False)
        self.world_state.set_flag("honest_conversation", False)
        self.world_state.set_flag("final_decision_made", False)
        self.world_state.set_flag("player_mediated", False)
    
    def _load_data(self):
        """加载 Storylets 和 Landmarks"""
        self.storylet_manager.load_from_dicts(DEFAULT_STORYLETS)
        self.landmark_manager.load_from_dicts(DEFAULT_LANDMARKS)
    
    def start(self):
        """开始游戏"""
        print("=" * 60)
        print("FacadeRemake 原型")
        print("基于 LLM + Storylet 架构的互动叙事系统")
        print("=" * 60)
        print()
        print("情境：你受邀到老友 Trip 和 Grace 家中做客。")
        print("气氛似乎有些微妙...")
        print()
        print("输入 'quit' 退出，'status' 查看状态")
        print("-" * 60)
        print()
        
        # 触发第一个 Storylet
        self._trigger_initial_storylet()
        
        # 主循环
        while True:
            try:
                # 获取玩家输入
                player_input = input("\n你: ").strip()

                if not player_input:
                    continue

                if player_input.lower() == "quit":
                    print("\n游戏结束。")
                    break

                if player_input.lower() == "status":
                    self._show_status()
                    continue

                # 处理回合
                self._process_turn(player_input)

                # 检查是否触发结局（由 _process_turn 内部设置 self.game_ended）
                if self.game_ended:
                    break

            except KeyboardInterrupt:
                print("\n\n游戏被中断。")
                break
            except EOFError:
                break
    
    def _trigger_initial_storylet(self):
        """触发初始 Storylet"""
        storylet = self.story_selector.select(
            self.world_state,
            self.current_turn
        )
        
        if storylet:
            self.current_storylet = storylet
            self.storylet_turn_count = 0
            self.storylet_start_turn = self.current_turn
            
            # ── 设置初始叙事目标 ───────────────────────────
            if storylet.narrative_goal:
                self.director.set_current_goal(storylet.narrative_goal)
            
            if self.debug_mode:
                self._show_storylet_start(storylet)
            self._execute_storylet("")
    
    def _process_turn(self, player_input: str):
        """处理一个回合"""
        self.current_turn += 1
        self.storylet_turn_count += 1

        # ── 通知 Director 推进回合计数 ───────────────────
        self.director.advance_turn()

        # 通知 LandmarkManager：本阶段又过了一回合
        self.landmark_manager.increment_turn_count()

        # 处理当前回合（Storylet 驱动）
        self._process_storylet_turn(player_input)

        # 检查 Landmark 推进（transitions 条件检查）
        next_landmark_id = self.landmark_manager.check_progression(
            self.world_state,
            player_input
        )

        if next_landmark_id:
            if self.debug_mode:
                self._show_landmark_summary()

            self.landmark_manager.set_current(next_landmark_id, self.world_state)
            next_landmark = self.landmark_manager.get_current()

            # ── 结局节点：显示结局，标记游戏结束 ──
            if next_landmark and next_landmark.is_ending:
                self._trigger_ending_landmark(next_landmark)
                self.game_ended = True
                return

            # ── 普通阶段节点：推进到下一阶段 ──
            print(f"\n[系统] 进入新阶段: {next_landmark.title if next_landmark else next_landmark_id}")
            self.landmark_start_turn = self.current_turn
            self.current_storylet = None
            self.storylet_turn_count = 0

        # 检查是否需要切换 Storylet
        if self._should_switch_storylet(player_input):
            if self.debug_mode and self.current_storylet:
                self._show_storylet_summary()

            new_storylet = self.story_selector.select(
                self.world_state,
                self.current_turn,
                player_input
            )

            if new_storylet and (not self.current_storylet or
                                new_storylet.id != self.current_storylet.id):
                if self.current_storylet:
                    print(f"\n[场景结束: {self.current_storylet.title}]")
                self.current_storylet = new_storylet
                self.storylet_turn_count = 0
                self.storylet_start_turn = self.current_turn

                # ── 更新 Director 叙事目标 ─────────────────
                if new_storylet.narrative_goal:
                    self.director.set_current_goal(new_storylet.narrative_goal)

                # 通知 LandmarkManager：本阶段又切换了一个 Storylet
                self.landmark_manager.increment_storylet_count()

                # ✅ 只在 Storylet 首次进入时应用一次 effects（防止数值每回合叠加）
                self._apply_storylet_effects()

                print(f"\n{'='*60}")
                print(f"[进入新场景: {new_storylet.title}]")
                print(f"叙事目标: {new_storylet.narrative_goal}")
                print(f"{'='*60}")
                if self.debug_mode:
                    self._show_storylet_start(new_storylet)

    def _process_storylet_turn(self, player_input: str):
        """使用普通 Storylet 模式处理回合"""
        # 1. 解析玩家输入
        context = {
            "situation": "家庭晚餐",
            "landmark": self.landmark_manager.current_landmark_id
        }
        parsed_input = self.input_parser.parse(player_input, context)

        if self.debug_mode:
            print(f"\n[DEBUG] 输入解析: {parsed_input}")

        # 2. 检测玩家调解行为（Act3 中主动介入才能触发和解结局）
        self._check_player_mediation(player_input)

        # 3. 执行当前 Storylet（生成角色回应）
        self._execute_storylet(player_input, parsed_input)

    def _check_player_mediation(self, player_input: str):
        """检测玩家是否在坦白后做出调解行为"""
        # 只在秘密揭露后才有意义
        if not self.world_state.get_flag("secrets_revealed"):
            return
        if self.world_state.get_flag("player_mediated"):
            return
        mediation_keywords = [
            "劝", "调解", "别吵", "好好说", "冷静", "和好", "谅解", "原谅",
            "理解", "沟通", "一起", "家人", "没事的", "没关系", "说开", "你们俩",
            "爸妈", "帮你们", "出面", "再给他一次机会",
            "你们俩", "说清楚", "好好谈",
        ]
        if any(kw in player_input for kw in mediation_keywords):
            self.world_state.set_flag("player_mediated", True)
            if self.debug_mode:
                print("[DEBUG] player_mediated → True（检测到玩家调解行为）")
    
    def _decide_speakers(self, player_input: str, storylet_content: Dict,
                          parsed_input: Dict = None) -> List[str]:
        """DRAMA LLAMA 风格：让 LLM 决定本轮哪些角色应该回应，以及顺序。

        返回角色名列表，例如 ["grace"] 或 ["trip", "grace"]。
        如果 LLM 判断失败，fallback 到 storylet 的 character_focus（向后兼容）。
        """
        characters_in_scene = ["trip", "grace"]
        director_note = storylet_content.get("director_note", "")
        narrative_goal = getattr(self.current_storylet, "narrative_goal", "") if self.current_storylet else ""

        # 取最近 3 条对话历史作为上下文
        recent = ""
        if self.conversation_history:
            recent = "\n".join(self.conversation_history[-4:])

        prompt = f"""你是一个叙事导演，正在安排一场戏剧中的对话。

【当前叙事目标】{narrative_goal}
【场景说明】{director_note}
在场角色：{characters_in_scene}

最近的对话：
{recent}

老友（玩家）刚才说："{player_input}"

请判断：接下来应该由哪个（或哪些）角色回应，以及回应顺序。
规则：
- 根据叙事目标选择最合适回应的角色
- 通常只有 1 个角色回应（最自然的方式）
- 如果两人都应该有反应，可以输出两个
- 考虑谁在场景中处于主导位置
- 考虑另一个角色是否会选择沉默或只有肢体反应

只输出角色名，用英文逗号分隔，例如：trip 或 grace 或 grace,trip
不要有任何其他内容："""

        try:
            raw = self.llm_client.call_llm(prompt, max_tokens=20, temperature=0.2)
            raw = raw.strip().lower()
            speakers = []
            for name in raw.split(","):
                name = name.strip()
                if name in ["trip", "grace"]:
                    speakers.append(name)
            if speakers:
                if self.debug_mode:
                    print(f"[DRAMA] 本轮发言角色（LLM 决定）：{speakers}")
                return speakers
        except Exception as e:
            if self.debug_mode:
                print(f"[DRAMA] 发言角色决策失败（{e}），fallback 到 character_focus")

        # Fallback：向后兼容旧的 character_focus 字段
        focus = storylet_content.get("character_focus", "both")
        if focus in ["trip", "grace"]:
            return [focus]
        primary = storylet_content.get("primary_speaker", "grace")
        secondary = "trip" if primary == "grace" else "grace"
        return [primary, secondary]

    def _execute_storylet(self, player_input: str, parsed_input: Dict = None):
        """执行 Storylet，生成角色回应（DRAMA LLAMA 风格：LLM 自决发言顺序）"""
        if not self.current_storylet:
            return

        storylet = self.current_storylet
        content = storylet.content

        # 先把玩家输入记录到对话历史
        if player_input and player_input.strip():
            self.conversation_history.append(f"玩家: {player_input}")

        # DRAMA LLAMA：让 LLM 决定本轮谁说话
        speakers = self._decide_speakers(player_input, content, parsed_input)

        for i, character in enumerate(speakers):
            # 第二个角色往后：让其知道前一个角色已经说话了
            extra_note = ""
            if i > 0:
                extra_note = "（另一个角色已经做出了回应，你根据情境决定是否开口，可以沉默、用肢体回应或简短说话，不要重复对方的内容。）"
            self._generate_character_response(
                character, player_input, content,
                extra_director_note=extra_note,
                skip_history_append_player=True  # 玩家输入已在上面记录，不要重复
            )

        # 显示提示
        if storylet.choices_hint and self.storylet_turn_count == 0:
            print(f"\n[你可以: {', '.join(storylet.choices_hint)}]")
    
    def _generate_character_response(self, character: str, player_input: str, content: Dict,
                                      extra_director_note: str = "",
                                      director_instruction: str = "",
                                      skip_history_append_player: bool = False):
        """生成单个角色的回应，分层显示：内心独白 / 言语 / 动作

        Args:
            character: 角色名
            player_input: 玩家输入
            content: Storylet 内容
            extra_director_note: 额外的导演备注
            director_instruction: 导演指导（由 DirectorAgent 生成）
            skip_history_append_player: 是否跳过记录玩家输入
        """

        # 如果 skip_history_append_player=False，才把玩家输入加入历史
        # （默认 False 兼容旧调用路径；_execute_storylet 已在外部记录，传入 True 跳过）
        if not skip_history_append_player and player_input and player_input.strip():
            self.conversation_history.append(f"玩家: {player_input}")

        # 合并 extra_director_note 到 content（不修改原始 dict）
        effective_content = dict(content)
        if extra_director_note:
            orig = effective_content.get("director_note", "")
            effective_content["director_note"] = orig + " " + extra_director_note

        # 注入 narrative_goal（来自 storylet 顶层）
        if self.current_storylet and "narrative_goal" not in effective_content:
            effective_content["narrative_goal"] = getattr(self.current_storylet, "narrative_goal", "")

        # ── 获取导演指导 ────────────────────────────────────
        # 如果没有提供导演指导，使用 DirectorAgent 动态生成
        if not director_instruction and hasattr(self, 'director'):
            director_instruction = self.director.generate_instruction_for(
                character=character,
                storylet_content=effective_content,
                world_state=self.world_state.to_dict(),
                dialogue_history=self.conversation_history,
                use_llm=True  # 使用 LLM 生成精细指导
            )
            if self.debug_mode:
                print(f"\n[Director] 为 {character} 生成指导:\n{director_instruction[:100]}...")

        # 获取当前 Landmark 的禁止话题
        current_landmark = self.landmark_manager.get_current()
        forbidden_topics = current_landmark.get_forbidden_reveals() if current_landmark else []

        # 提取 allowed_behaviors（支持列表/字典两种格式）
        raw_behaviors = content.get("allowed_behaviors")
        allowed_behaviors = None
        if isinstance(raw_behaviors, list):
            allowed_behaviors = raw_behaviors
        elif isinstance(raw_behaviors, dict):
            allowed_behaviors = raw_behaviors.get(character)

        agent = self.trip_agent if character == "trip" else self.grace_agent
        result = agent.generate_response(
            player_input,
            effective_content,
            self.world_state.to_dict(),
            self.conversation_history,
            director_instruction=director_instruction,
            forbidden_topics=forbidden_topics,
            allowed_behaviors=allowed_behaviors
        )

        # ── 分层显示输出 ────────────────────────────────
        thought = result.get("thought", "")
        speech = result.get("speech", "")
        action = result.get("action", "")

        # 清理可能残留的角色名前缀
        speech = self._clean_response_prefix(speech, character)

        # 内心独白（仅调试模式显示，用不同样式区分）
        if thought and self.debug_mode:
            print(f"\n  💭 [{character} 内心] {thought}")

        # 言语 + 动作
        if speech and action:
            print(f"\n{character}: {speech}")
            print(f"  {action}")
        elif speech:
            print(f"\n{character}: {speech}")
        elif action:
            # 只有动作，没有台词（沉默但有反应）
            print(f"\n{character}: {action}")
        else:
            # 完全沉默（LLM 给了空回应）
            if self.debug_mode:
                print(f"\n  [{character} 保持沉默]")

        # 记录到对话历史（speech + action 合并为一行）
        history_line = self._format_history_line(character, speech, action)
        if history_line:
            self.conversation_history.append(history_line)

    def _format_history_line(self, character: str, speech: str, action: str) -> str:
        """将 speech 和 action 合并为对话历史中的一行文本"""
        parts = []
        if speech:
            parts.append(speech)
        if action:
            parts.append(action)
        if parts:
            return f"{character}: {'  '.join(parts)}"
        return ""
    
    def _clean_response_prefix(self, response: str, character: str) -> str:
        """清理 LLM 可能在回应前加的角色名前缀"""
        # 所有可能的前缀（包括中英文）
        all_prefixes = [
            "trip:", "trip：",
            "grace:", "grace：",
            "Trip:", "Trip：",
            "Grace:", "Grace：",
            "特拉维斯:", "特拉维斯：",
            "格蕾丝:", "格蕾丝：",
        ]
        cleaned = response.strip()
        # 循环清理，直到没有前缀为止
        while True:
            found = False
            for prefix in all_prefixes:
                if cleaned.lower().startswith(prefix.lower()):
                    cleaned = cleaned[len(prefix):].strip()
                    found = True
                    break
            if not found:
                break
        return cleaned
    
    def _apply_storylet_effects(self):
        """应用 Storylet 效果"""
        if not self.current_storylet:
            return

        # 应用普通效果
        for effect in self.current_storylet.effects:
            self.world_state.apply_effect(effect)

        # 应用条件效果
        for conditional_effect in self.current_storylet.conditional_effects:
            if self._check_conditional_effect(conditional_effect):
                for effect in conditional_effect.get("effects", []):
                    self.world_state.apply_effect(effect)

    def _check_conditional_effect(self, conditional_effect: Dict) -> bool:
        """检查条件效果是否满足"""
        conditions = conditional_effect.get("conditions", [])

        # 如果没有条件，默认满足
        if not conditions:
            return True

        # 所有条件都必须满足
        for condition in conditions:
            cond_type = condition.get("type")

            if cond_type == "quality_check":
                key = condition.get("key")
                op = condition.get("op")
                value = condition.get("value")
                current = self.world_state.get_quality(key)

                if not self._compare_values(current, op, value):
                    return False

            elif cond_type == "flag_check":
                key = condition.get("key")
                op = condition.get("op")
                value = condition.get("value")
                current = self.world_state.get_flag(key)

                if not self._compare_values(current, op, value):
                    return False

            elif cond_type == "turn_range":
                min_turn = condition.get("min_turn", 0)
                max_turn = condition.get("max_turn", float('inf'))

                if self.current_turn < min_turn or self.current_turn > max_turn:
                    return False

        return True
    
    def _should_switch_storylet(self, player_input: str) -> bool:
        """判断是否应该切换 Storylet"""
        if not self.current_storylet:
            return True

        storylet = self.current_storylet

        # 检查 sticky 状态
        if storylet.sticky:
            # sticky Storylet 不会被切换，除非达到强制结束条件
            return self._check_force_wrap_up()

        # 检查回合限制
        completion = storylet.completion_trigger
        if completion:
            max_turns = completion.get("max_turns", 10)
            if self.storylet_turn_count >= max_turns:
                return True

        # 默认：3-5 回合后考虑切换
        if self.storylet_turn_count >= 5:
            return True

        return False

    def _check_force_wrap_up(self) -> bool:
        """检查是否应该强制结束当前 Storylet"""
        if not self.current_storylet:
            return False

        force_wrap = self.current_storylet.force_wrap_up
        if not force_wrap:
            return False

        # 检查回合限制
        max_turns = force_wrap.get("max_turns", 15)
        if self.storylet_turn_count >= max_turns:
            return True

        # 检查世界状态条件
        conditions = force_wrap.get("conditions", [])
        for condition in conditions:
            if not self._evaluate_condition(condition):
                return False

        return True
    
    def _show_status(self):
        """显示当前状态"""
        print("\n" + "=" * 60)
        print("当前世界状态")
        print("=" * 60)
        print(f"回合: {self.current_turn}")
        print(f"当前 Landmark: {self.landmark_manager.current_landmark_id}")
        landmark = self.landmark_manager.get_current()
        if landmark:
            print(f"  └─ {landmark.title}: {landmark.description}")
        print(f"当前 Storylet: {self.current_storylet.title if self.current_storylet else 'None'}")
        if self.current_storylet:
            print(f"  └─ 叙事目标: {self.current_storylet.narrative_goal}")
        print(f"Storylet 已进行: {self.storylet_turn_count} 回合")
        print("-" * 60)
        print("数值:")
        print(f"  tension: {self.world_state.get_quality('tension')}")
        print("-" * 60)
        print("标记:")
        flags_to_show = [
            'arrived', 'drinks_started', 'renovation_fight',
            'trip_confessed', 'grace_exposed', 'secrets_revealed',
            'trip_detail_revealed', 'grace_detail_revealed',
            'honest_conversation', 'final_decision_made', 'player_mediated'
        ]
        for flag in flags_to_show:
            value = self.world_state.get_flag(flag)
            status = "Y" if value else "-"
            print(f"  [{status}] {flag}")
        print("=" * 60)
    
    def _show_storylet_start(self, storylet):
        """显示 Storylet 开始时的调试信息"""
        if not self.debug_mode:
            return
        print(f"\n[DEBUG] Storylet 开始: {storylet.id}")
        print(f"[DEBUG] 阶段标签: {storylet.phase_tags}")
        print(f"[DEBUG] Salience 基础分: {storylet.salience.get('base', 5)}")
        print(f"[DEBUG] 可重复性: {storylet.repeatability}")
    
    def _show_storylet_summary(self):
        """显示 Storylet 结束总结"""
        if not self.current_storylet:
            return
        duration = self.current_turn - self.storylet_start_turn
        print(f"\n{'='*60}")
        print(f"📋 Storylet 总结: {self.current_storylet.title}")
        print(f"{'='*60}")
        print(f"持续时间: {duration} 回合")
        print(f"触发次数: {self.current_storylet.times_triggered}")
        print(f"执行的效果:")
        for effect in self.current_storylet.effects:
            print(f"  · {effect['key']} {effect['op']} {effect['value']}")
        print(f"{'='*60}")
    
    def _show_landmark_summary(self):
        """显示 Landmark 阶段总结"""
        landmark = self.landmark_manager.get_current()
        if not landmark:
            return
        duration = self.current_turn - self.landmark_start_turn
        print(f"\n{'='*60}")
        print(f"🎬 Landmark 阶段总结: {landmark.title}")
        print(f"{'='*60}")
        print(f"持续时间: {duration} 回合")
        print(f"开始时的世界状态:")
        print(f"  (此处可记录进入时的状态快照)")
        print(f"结束时的世界状态:")
        print(f"  tension: {self.world_state.get_quality('tension')}")
        print(f"  secrets_revealed: {self.world_state.get_flag('secrets_revealed')}")
        print(f"{'='*60}")

    def _trigger_ending_landmark(self, landmark):
        """触发结局 Landmark（is_ending=True 的节点）"""
        print(f"\n{'='*60}")
        print(f"🏁 结局: {landmark.title}")
        print(f"{'='*60}")
        print(f"\n{landmark.description}\n")
        if landmark.ending_content:
            print(landmark.ending_content.strip())
        print(f"\n{'='*60}")
        print(f"\n[游戏结束 - 总回合数: {self.current_turn}]")
        print(f"[tension 最终值: {self.world_state.get_quality('tension')}]")
        print(f"[坦白路径: trip={self.world_state.get_flag('trip_confessed')}, grace={self.world_state.get_flag('grace_exposed')}]")
        print(f"[坦诚对话: {self.world_state.get_flag('honest_conversation')}]")
        print(f"[玩家调解: {self.world_state.get_flag('player_mediated')}]")
        print(f"{'='*60}\n")

    def _compare_values(self, actual, op: str, expected) -> bool:
        """比较值（用于兼容旧代码路径，现在主要由 LandmarkTransition 内部处理）"""
        if op == "==":
            return actual == expected
        elif op == "!=":
            return actual != expected
        elif op == ">":
            return actual > expected
        elif op == ">=":
            return actual >= expected
        elif op == "<":
            return actual < expected
        elif op == "<=":
            return actual <= expected
        return False


def main():
    """主函数"""
    import argparse
    parser = argparse.ArgumentParser(description='FacadeRemake 原型')
    parser.add_argument('--debug', action='store_true', default=True,
                       help='启用调试模式（显示详细状态）')
    parser.add_argument('--no-debug', action='store_true',
                       help='关闭调试模式')
    args = parser.parse_args()
    
    debug_mode = not args.no_debug
    game = FacadeRemakeGame(debug_mode=debug_mode)
    game.start()


if __name__ == "__main__":
    main()
