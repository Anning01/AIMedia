import requests, json
import re
import random
from zhipuai import ZhipuAI
from config import zhipu_aip_key


def hot2article(hot, cls):
    json_data = {
        'appId': 'YfxxmUAkYiuwC5rFFzfcDzGfqlFwLpdp',
        'sessionId': f'{random.randint(10 ** 18, 10 ** 19 - 1)}',
        'versionCode': 1,
        'versionType': 'audit',
        'content': {
            'query': {
                'type': 'text',
                'value': {
                    "showText": f"热点话题：{hot}，分类：{cls}",
                },
            },
        },
    }

    response = requests.post(
        'https://agent-proxy-ws.baidu.com/agent/call/conversation',
        json=json_data,
    )
    text = ""
    for line in response.iter_lines():
        if line:
            decoded_line = line.decode("utf-8").rstrip()
            if decoded_line.startswith("data:"):
                data = json.loads(decoded_line[5:])  # 去除"data:"前缀
                try:
                    text += data["data"]["message"]["content"][0]["data"]["text"]
                except:
                    pass
    return text.replace("*", "").replace("#", "")


# 去水印
def del_watermark(url_old):
    json_data = {
        'appId': 'dKb2XbRQXaRM4A6svDFb0PUG0tJXoKkU',
        'sessionId': f'{random.randint(10 ** 18, 10 ** 19 - 1)}',
        'versionCode': 1,
        'versionType': 'online',
        'content': {
            'query': {
                'type': 'text',
                'value': {
                    'showText': url_old,
                },
            },
        },
    }
    response = requests.post(
        'https://agent-proxy-ws.baidu.com/agent/call/conversation',
        json=json_data,
    )
    url_ = ''
    for line in response.iter_lines():
        if line:
            decoded_line = line.decode("utf-8").rstrip()
            if decoded_line.startswith("data:"):
                data = json.loads(decoded_line[5:])  # 去除"data:"前缀
                try:
                    url = data['data']['message']['content'][0]['data']['image_url']
                    if len(url) > 10:
                        url_ += url
                except:
                    pass

    return url_


# 文章分类
def title_clas(title):
    client = ZhipuAI(api_key=zhipu_aip_key)  # 填写您自己的APIKey
    cls = '美食，旅行，站内玩法，话题互动，娱乐，社会，二次元，交通，亲子，体育，军事，剧情，动物萌宠，天气，才艺，文化教育，时尚，时政，校园，汽车，游戏，科技，财经'
    response = client.chat.completions.create(
        model="glm-4-flash",
        messages=[
            {"role": "user",
             "content": f"你好,我给你一段内容，你理解分析后，将他在{cls}中分类，然后将分类的最终结果输出给我，只需要输出分类，不能有其他多余的回答，否则会搜到惩罚！，以下是内容：{title}"},
        ],
    )
    try:
        res = response.choices[0].message.content
    except:
        res = '未知'
    return res


