import shutil

from PySide6.QtCore import QThread, Signal
import time
import os
import requests
from datetime import datetime

from utils.token_check import check_user_token
from utils.article_product import article_create
from utils.precess_image import precess_image
from auto_browser.auto_base import AutoTools
from api.api_all import get_account_info, token_report
from services.material_service import MaterialService

from utils.get_user_ope import user_opt


class MaterialThread(QThread):
    """素材生产发布线程"""
    log_signal = Signal(str)
    
    def __init__(self, materials, production_window, material_service):
        super().__init__()
        self.materials = materials
        self.production_window = production_window
        self.material_service = material_service
        self._running = True
        
    def run(self):
        """运行线程"""
        try:
            selected_model, api_key,config = user_opt()
            if False in [selected_model, api_key]:
                self.log_signal.emit("请先配置模型和api_key")
                time.sleep(10)
                return

            is_publish, is_not_full, api_key, selected_model, prompt = check_user_token()
            print(is_publish, is_not_full, api_key, selected_model, prompt)
            if not is_publish:
                self.log_signal.emit('请先在模型中心配置')
                return
                
            for material in self.materials:
                if not self._running:
                    break
                    
                try:
                    self.log_signal.emit(f'开始处理素材: {material["title"]}')
                    
                    # 1. 下载图片
                    self.log_signal.emit('开始下载图片')
                    img_dir = os.path.join('temp', 'img_temp', f'zdy_{material["id"]}')
                    os.makedirs(img_dir, exist_ok=True)
                    
                    img_paths = []
                    headers = {
                        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
                    }
                    for i, img_url in enumerate(material['image_list']):
                        print(img_url)
                        try:
                            response = requests.get(img_url,headers=headers, timeout=30)
                            if response.status_code == 200:
                                img_path = os.path.join(img_dir, f'{i}.jpg')
                                with open(img_path, 'wb') as f:
                                    f.write(response.content)
                                img_paths.append(img_path)
                                self.log_signal.emit(f'下载图片 {i+1}/3 成功')
                            else:
                                self.log_signal.emit(f'下载图片 {i+1}/3 失败: HTTP {response.status_code}')
                        except Exception as e:
                            self.log_signal.emit(f'下载图片 {i+1}/3 失败: {str(e)}')
                    
                    if len(img_paths) != 3:
                        self.log_signal.emit('图片下载不完整，跳过此素材')
                        continue
                    
                    # 2. 生产内容
                    self.log_signal.emit('开始生产内容')
                    topic = material['title'] + '\n' + material['content']
                    is_create, article = self.produce_content(topic, selected_model, api_key, prompt, material['id'],is_not_full)
                    
                    if not is_create:
                        self.log_signal.emit('文章生产失败')
                        continue
                    
                    # 3. 发布内容
                    self.log_signal.emit('获取账号信息')
                    cookies = get_account_info(material['account_id'])
                    cookie = cookies['cookie']
                    
                    self.log_signal.emit('开始发布，等待浏览器启动')
                    publish_tool = AutoTools()
                    result = publish_tool.publish(cookie, article, material['platform'], img_dir)
                    
                    # 4. 更新状态
                    now = datetime.now()
                    material_service_ = MaterialService()
                    if result["status"]:
                        self.log_signal.emit('发布成功')
                        material_service_.update_material_status(material['id'], 2)  # 已发布
                    else:
                        self.log_signal.emit('发布失败')
                        material_service_.update_material_status(material['id'], 3)  # 发布失败
                    shutil.rmtree(img_dir)
                except Exception as e:
                    self.log_signal.emit(f'处理素材失败: {str(e)}')
                    continue
            self.log_signal.emit(f'任务已经全部完成')
        except Exception as e:
            self.log_signal.emit(f'生产发布任务失败: {str(e)}')
            
    def produce_content(self, topic, selected_model, api_key, prompt, _id,is_not_full):
        """生产内容"""
        try:
            article, usetokens, enable = article_create(topic, selected_model, api_key, prompt,is_not_full)
            
            if api_key is None:
                lines = topic.splitlines()
                original_title = lines[0].strip()
                original_content = "\n".join(lines[1:]).strip()

                lines_new = article.splitlines()
                new_title = lines_new[0].strip()
                new_content = "\n".join(lines_new[1:]).strip()
                
                dict_ = {
                    'original_title': original_title,
                    'original_content': original_content,
                    'image_list': '',
                    'new_title': new_title,
                    'new_content': new_content,
                    'use_token': usetokens,
                    'enable': enable
                }
                
                try:
                    token_report(dict_)
                except:
                    pass
                    
                if len(article) > 500:
                    return True, article
                    
            return True, article
            
        except:
            return False, None
