#!/usr/bin/env python
# @Time    : 2024/12/2 17:39
# @Author  : DNQTeach
# @File    : weixin.py
import os
import platform
import subprocess
import time
from io import BytesIO

from PIL import Image
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

if platform.system() == "Windows":
    import pyperclip
    import pythoncom
    import win32clipboard
    from win32com import client as win_client

elif platform.system() == "Darwin":  # macOS
    pass


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
        {"source": 'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'},
    )
    screen_width = driver.execute_script("return window.screen.width")
    screen_height = driver.execute_script("return window.screen.height")
    window_width = screen_width
    window_height = screen_height
    driver.set_window_size(window_width, window_height)
    return driver


def get_cookie_weixin(driver):
    url = "https://mp.weixin.qq.com/"
    driver.get(url)
    driver.delete_all_cookies()
    time.sleep(1)
    driver.refresh()
    nickName, cookies, uid = None, None, None
    time.sleep(3)
    while True:
        try:
            tabs = driver.find_elements(By.CLASS_NAME, "menu-fold")
            for tab in tabs:
                if tab.text == "设置与开发":
                    tab.click()
                    time.sleep(1)
                    break
            labs = driver.find_elements(By.CLASS_NAME, "weui-desktop-sub-menu__item")
            for lab in labs:
                if lab.text == "账号设置":
                    lab.click()
                    time.sleep(1)
                    break

            contents = driver.find_elements(By.CLASS_NAME, "weui-desktop-setting__item")
            for c in contents:
                if "名称" in c.text:
                    nickName = c.text.replace("名称\n", "").replace("修改", "").strip()
                if "原始ID" in c.text:
                    uid = c.text.replace("原始ID\n", "").replace("注销账号", "").strip()
            cookies = driver.get_cookies()
            if nickName and cookies and uid:
                break
        except:
            pass
    return nickName, cookies, uid


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

        resized_img = cropped_img.resize((target_width, target_height), Image.Resampling.LANCZOS)
        resized_img.save(image_path)
        print(f"图片已调整为1080x1920并覆盖原文件：{image_path}")


