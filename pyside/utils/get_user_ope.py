#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time    : 2024/12/29 13:47
# @Author  : DNQTeach
# @File    : get_user_ope.py
import json


def user_opt():
    try:
        file_path = 'opt.json'
        with open(file_path, 'r', encoding='utf-8') as file:
            content = json.load(file)
            selected_model = content['selected_model']
            api_key = content[selected_model]['api_key']
        if len(api_key) >0 and len(selected_model)>0:
            return selected_model,api_key,content
        else:
            return False,False,False
    except:
        return False,False,False