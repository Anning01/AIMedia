# -*- coding: utf-8 -*-
import json
import random
from typing import Dict, Any, Optional
from langchain_community.chat_models import ChatZhipuAI, MoonshotChat
from ai_model.token_tracker import TokenCallbackHandler
from ai_model.tools import KnowledgeBaseTool
from openai import OpenAI

class WritingAssistant:

    def __init__(self, mod: str = 'glm', api_key: Optional[str] = '',
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
            self.llm =None


        # 初始化知识库
        self.knowledge_base = KnowledgeBaseTool()

    def generate_article(self, topics: str) -> Dict[str, Any]:
        try:
            print("\n" + "*" * 50)
            print("开始生成文章")

            lines = topics.splitlines()
            topic = lines[0].strip()
            info = "\n".join(lines[1:]).strip()

            # 添加到知识库
            self.knowledge_base.add_document(info, f"{topic}.txt")

            # 查询知识库
            print("\n查询知识库...")
            background_info = self.knowledge_base._run(topic)

            my_prompt = ["""Background:
            作为一名AI文章自然写作专家，你的目标是引导AI创作出具有人类写作特色的文本。你需要利用你对人类写作风格的深刻理解和自然语言处理的技能，来指导AI生成的文章从一开始就避免机械和公式化的痕迹，增强文章的可读性和亲和力。
            ##Skills:
            深度理解人类写作风格和习惯
            识别并避免AI写作的常见特征和模式
            语言润色和重写能力
            增加文章的情感和个性化表达
            调整句式结构，增加变化性
            ##人味写作指导
            1.句式多样化：
            避免使用单一的句子结构
            结合长短句，增加文章的节奏感
            2.个性化表达：
            在适当的地方加入个人观点或感受
            根据文章主题和目标受众调整语言风格
            3.情感注入：
            在文章中适当加入情感词汇和感官细节
            使用反问、感叹等表达方式增加情感色彩
            4.逻辑连贯性：
            使用自然的过渡词和短语
            确保文章段落之间的逻辑关系清晰
            5.避免机械化特征：
            减少数字列举和重复句式的使用
            用生动的词汇替换专业术语
            6.增加互动性：
            适当加入设问，邀请读者思考或想象
            使用直接称呼增加文章的互动性
            7.表达流畅自然：
            避免使用“首先、其次、再次、最后”等明显的排序词
            减少使用“总之、综上所述”等明显的总结词
            用更自然的表达替代“值得注意的是、需要指出的是”等套话
            ##Workflow:
            1.主题：{topic}，背景信息：{background_info}
            2.根据给定的主题和背景信息，书写文章时，要按照<人味写作指导>来书写文章
            ##Constraints:
            1.文章必须中文，字数1300左右，不设小段落标题，引言和结语。
            2.采用三段式标题，标题总字数不超过25个字
            3.确保文章在逻辑上更加连贯
            4.避免过度修饰导致文章变得不自然
            5.根据文章主题和目标受众调整语言风格
            6.严格避免使用明显的AI风格词语和句式结构,
            7.确保文章的语言流畅自然，像人类写作一样有节奏感和变化
            8.要满足按照<人味写作指导>来书写文章"""]
            # 使用自定义提示词或默认提示词
            if self.custom_prompt is not None:
                prompt = self.custom_prompt
            else:
                prompt = random.choice(my_prompt)

            with open('opt.json', 'r', encoding='utf-8') as file:
                _config = json.load(file)
            if _config['selected_model'] != 'other':
                # 重置token计数
                self.token_handler.reset_tokens()

                # 生成文章
                print("\n生成文章ss...")

                # print(prompt)
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
            else:
                print("\n生成文章...")
                client = OpenAI(api_key=_config['other']['api_key'], base_url=_config['other']['platform_url'])
                response = client.chat.completions.create(
                    model=_config['other']['model'],
                    messages=[
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": f'topic:{topic},background_info:{background_info}'},
                    ],
                    stream=False,
                    temperature=_config['other']['temperature'],
                )
                res = response.choices[0].message.content
                # 清理知识库
                self.knowledge_base.delete_document(f"{topic}.txt")

                # 统计token
                token_usage = {
                    "prompt_tokens": -1,
                    "completion_tokens": -1,
                    "total_tokens": -1,
                    "successful_requests": -1
                }
                return {
                    "content": res,
                    "token_usage": token_usage
                }

        except Exception as e:
            print(f"\n发生错误: {str(e)}")
            return {
                "content": f"生成文章时发生错误: {str(e)}",
                "token_usage": None
            }
