import os
from datetime import datetime
import json
from pathlib import Path
import requests
from PySide6.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
                             QPushButton, QLabel, QStackedWidget, QScrollArea,
                             QApplication, QMessageBox)
from PySide6.QtCore import Qt, QSize, QCoreApplication, QTimer
from PySide6.QtGui import (QIcon, QFont, QPixmap)

import sys
from PySide6.QtCore import Qt, QSize, QCoreApplication

from api.api_all import get_user
from components.user_info_widget import UserInfoWidget
from components.hot_spot_widget import HotSpotWidget
from components.account_manager_widget import AccountManagerWidget
from components.task_center_widget import TaskCenterWidget
from components.auto_publish_widget import AutoPublishWidget
from components.model_config_widget import ModelConfigWidget
from components.material_import_widget import MaterialImportWidget
from components.notice_widget import NoticeWidget
from components.help_widget import HelpWidget
from components.vip_widget import VipWidget
from utils.auto_updater import AutoUpdater
from utils.notice_service import NoticeService
import logging

class MainWindow(QMainWindow):
    def __init__(self):
        # 在创建QMainWindow之前设置属性
        if hasattr(Qt, 'AA_EnableHighDpiScaling'):
            QApplication.setAttribute(Qt.AA_EnableHighDpiScaling)
        if hasattr(Qt, 'AA_UseHighDpiPixmaps'):
            QApplication.setAttribute(Qt.AA_UseHighDpiPixmaps)
        
        super().__init__()
        
        # 加载版本信息
        try:
            if getattr(sys, 'frozen', False):
                # 打包环境
                version_path = Path(sys.executable).parent / "version.json"
            else:
                # 开发环境
                version_path = Path(__file__).parent.parent / "version.json"
                
            with open(version_path, 'r', encoding='utf-8') as f:
                version_info = json.load(f)
                self.current_version = version_info.get('version', '1.0.0')
        except Exception as e:
            logging.error(f"加载版本信息失败: {str(e)}")
            self.current_version = '1.0.0'
        
        # 初始化自动更新器
        self.updater = AutoUpdater(
            current_version=self.current_version,
            app_name="AiMedia"
        )
        
        # 初始化通知服务
        self.notice_service = NoticeService()
        
        # 设置定时检查更新
        self.update_timer = QTimer(self)
        self.update_timer.timeout.connect(self.check_for_updates)
        # 设置为每小时检查一次（3600000毫秒）
        self.update_timer.start(3600000)
        
        # 设置定时检查通知
        self.notice_timer = QTimer(self)
        self.notice_timer.timeout.connect(self.update_notice_badge)
        self.notice_timer.start(1800000)  # 每30分钟检查一次 (30 * 60 * 1000 毫秒)
        
        # 设置Qt文本渲染
        self.setAttribute(Qt.WA_TranslucentBackground, False)
        self.setAttribute(Qt.WA_OpaquePaintEvent, True)
        
        # 设置全局默认字体
        default_font = QFont("Microsoft YaHei, 微软雅黑, SimSun, 宋体, Arial", 9)
        QApplication.setFont(default_font)
        
        self.init_ui()
        
        # 设置默认用户信息
        self.update_user_info()
        
        # 首次检查更新
        QTimer.singleShot(5000, self.check_for_updates)  # 启动5秒后检查更新

    def init_ui(self):
        """初始化UI"""
        # 移除重复的字体设置，使用全局字体设置
        self.setWindowTitle("AI Media Plus")
        self.setWindowIcon(QIcon("docs/logo.png"))
        self.resize(1200, 800)
        self.setMinimumSize(1000, 600)
        
        # 设置应用样式
        self.setStyleSheet("""\
            /* 全局字体设置 */
            * {
                font-family: "Microsoft YaHei", "微软雅黑", "SimSun", "宋体", "Arial", sans-serif;
            }
            
            QMainWindow {
                background-color: #ECF0F1;
            }
            
            /* 侧边栏样式 */
            #sidebar {
                background-color: #2C3E50;
                color: white;
                border-right: 1px solid #BDC3C7;
            }
            
            #logo {
                padding: 20px 0;
            }
            
            /* 导航按钮样式 */
            #nav_button {
                border: none;
                text-align: left;
                padding: 10px 20px;
                color: #ECF0F1;
                background-color: transparent;
            }
            
            #nav_button:hover {
                background-color: #34495E;
            }
            
            #nav_button:checked {
                background-color: #3498DB;
                border-left: 4px solid #E74C3C;
            }
            
            /* 内容区样式 */
            #content_area {
                background-color: #ECF0F1;
            }
            
            /* 标题栏样式 */
            #title_bar {
                background-color: white;
                border-bottom: 1px solid #BDC3C7;
            }
            
            #page_title {
                color: #2C3E50;
            }
            
            /* 滚动区域样式 */
            QScrollArea {
                border: none;
                background-color: transparent;
            }
            
            QScrollBar:vertical {
                border: none;
                background: #ECF0F1;
                width: 10px;
                margin: 0;
            }
            
            QScrollBar::handle:vertical {
                background: #BDC3C7;
                min-height: 20px;
                border-radius: 5px;
            }
            
            QScrollBar::add-line:vertical,
            QScrollBar::sub-line:vertical {
                border: none;
                background: none;
            }
            
            /* 页面内容样式 */
            QLabel[objectName^="label_"] {
                color: #2C3E50;
                background-color: white;
                border-radius: 10px;
                padding: 40px;
                border: 1px solid #BDC3C7;
            }
            
            QPushButton {
                padding: 5px 10px;
                border: none;
                border-radius: 4px;
                background-color: transparent;
                color: #333333;
            }
            QPushButton:hover {
                background-color: rgba(0, 0, 0, 0.1);
            }
            QPushButton:pressed {
                background-color: rgba(0, 0, 0, 0.2);
            }
            * {
                color: #333333;
            }
        """)
        
        # 创建主布局
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QHBoxLayout(central_widget)
        main_layout.setSpacing(0)
        main_layout.setContentsMargins(0, 0, 0, 0)
        
        # 创建左侧导航栏
        self.create_sidebar(main_layout)
        
        # 创建右侧内容区
        self.create_content_area(main_layout)
        
        # 设置默认显示的页面
        self.stacked_widget.setCurrentIndex(0)
    
    def create_sidebar(self, main_layout):
        """创建左侧导航栏"""
        sidebar = QWidget()
        sidebar.setObjectName("sidebar")
        sidebar.setFixedWidth(200)
        
        sidebar_layout = QVBoxLayout(sidebar)
        sidebar_layout.setContentsMargins(0, 0, 0, 0)
        sidebar_layout.setSpacing(0)
        
        # Logo区域
        logo_label = QLabel()
        logo_label.setObjectName("logo")
        logo_label.setPixmap(QPixmap("docs/logo.png").scaled(
            160, 60, Qt.KeepAspectRatio, Qt.SmoothTransformation))
        logo_label.setAlignment(Qt.AlignCenter)
        sidebar_layout.addWidget(logo_label)
        
        # 导航按钮
        self.nav_buttons = []
        nav_items = [
            {"text": "实时热点", "icon": ""},
            {"text": "账号管理", "icon": ""},
            {"text": "任务中心", "icon": ""},
            {"text": "一键托管", "icon": ""},
            {"text": "模型配置", "icon": ""},
            {"text": "素材导入", "icon": ""},
            {"text": "指导通知", "icon": ""},
            {"text": "开通会员", "icon": ""},
            {"text": "使用帮助", "icon": ""}
        ]
        
        for i, item in enumerate(nav_items):
            btn_container = QWidget()
            btn_layout = QHBoxLayout(btn_container)
            btn_layout.setContentsMargins(0, 0, 0, 0)
            btn_layout.setSpacing(5)
            
            # 创建按钮
            btn = QPushButton(item["text"])
            btn.setObjectName("nav_button")
            btn.setCheckable(True)
            btn.clicked.connect(lambda checked, index=i: self.on_nav_button_clicked(index))
            
            # 添加图标
            if item["icon"]:
                btn.setIcon(QIcon(item["icon"]))
            
            btn_layout.addWidget(btn)
            
            # 如果是通知按钮，添加红点标记
            if item["text"] == "指导通知":
                self.notice_badge = QLabel()
                self.notice_badge.setFixedSize(16, 16)
                self.notice_badge.setAlignment(Qt.AlignCenter)
                self.notice_badge.setStyleSheet("""
                    QLabel {
                        background-color: #E74C3C;
                        color: white;
                        border-radius: 8px;
                        font-size: 10px;
                        font-weight: bold;
                    }
                """)
                self.notice_badge.hide()
                btn_layout.addWidget(self.notice_badge)
            
            sidebar_layout.addWidget(btn_container)
            self.nav_buttons.append(btn)
        
        sidebar_layout.addStretch()
        main_layout.addWidget(sidebar)
        
        # 初始化通知红点
        self.update_notice_badge()
    
    def create_content_area(self, main_layout):
        """创建右侧内容区"""
        content_area = QWidget()
        content_area.setObjectName("content_area")
        content_layout = QVBoxLayout(content_area)
        content_layout.setContentsMargins(0, 0, 0, 0)
        
        # 创建顶部标题栏
        title_bar = QWidget()
        title_bar.setObjectName("title_bar")
        title_bar.setFixedHeight(60)
        title_layout = QHBoxLayout(title_bar)
        title_layout.setContentsMargins(20, 0, 20, 0)
        
        # 页面标题
        self.page_title = QLabel("实时热点")
        self.page_title.setObjectName("page_title")
        title_layout.addWidget(self.page_title)
        
        # 添加弹簧
        title_layout.addStretch()
        
        # 添加用户信息组件
        self.user_info_widget = UserInfoWidget()
        self.user_info_widget.setObjectName("user_info")
        title_layout.addWidget(self.user_info_widget)
        
        content_layout.addWidget(title_bar)
        
        # 创建堆叠窗口
        self.stacked_widget = QStackedWidget()
        
        # 创建各个页面
        self.hot_spot_page = HotSpotWidget()
        self.account_page = AccountManagerWidget()
        self.task_page = TaskCenterWidget()
        self.auto_page = AutoPublishWidget()
        self.model_page = ModelConfigWidget()
        self.material_page = MaterialImportWidget()
        self.create_notice_page()  # 使用create_notice_page方法创建通知页面
        self.vip_page = VipWidget()
        self.help_page = HelpWidget()
        
        # 将页面添加到堆叠窗口
        self.stacked_widget.addWidget(self.hot_spot_page)      # 索引 0
        self.stacked_widget.addWidget(self.account_page)       # 索引 1
        self.stacked_widget.addWidget(self.task_page)          # 索引 2
        self.stacked_widget.addWidget(self.auto_page)          # 索引 3
        self.stacked_widget.addWidget(self.model_page)         # 索引 4
        self.stacked_widget.addWidget(self.material_page)      # 索引 5
        self.stacked_widget.addWidget(self.notice_widget)      # 索引 6
        self.stacked_widget.addWidget(self.vip_page)          # 索引 7
        self.stacked_widget.addWidget(self.help_page)         # 索引 8
        
        content_layout.addWidget(self.stacked_widget)
        main_layout.addWidget(content_area)
    
    def on_nav_button_clicked(self, index):
        """处理导航按钮点击事件"""
        # 取消其他按钮的选中状态
        for btn in self.nav_buttons:
            btn.setChecked(False)
        # 设置当前按钮为选中状态
        self.nav_buttons[index].setChecked(True)
        
        # 切换到对应的页面
        self.stacked_widget.setCurrentIndex(index)
        
        # 更新页面标题
        titles = ["实时热点", "账号管理", "任务中心", "一键托管", 
                 "模型配置", "素材导入", "指导通知", "开通会员", "使用帮助"]
        self.page_title.setText(titles[index])
        
        # 如果是通知页面，加载通知
        if index == 6:  # 通知页面索引
            self.notice_widget.load_notices()
    
    def update_user_info(self, nickname="未登录用户", avatar_path=None, is_vip=False, vip_expire_date=None):
        user_info = get_user()  # 调用 API 获取用户信息
        nickname = user_info.get('nickname', nickname)  # 提取昵称
        avatar_path = user_info.get('avatar', avatar_path)  # 提取头像路径
        try:
            res = requests.get(avatar_path)
            avatar_path = 'docs/avatar.png'
            with open('docs/avatar.png','wb') as f:
                f.write(res.content)

        except:
            avatar_path = avatar_path
        vip_expire_date = user_info.get('expiry_time')  # 提取 VIP 到期日期
        level = user_info.get('level')

        """更新用户信息"""
        if hasattr(self, 'user_info_widget'):
            self.user_info_widget.set_user_info(
                nickname=nickname,
                avatar_path=avatar_path,
                level=level,
                vip_expire_date=vip_expire_date
            )
        
        # 连接用户信息弹出框的信号
        if self.user_info_widget.popup:
            self.user_info_widget.popup.logout_clicked.connect(self.handle_logout)
            self.user_info_widget.popup.recharge_clicked.connect(self.handle_recharge)
    
    def handle_logout(self):
        """处理退出登录"""
        from views.login_window import LoginWindow
        login_window = LoginWindow()
        login_window.show()
        self.close()
    
    def handle_recharge(self):
        """处理充值会员"""
        # TODO: 实现充值会员功能
        pass
    
    def check_for_updates(self):
        """检查更新"""
        try:
            has_update, update_info = self.updater.check_for_updates()
            if has_update and update_info:
                # 显示更新提示对话框
                msg = QMessageBox(self)
                msg.setWindowTitle("发现新版本")
                msg.setText(f"发现新版本 {update_info['version']}")
                msg.setInformativeText(
                    f"当前版本: {self.updater.current_version}\n"
                    f"最新版本: {update_info['version']}\n"
                    f"发布日期: {update_info['release_date']}\n"
                    f"更新说明: {update_info['release_notes']}\n\n"
                    f"下载地址: {update_info['download_url']}"
                )
                msg.setStandardButtons(QMessageBox.Ok)
                
                # 添加复制下载链接按钮
                copy_button = msg.addButton("复制下载链接", QMessageBox.ActionRole)
                copy_button.clicked.connect(lambda: QApplication.clipboard().setText(update_info['download_url']))
                
                msg.exec_()
        except Exception as e:
            logging.error(f"检查更新失败: {str(e)}")
            QMessageBox.warning(self, "更新检查失败", f"检查更新时发生错误: {str(e)}")
    
    def start_update(self, download_url):
        """开始更新过程"""
        try:
            # 下载新版本
            new_file_path = self.updater.download_update(download_url)
            if new_file_path:
                # 安装新版本
                self.updater.install_update(new_file_path)
            else:
                QMessageBox.warning(self, "更新失败", "下载更新失败，请稍后重试。")
        except Exception as e:
            QMessageBox.warning(self, "更新失败", f"更新过程中出错：{str(e)}")

    def update_notice_badge(self):
        """更新通知红点"""
        unread_count = self.notice_service.get_unread_count()
        if unread_count > 0:
            self.notice_badge.setText(str(min(unread_count, 99)))
            self.notice_badge.show()
        else:
            self.notice_badge.hide()

    def create_notice_page(self):
        """创建通知页面"""
        self.notice_widget = NoticeWidget()
        self.notice_widget.notice_read.connect(self.update_notice_badge)  # 连接通知已读信号
