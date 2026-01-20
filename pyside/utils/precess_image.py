import concurrent.futures
import os
import random
import re
import time

import requests
from openai import OpenAI
from PIL import Image, ImageDraw, ImageFilter
from zhipuai import ZhipuAI

from utils.get_user_ope import user_opt


class HippopxImageScraper:
    def __init__(self):
        self.headers = {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        }
        self.params = {
            "c": "main",
            "m": "portal_loadmore",
            "lang": "en",
            "page": random.randint(1, 10000),
        }
        self.img_list = []
        self.timeout = 10  # 添加超时设置

    def fetch_index_page(self):
        try:
            response = requests.get(
                "https://www.hippopx.com/index.php",
                params=self.params,
                headers=self.headers,
                timeout=self.timeout,
            )  # 添加超时
            return response.text
        except requests.exceptions.RequestException as e:
            print(f"Error fetching index page: {e}")
            return ""

    def extract_a_tag_urls(self, html_content):
        return re.findall(r'href="([^"]+)"', html_content)

    def fetch_image_url(self, url):
        try:
            if "https://www.hippopx.com/en" in url:
                res = requests.get(url, headers=self.headers, timeout=self.timeout)  # 添加超时
                match = re.search(r'<img\s+[^>]*class="view_img"[^>]*src="([^"]+)"[^>]*>', res.text)
                if match:
                    return match.group(1)
        except requests.exceptions.RequestException as e:
            print(f"Error fetching image URL {url}: {e}")
        return None

    def process_urls(self, urls):
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:  # 减少线程数
            futures = [executor.submit(self.fetch_image_url, url) for url in urls]
            try:
                # 添加超时机制
                for future in concurrent.futures.as_completed(futures, timeout=30):
                    result = future.result()
                    if result:
                        self.img_list.append(result)
            except concurrent.futures.TimeoutError:
                print("Timeout while processing URLs")
                executor._threads.clear()
                concurrent.futures.thread._threads_queues.clear()

    def run(self):
        try:
            index_page_content = self.fetch_index_page()
            if not index_page_content:
                return []
            a_tag_urls = self.extract_a_tag_urls(index_page_content)
            self.process_urls(a_tag_urls)
            return self.img_list
        except Exception as e:
            print(f"Error in run: {e}")
            return []


def crop_and_resize_image(image_path):
    """
    裁剪图片的四边各五分之一，并确保分辨率不低于 900x500 或 500x900。
    通过超分辨率、锐化和高质量保存提升图片清晰度。
    """
    # 打开图片
    img = Image.open(image_path)
    # 检查图像模式并转换
    if img.mode != "RGB":
        img = img.convert("RGB")
    # 获取图片的宽度和高度
    width, height = img.size
    # 判断图片的原始方向
    is_landscape = width > height  # 横屏为 True，竖屏为 False
    # 计算裁剪区域的左上角和右下角坐标
    crop_width = width // 10
    crop_height = height // 10
    left = crop_width
    top = crop_height
    right = width - crop_width
    bottom = height - crop_height
    # 裁剪图片
    cropped_img = img.crop((left, top, right, bottom))
    # 获取裁剪后图片的宽度和高度
    cropped_width, cropped_height = cropped_img.size

    # 设置最小分辨率
    min_width = 900
    min_height = 500
    if is_landscape:
        # 横屏图片：确保宽度 >= 900，高度 >= 500
        target_width = max(cropped_width, min_width)
        target_height = max(cropped_height, min_height)
    else:
        # 竖屏图片：确保宽度 >= 500，高度 >= 900
        target_width = max(cropped_width, min_height)
        target_height = max(cropped_height, min_width)

    # 计算调整后的分辨率，保持宽高比例
    aspect_ratio = cropped_width / cropped_height
    if aspect_ratio > target_width / target_height:
        # 宽度较大，按宽度缩放
        new_width = target_width
        new_height = int(target_width / aspect_ratio)
    else:
        # 高度较大，按高度缩放
        new_height = target_height
        new_width = int(target_height * aspect_ratio)

    # 调整图片分辨率
    resized_img = cropped_img.resize((new_width, new_height), Image.Resampling.LANCZOS)

    # 锐化处理
    sharpened_img = resized_img.filter(ImageFilter.SHARPEN)

    # 保存最终图片（高质量）
    sharpened_img.save(image_path, quality=95)


