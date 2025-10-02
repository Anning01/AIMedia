from datetime import datetime

import requests
from lxml import etree


# Create your tests here.


class ChineseDayNews:
    headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    }

    def get_news_list(self, code=None):
        url = code
        content = requests.get(url, headers=self.headers).text
        content_html = etree.HTML(content)
        # 初始化结果列表
        result = []

        # 获取所有包含 "busBox3" 类的元素
        # bus_box_elements = content_html.xpath('//div[contains(@class, "busBox3")]')
        # print(len(bus_box_elements))
        div_elements = content_html.xpath('//html/body/div[3]/div[1]/div/div[.//h3 and .//p/b]')
        # 遍历每个元素，提取数据
        for element in div_elements:
            # 提取标题文字
            title = element.xpath('.//h3/a/text()')
            title = title[0].strip() if title else None
            # 提取文章 URL
            article_url = element.xpath('.//h3/a/@href')
            article_url = 'https:' + article_url[0].strip() if article_url else None

            # 提取封面图片 URL
            cover_url = element.xpath('.//div[contains(@class, "mr10")]/a/img/@src')
            cover_url = 'https:' + cover_url[0].strip() if cover_url else None

            # 提取时间字符串
            date_str = element.xpath('.//p/b/text()')
            date_str = date_str[0].strip() if date_str else None

            # 创建字典并添加到结果列表
            x = {
                "title": title,
                "article_url": article_url,
                "cover_url": cover_url,
                "date_str": datetime.strptime(date_str, "%Y-%m-%d %H:%M").strftime("%Y-%m-%d %H:%M:%S"),
            }
            result.append(x)
        result = sorted(result, key=lambda x: x["date_str"], reverse=True)
        return result

    def get_news_info(self, news, category=None):
        article_url = news["article_url"]

        content = requests.get(article_url, headers=self.headers).text
        content_html = etree.HTML(content)
        content_div = content_html.xpath('//div[@id="Content"]')[0]

        # 提取 p 标签的文本列表
        text_list = content_div.xpath('.//p/text()')
        # 提取 img 标签的 src 列表
        img_list = content_div.xpath('.//img/@src')
        img_list = ['https:' + i for i in img_list]
        article_info = ""
        for item in text_list:
            article_info += item
            article_info += "\n"
        if not article_info:
            return None
        if len(article_info) <50:
            return None
        try:
            date_str = datetime.strptime(news['date_str'], "%Y-%m-%d %H:%M").strftime("%Y-%m-%d %H:%M:%S")
        except:
            date_str = news['date_str']
        dict_ = {
            "title": news["title"],
            "article_url": article_url,
            "cover_url": news['cover_url'],
            "date_str": date_str,
            "article_info": article_info,
            "img_list": img_list,
            "category": category,
        }
        return dict_


if __name__ == '__main__':
    news = ChineseDayNews()
    x_list = [
        {
            "name": "中国日报",
            "code": "4",
            "children": [
                {"name": "时政要闻", "code": "https://china.chinadaily.com.cn/5bd5639ca3101a87ca8ff636",
                 "classify": "1"},
                {"name": "台海动态", "code": "https://china.chinadaily.com.cn/5e1ea9f6a3107bb6b579a144",
                 "classify": "1"},
                {"name": "台湾政策", "code": "https://china.chinadaily.com.cn/5e1ea9f6a3107bb6b579a147",
                 "classify": "1"},
                {"name": "两岸人生", "code": "https://china.chinadaily.com.cn/5e23b3dea3107bb6b579ab68",
                 "classify": "9"},
                {"name": "国际资讯", "code": "https://china.chinadaily.com.cn/5bd55927a3101a87ca8ff618",
                 "classify": "7"},
                {"name": "中国日报专稿",
                 "code": "https://cn.chinadaily.com.cn/5b753f9fa310030f813cf408/5bd54dd6a3101a87ca8ff5f8/5bd54e59a3101a87ca8ff606",
                 "classify": "3"},
                {"name": "传媒动态",
                 "code": "https://cn.chinadaily.com.cn/5b753f9fa310030f813cf408/5bd549f1a3101a87ca8ff5e0",
                 "classify": "9"},
                {"name": "财经大事", "code": "https://caijing.chinadaily.com.cn/stock/5f646b7fa3101e7ce97253d3",
                 "classify": "2"},
                {"name": "权威发布", "code": "https://caijing.chinadaily.com.cn/stock/5f646b7fa3101e7ce97253d6",
                 "classify": "2"},
                {"name": "公告解读", "code": "https://caijing.chinadaily.com.cn/stock/5f646b7fa3101e7ce97253d9",
                 "classify": "2"},
                {"name": "深度报道", "code": "https://caijing.chinadaily.com.cn/stock/5f646b7fa3101e7ce97253dc",
                 "classify": "2"},
                {"name": "信息披露", "code": "https://caijing.chinadaily.com.cn/stock/5f646b7fa3101e7ce97253df",
                 "classify": "2"},
                {"name": "头条新闻", "code": "https://cn.chinadaily.com.cn/wenlv/5b7628dfa310030f813cf495",
                 "classify": "10"},
                {"name": "旅游要闻", "code": "https://cn.chinadaily.com.cn/wenlv/5b7628c6a310030f813cf48f",
                 "classify": "10"},
                {"name": "酒店", "code": "https://cn.chinadaily.com.cn/wenlv/5b7628c6a310030f813cf48b",
                 "classify": "10"},
                {"name": "旅游原创", "code": "https://cn.chinadaily.com.cn/wenlv/5b7628c6a310030f813cf492",
                 "classify": "10"},
                {"name": "业界资讯", "code": "https://cn.chinadaily.com.cn/wenlv/5b7628c6a310030f813cf493",
                 "classify": "10"},
                {"name": "时尚", "code": "https://fashion.chinadaily.com.cn/5b762404a310030f813cf467",
                 "classify": "10"},
                {"name": "健康频道", "code": "https://cn.chinadaily.com.cn/jiankang", "classify": "12"},
                {"name": "教育", "code": "https://fashion.chinadaily.com.cn/5b762404a310030f813cf461",
                 "classify": "11"},
                {"name": "体育", "code": "https://fashion.chinadaily.com.cn/5b762404a310030f813cf462", "classify": "5"},
            ],
        },
    ]
    results = news.get_news_list('https://china.chinadaily.com.cn/5bd5639ca3101a87ca8ff636')
    x = news.get_news_info(results[0])
    print(x)