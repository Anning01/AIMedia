#!/usr/bin/env python
# -*- coding: utf-8 -*-
# @Time    : 2024/12/22 21:09
# @Author  : DNQTeach
# @File    : qiehao.py
import os
import platform
import time
from io import BytesIO

from PIL import Image
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium import webdriver
import subprocess


if platform.system() == "Windows":
    import win32clipboard
    import pyperclip
    from win32com import client as win_client
    import pythoncom

elif platform.system() == "Darwin":  # macOS
    from AppKit import NSPasteboard, NSImage

def get_driver():
    chrome_options = Options()
    chrome_options.add_argument("--no-sandbox")  # 禁用沙盒模式git
    chrome_options.add_argument("--disable-gpu")
    current_path = os.path.dirname(__file__)
    parent_path = os.path.dirname(current_path)
    if platform.system() == "Windows":
        chrome_path = os.path.join(parent_path, "chrome", "chrome.exe")
        pythoncom.CoInitialize()
        win_obj = win_client.Dispatch("Scripting.FileSystemObject")
        chrome_version = win_obj.GetFileVersion(chrome_path)
        chrome_version = chrome_version.strip()
    else:
        chrome_path = os.path.join(
            parent_path,
            "chrome-mac-arm64",
            "Google Chrome for Testing.app",
            "Contents",
            "MacOS",
            "Google Chrome for Testing",
        )
        result = subprocess.run(
            [chrome_path, "--version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        chrome_version = result.stdout.decode("utf-8").strip().split()[-1]

    chrome_options.binary_location = chrome_path
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])

    driver = webdriver.Chrome(
        options=chrome_options,
        service=Service(ChromeDriverManager(chrome_version).install()),
    )
    driver.execute_cdp_cmd(
        "Page.addScriptToEvaluateOnNewDocument",
        {
            "source": 'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'
        },
    )
    screen_width = driver.execute_script("return window.screen.width")
    screen_height = driver.execute_script("return window.screen.height")
    window_width = screen_width
    window_height = screen_height
    driver.set_window_size(window_width, window_height)
    return driver


def get_cookie_qiehao(driver):
    url = "https://om.qq.com/main/account/accountSettings"
    driver.get(url)
    driver.delete_all_cookies()
    time.sleep(1)
    nickName, cookies, uid = None, None, None
    time.sleep(3)
    sm_flag = False
    while True:
        try:
            driver.find_element(By.XPATH, "//a[text()='账号管理']").click()
        except:
            pass
        try:
            if not sm_flag:
                driver.find_element(By.CLASS_NAME, 'verify_action__wrapper-cls2uD5U').find_element(By.TAG_NAME,'button').click()
                sm_flag = True
        except:
            pass
        try:
            time.sleep(1)
            nk = driver.find_elements(By.CLASS_NAME,'setting__item-cls3yN0V')
            idc,phone = None,None
            for n in nk:
                if '账号名称' in n.text:
                    nickName = n.text.split('\n')[1]
                if '联系电话' in n.text:
                    phone = n.text.split('\n')[1]
                if '主体信息' in n.text:
                    idc = n.text.split('\n')[3]
                    idc = idc[-4:]
            cookies = driver.get_cookies()
            time.sleep(1)
            if "*" not in phone and "*" not in idc:
                uid = f'{phone}_{idc}'
        except:
            pass
        if nickName and cookies and uid:
            break
    return nickName.strip(), cookies, uid.strip()


def convert_to_portrait(image_path):
    """横屏转竖屏"""
    with Image.open(image_path) as img:
        # 获取图片的宽度和高度
        width, height = img.size
        # 目标尺寸
        target_width, target_height = 540, 960
        # 判断图片是否已经是目标尺寸
        if width == target_width and height == target_height:
            print("图片已经是目标尺寸，无需转换。")
            return
        # 计算裁剪区域
        if width / height > target_width / target_height:
            # 宽度较大，需要裁剪宽度
            new_width = int(height * (target_width / target_height))
            left = (width - new_width) // 2
            top = 0
            right = (width + new_width) // 2
            bottom = height
        else:
            # 高度较大，需要裁剪高度
            new_height = int(width * (target_height / target_width))
            left = 0
            top = (height - new_height) // 2
            right = width
            bottom = (height + new_height) // 2
        # 裁剪图片
        cropped_img = img.crop((left, top, right, bottom))
        # 调整图片尺寸到目标尺寸

        resized_img = cropped_img.resize((target_width, target_height),Image.Resampling.LANCZOS)
        resized_img.save(image_path)
        print(f"图片已调整为1080x1920并覆盖原文件：{image_path}")


