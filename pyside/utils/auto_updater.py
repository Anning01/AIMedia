import json
import logging
import sys
from pathlib import Path

import requests

from api.request_handler import BASE_URL


class AutoUpdater:
    def __init__(self, current_version: str, app_name: str = "AiMedia"):
        self.current_version = current_version
        self.app_name = app_name

        # 获取配置文件路径
        if getattr(sys, "frozen", False):
            # 如果是打包后的可执行文件
            self.app_dir = Path(sys.executable).parent
            config_path = self.app_dir / "config" / "update_config.json"
        else:
            # 如果是开发环境
            self.app_dir = Path(__file__).parent.parent
            config_path = self.app_dir / "config" / "update_config.json"

        try:
            with open(config_path, encoding="utf-8") as f:
                self.config = json.load(f)
                self.config["update_server"]["base_url"] = f"{BASE_URL}/api/crawler/client_version"
        except Exception as e:
            logging.error(f"加载更新配置失败: {str(e)}")
            self.config = {
                "update_server": {"base_url": f"{BASE_URL}/api/crawler/client_version"},
                "check_interval": 3600,
            }

    def check_for_updates(self) -> tuple[bool, dict | None]:
        """
        检查更新
        :return: (是否有更新, 更新信息)
        """
        try:
            # 发送请求
            response = requests.get(self.config["update_server"]["base_url"])
            if response.status_code != 200:
                logging.error(f"检查更新失败: HTTP {response.status_code}")
                return False, None

            # 解析响应
            response_data = response.json()

            # 检查响应结构
            if response_data.get("code") != 0 or not response_data.get("result"):
                logging.error("服务器返回数据格式错误或无更新信息")
                return False, None

            # 获取最新版本信息（取结果列表的第一个）
            update_info = response_data["result"][0]

            # 打印调试信息
            logging.debug(f"服务器返回数据: {update_info}")

            # 获取版本信息
            server_version = update_info.get("version", "")
            if not server_version:
                logging.error("服务器返回的数据中没有版本号")
                return False, None

            # 比较版本
            if server_version > self.current_version:
                # 转换为我们需要的格式
                formatted_info = {
                    "version": server_version,
                    "release_date": update_info.get("updated_at", ""),
                    "release_notes": update_info.get("content", "暂无更新说明"),
                    "download_url": update_info.get("download_link", ""),
                }

                # 检查必要的字段
                if not formatted_info["download_url"]:
                    logging.error("服务器返回的数据中没有下载链接")
                    return False, None

                return True, formatted_info

            return False, None

        except Exception as e:
            logging.error(f"检查更新失败: {str(e)}")
            return False, None
