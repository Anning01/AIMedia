import json
import os
import re
import time

from django.conf import settings
from langchain_community.chat_models import ChatZhipuAI
from langchain_community.tools import BaseTool
from zhipuai import ZhipuAI


# 搜索引擎工具
class SearchTool:
    def __init__(self, API_KEY):
        self.API_KEY = API_KEY

    def run(self, query):
        try:
            client = ZhipuAI(api_key=self.API_KEY)
            messages = [{"role": "user", "content": query}]
            tool_zhipu = [
                {"type": "web_search", "web_search": {"enable": True, "search_query": query}}
            ]
            response = client.chat.completions.create(
                model="glm-4-flash", messages=messages, tools=tool_zhipu
            )
            if response.choices:
                return response.choices[0].message.content
            else:
                return "No results found."
        except Exception as e:
            return f"An error occurred: {str(e)}"


# 文章生成逻辑工具
class ContentAnalysisTool(BaseTool):
    name: str = "content_analysis"
    description: str = "分析主题内容，提供写作建议和关键点"

    def _run(self, topic: str) -> str:
        print("\n" + "=" * 50)
        print("[ContentAnalysisTool] 开始分析主题")

        result = f"""
基于主题"{topic}"的内容分析：
  1. 核心关键点：[分析主题的主要方面]
  2. 写作角度建议：[提供独特的写作视角]
  3. 受众分析：[分析目标受众的兴趣点]
  4. 热点关联：[相关的热点话题]
"""

        return result


class OutlineGeneratorTool(BaseTool):
    name: str = "outline_generator"
    description: str = "生成文章大纲"

    def _run(self, topic: str) -> str:
        print("\n" + "=" * 50)
        print("[OutlineGeneratorTool] 开始生成大纲")

        result = f"""
为主题"{topic}"生成的文章大纲：
  1. 引言部分：吸引读者注意
  2. 主体部分：
     - 核心观点1
     - 核心观点2
     - 核心观点3
  3. 结论部分：总结和引发思考
"""
        return result


class ArticleWriterTool(BaseTool):
    name: str = "article_writer"
    description: str = "根据大纲和分析生成完整文章"

    def _run(self, outline: str) -> str:
        print("\n" + "=" * 50)
        print("[ArticleWriterTool] 开始生成文章")

        result = "根据大纲生成的完整文章内容..."

        return result


class KnowledgeBaseTool(BaseTool):
    name: str = "knowledge_base"
    description: str = "从知识库中检索相关信息"
    docs_dir: str = None
    use_offline: bool = True
    documents: list | None = None
    api_key: str | None = None
    max_chars: int = 500  # 限制返回的最大字符数

    def __init__(self, docs_dir: str = "./ai_model/knowledge_base"):
        super().__init__()
        self.docs_dir = docs_dir
        self.max_chars = 500  # 限制知识库返回的最大字符数

        # 确保文档目录存在
        if not os.path.exists(self.docs_dir):
            os.makedirs(self.docs_dir)

        self._initialize_knowledge_base()

    def _initialize_knowledge_base(self):
        """初始化知识库"""
        try:
            # 获取所有txt文件
            txt_files = []
            for file in os.listdir(self.docs_dir):
                if file.endswith(".txt"):
                    txt_files.append(os.path.join(self.docs_dir, file))

            # 加载所有文档
            self.documents = txt_files
        except Exception as e:
            print(f"Error initializing knowledge base: {str(e)}")
            self.documents = []

    def _run(self, query: str) -> str:
        """运行知识库查询，返回结构化的信息概要"""
        print("\n" + "=" * 50)
        print("[KnowledgeBaseTool] 开始查询知识库")

        if not query:
            return "请提供查询内容"
        raw_content = ""
        # 尝试使用向量搜索
        if self.docs_dir:
            for doc in self.documents:
                querys = re.sub(r"[^\w]", "", query)
                if querys in doc:
                    with open(doc, encoding="utf-8") as f:
                        raw_content = f.read()
                        break
        if not raw_content:
            return "未找到相关信息"
        try:
            file_path = "opt.json"
            with open(file_path, encoding="utf-8") as file:
                content = json.load(file)
                api_key = content["glm"]["api_key"]
        except:
            api_key = settings.GML_KEY
        # 提取关键信息
        try:
            # 使用 LLM 提取结构化信息
            llm = ChatZhipuAI(model_name="glm-4-flash", api_key=api_key, temperature=0.1)
            response = llm.invoke(
                f"""请从以下文本中提取关键信息，按照以下格式输出：
                时间：[具体发生时间]
                地点：[事件发生地点]
                人物：[相关人物及身份]
                事件：[主要事件经过，200字以内]
                背景：[相关背景信息，100字以内]
                影响：[事件的社会影响，100字以内]
                痛点：[事件背后相关痛点，100字以内]
                原文：{raw_content}
                只需提取关键信息，无需添加任何其他内容。如果某项信息不存在，则填写"未提及"。
                """
            )

            print("\n提取的信息概要：")
            print(response.content)
            return response.content

        except Exception as e:
            print(f"提取信息失败: {str(e)}")
            # 如果结构化提取失败，返回原始内容的前300字
            return raw_content[:300] + "..."

    def add_document(self, content: str, filename: str | None = None) -> bool:
        """添加新文档到知识库

        Args:
            content: 文档内容
            filename: 文件名，如果不提供则自动生成

        Returns:
            bool: 是否添加成功
        """
        try:
            if not filename:
                filename = f"doc_{int(time.time())}.txt"
            filename = re.sub(r"[^\w]", "", filename)
            # 确保文件名以.txt结尾
            if not filename.endswith(".txt"):
                filename += ".txt"

            filepath = os.path.join(self.docs_dir, filename)

            # 写入文件
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)

            # 重新初始化知识库
            self._initialize_knowledge_base()
            return True

        except Exception as e:
            print(f"Error adding document: {str(e)}")
            return False

    def delete_document(self, filename: str) -> bool:
        """删除知识库中的文档

        Args:
            filename: 要删除的文件名（如果没有.txt后缀会自动添加）

        Returns:
            bool: 是否删除成功
        """
        try:
            filename = re.sub(r"[^\w]", "", filename)
            # 确保文件名以.txt结尾
            if not filename.endswith(".txt"):
                filename += ".txt"

            filepath = os.path.join(self.docs_dir, filename)

            # 检查文件是否存在
            if not os.path.exists(filepath):
                print(f"File not found: {filename}")
                return False

            # 删除文件
            os.remove(filepath)

            # 重新初始化知识库
            self._initialize_knowledge_base()
            return True

        except Exception as e:
            print(f"Error deleting document: {str(e)}")
            return False

    def list_documents(self) -> list[str]:
        """列出知识库中的所有文档

        Returns:
            List[str]: 文档名列表
        """
        try:
            files = []
            for file in os.listdir(self.docs_dir):
                if file.endswith(".txt"):
                    files.append(file)
            return files
        except Exception as e:
            print(f"文档list错误: {str(e)}")
            return []