def publish_qiehao(driver, content, imgs_path):
    lines = content.splitlines()
    title = lines[0].strip()
    title = title.replace("#", "")
    info = "\n".join(lines[1:]).strip()
    info = info.replace("#", "")
    imgs_list = os.listdir(imgs_path)
    # convert_to_portrait(os.path.join(imgs_path,imgs_list[2]))
    imgs_list_len = len(imgs_list)

    is_copy_content = False
    out_flag = False
    time_out = 60 * 2
    tart_time = time.time()
    result = {
        "status": False,
        "msg": "",
    }
    time.sleep(10)
    while True:
        if is_copy_content is False:
            """标题"""
            try:
                title_input = WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.XPATH, '//*[@id="omEditorTitle"]/div/div[1]/div/span'))
                )
                title_input.clear()
                title_input.send_keys(title)
                time.sleep(1)
                content_input = driver.find_element(By.CLASS_NAME,'ExEditor-basic')
                content_input.clear()
                info_len = info.split("\n")
                tep = int(len(info_len) / imgs_list_len)
                info1 = [i + "\n" for i in info_len[0:tep] if len(i) > 0]
                info2 = [i + "\n" for i in info_len[tep: tep * 2] if len(i) > 0]
                info3 = [i + "\n" for i in info_len[tep * 2:] if len(i) > 0]
                ct = [info1, info2, info3]
                img_idx = 0
                for info_txt in ct:
                    try:
                        # 检查操作系统
                        image = Image.open(
                            os.path.join(imgs_path, imgs_list[img_idx])
                        )
                        output = BytesIO()
                        image.save(output, "BMP")
                        data = output.getvalue()[14:]
                        output.close()
                        win32clipboard.OpenClipboard()
                        win32clipboard.EmptyClipboard()
                        win32clipboard.SetClipboardData(
                            win32clipboard.CF_DIB, data
                        )
                        win32clipboard.CloseClipboard()
                        content_input.send_keys(Keys.CONTROL, "v")
                        time.sleep(0.5)
                        content_input.send_keys(Keys.ENTER)
                    except:
                        pass
                    pyperclip.copy("".join(info_txt))
                    content_input.send_keys(Keys.CONTROL, "v")
                    time.sleep(0.5)
                    # content_input.send_keys(Keys.DOWN)
                    img_idx += 1
                is_copy_content = True
            except:
                pass
        print("is_copy_content:", is_copy_content)
        if is_copy_content is True:
            time.sleep(10)
            try:
                wait = WebDriverWait(driver, 10)  # 等待时间设为10秒
                # 使用显示等待来等待元素出现
                publish_text_element = wait.until(
                    EC.visibility_of_element_located((By.XPATH, '//span[text()="发布"]')))
                # 从包含“发布”文本的元素出发，找到对应的按钮
                button = publish_text_element.find_element(By.XPATH, './parent::button')
                button.click()
                # 点击元素
                # a.click()
                time.sleep(5)
                out_flag = True
            except:
                print("没有找到")
        end_time = time.time()
        if out_flag:
            result["status"] = True
            break
        elif end_time - tart_time > time_out:
            break
        else:
            break
    time.sleep(10)
    return result



# driver = get_driver()
#
# cookie = [{'domain': '.om.qq.com', 'expiry': 1735135867, 'httpOnly': False, 'name': 'srcaccessToken', 'path': '/', 'sameSite': 'Lax', 'secure': False, 'value': 'FD9C3D70F7D10C82EE8AAAFA00ED9AD6'}, {'domain': 'om.qq.com', 'expiry': 1734963067, 'httpOnly': False, 'name': 'csrfToken', 'path': '/', 'sameSite': 'Lax', 'secure': False, 'value': 'csrf-1734876667143'}, {'domain': '.om.qq.com', 'expiry': 1735135867, 'httpOnly': False, 'name': 'srcopenid', 'path': '/', 'sameSite': 'Lax', 'secure': False, 'value': '2F5E10A5D9044C5CD2043E2366C0436D'}, {'domain': '.om.qq.com', 'expiry': 1735135867, 'httpOnly': False, 'name': 'omaccesstoken', 'path': '/', 'sameSite': 'Lax', 'secure': False, 'value': '00ea3bb5dcbc5ff0653ded0fedeb496a5d50059b03670b8a0d54c48ca94cf6409f9ecc504f9c6dcab1c90e097bdc132b40a7985a99fa99aa85f9d543b8e0915371bt'}, {'domain': '.om.qq.com', 'expiry': 1734919957, 'httpOnly': False, 'name': 'omtoken', 'path': '/', 'sameSite': 'Lax', 'secure': False, 'value': '00ea3bb5dcbc5ff0653ded0fedeb496a5d50059b03670b8a0d54c48ca94cf6409f9ecc504f9c6dcab1c90e097bdc132b40a7985a99fa99aa85f9d543b8e0915371bt'}, {'domain': '.om.qq.com', 'expiry': 1735135867, 'httpOnly': False, 'name': 'logintype', 'path': '/', 'sameSite': 'Lax', 'secure': False, 'value': '3'}, {'domain': '.qq.com', 'expiry': 1769436665, 'httpOnly': False, 'name': 'RK', 'path': '/', 'sameSite': 'Lax', 'secure': False, 'value': '+WcItLY2HH'}, {'domain': '.om.qq.com', 'expiry': 1735135867, 'httpOnly': False, 'name': 'userid', 'path': '/', 'sameSite': 'Lax', 'secure': False, 'value': '20190567'}, {'domain': '.qq.com', 'expiry': 1769436665, 'httpOnly': False, 'name': 'ptcz', 'path': '/', 'sameSite': 'Lax', 'secure': False, 'value': 'cc8519bd7c6614315bba6b6504e36b0baaba7c7b66780f898fd2198c641f4cfe'}]
# driver.get('https://om.qq.com/main/creation/article')
# try:
#     for ck in cookie:
#         driver.add_cookie(ck)
# except Exception as e:
#     print(e)
# driver.get('https://om.qq.com/main/creation/article')
# content = """测试\n
# 测试\n
# 哈哈\n
# 呵呵\n
# """
# imgs_path = r'D:\ai-media-pack\ai-media-plus\temp\img_temp\zdy_7'
# publish_qiehao(driver,content,imgs_path)
