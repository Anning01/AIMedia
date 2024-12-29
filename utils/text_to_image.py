#!/usr/bin/python
# -*- coding: UTF-8 -*-
# @author:anning
# @email:anningforchina@gmail.com
# @time:2024/10/13 16:29
# @file:text_to_image.py
import base64
import io
import re

import requests
from PIL import Image

from utils.translation import Sample
from config import firstphase_width, firstphase_height, sd_url, negative_prompt


def print_tip(tip, blank_line=0):
    """打印提示文字和空行"""
    blank = "\n" * blank_line if blank_line else ""


class Main:
    def handle(self, text, quantity, save_path):
        """
        通过文本生成图片
        :param text: 生成图片的文本
        :param quantity: 需要配图的数量
        :return:
        """
        # 首先将接收到的文本进行分段
        text_list = self.split_text_by_quantity(text, quantity)
        translates_list = []


        # 将分段内容进行翻译
        for index_i, i in enumerate(text_list):
            translates_list.append(Sample.main(i))

        # base64_image_list = []
        # 将翻译内容传到Stable Diffusion生成图片
        for index_j, j in enumerate(translates_list):
            # base64_image_list.append(get_images(j))
            image_bytes = base64.b64decode(get_images(j))
            image = Image.open(io.BytesIO(image_bytes))
            image.save(rf"{save_path}/{index_j}.jpg")

        # 最后返回图片
        # return base64_image_list

    def split_text_by_quantity(self, text, quantity):
        # 使用正则表达式按中文标点符号分句
        sentences = re.split(r"(。|！|？|；|，|、)", text)
        sentences = [s for s in sentences if s]  # 移除空句子

        # 计算每个段落大致的句子数¬
        sentences_per_part = len(sentences) // quantity
        remainder = len(sentences) % quantity

        result = []
        part = []
        count = 0

        for i, sentence in enumerate(sentences):
            part.append(sentence)
            count += 1
            # 如果达到分配的句子数，或者这是剩余句子之一，就进行分段
            if count >= sentences_per_part + (1 if remainder > 0 else 0):
                result.append("".join(part))
                part = []
                count = 0
                remainder -= 1  # 减少剩余句子的数量

        # 如果最后有剩余的部分也加入到结果中
        if part:
            result.append("".join(part))

        return result


base_data = {
    "seed": -1,
    "sampler_name": "Euler",
    "batch_size": 1,
    "steps": 8,
    "cfg_scale": 2,
    "restore_faces": True,
}


def get_images(text):
    prompt = text
    novel_dict = {
        "width": firstphase_width,
        "height": firstphase_height,
        "negative_prompt": negative_prompt,
        "prompt": prompt + "<lora:sdxl_lightning_8step_lora:1>",
        **base_data,
    }
    try:
        response = requests.post(sd_url, json=novel_dict, timeout=30)
        img_response = response.json()
    except Exception as e:
        if str(e) == "Expecting value: line 2 column 1 (char 1)":
            raise Exception(f"{sd_url} 返回数据异常，请查看是否开启，或者是否连接成功。")
        raise Exception(response.text)
    images = img_response.get("images", None)
    if not images:
        error = img_response.get(
            "error",
            "Stable Diffusion 返回数据异常，请查看ip+端口是否匹配，是否开启。",
        )
        raise Exception(error)
    return images[0]


