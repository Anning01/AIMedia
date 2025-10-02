import requests
import json
from typing import Tuple, Optional
from PySide6.QtCore import QSettings
from api.request_handler import BASE_URL

class AuthService:
    BASE_URL = BASE_URL
    
    @staticmethod
    def get_login_url() -> Tuple[str, str]:
        """获取登录二维码URL和state"""
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json'
        }
        try:
            # 添加allow_redirects=True来处理重定向
            response = requests.get(
                f"{AuthService.BASE_URL}/crawler/qr_code/",
                headers=headers,
                timeout=10,
                allow_redirects=True,
                verify=False  # 如果是HTTPS证书问题，可以暂时禁用验证
            )
            print(f"\n获取登录URL响应:")
            print(f"状态码: {response.status_code}")
            print(f"响应头: {dict(response.headers)}")
            print(f"响应内容: {response.text}\n")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if data.get("code") !=0:
                        raise ValueError("响应数据缺少必要字段")
                    # 验证URL格式
                    authorize_url = data['result']["authorize_url"]
                    if not authorize_url.startswith('https'):
                        raise ValueError(f"无效的URL格式: {authorize_url}")
                    return authorize_url, data['result']["state"]
                except json.JSONDecodeError:
                    raise Exception("服务器返回的不是有效的JSON数据")
            else:
                raise Exception(f"服务器返回错误状态码: {response.status_code}")
        except requests.exceptions.Timeout:
            raise Exception("获取登录二维码超时，请检查网络连接")
        except requests.exceptions.RequestException as e:
            raise Exception(f"网络请求失败: {str(e)}")
        except Exception as e:
            raise Exception(f"获取登录二维码失败: {str(e)}")
    
    @staticmethod
    def check_login_status(state: str) -> Optional[str]:
        """检查登录状态，返回token或None"""
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json'
        }
        try:
            response = requests.get(
                f"{AuthService.BASE_URL}/crawler/checkin",
                params={"state": state},
                headers=headers,
                timeout=10,
                allow_redirects=True,
                verify=False  # 如果是HTTPS证书问题，可以暂时禁用验证
            )
            print(f"\n检查登录状态响应:")
            print(f"状态码: {response.status_code}")
            print(f"响应头: {dict(response.headers)}")
            print(f"响应内容: {response.text}\n")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if data.get("code") == 0:
                        result = data.get("result", {})
                        if result.get("status") == 'success':  # 只获取access token
                            data = result.get("data",{})
                            return data["access"]
                    # 其他所有情况都视为扫码失败
                    return "SCAN_FAILED"
                except json.JSONDecodeError:
                    raise Exception("服务器返回的不是有效的JSON数据")
            else:
                raise Exception(f"服务器返回错误状态码: {response.status_code}")
        except requests.exceptions.Timeout:
            raise Exception("检查登录状态超时，请检查网络连接")
        except requests.exceptions.RequestException as e:
            raise Exception(f"网络请求失败: {str(e)}")
        except Exception as e:
            raise Exception(f"检查登录状态失败: {str(e)}")
    
    @staticmethod
    def save_token(token: str):
        """将token保存到设置中"""
        settings = QSettings("AiMedia", "ai-media")
        settings.setValue("token", token)
    
    @staticmethod
    def get_token() -> Optional[str]:
        """从设置中获取token"""
        settings = QSettings("AiMedia", "ai-media")
        return settings.value("token")

    @staticmethod
    def delete_token() -> bool:
        """从设置中删除token"""
        try:
            settings = QSettings("AiMedia", "ai-media")
            settings.remove("token")
            print("成功删除token")
            return True
        except Exception as e:
            print(f"删除token失败: {e}")
            return False

# AuthService().save_token("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzM1OTEyMDM4LCJpYXQiOjE3MzUzMDcyMzgsImp0aSI6Ijc3YjFjZDg3NTQxMjQ4YzVhNDBlNTRkYWI1MjVhY2I2IiwidXNlcl9pZCI6MTYzfQ.MBgoNjARTPTeJ6Ta1X2LqZ8jls5gNlrh59KXUbxKGi4")