import time
from urllib.parse import quote

import requests
from lxml import etree
import time

# Create your tests here.


class pengpai:
    headers = {
        'accept': 'application/json',
        'accept-language': 'zh-CN,zh;q=0.9',
        'client-type': '1',
        'content-type': 'application/json',
        'origin': 'https://www.thepaper.cn',
        'referer': 'https://www.thepaper.cn/',
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    }

    def get_news_list(self, code="25950"):
        # 获取当前时间戳（秒）
        timestamp_seconds = time.time()
        # 获取当前时间戳（毫秒）
        timestamp_milliseconds = int(time.time() * 1000)
        json_data = {
            'nodeId': code,
            'excludeContIds': [],
            'pageSize': 20,
            'startTime': timestamp_milliseconds,
            'pageNum': 1,
        }

        response = requests.post(
            'https://api.thepaper.cn/contentapi/nodeCont/getByNodeIdPortal',
            headers=self.headers,
            json=json_data,
        )

        try:
            list = response.json()['data']['list']
            result = []
            for i in list:
                if i.get("link"):
                    continue
                result.append({
                    "title": i["name"],
                    "article_url": f"https://www.thepaper.cn/newsDetail_forward_{quote(i['contId'])}",
                    "cover_url": i["pic"],
                    "date_str": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(i['pubTimeLong'] / 1000))
                })
            result = sorted(result, key=lambda x: x["date_str"], reverse=True)
            return result
        except:
            return []

    def get_news_info(self, hotNew, category=None):
        content = requests.get(hotNew["article_url"], headers=self.headers).text
        content_html = etree.HTML(content)
        img_list = content_html.xpath('//*[@id="__next"]/main/div[4]/div[1]/div[1]/div/div[2]/img/@src')

        txt = content_html.xpath('//*[@id="__next"]/main/div[4]/div[1]/div[1]/div/div[2]/p')
        article_info = ""
        for item in txt:
            t = item.xpath(".//text()")
            for i in t:
                article_info += i
                article_info += "\n"
        if not article_info:
            return None
        if len(article_info) <50:
            return None
        dict_ = {
            "title": hotNew["title"],
            "article_url": hotNew["article_url"],
            "cover_url": hotNew['cover_url'],
            "date_str": hotNew['date_str'],
            "article_info": article_info,
            "img_list": img_list,
            "category": category,
        }
        return dict_


# if __name__ == '__main__':
#     pengpai_ = pengpai()
#     list_ = pengpai_.get_news_list('25488')
#     # print(list_)
#     res = pengpai_.get_news_info(list_[0])
#     print(res)