def publish_weixin(driver, content, imgs_path):
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
    cover_flag = False
    time_out = 60 * 2
    tart_time = time.time()
    result = {
        "status": False,
        "msg": "",
    }
    time.sleep(3)
    elms = driver.find_elements(By.CLASS_NAME, "new-creation__menu-content")
    try:
        auth = driver.find_element(By.CLASS_NAME, "weui-desktop_name").text
    except:
        auth = "佚名"
    try:
        current_window = driver.current_window_handle
        for item in elms:
            print(item.text)
            if item.text == "文章":
                item.click()
                break
        # 获取所有窗口的句柄
        all_windows = driver.window_handles
        # 切换到新打开的标签页
        for window in all_windows:
            if window != current_window:
                driver.switch_to.window(window)
                break
    except:
        pass
    time.sleep(3)
    while True:
        if is_copy_content is False:
            """标题内容"""
            try:
                title_input = WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.XPATH, '//*[@id="title"]'))
                )
                title_input.send_keys(title)
                time.sleep(1)
                """作者"""
                author = driver.find_element(By.ID, "author")
                author.send_keys(auth)
                time.sleep(1)
                """内容"""
                try:
                    """订阅号"""
                    content_input = driver.find_element(By.CLASS_NAME, "ProseMirror")
                    info_len = info.split("\n")
                    tep = int(len(info_len) / imgs_list_len)
                    info1 = [i + "\n" for i in info_len[0:tep] if len(i) > 0]
                    info2 = [i + "\n" for i in info_len[tep : tep * 2] if len(i) > 0]
                    info3 = [i + "\n" for i in info_len[tep * 2 :] if len(i) > 0]
                    ct = [info1, info2, info3]
                    img_idx = 0
                    for info_txt in ct:
                        try:
                            image = Image.open(os.path.join(imgs_path, imgs_list[img_idx]))
                            output = BytesIO()
                            image.save(output, "BMP")
                            data = output.getvalue()[14:]
                            output.close()
                            win32clipboard.OpenClipboard()
                            win32clipboard.EmptyClipboard()
                            win32clipboard.SetClipboardData(win32clipboard.CF_DIB, data)
                            win32clipboard.CloseClipboard()
                            content_input.send_keys(Keys.CONTROL, "v")
                            time.sleep(0.5)
                            # content_input.send_keys(Keys.DOWN)
                        except:
                            pass
                        pyperclip.copy("".join(info_txt))
                        content_input.send_keys(Keys.CONTROL, "v")
                        time.sleep(0.5)
                        # content_input.send_keys(Keys.DOWN)
                        img_idx += 1
                    is_copy_content = True
                except:
                    """服务号"""
                    driver.switch_to.frame("ueditor_0")
                    content_input = driver.find_element(By.CLASS_NAME, "autoTypeSetting24psection")
                    info_len = info.split("\n")
                    tep = int(len(info_len) / imgs_list_len)
                    info1 = [i + "\n" for i in info_len[0:tep] if len(i) > 0]
                    info2 = [i + "\n" for i in info_len[tep : tep * 2] if len(i) > 0]
                    info3 = [i + "\n" for i in info_len[tep * 2 :] if len(i) > 0]
                    ct = [info1, info2, info3]
                    img_idx = 0
                    for info_txt in ct:
                        try:
                            image = Image.open(os.path.join(imgs_path, imgs_list[img_idx]))
                            output = BytesIO()
                            image.save(output, "BMP")
                            data = output.getvalue()[14:]
                            output.close()
                            win32clipboard.OpenClipboard()
                            win32clipboard.EmptyClipboard()
                            win32clipboard.SetClipboardData(win32clipboard.CF_DIB, data)
                            win32clipboard.CloseClipboard()
                            content_input.send_keys(Keys.CONTROL, "v")
                            time.sleep(0.5)
                            # content_input.send_keys(Keys.DOWN)
                        except:
                            pass
                        pyperclip.copy("".join(info_txt))
                        content_input.send_keys(Keys.CONTROL, "v")
                        time.sleep(0.5)
                        # content_input.send_keys(Keys.DOWN)
                        img_idx += 1
                    is_copy_content = True
                driver.switch_to.default_content()
            except:
                pass
        if is_copy_content:
            try:
                """封面"""
                time.sleep(1)
                cover_ac = driver.find_element(By.ID, "js_cover_area")
                driver.execute_script("arguments[0].scrollIntoView();", cover_ac)
                time.sleep(1)
                actions = ActionChains(driver)
                actions.move_to_element(cover_ac).perform()
                time.sleep(1)
                popup_info = driver.find_elements(By.CLASS_NAME, "pop-opr__item")
                for info in popup_info:
                    print(info.text)
                    if info.text == "从正文选择":
                        info.click()
                        break
                time.sleep(1)
                # 点击第一章图片
                imgs = driver.find_elements(By.CLASS_NAME, "appmsg_content_img_item")
                imgs[0].click()
                # 下一步
                buttons_cover = driver.find_elements(By.CLASS_NAME, "weui-desktop-btn_wrp")
                for bnt in buttons_cover:
                    if bnt.text == "下一步":
                        bnt.find_element(By.TAG_NAME, "button").click()
                        time.sleep(2)
                        break
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                buttons_cover2 = driver.find_elements(By.CLASS_NAME, "weui-desktop-btn_wrp")
                for bnt2 in buttons_cover2:
                    if bnt2.text == "确认":
                        bnt2.find_element(By.TAG_NAME, "button").click()
                        time.sleep(1)
                        break
                cover_flag = True
            except Exception as e:
                print(e)
        try:
            if cover_flag:
                print("原创")
                yc = driver.find_element(By.CLASS_NAME, "js_unset_original_title")
                if yc.text == "未声明":
                    yc.click()
                    time.sleep(1)
                    ag = driver.find_element(By.CLASS_NAME, "original_agreement")
                    ag.find_element(By.CLASS_NAME, "weui-desktop-form__check-label").find_element(
                        By.CLASS_NAME, "weui-desktop-icon-checkbox"
                    ).click()

                    bnts = driver.find_elements(By.CLASS_NAME, "weui-desktop-btn_primary")
                    for b in bnts:
                        if b.text == "确定":
                            b.click()
                            break
        except:
            pass
        print("cover_flag:", cover_flag)
        print("is_copy_content:", is_copy_content)
        if cover_flag is True and is_copy_content is True:
            time.sleep(3)
            try:
                wait = WebDriverWait(driver, 10)  # 等待时间设为10秒
                # 使用显示等待来等待元素出现
                publish_text_element = wait.until(
                    EC.visibility_of_element_located((By.CLASS_NAME, "mass_send"))
                )
                publish_text_element.click()
                # 取消群发
                time.sleep(2)
                check = driver.find_elements(By.CLASS_NAME, "weui-desktop-form__label")
                for c in check:
                    if c.text == "群发通知":
                        inp = c.find_element(By.XPATH, "./following-sibling::div//input")
                        if inp.is_selected():
                            inp.find_element(By.XPATH, "./parent::*").click()
                            break
                time.sleep(1)
                # 确定发布
                footer_element = driver.find_element(
                    By.CLASS_NAME, "mass-send__footer"
                ).find_element(By.CLASS_NAME, "weui-desktop-popover__wrp")
                divs = footer_element.find_elements(By.CLASS_NAME, "weui-desktop-btn_wrp")
                for d in divs:
                    if d.text == "发表":
                        d.find_element(By.TAG_NAME, "button").click()
                        break
                time.sleep(1)
                # 继续发表
                continue_bnt = driver.find_elements(By.CLASS_NAME, "weui-desktop-btn_wrp")
                for c in continue_bnt:
                    if c.text == "继续发表":
                        c.find_element(By.TAG_NAME, "button").click()
                        print("发布成功")
                        out_flag = True
                        time.sleep(10)
                        break
            except:
                print("没有找到")
        end_time = time.time()
        driver.close()
        driver.quit()
        if out_flag:
            result["status"] = True
            break
        elif end_time - tart_time > time_out:
            break
        else:
            break

    return result


