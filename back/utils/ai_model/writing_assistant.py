# -*- coding: utf-8 -*-
from typing import Dict, Any, Optional
from langchain_community.chat_models import ChatZhipuAI, MoonshotChat
from utils.ai_model.token_tracker import TokenCallbackHandler
from utils.ai_model.tools import KnowledgeBaseTool


class WritingAssistant:

    def __init__(self, mod: str = 'glm', api_key: Optional[str] = '1cfafa5d63e9b217254cedc2a4b2113d.M7BmUs11zXrgKl6n',
                 temperature: float = 0.4, prompt: Optional[str] = None):
        # 创建一个共享的 token 追踪回调
        self.token_handler = TokenCallbackHandler()
        self.callbacks = [self.token_handler]

        # 保存自定义提示词
        self.custom_prompt = prompt

        # 初始化llm
        if mod == 'glm':
            print('glm')
            self.llm = ChatZhipuAI(
                model_name='glm-4-plus',
                api_key=api_key,
                temperature=temperature,
                callbacks=self.callbacks
            )
        elif mod == "kimi":
            print('kimi')
            self.llm = MoonshotChat(
                model_name='moonshot-v1-128k',
                api_key=api_key,
                temperature=temperature,
                callbacks=self.callbacks
            )
        else:
            self.llm = None

        # 初始化知识库
        self.knowledge_base = KnowledgeBaseTool()

    def generate_article(self, topics: str) -> Dict[str, Any]:
        try:
            print("\n" + "*" * 50)
            print("开始生成文章")

            # 重置token计数
            self.token_handler.reset_tokens()

            lines = topics.splitlines()
            topic = lines[0].strip()
            info = "\n".join(lines[1:]).strip()

            # 添加到知识库
            self.knowledge_base.add_document(info, f"{topic}.txt")

            # 查询知识库
            print("\n查询知识库...")
            background_info = self.knowledge_base._run(topic)

            # 生成文章
            print("\n生成文章...")
            # 使用自定义提示词或默认提示词
            if self.custom_prompt is not None:
                prompt = self.custom_prompt
            else:
                prompt = """你是资深中文自媒体作家。请根据以下信息创作一篇文章：
                主题：{topic}
                参考信息：{background_info}
                请遵循以下写作要求：
                - 文章必须是中文
                - 字数1300字左右
                - 三段式标题,标题字数不得超过25个字，否则将受到惩罚！
                - 避免使用承接词和过渡词汇，如"综上所述"、"首先"等。
                - 选择独特视角报道新闻，如背景、影响、未来趋势，保持客观公正。
                - 杜绝抄袭，增加噱头和观点，提升吸引力。
                - 原创度100%，避免与原文高相似度。
                - 去AI化，不设小标题,引言和结语。
                - 深入挖掘细节，提供背景信息和数据，丰富报道。
                - 引用内容不超过15%。
                - 加入个人分析和评论，提供独特见解。
                - 使用多样化表达，避免重复词汇和句式。
                - 采用个性化语言，尝试修辞手法。
                - 确保逻辑清晰，段落过渡明确。
                - 采用不同结构，如倒金字塔、时间线或问题导向。
                - 反问式总结，引发共鸣。
                """

            response = self.llm.invoke(
                prompt.format(
                    topic=topic,
                    background_info=background_info
                )
            )

            # 统计token
            token_usage = {
                "prompt_tokens": self.token_handler.tokens["prompt_tokens"],
                "completion_tokens": self.token_handler.tokens["completion_tokens"],
                "total_tokens": self.token_handler.tokens["total_tokens"],
                "successful_requests": self.token_handler.successful_requests
            }

            print("\nToken 使用情况:")
            for key, value in token_usage.items():
                print(f"{key}: {value}")

            # 清理知识库
            self.knowledge_base.delete_document(f"{topic}.txt")

            return {
                "content": response.content,
                "token_usage": token_usage
            }

        except Exception as e:
            print(f"\n发生错误: {str(e)}")
            return {
                "content": f"生成文章时发生错误: {str(e)}",
                "token_usage": None
            }
