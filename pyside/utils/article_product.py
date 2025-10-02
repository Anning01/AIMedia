#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time    : 2024/12/10 14:19
# @Author  : DNQTeach
# @File    : articl_product.py
from ai_model.writing_assistant import WritingAssistant
from api.api_all import token_not_full
from utils.get_server_key import run_decrypt


def article_create(topic, selected_model, api_key, prompt, is_not_full):
    """
    创建文章内容
    Args:
        topic: 文章主题
        selected_model: 选择的模型
        api_key: API密钥
        prompt: 提示词
        is_not_full: 是否使用内部模型
    Returns:
        tuple: (文章内容, token使用量, 是否启用)
    """
    try:
        model_config = [selected_model, api_key, prompt]
        print(f"用户配置模型: {selected_model}, 是否用内置key: {is_not_full}")
        # 创建 WritingAssistant 实例
        try:
            enable = token_not_full()
            if is_not_full:
                print("用我们自己的")
                # 获取token
                apikey = run_decrypt()
                print(apikey)
                if prompt is not None:
                    assistant = WritingAssistant(prompt=prompt, api_key=apikey)
                else:
                    print("走这里")
                    assistant = WritingAssistant(api_key=apikey)
            else:
                print("使用用户的")
                if None not in model_config:
                    assistant = WritingAssistant(mod=selected_model, api_key=api_key, prompt=prompt)
                else:
                    assistant = WritingAssistant(mod=selected_model, api_key=api_key)
        except Exception as e:
            print(f"Error creating WritingAssistant: {str(e)}")
            return False, None, False

        # 生成文章
        if not assistant or not hasattr(assistant, 'generate_article'):
            print("Invalid WritingAssistant instance")
            return False, None, False

        result = assistant.generate_article(topic)
        
        if not result or 'content' not in result:
            print("No content in generation result")
            return False, None, False

        article = result["content"].replace("**", "").replace('### ', '').replace('标题：', '')
        usetokens = result.get('token_usage', {}).get('total_tokens', 0)
        
        if not article or len(article.strip()) == 0:
            print("Empty article generated")
            return False, None, False

        return article, usetokens, enable

    except Exception as e:
        print(f"Error in article_create: {str(e)}")
        return False, None, False
