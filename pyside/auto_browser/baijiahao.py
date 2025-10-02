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

if platform.system() == "Windows":
    import win32clipboard
    import pyperclip

elif platform.system() == "Darwin":  # macOS
    from AppKit import NSPasteboard, NSImage



def get_cookie_baijiahao(driver):
    url = "https://baijiahao.baidu.com/builder/theme/bjh/login"
    driver.get(url)
    driver.delete_all_cookies()
    time.sleep(1)
    nickName, cookies, uid = None, None, None
    try:
        driver.find_element(By.CLASS_NAME, 'btnlogin--bI826').click()
    except:
        pass
    time.sleep(3)
    while True:
        try:
            driver.find_element('class name','activity-content').click()
        except:
            pass

        '''关闭弹窗'''
        try:
            driver.find_element(By.XPATH, '//*[@id="react-joyride-step-0"]/div/div/div[1]/div[2]/button').click()
            time.sleep(1)
        except:
            pass
        try:
            driver.find_element(By.XPATH, '//*[@id="react-joyride-step-1"]/div/div/div[1]/div[2]/button[2]').click()
            time.sleep(1)
        except:
            pass
        try:
            driver.find_element(By.XPATH, '//*[@id="react-joyride-step-2"]/div/div/div[1]/div[2]/button[2]').click()
            time.sleep(1)
        except:
            pass
        try:
            driver.find_element(By.XPATH,'//*[@id="react-joyride-step-3"]/div/div/div[1]/div[2]/button[2]').click()
        except:
            pass
        '''跳转首页'''
        try:
            driver.find_element(By.ID, "asideMenuItem-个人中心").click()
        except:
            pass
        try:
            time.sleep(1)
            nickName = driver.find_element("class name", "pRvnIfCutwzU_pTdvz9Q").text
            cookies = driver.get_cookies()
            time.sleep(1)
            uid = driver.find_element("xpath",
                                      '//*[@id="layout-main-content"]/div[2]/div/div/div/div[1]/div[1]/div[3]/div[2]/div[1]/div[2]/div/span').text
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
        resized_img = cropped_img.resize((target_width, target_height), Image.Resampling.LANCZOS)
        # 保存图片时提高质量
        resized_img.save(image_path, quality=95)
        print(f"图片已调整为540x960并覆盖原文件：{image_path}")



def publish_baijiahao(driver, content, imgs_path):
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
    time.sleep(10)
    while True:
        """处理弹窗"""
        try:
            # 等待 span 元素出现，并找到包含特定文本的 span
            span_element = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//span[contains(text(), '好的')]"))
            )
            # 点击该 span 元素
            span_element.click()
        except Exception as e:
            print(f"An error occurred: {e}")

        if is_copy_content is False:
            """标题"""
            try:
                title_input = WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.XPATH, '//*[@id="newsTextArea"]/div/div/div/div/div/div/div[1]/div/div[1]/textarea'))
                )
                title_input.send_keys(title)

                # 等待iframe加载完成
                wait = WebDriverWait(driver, 10)
                # 通过ID切换到iframe
                driver.switch_to.frame('ueditor_0')
                content_input = driver.find_element(By.XPATH,'/html/body')
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
                        if platform.system() == "Windows":
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
                            # content_input.send_keys(Keys.DOWN)
                        elif platform.system() == "Darwin":  # macOS
                            image = Image.open(
                                os.path.join(imgs_path, imgs_list[img_idx])
                            )
                            # 将图像转换为 NSImage
                            output = BytesIO()
                            image.save(output, "BMP")
                            output.seek(0)
                            ns_image = NSImage.alloc().initWithData_(
                                output.getvalue()
                            )
                            # 获取系统剪贴板
                            pasteboard = NSPasteboard.generalPasteboard()
                            pasteboard.clearContents()
                            # 将 NSImage 写入剪贴板
                            pasteboard.writeObjects_([ns_image])
                            content_input.send_keys(Keys.COMMAND, "v")
                            time.sleep(0.5)
                            # content_input.send_keys(Keys.DOWN)
                    except:
                        pass
                    if platform.system() == "Windows":
                        pyperclip.copy("".join(info_txt))
                        content_input.send_keys(Keys.CONTROL, "v")
                    else:
                        pasteboard = NSPasteboard.generalPasteboard()
                        pasteboard.clearContents()
                        pasteboard.writeObjects_(info_txt)
                        content_input.send_keys(Keys.COMMAND, "v")
                    time.sleep(0.5)
                    # content_input.send_keys(Keys.DOWN)
                    img_idx += 1
                is_copy_content = True
                driver.switch_to.default_content()
            except:
                driver.switch_to.default_content()
        if is_copy_content:
            time.sleep(1)
            # 切换回主文档
            try:
                radios = driver.find_element(By.XPATH,'//span[text()="单图"]')
                driver.execute_script("arguments[0].scrollIntoView(true);", radios)
                driver.execute_script("arguments[0].click();", radios)
                time.sleep(5)
                cover_row = driver.find_elements(By.CLASS_NAME,'wrap-scale-DraggableTags')
                index = 0
                print(len(cover_row))
                for elm in cover_row:
                    if index == 0:
                        actions = ActionChains(driver)
                        actions.move_to_element(elm).click().perform()
                        time.sleep(1)
                        covers = driver.find_elements(By.CLASS_NAME,"cheetah-ui-pro-base-image-aspect-fit")
                        actions = ActionChains(driver)
                        actions.move_to_element(covers[0]).click().perform()
                        time.sleep(1)
                        current_element = driver.find_element(By.ID, "imageModalEditBtn")
                        # 获取父元素
                        parent_element = current_element.find_element(By.XPATH, "..")
                        # 查找所有同级元素
                        sibling_elements = parent_element.find_elements(By.TAG_NAME, "button")
                        for t in sibling_elements:
                            if t.text == "确认":
                                t.click()
                                time.sleep(3)
                    else:
                        actions = ActionChains(driver)
                        actions.move_to_element(elm).click().perform()
                        time.sleep(1)
                        covers = driver.find_elements(By.CLASS_NAME,"cheetah-ui-pro-base-image-aspect-fit")
                        actions = ActionChains(driver)
                        actions.move_to_element(covers[2]).click().perform()
                        time.sleep(3)
                        buttons = driver.find_elements(By.XPATH,'//button/span[text()="确认"]/..')
                        actions = ActionChains(driver)
                        actions.move_to_element(buttons[1]).click().perform()
                        cover_flag = True
                    index +=1
            except Exception as e:
                print("图片封面出错")
        """勾选框"""
        try:
            selects = driver.find_elements('class name','cheetah-checkbox-input')
            for s in selects:
                if s.is_selected() is False:
                    driver.execute_script("arguments[0].scrollIntoView(true);", s)
                    time.sleep(1)  # 等待页面滚动完成
                    actions = ActionChains(driver)
                    actions.move_to_element(s).click().perform()
                    time.sleep(1)
        except:
            pass
        print("cover_flag:",cover_flag)
        print("is_copy_content:", is_copy_content)
        if  is_copy_content is True:
            time.sleep(10)
            try:
                wait = WebDriverWait(driver, 10)  # 等待时间设为10秒
                # 使用显示等待来等待元素出现
                publish_text_element = wait.until(
                    EC.visibility_of_element_located((By.XPATH, '//div[text()="发布" and not(contains(text(), "定时发布"))]')))
                print(publish_text_element.text)
                # 从包含“发布”文本的元素出发，找到对应的按钮
                print("找到发布")
                button = publish_text_element.find_element(By.XPATH, './parent::div//button')
                print("找到按钮")
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




