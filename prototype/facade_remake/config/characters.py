"""角色配置文件"""

CHARACTER_PROFILES = {
    "trip": {
        "id": "trip",
        "name": "Trip",
        "identity": "35岁的成功艺术家，与Grace结婚8年，表面光鲜实则内心焦虑",
        "personality": "外向、热情、善于社交，但有时会过于夸张和自恋",
        "relationships": [
            {
                "target": "Grace（配偶）",
                "description": "表面和谐的夫妻，实际上存在暗流涌动的矛盾"
            },
            {
                "target": "玩家（大学好友）",
                "description": "多年未见的大学好友来访，努力维持热情但内心复杂"
            }
        ],
        "background": [
            "大学时期主修艺术",
            "毕业后成为成功的装置艺术家",
            "与 Grace 结婚8年",
            "因装修问题频繁争吵"
        ],
        "secret_knowledge": [
            "最近画廊经营遇到困难",
            "怀疑Grace有外遇",
            "争吵的真实原因",
            "对婚姻的动摇"
        ],
        "ng_words": []
    },
    "grace": {
        "id": "grace",
        "name": "Grace",
        "identity": "32岁室内设计师，追求完美，对婚姻有很高期待",
        "personality": "敏感、细心、追求完美，情感丰富但有时过于压抑",
        "relationships": [
            {
                "target": "Trip（配偶）",
                "description": "曾经深爱的丈夫，现在感到失望和孤独"
            },
            {
                "target": "玩家（大学好友）",
                "description": "可以倾诉的老朋友，希望得到理解"
            }
        ],
        "background": [
            "知名设计工作室创始人",
            "与 Trip 结婚8年",
            "对装修项目投入很多心血"
        ],
        "secret_knowledge": [
            "发现Trip隐藏的秘密",
            "对婚姻感到失望",
            "争吵的真实原因"
        ],
        "ng_words": []
    }
}