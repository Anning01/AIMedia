import os
import shutil
import random
import subprocess
import time
import psutil
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.action_chains import ActionChains
import pyperclip
from selenium.webdriver.common.keys import Keys
import pythoncom
from win32com import client as win_client
from PIL import Image
from io import BytesIO
import win32clipboard

class AutoTools(object):
    def __init__(self):
        self.platform_url = {"头条号": "https://mp.toutiao.com/auth/page/login",
                             "抖音热点宝":"https://douhot.douyin.com/welcome"
                             }

    def get_driver(self):
        chrome_options = Options()
        current_path = os.path.dirname(__file__)
        parent_path = os.path.dirname(current_path)
        chrome_path = os.path.join(parent_path, "chrome", "chrome1.exe")
        pythoncom.CoInitialize()
        win_obj = win_client.Dispatch("Scripting.FileSystemObject")
        chrome_version = win_obj.GetFileVersion(chrome_path)
        chrome_version = chrome_version.strip()
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
        window_width = screen_width // 1.3
        window_height = screen_height
        driver.set_window_size(window_width, window_height)
        return driver

    def connect_driver(self, random_number, chrome_path,user_data_dir):
        chrome_options = Options()
        chrome_options.add_experimental_option(
            "debuggerAddress", f"127.0.0.1:{random_number}"
        )
        pythoncom.CoInitialize()
        chrome_options.add_argument(fr"--user-data-dir={user_data_dir}")
        win_obj = win_client.Dispatch("Scripting.FileSystemObject")
        chrome_version = win_obj.GetFileVersion(chrome_path)
        chrome_version = chrome_version.strip()
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
        chrome_options.add_argument(f"user-agent={user_agent}")

        driver = webdriver.Chrome(
            options=chrome_options,
            service=Service(ChromeDriverManager(chrome_version).install()),
        )
        return driver, random_number

    def run_as_admin(self, cmd):
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        process = subprocess.Popen(cmd, shell=True, startupinfo=startupinfo)
        return process

    def get_cookies(self, platform):
        driver = self.get_driver()
        driver.get(self.platform_url[platform])
        driver.delete_all_cookies()
        time.sleep(1)
        nickName, cookies, uid = None, None, None
        while True:
            try:
                time.sleep(1)
                nickName = driver.find_element("class name", "auth-avator-name").text
                cookies = driver.get_cookies()
                driver.find_element(By.LINK_TEXT, "设置").click()
                time.sleep(1)
                uid = driver.find_element(
                    "xpath",
                    '//*[@id="root"]/div/div[1]/div[1]/div[2]/div[5]/div/div[2]',
                ).text
                uid = uid.replace("复制ID", "").replace("\n", "").replace("\t", "")
            except:
                pass

            if nickName and cookies and uid:
                break
        return nickName, cookies, uid

    def get_cookies_douy_hot(self, platform):
        print("222")
        driver = self.get_driver()
        driver.get(self.platform_url[platform])
        driver.delete_all_cookies()
        time.sleep(1)
        nickName, cookies, uid = None, None, None
        try:
            driver.find_element(By.XPATH, '//*[@id="root"]/section/header/div/div[2]/button').click()
        except:
            pass
        while True:
            try:
                time.sleep(1)
                cookies = driver.get_cookies()
            except:
                pass
            time.sleep(1)
            try:
                elm = driver.find_element(By.XPATH,'//*[@id="root"]/section/header/div/div[2]/div[2]/div/span/img')
            except:
                elm = None
            if elm:
                break
        return cookies

    def kill_process_tree(self, pid):
        try:
            parent = psutil.Process(pid)
            children = parent.children(recursive=True)
            for child in children:
                child.terminate()
            gone, still_alive = psutil.wait_procs(children, timeout=5)
            for p in still_alive:
                p.kill()
            parent.terminate()
            parent.wait(timeout=5)
            print(f"Process tree with root PID {pid} terminated successfully.")
        except psutil.NoSuchProcess:
            print(f"Process with PID {pid} does not exist.")
        except psutil.TimeoutExpired:
            print(f"Process with PID {pid} did not terminate in time. Forcefully killing...")
            parent.kill()
            print(f"Process with PID {pid} forcefully killed.")

    def publish(self, cookie, content, platform, imgs_path):
        urls = {"头条号": "https://mp.toutiao.com/profile_v4/graphic/publish"}
        url = urls[platform]
        current_path = os.path.dirname(__file__)
        parent_path = os.path.dirname(current_path)
        or_chrome_path = os.path.join(parent_path, "chrome", "chrome1.exe")
        random_number = random.randint(9000, 9999)
        new_chrome_path = os.path.join(parent_path, "chrome", f"chrome{random_number}.exe")
        try:
            shutil.copy(or_chrome_path, new_chrome_path)
        except:
            pass
        print("random_number:", random_number)
        user_data_dir = rf"C:\selenium\ChromeProfile{random_number}"
        cmd = rf'"{new_chrome_path}" --remote-debugging-port={random_number} --user-data-dir="{user_data_dir}" --start-maximized --no-first-run --no-default-browser-check'
        self.run_as_admin(cmd)
        driver, random_number = self.connect_driver(random_number, new_chrome_path,user_data_dir)
        driver.get(url)
        driver.delete_all_cookies()
        time.sleep(1)
        try:
            for ck in cookie:
                driver.add_cookie(ck)
        except Exception as e:
            print(e)
        time.sleep(5)
        lines = content.splitlines()
        title = lines[0].strip()
        title = title.replace("#", "")
        info = "\n".join(lines[1:]).strip()
        info = info.replace("#", "")
        is_copy_content = False
        out_flag = False
        publish_flag = False
        time_out = 60 * 2
        tart_time = time.time()
        imgs_list = os.listdir(imgs_path)
        imgs_list_len = len(imgs_list)
        result = {
            "status": False,
            "msg": "",
        }
        while True:
            try:
                if is_copy_content is False:
                    textarea = driver.find_element(
                        By.XPATH,
                        '//*[@id="root"]/div/div[1]/div/div[1]/div[3]/div/div/div[2]/div/div/div/textarea',
                    )
                    textarea.send_keys(title)
                    time.sleep(random.randint(1, 2))
                    time.sleep(1)
                    info_tag = driver.find_element(
                        By.XPATH,
                        '//*[@id="root"]/div/div[1]/div/div[1]/div[4]/div/div[1]',
                    )

                    if imgs_list_len == 0:
                        pyperclip.copy(info)
                        info_tag.send_keys(Keys.CONTROL, "v")
                        time.sleep(0.5)
                        time.sleep(0.5)
                        info_tag.send_keys(Keys.DOWN)
                        is_copy_content = True
                    else:
                        info_len = info.split("\n")
                        tep = int(len(info_len) / imgs_list_len)
                        info1 = [i + "\n" for i in info_len[0:tep]]
                        info2 = [i + "\n" for i in info_len[tep : tep * 2]]
                        info3 = [i + "\n" for i in info_len[tep * 2 :]]
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
                                info_tag.send_keys(Keys.CONTROL, "v")
                                time.sleep(0.5)
                                info_tag.send_keys(Keys.DOWN)
                            except:
                                pass
                            pyperclip.copy("".join(info_txt))
                            info_tag.send_keys(Keys.CONTROL, "v")
                            time.sleep(0.5)
                            info_tag.send_keys(Keys.DOWN)
                            is_copy_content = True
                            img_idx += 1
            except:
                pass

            print(is_copy_content, "is_copy_content")
            if is_copy_content:
                print("投放广告赚收益")
                tags = driver.find_elements(By.CLASS_NAME, "edit-input")
                for i in tags:
                    time.sleep(1)
                    txt = i.text
                    if txt == "投放广告赚收益不投放广告":
                        try:
                            i.find_element(By.CLASS_NAME, "byte-radio-inner").click()
                        except:
                            pass
                    if "头条首发" in txt:
                        driver.execute_script("arguments[0].scrollIntoView();", i)
                        if "授权平台自动维权" not in txt:
                            try:
                                i.find_element(
                                    By.CLASS_NAME, "byte-checkbox-wrapper"
                                ).click()
                            except:
                                pass
                    if "发布得更多收益" in txt:
                        try:
                            checked = i.find_element(By.CLASS_NAME, "combine-tip-wrap")
                            child_elements = checked.find_element(By.TAG_NAME, "label")
                            class_name = child_elements.get_attribute("class")
                            if class_name == "byte-checkbox item-checkbox":
                                i.find_element(
                                    By.CLASS_NAME, "byte-checkbox-wrapper"
                                ).click()
                        except:
                            pass
                    if "个人观点" in txt:
                        try:
                            source = i.find_element(By.CLASS_NAME, "source-info-wrap")
                            labels = source.find_element(
                                By.CLASS_NAME, "byte-checkbox-group"
                            )
                            child_elements = labels.find_elements(By.TAG_NAME, "label")
                            for info_e in child_elements:
                                if info_e.text == "个人观点，仅供参考":
                                    class_name = info_e.get_attribute("class")
                                    if class_name == "byte-checkbox checkbot-item":
                                        info_e.find_element(
                                            By.CLASS_NAME, "byte-checkbox-wrapper"
                                        ).click()
                                        break
                        except:
                            pass
            if is_copy_content:
                if imgs_list_len == 0:
                    time.sleep(1)
                    tags = driver.find_elements(By.CLASS_NAME, "byte-tabs-header-title")
                    for item in tags:
                        for a in range(0, 5):
                            if "1" in item.text:
                                item.click()
                                time.sleep(2)
                                driver.find_element(
                                    By.XPATH,
                                    '//*[@id="root"]/div/div[2]/div[2]/div/div/div/div[2]/div/div[2]/div/div/div[2]/div/div/div[2]/ul/li[1]',
                                ).click()
                                publish_flag = True
                                time.sleep(2)
                                break
                            elif "2" in item.text:
                                item.click()
                                time.sleep(2)
                                driver.find_element(
                                    By.XPATH,
                                    '//*[@id="root"]/div/div[2]/div/div/div/div/div[2]/div/div[2]/div/div/div[2]/div/div[2]/div[2]/ul/li[1]',
                                ).click()
                                publish_flag = True
                                time.sleep(2)
                                break
                            elif "内容建议" in item.text:
                                item.click()
                                driver.find_element(
                                    By.XPATH,
                                    '//*[@id="root"]/div/div[2]/div[2]/div/div/div/div[2]/div/div[2]/div/div/div[1]/div/a',
                                ).click()
                                time.sleep(5)
                            else:
                                pass
                else:
                    publish_flag = True
            print("publish_flag:", publish_flag)
            if publish_flag:
                try:
                    driver.find_element(By.CLASS_NAME, "publish-btn-last").click()
                    time.sleep(3)
                    driver.find_element(By.CLASS_NAME, "publish-btn-last").click()
                    out_flag = True
                    time.sleep(3)
                except:
                    pass
            end_time = time.time()
            if out_flag:
                result["status"] = True
                break
            elif end_time - tart_time > time_out:
                break
            else:
                is_copy_content = False
                out_flag = False
                publish_flag = False
                driver.refresh()
                time.sleep(3)
        driver.quit()
        time.sleep(3)
        subprocess.call(['taskkill', '/F', '/IM', f'chrome{random_number}.exe'])
        try:
            time.sleep(3)
            shutil.rmtree(new_chrome_path)
            time.sleep(3)
            shutil.rmtree(user_data_dir)
        except:
            pass
        return result

    def get_acconut_data(self, cookie, platform):
        urls = {"头条号": "https://mp.toutiao.com/profile_v4/index"}
        driver = self.get_driver()
        driver.get(urls[platform])
        driver.delete_all_cookies()
        try:
            for ck in cookie:
                driver.add_cookie(ck)
        except Exception as e:
            print(e)
        time.sleep(60 * 30)


if __name__ == "__main__":
    a = AutoTools()

