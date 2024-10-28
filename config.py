# config.py

import os

# 检查是否存在 local_config.py 文件
if os.path.exists("local_config.py"):
    from local_config import *
else:
    # 抖音接口秘钥
    sessionid = ""

    # 智普秘钥
    zhipu_aip_key = ''

    # stable diffusion 配置
    enable = False

    # 阿里翻译配置
    access_key = ""
    secret = ""
    language = "zh"

    # stable diffusion 配置
    sd_url = "http://127.0.0.1:7860/sdapi/v1/txt2img"
    # 图片宽
    firstphase_width = "1080"
    # 图片高
    firstphase_height = "960"
    # 反向提示词
    negative_prompt = ""