def precess_image(img_list, ids, log_signal, content):
    headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    }
    """图片处理"""
    root = f"temp/img_temp/{ids}"
    if not os.path.exists(root):
        os.makedirs(root)
    root = os.path.abspath(root)
    log_signal.append_log(f"素材原图: {len(img_list)}张")

    if len(img_list) > 0:
        if len(img_list) > 3:
            img_random = random.sample(img_list, 3)
        else:
            img_random = img_list
            log_signal.append_log(f"去除原图片水印: {len(img_random)}张")

        for image_url in img_random:
            save_path = rf"{root}/{img_list.index(image_url)}.jpg"
            try:
                response = requests.get(image_url, headers=headers, timeout=10)  # 添加超时
                if response.status_code == 200:
                    with open(save_path, "wb") as file:
                        file.write(response.content)
                    crop_and_resize_image(save_path)
            except Exception as e:
                print(f"Error processing image {image_url}: {e}")
                continue

    img_precess_list = os.listdir(root)
    log_signal.append_log(f"保存图片: {len(img_precess_list)}张")

    if len(img_precess_list) < 3:
        log_signal.append_log("开始补充图片")
        max_attempts = 10  # 最大尝试次数
        attempt = 0

        while len(os.listdir(root)) < 3 and attempt < max_attempts:
            attempt += 1
            print(f"尝试第 {attempt} 次补充图片")

            try:
                # scraper = HippopxImageScraper()
                # img_list_spider = scraper.run()
                img_list_spider = get_img_key(content)

                if not img_list_spider:
                    continue

                needed_images = 3 - len(os.listdir(root))
                if len(img_list_spider) > needed_images:
                    img_random = random.sample(img_list_spider, needed_images)
                else:
                    img_random = img_list_spider

                for k, image_url in enumerate(img_random):
                    save_path = rf"{root}/{30 + k}.jpg"

                    try:
                        response = requests.get(image_url, headers=headers, timeout=10)
                        if response.status_code == 200:
                            with open(save_path, "wb") as file:
                                file.write(response.content)
                            crop_and_resize_image(save_path)
                    except Exception as e:
                        print(f"Error downloading supplementary image: {e}")
                        continue

                time.sleep(1)  # 添加延迟避免请求过快

            except Exception as e:
                print(f"Error in supplement attempt {attempt}: {e}")
                continue

        if len(os.listdir(root)) < 3:
            log_signal.append_log(f"警告：未能获取足够的图片，当前只有 {len(os.listdir(root))} 张")
    img_precess_lists = os.listdir(root)
    log_signal.append_log(f"保存最终图片: {len(img_precess_lists)}张")
    return root


def add_frame(img, style):
    """
    根据样式编号添加不同的相框效果。

    :param img: 需要添加相框的图片
    :param style: 相框样式编号 (1-5)
    """
    draw = ImageDraw.Draw(img)
    target_width, target_height = img.size

    if style == 1:
        # 样式1：简单渐变边框
        frame_width = 20
        for i in range(frame_width):
            alpha = int(255 * (i / frame_width))  # 渐变透明度
            draw.rectangle(
                (i, i, target_width - i, target_height - i), outline=(220, 220, 220, alpha), width=1
            )

    elif style == 2:
        # 样式2：木纹边框
        frame_width = 30
        for i in range(frame_width):
            color = (200 - i * 2, 180 - i * 2, 140 - i * 2)  # 木纹颜色渐变
            draw.rectangle((i, i, target_width - i, target_height - i), outline=color, width=1)

    elif style == 3:
        # 样式3：金属质感边框
        frame_width = 25
        for i in range(frame_width):
            color = (180 + i * 2, 180 + i * 2, 180 + i * 2)  # 金属渐变
            draw.rectangle((i, i, target_width - i, target_height - i), outline=color, width=1)
    elif style == 4:
        # 样式5：简约线条边框
        frame_width = 15
        for i in range(frame_width):
            color = (180, 180, 180)  # 灰色线条
            draw.rectangle((i, i, target_width - i, target_height - i), outline=color, width=1)
        # 添加内嵌线条
        draw.rectangle(
            (frame_width, frame_width, target_width - frame_width, target_height - frame_width),
            outline=(220, 220, 220),
            width=2,
        )


