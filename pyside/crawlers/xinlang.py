import re
from datetime import datetime

import requests
from lxml import etree


class XinLangGuoJi:
    headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    }

    def convert_time_str(self, time_str, default_year=None):
        """
        将类似 "12月20日 23:59" 的时间字符串转换为 "%Y-%m-%d %H:%M:%S" 格式。

        :param time_str: 原始时间字符串，例如 "12月20日 23:59"
        :param default_year: 可选参数，指定年份。如果未提供，则使用当前年份。
        :return: 格式化后的时间字符串，例如 "2024-12-20 23:59:00"
        """
        # 使用正则表达式提取月、日、小时和分钟
        pattern = r'(?P<month>\d{1,2})月(?P<day>\d{1,2})日\s+(?P<hour>\d{1,2}):(?P<minute>\d{2})'
        match = re.match(pattern, time_str)

        if not match:
            raise ValueError(f"时间字符串格式不正确: '{time_str}'")

        month = int(match.group('month'))
        day = int(match.group('day'))
        hour = int(match.group('hour'))
        minute = int(match.group('minute'))

        # 获取当前年份或使用提供的默认年份
        if default_year is None:
            current_year = datetime.now().year
        else:
            current_year = default_year

        try:
            # 创建 datetime 对象
            dt = datetime(year=current_year, month=month, day=day, hour=hour, minute=minute, second=0)
        except ValueError as e:
            raise ValueError(f"无效的日期时间信息: {e}")

        # 格式化为指定的字符串格式
        formatted_time = dt.strftime('%Y-%m-%d %H:%M:%S')

        return formatted_time

    def get_news_list(self, url=None):
        response = requests.get(url, headers=self.headers)
        response.encoding = response.apparent_encoding
        content = response.text
        content_html = etree.HTML(content)
        # 初始化结果列表
        result = []

        news_items = content_html.xpath('//div[contains(@class, "news-item")]')

        for item in news_items:
            # 提取标题和链接
            title_elements = item.xpath('.//h2/a')
            if title_elements:
                title = title_elements[0].text.strip()
                link = title_elements[0].get('href').strip()
            else:
                # 如果没有标题或链接，跳过该条目
                continue

            # 提取时间
            time_elements = item.xpath('.//div[contains(@class, "time")]/text()')
            if time_elements:
                time = time_elements[0].strip()
            else:
                # 如果没有时间，跳过该条目
                continue

            # 只添加有实际内容的条目
            if title and link and time:
                # 将数据添加到列表中
                result.append({
                    'title': title,
                    'article_url': link,
                    'date_str': self.convert_time_str(time)
                })

        return result

    def get_news_info(self, news, category=None):
        article_url = news["article_url"]

        response = requests.get(article_url, headers=self.headers)
        response.encoding = response.apparent_encoding
        content = response.text
        content_html = etree.HTML(content)
        content_div = content_html.xpath('//*[@id="article"]')[0]


        # 提取 p 标签的文本列表
        text_list = content_div.xpath('.//p[not(@class="show_author")]/text()')

        # 提取 img 标签的 src 列表
        img_list = content_div.xpath('.//div[@class="img_wrapper"]//img/@src')
        img_list = ['https:' + i for i in img_list]
        article_info = ""
        for item in text_list:
            article_info += item
            article_info += "\n"
        if not article_info:
            return None
        if len(article_info) < 50:
            return None
        dict_ = {
            "title": news["title"],
            "article_url": article_url,
            "cover_url": img_list[0] if img_list else "",
            "date_str": news['date_str'],
            "article_info": article_info.replace("\u3000", '').replace('\xa0', ''),
            "img_list": img_list,
            "category": category,
        }
        return dict_


# if __name__ == '__main__':
#     news = XinLang()
#     results = news.get_news_list('https://news.sina.com.cn/world/')
#     x = news.get_news_info(results[2])
#     print(x)