if __name__ == "__main__":
    text = "**牛市突然叫停！揭秘背后的十个重要原因，你不可不知！** 嘿，亲爱的财经小伙伴们，最近股市的风云突变，是不是让你们也感到措手不及呢？那个一路狂飙的牛市，怎么就突然来了个急刹车？别急，今天我就来给大家揭秘这背后的十个重要原因，保证让你们看得明明白白，还能引发一波热烈的评论互动哦！ **一、监管爸爸出手：股市太热，得降温！** 哎呀，这股市啊，就像是个孩子，一旦玩起来就忘了形。监管部门一看，这不行啊，再这么疯下去，大家都要跳火坑了！于是，监管爸爸一拍桌子，决定给股市降降温。这一下子，牛市就像被浇了一盆冷水，瞬间熄火了。 **二、市场涨得太猛，人心慌慌，得刹车！** 你知道吗，当市场涨得太猛的时候，人心就开始慌了。大家都在想，这股市是不是泡沫太大了？监管部门一看，这不行啊，再这么涨下去，小车变火车，失控了怎么办？于是，他们果断出手，给牛市踩了个急刹车。 **三、经济基本面撑不住，泡沫太大，得叫停！** 咱们得说实话，这股市的狂热，经济基本面可是撑不住的。泡沫越吹越大，再不叫停的话，后果可是很严重的。所以啊，监管部门也是出于保护大家的考虑，才决定给牛市来个紧急叫停的。 **四、资金都跑股市去了，实体经济缺钱，得平衡！** 你知道吗，当大量资金都涌入股市的时候，实体经济可就缺钱了。这可不行啊，经济结构得平衡发展才行。于是呢，监管部门就出手了，给牛市踩了个刹车，让资金能够回流到实体经济中去。 **五、外部环境不稳定，牛市持续风险大，得谨慎！** 哎，这外部环境也是不稳定啊，不确定性增加了很多。监管部门一看，这牛市要是再持续下去的话，风险可是很大的。所以啊，他们也是出于谨慎的考虑，才决定给牛市来个紧急叫停的。 **六、股市投机太多，市场乱了套，得整顿！** 你知道吗，这股市中的投机行为也是很多的。这样一来呢，市场的正常秩序就被打乱了。监管部门一看，这不行啊，得整顿整顿！于是呢，他们就出手了，给牛市来了个紧急叫停，想要把市场给整顿好。 **七、部分行业估值过高，得回调回归合理！** 哎呀，这部分行业的估值也是过高了啊！与实际价值严重背离，这可不行啊。于是呢，监管部门就出手了，想要让这部分行业的估值回调一下，回归到合理的区间去。这样一来呢，牛市也就只能被迫叫停了。 **八、宏观政策调整影响资金流动性，牛市难维持！** 你知道吗，这宏观政策也是有所调整的啊！这样一来呢，资金的流动性就受到了影响。牛市想要维持下去的话，也是很难的啊！所以啊，监管部门也是出于无奈的考虑，才决定给牛市来个紧急叫停的。 **九、市场预期变了，投资者信心动摇，牛市失动力！** 哎呀，这市场预期也是变了啊！投资者的信心开始动摇了。这样一来呢，牛市也就失去了动力。监管部门一看，这不行啊，得赶紧出手！于是呢，他们就决定给牛市来个紧急叫停，想要重新提振投资者的信心。 **十、国际金融市场波动传导至国内，为防风险得叫停！** 最后啊，这国际金融市场也是有所波动的啊！这样一来呢，就对国内股市产生了传导效应。监管部门一看，这不行啊，为了防范风险呢，他们也是果断出手了！给牛市来了个紧急叫停。 好啦好啦，说了这么多原因呢，大家是不是也对这牛市的突然叫停有了更深入的了解了呢？其实啊，这股市的涨跌都是有其内在原因的。我们作为投资者呢，也要学会理性看待市场的波动哦！ 那么在这里呢，我也想问问大家：你们觉得这次牛市的突然叫停是好事还是坏事呢？对于未来的股市走势你们又怎么看呢？欢迎大家在评论区留言互动哦！让我们一起探讨股市的奥秘吧！ 还有啊，如果你觉得这篇文章写得还不错的话呢，也记得给我点个赞和关注哦！这样我就能为大家带来更多有趣、有深度的财经文章啦！期待与大家在财经的世界里相遇哦！ 好啦好啦，今天的文章就到这里啦！希望大家都能理性看待股市的波动哦！我们下期再见啦！拜拜~"
    Main().handle(text, 3, './')
    # for index, value in enumerate(photo_list):
    #     image_bytes = base64.b64decode(value)
    #     image = Image.open(io.BytesIO(image_bytes))
    #
    #     image.save(f"./{index}.png")
