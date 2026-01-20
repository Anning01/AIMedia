from langchain.callbacks.base import BaseCallbackHandler


class TokenCallbackHandler(BaseCallbackHandler):
    """通用的 Token 追踪回调处理器，支持多种模型"""

    def __init__(self):
        super().__init__()
        self.reset_tokens()
        self.model_name = None

    def reset_tokens(self):
        """重置 token 计数"""
        self.tokens = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        self.successful_requests = 0
        self.has_error = False
        self.error_message = None

    def extract_token_info(self, response) -> dict:
        """从不同模型的响应中提取 token 信息"""
        token_info = None

        try:
            # 1. 尝试从 generations 中获取
            if hasattr(response, "generations") and response.generations:
                for generation in response.generations:
                    if hasattr(generation[0], "generation_info"):
                        info = generation[0].generation_info
                        print(f"Generation info: {info}")
                        if isinstance(info, dict):
                            if "token_usage" in info:  # ChatZhipuAI 格式
                                return info["token_usage"]
                            elif "usage" in info:  # 其他模型可能的格式
                                return info["usage"]

            # 2. 尝试从 llm_output 中获取 (MoonshotChat 格式)
            if hasattr(response, "llm_output") and response.llm_output:
                llm_output = response.llm_output
                print(f"LLM output: {llm_output}")
                if isinstance(llm_output, dict):
                    if "token_usage" in llm_output:
                        return llm_output["token_usage"]
                    elif "usage" in llm_output:
                        return llm_output["usage"]

            # 3. 尝试直接从 response.usage 获取
            if hasattr(response, "usage") and response.usage:
                return response.usage

        except Exception as e:
            print(f"token详情错误: {str(e)}")

        return None

    def update_tokens(self, token_info: dict):
        """更新 token 信息"""
        if not token_info or not isinstance(token_info, dict):
            return False

        try:
            # 标准化 key 名称
            key_mappings = {
                "prompt_tokens": [
                    "prompt_tokens",
                    "promptTokens",
                    "prompt",
                    "input_tokens",
                    "inputTokens",
                ],
                "completion_tokens": [
                    "completion_tokens",
                    "completionTokens",
                    "completion",
                    "output_tokens",
                    "outputTokens",
                ],
                "total_tokens": ["total_tokens", "totalTokens", "total"],
            }

            updated = False
            for target_key, possible_keys in key_mappings.items():
                for key in possible_keys:
                    if key in token_info:
                        try:
                            value = int(token_info[key])
                            self.tokens[target_key] = value
                            updated = True
                            break
                        except (ValueError, TypeError):
                            print(f"无法初始化 {key}: {token_info[key]}")

            if updated:
                self.successful_requests += 1
                print(f"跟新tokens: {self.tokens}")
            return updated

        except Exception as e:
            print(f"token 跟新错误: {str(e)}")
            return False

    def on_llm_start(self, *args, **kwargs):
        """当 LLM 开始时被调用"""
        self.reset_tokens()

    def on_llm_end(self, response, *args, **kwargs):
        """当 LLM 结束时被调用"""
        try:
            # 提取 token 信息
            token_info = self.extract_token_info(response)

            # 更新 token 信息
            if token_info:
                print(f"Found token info: {token_info}")
                self.update_tokens(token_info)
            else:
                # 如果没有找到 token 信息，尝试估算
                print("无法获取，自己估算...")
                if hasattr(response, "generations") and response.generations:
                    # 简单估算：每个字符算作 1 token
                    text = response.generations[0][0].text
                    estimated_tokens = len(text)
                    self.tokens["completion_tokens"] = estimated_tokens
                    self.tokens["total_tokens"] = estimated_tokens
                    print(f"Estimated tokens: {self.tokens}")

        except Exception as e:
            print(f"token 错误: {str(e)}")
            import traceback

            print(traceback.format_exc())

    def on_llm_error(self, error: Exception, *args, **kwargs):
        """当 LLM 发生错误时被调用"""
        print(f"\n错误时调用: {str(error)}")
        self.has_error = True
        self.error_message = str(error)

    def get_token_usage(self) -> dict:
        """获取完整的 token 使用情况"""
        return {
            **self.tokens,
            "successful_requests": self.successful_requests,
            "has_error": self.has_error,
            "error_message": self.error_message,
        }