def get_img_key(content):
    selected_model, api_key, _config = user_opt()
    if selected_model == "glm":
        client = ZhipuAI(api_key=api_key)  # 填写您自己的APIKey
        response = client.chat.completions.create(
            model="glm-4-flash",
            messages=[
                {
                    "role": "system",
                    "content": "你是一个文章配图分析助手，你会根据用户输入的文章，给用户三个适合搜索配图的关键词,关键词要高度切合文章的信息，包括但不限于，地点，国家，事件,不能包含新闻平台的名字,避免人名，地名，发票，合同等。"
                    "你的回答格式：xx-xx-xx",
                },
                {"role": "user", "content": content},
            ],
        )
    elif selected_model == "other":
        client = OpenAI(
            api_key=_config["other"]["api_key"], base_url=_config["other"]["platform_url"]
        )
        response = client.chat.completions.create(
            model=_config["other"]["model"],
            messages=[
                {
                    "role": "system",
                    "content": "你是一个文章配图分析助手，你会根据用户输入的文章，给用户三个适合搜索配图的关键词,关键词要高度切合文章的信息，包括但不限于，地点，国家，事件,不能包含新闻平台的名字,避免人名，地名，发票，合同等。"
                    "你的回答格式：xx-xx-xx",
                },
                {"role": "user", "content": content},
            ],
            stream=False,
            temperature=_config["other"]["temperature"],
        )
    else:
        client = OpenAI(
            api_key=api_key,
            base_url="https://api.moonshot.cn/v1",
        )
        response = client.chat.completions.create(
            model="moonshot-v1-8k",
            messages=[
                {
                    "role": "system",
                    "content": "你是一个文章配图分析助手，你会根据用户输入的文章，给用户三个适合搜索配图的关键词,关键词要高度切合文章的信息，包括但不限于，地点，国家，事件,不能包含新闻平台的名字,避免人名，地名，发票，合同等。"
                    "你的回答格式：xx-xx-xx",
                },
                {"role": "user", "content": content},
            ],
            temperature=0.1,
        )
    key_word = response.choices[0].message.content
    word = key_word.split("-")
    for i in range(0, 3):
        queryWord = random.choice(word)
        headers = {
            "Accept": "text/plain, */*; q=0.01",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Connection": "keep-alive",
            # 'Cookie': 'BDqhfp=%E5%8F%99%E5%88%A9%E4%BA%9A%E7%A7%91%E5%B7%B4%E5%B0%BC%E5%9C%B0%E5%8C%BA%20%E5%86%9B%E4%BA%8B%E5%86%B2%E7%AA%81%20%E5%9C%9F%E8%80%B3%E5%85%B6%E5%A8%81%E8%83%81%26%26-10-1undefined%26%260%26%261; BAIDUID=BE5113FD47630AEA54DA20C69382B884:FG=1; BAIDUID_BFESS=BE5113FD47630AEA54DA20C69382B884:FG=1; BIDUPSID=BE5113FD47630AEA54DA20C69382B884; BDRCVFR[dG2JNJb_ajR]=mk3SLVN4HKm; userFrom=null; ab_sr=1.0.1_NzBkYmFmZjhkOWNhZjU1OTIyODRlNGE3OTQ3MjAzN2QxYTdlM2M2MDhlNDBiZDE2NGI2NGRkOWY1YzVjMDYyZmZiNDg4NjZjMTc3NGU3MzE2NGU2MjRjYzQzNzlhZjBhZGE2Njg4MTE3ZWQwZjBhZWE0ZjgxNmFmNjdjNTcwYjUyODQ4MjcyNzkzOGIyZDY4NTY2MDBhYzk1N2VjMDQ2OTY2NmJkNTBjMmM1YTI1ODlkYjE5YTU0MDBkMmU2YmNkOTk5MTkyODU4NDJkZWM0MjRhNTNiZWZiZGUzYjcwZTc=',
            "Referer": "https://image.baidu.com/search/index?tn=baiduimage&ipn=r&ct=201326592&cl=2&lm=-1&st=-1&fm=result&fr=&sf=1&fmq=1734421447254_R&pv=&ic=&nc=1&z=&hd=&latest=&copyright=&se=1&showtab=0&fb=0&width=&height=&face=0&istype=2&dyTabStr=MCwzLDEsMiwxMyw3LDYsNSwxMiw5&ie=utf-8&sid=&word=%E5%8F%99%E5%88%A9%E4%BA%9A%E7%A7%91%E5%B7%B4%E5%B0%BC%E5%9C%B0%E5%8C%BA+%E5%86%9B%E4%BA%8B%E5%86%B2%E7%AA%81+%E5%9C%9F%E8%80%B3%E5%85%B6%E5%A8%81%E8%83%81",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "X-Requested-With": "XMLHttpRequest",
            "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
        }
        params = {
            "tn": "resultjson_com",
            "ipn": "rj",
            "is": "",
            "fp": "result",
            "fr": "",
            "word": queryWord,
            "queryWord": queryWord,
            "cl": "2",
            "lm": "-1",
            "ie": "utf-8",
            "oe": "utf-8",
            "adpicid": "",
            "st": "-1",
            "z": "",
            "ic": "",
            "hd": "",
            "latest": "",
            "copyright": "",
            "s": "",
            "se": "",
            "tab": "",
            "width": "1920",
            "height": "1080",
            "face": "0",
            "istype": "2",
            "qc": "",
            "nc": "1",
            "expermode": "",
            "nojc": "",
            "isAsync": "",
            "pn": "0",
            "rn": "60",
            "gsm": "1e",
        }
        response = requests.get(
            "https://image.baidu.com/search/acjson", params=params, headers=headers
        )
        urls = []
        try:
            print("高清")
            for item in response.json()["data"]:
                if item.get("aiEditData", {}).get("type", 1) != 1:
                    url = item["replaceUrl"][0]["ObjURL"]
                    if url.split(".")[-1] in ["jpg", "jpeg", "png"]:
                        urls.append(url)
        except:
            print("标清")
            urls = re.findall(r'"middleURL":"(https?://.*?)"', response.text)
        if len(urls) > 0:
            return urls
