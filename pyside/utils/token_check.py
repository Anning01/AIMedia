#!/usr/bin/env python
# @Time    : 2024/12/10 17:05
# @Author  : DNQTeach
# @File    : token_check.py
import json
import os

from api.api_all import token_not_full


def check_user_token():
    file_path = "opt.json"
    flag = token_not_full()
    if flag:
        if os.path.exists(file_path):
            with open(file_path, encoding="utf-8") as file:
                content = json.load(file)
                selected_model = content["selected_model"]
                api_key = content[selected_model]["api_key"]
                prompt = content["prompt"]
            if len(prompt) > 0:
                return True, True, None, selected_model, prompt
            else:
                return True, True, None, selected_model, None
        else:
            return True, True, None, None, None
    else:
        if os.path.exists(file_path):
            with open(file_path, encoding="utf-8") as file:
                content = json.load(file)
                selected_model = content["selected_model"]
                api_key = content[selected_model]["api_key"]
                prompt = content["prompt"]
                if len(api_key) > 0:
                    if len(prompt) > 0:
                        return True, False, api_key, selected_model, prompt
                    else:
                        return True, False, api_key, selected_model, None
                else:
                    return False, False, None, None, None
        else:
            return False, False, None, None, None
