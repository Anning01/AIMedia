import json
import os

from utils.article_product import article_create


class ModelService:
    """模型配置服务"""
    def __init__(self):
        self.optPath = 'opt.json'
        self._init_mock_data()

    
    def _init_mock_data(self):
        """初始化模拟数据"""
        if os.path.exists(self.optPath):
            with open(self.optPath, 'r', encoding='utf-8') as file:
                self._config = json.load(file)
        else:
            self._config = {
                "glm": {
                    "api_key": "",
                    "platform_url": "https://open.bigmodel.cn/",
                },
                "kimi": {
                    "api_key": "",
                    "platform_url": "https://platform.moonshot.cn/",
                },
                "other": {
                    "api_key": "",
                    "platform_url": "",
                    "model": "",
                    "temperature": "0.7"
                },
                "publishNum": '5',
                "selected_model": "glm",
                "prompt": """Background:
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
8.要满足按照<人味写作指导>来书写文章"""
            }
    
    def get_config(self):
        """获取配置"""
        return self._config
    
    def save_config(self, config):
        """保存配置"""
        self._config.update(config)
        with open(self.optPath, 'w', encoding='utf-8') as file:
            json.dump(self._config, file, ensure_ascii=False, indent=4)

    def preview_task(self, topic,selected_model,api_key,prompt):
        """预览任务"""
        if len(prompt)== 0:
            prompt = None
        else:
            prompt = prompt
        try:
            content, usetokens,enable = article_create(topic,selected_model,api_key,prompt,False)
            return content + '\n' + f'本次使用tokens：{usetokens}'
        except Exception as e:
            print(f"预览任务出错: {e}")
            return f"生成预览内容失败: {str(e)}"