# driver = get_driver()
# cookie = [{"name": "_clsk", "path": "/", "value": "6d5571|1734710773255|2|1|mp.weixin.qq.com/weheat-agent/payload/record", "domain": ".qq.com", "expiry": 1734797173, "secure": False, "httpOnly": False, "sameSite": "Lax"}, {"name": "mm_lang", "path": "/", "value": "zh_CN", "domain": "mp.weixin.qq.com", "expiry": 1769270766, "secure": True, "httpOnly": False, "sameSite": "Lax"}, {"name": "slave_sid", "path": "/", "value": "TUZJNVAxMGE1Rl9SempGamdpeHhadnQwYm54aGwzVlhTcVQ2ZFh6MzZaZUIzVFBFYVBYb05IVHd1ZGJheEpFbGVQbFZrd3pCOVJzQmZFRXVWMVAzNXk1NWZIM2pTQmZ6UXp0Yll6UFl1Q0prQVkxUXJPTEF1WXR2dFVpa0swT3FzaDlTeG5vRWFBMmY5UUI5", "domain": "mp.weixin.qq.com", "expiry": 1735056373, "secure": True, "httpOnly": True, "sameSite": "Lax"}, {"name": "data_ticket", "path": "/", "value": "OGQB84Iz84/QDE/drYLOKG2mZZ2MAONu2msRPTEcMUsq0Ac+JbPe/aX9kIR9inRp", "domain": "mp.weixin.qq.com", "expiry": 1735056373, "secure": True, "httpOnly": True, "sameSite": "Lax"}, {"name": "data_bizuin", "path": "/", "value": "3589692210", "domain": "mp.weixin.qq.com", "expiry": 1735056373, "secure": True, "httpOnly": True, "sameSite": "Lax"}, {"name": "rand_info", "path": "/", "value": "CAESIGuYjh+qO/rCdDE0vgbFxIqi1Xabk6pjq1qfzYv8hNhd", "domain": "mp.weixin.qq.com", "expiry": 1735056373, "secure": True, "httpOnly": True, "sameSite": "Lax"}, {"name": "_clck", "path": "/", "value": "7nvlhs|1|frv|0", "domain": ".qq.com", "expiry": 1766246756, "secure": False, "httpOnly": False, "sameSite": "Lax"}, {"name": "xid", "path": "/", "value": "b42fb7565e2ca0d60896d1b89cbffa11", "domain": "mp.weixin.qq.com", "expiry": 1769270766, "secure": True, "httpOnly": True, "sameSite": "Lax"}, {"name": "slave_bizuin", "path": "/", "value": "3589692210", "domain": "mp.weixin.qq.com", "expiry": 1735056373, "secure": True, "httpOnly": True, "sameSite": "Lax"}, {"name": "slave_user", "path": "/", "value": "gh_db7c14ceefb2", "domain": "mp.weixin.qq.com", "expiry": 1735056373, "secure": True, "httpOnly": True, "sameSite": "Lax"}, {"name": "bizuin", "path": "/", "value": "3589692210", "domain": "mp.weixin.qq.com", "expiry": 1735056373, "secure": True, "httpOnly": True, "sameSite": "Lax"}, {"name": "uuid", "path": "/", "value": "fee07afb35bf58ef96448c3d1767998e", "domain": "mp.weixin.qq.com", "secure": True, "httpOnly": True, "sameSite": "Lax"}, {"name": "ua_id", "path": "/", "value": "aqxC3G1IgnmED1S4AAAAAN9M4ZRgjh6rGATc1phQdn4=", "domain": "mp.weixin.qq.com", "expiry": 1769270766, "secure": True, "httpOnly": True, "sameSite": "Lax"}]
# # cookie = [{"name": "_clsk", "path": "/", "value": "1mi4kdy|1734672904190|2|1|mp.weixin.qq.com/weheat-agent/payload/record", "domain": ".qq.com", "expiry": 1734759304, "secure": False, "httpOnly": False, "sameSite": "Lax"}, {"name": "mm_lang", "path": "/", "value": "zh_CN", "domain": "mp.weixin.qq.com", "expiry": 1769232897, "secure": True, "httpOnly": False, "sameSite": "Lax"}, {"name": "slave_sid", "path": "/", "value": "bmtzRmVsM2M0TzJfTmpiQ1NyXzJkQndlME5uMGZYUWFycHNzYjZUTVQ5TXlzbmNzYWxXNTdQNmNRTzdRaXRaX2ZqYVRtU2p1YUJMb3I1d1F4S3NVSVlUcl92dDJUVlQ1VlpPcEVUQW1ONm9qN1E3ZmtzNTk4RjJicG1XZUlPYTF6ZUZaOUlicHZUaVdGeUtO", "domain": "mp.weixin.qq.com", "expiry": 1735018502, "secure": True, "httpOnly": True, "sameSite": "Lax"}, {"name": "data_ticket", "path": "/", "value": "YAdLDe5E9XutWOJwpzJ0nIULjq8/M5Lu1kT8TBp5LGs7C/Qr5BdWTb8+Uc0qnmAg", "domain": "mp.weixin.qq.com", "expiry": 1735018502, "secure": True, "httpOnly": True, "sameSite": "Lax"}, {"name": "data_bizuin", "path": "/", "value": "3888825599", "domain": "mp.weixin.qq.com", "expiry": 1735018502, "secure": True, "httpOnly": True, "sameSite": "Lax"}, {"name": "rand_info", "path": "/", "value": "CAESIFi9kKOm/8FePR+tVy1Q0YGC513M5PoCzfXGwiZ4ShzM", "domain": "mp.weixin.qq.com", "expiry": 1735018502, "secure": True, "httpOnly": True, "sameSite": "Lax"}, {"name": "_clck", "path": "/", "value": "124sc30|1|frv|0", "domain": ".qq.com", "expiry": 1766208878, "secure": False, "httpOnly": False, "sameSite": "Lax"}, {"name": "xid", "path": "/", "value": "5266e74f0ce025ed53dadefb20947615", "domain": "mp.weixin.qq.com", "expiry": 1769232897, "secure": True, "httpOnly": True, "sameSite": "Lax"}, {"name": "slave_bizuin", "path": "/", "value": "3888825599", "domain": "mp.weixin.qq.com", "expiry": 1735018502, "secure": True, "httpOnly": True, "sameSite": "Lax"}, {"name": "slave_user", "path": "/", "value": "gh_a0596ccdfcab", "domain": "mp.weixin.qq.com", "expiry": 1735018502, "secure": True, "httpOnly": True, "sameSite": "Lax"}, {"name": "bizuin", "path": "/", "value": "3888825599", "domain": "mp.weixin.qq.com", "expiry": 1735018502, "secure": True, "httpOnly": True, "sameSite": "Lax"}, {"name": "uuid", "path": "/", "value": "49aac1f46f556874a2e8900001b54916", "domain": "mp.weixin.qq.com", "secure": True, "httpOnly": True, "sameSite": "Lax"}, {"name": "ua_id", "path": "/", "value": "yh8TDeLijUol4YQ6AAAAADTbOzS2j65qMgbGSb_XfWs=", "domain": "mp.weixin.qq.com", "expiry": 1769232897, "secure": True, "httpOnly": True, "sameSite": "Lax"}]
# driver.get('https://mp.weixin.qq.com/')
# try:
#     for ck in cookie:
#         driver.add_cookie(ck)
# except Exception as e:
#     print(e)
# driver.get('https://mp.weixin.qq.com/')
# content = """测试\n
# 测试\n
# 哈哈\n
# 呵呵\n
# """
# imgs_path = r'D:\ai-media-pack\ai-media-plus\temp\img_temp\zdy_7'
# publish_weixin(driver,content,imgs_path)
