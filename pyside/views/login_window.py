import os

import qrcode
from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QPixmap
from PySide6.QtWidgets import (
    QLabel,
    QLineEdit,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from utils.auth_service import AuthService


class LoginWindow(QMainWindow):
    def __init__(self, mode="qr"):
        super().__init__()

        """界面渲染配置"""
        self.setWindowTitle("登录")
        self.setFixedSize(400, 520)
        self.setStyleSheet("""
            QMainWindow {
                background-color: white;
            }
        """)

        # 初始化状态
        self.state = None
        self.query_count = 0
        self.max_query_attempts = 30
        self.login_mode = mode  # "qr" 或 "password"

        self.login_timer = QTimer()
        self.login_timer.timeout.connect(self.check_login_status)

        self.refresh_timer = QTimer()
        self.refresh_timer.timeout.connect(self.refresh_qr_code)

        # 创建中央窗口部件
        central_widget = QWidget()
        self.setCentralWidget(central_widget)

        # 创建垂直布局
        layout = QVBoxLayout(central_widget)
        layout.setAlignment(Qt.AlignCenter)
        layout.setContentsMargins(50, 30, 50, 30)
        layout.setSpacing(15)

        # 添加logo图片
        logo_label = QLabel()
        logo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "docs", "logo.png")
        logo_pixmap = QPixmap(logo_path).scaled(80, 80, Qt.KeepAspectRatio, Qt.SmoothTransformation)
        logo_label.setPixmap(logo_pixmap)
        logo_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(logo_label)

        # 添加登录方式切换按钮
        self.switch_button = QPushButton("切换到账号密码登录")
        self.switch_button.setStyleSheet("""
            QPushButton {
                background-color: transparent;
                color: #1890FF;
                border: none;
                font-size: 13px;
                padding: 5px;
                text-align: center;
            }
            QPushButton:hover {
                color: #40A9FF;
                text-decoration: underline;
            }
        """)
        self.switch_button.setCursor(Qt.PointingHandCursor)
        self.switch_button.clicked.connect(self.switch_login_mode)
        layout.addWidget(self.switch_button, alignment=Qt.AlignCenter)

        # 创建二维码容器
        self.qr_container = QWidget()
        self.qr_container.setStyleSheet("""
            QWidget {
                background-color: white;
                border: 1px solid #EEEEEE;
                border-radius: 12px;
            }
        """)
        self.qr_container.setFixedSize(260, 260)
        qr_layout = QVBoxLayout(self.qr_container)
        qr_layout.setContentsMargins(10, 10, 10, 10)
        self.qr_label = QLabel()
        self.qr_label.setFixedSize(240, 240)
        self.qr_label.setAlignment(Qt.AlignCenter)
        self.qr_label.setStyleSheet("""
            QLabel {
                background-color: white;
            }
        """)
        qr_layout.addWidget(self.qr_label)
        layout.addWidget(self.qr_container, alignment=Qt.AlignCenter)

        # 二维码提示标签
        self.qr_tip_label = QLabel("请使用微信扫描二维码登录")
        self.qr_tip_label.setAlignment(Qt.AlignCenter)
        self.qr_tip_label.setStyleSheet("""
            QLabel {
                font-size: 14px;
                color: #666666;
                font-family: "Microsoft YaHei";
            }
        """)
        layout.addWidget(self.qr_tip_label)

        # 创建密码登录容器（初始隐藏）
        self.password_container = QWidget()
        self.password_container.setFixedSize(280, 150)
        password_layout = QVBoxLayout(self.password_container)
        password_layout.setContentsMargins(0, 0, 0, 0)
        password_layout.setSpacing(15)

        # open_id 输入框
        self.openid_input = QLineEdit()
        self.openid_input.setPlaceholderText("请输入 OpenID")
        self.openid_input.setStyleSheet("""
            QLineEdit {
                border: 1px solid #D9D9D9;
                border-radius: 4px;
                padding: 8px 12px;
                font-size: 13px;
                background-color: white;
            }
            QLineEdit:focus {
                border-color: #1890FF;
            }
        """)
        password_layout.addWidget(self.openid_input)

        # 密码输入框
        self.password_input = QLineEdit()
        self.password_input.setPlaceholderText("请输入密码")
        self.password_input.setEchoMode(QLineEdit.Password)
        self.password_input.setStyleSheet("""
            QLineEdit {
                border: 1px solid #D9D9D9;
                border-radius: 4px;
                padding: 8px 12px;
                font-size: 13px;
                background-color: white;
            }
            QLineEdit:focus {
                border-color: #1890FF;
            }
        """)
        password_layout.addWidget(self.password_input)

        # 登录按钮
        self.login_button = QPushButton("登录")
        self.login_button.setStyleSheet("""
            QPushButton {
                background-color: #1890FF;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 10px;
                font-size: 14px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #40A9FF;
            }
            QPushButton:pressed {
                background-color: #096DD9;
            }
        """)
        self.login_button.setCursor(Qt.PointingHandCursor)
        self.login_button.clicked.connect(self.password_login)
        password_layout.addWidget(self.login_button)

        layout.addWidget(self.password_container, alignment=Qt.AlignCenter)
        self.password_container.hide()

        # 底部提示
        self.bottom_tip = QLabel("扫码后请在手机上确认登录")
        self.bottom_tip.setAlignment(Qt.AlignCenter)
        self.bottom_tip.setStyleSheet("""
            QLabel {
                font-size: 12px;
                color: #999999;
                font-family: "Microsoft YaHei";
            }
        """)
        layout.addWidget(self.bottom_tip)

        # 开始登录流程
        self.start_login()

    def switch_login_mode(self):
        """切换登录模式"""
        if self.login_mode == "qr":
            # 切换到密码登录
            self.login_mode = "password"
            self.switch_button.setText("切换到微信扫码登录")
            self.qr_container.hide()
            self.qr_tip_label.hide()
            self.bottom_tip.setText("使用您的 OpenID 和密码登录")
            self.password_container.show()
            # 停止二维码定时器
            self.login_timer.stop()
            self.refresh_timer.stop()
        else:
            # 切换到二维码登录
            self.login_mode = "qr"
            self.switch_button.setText("切换到账号密码登录")
            self.password_container.hide()
            self.qr_container.show()
            self.qr_tip_label.show()
            self.bottom_tip.setText("扫码后请在手机上确认登录")
            # 重新加载二维码
            self.refresh_qr_code()
            self.login_timer.start(2000)
            self.refresh_timer.start(55000)

    def password_login(self):
        """密码登录"""
        open_id = self.openid_input.text().strip()
        password = self.password_input.text().strip()

        if not open_id:
            QMessageBox.warning(self, "提示", "请输入 OpenID")
            return
        if not password:
            QMessageBox.warning(self, "提示", "请输入密码")
            return

        try:
            token = AuthService.login_with_password(open_id, password)
            if token:
                # 保存 token
                AuthService.save_token(token)
                # 打开主窗口
                self.open_main_window()
        except Exception as e:
            QMessageBox.critical(self, "登录失败", str(e))

    def start_login(self):
        """开始登录流程"""
        try:
            # 根据模式初始化界面
            if self.login_mode == "password":
                # 密码登录模式
                self.switch_button.setText("切换到微信扫码登录")
                self.qr_container.hide()
                self.qr_tip_label.hide()
                self.bottom_tip.setText("使用您的 OpenID 和密码登录")
                self.password_container.show()
            else:
                # 二维码登录模式
                self.refresh_qr_code()
                self.login_timer.start(2000)
                self.refresh_timer.start(55000)
        except Exception as e:
            QMessageBox.critical(self, "错误", f"启动登录失败: {str(e)}")

    def refresh_qr_code(self):
        """刷新二维码"""
        try:
            # 重置查询计数器
            self.query_count = 0

            # 获取新的二维码URL和state
            authorize_url, self.state = AuthService.get_login_url()

            # 打印完整的二维码链接和调试信息
            print("\\n" + "=" * 50)
            print("二维码链接信息:")
            print("-" * 50)
            print(f"URL: {authorize_url}")
            print(f"State: {self.state}")
            print(f"URL长度: {len(authorize_url)}")
            print("-" * 50)

            # 验证URL格式
            if not authorize_url.startswith("http"):
                raise ValueError(f"无效的URL格式: {authorize_url}")

            # 生成二维码
            qr = qrcode.QRCode(
                version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=10, border=4
            )
            qr.add_data(authorize_url)
            qr.make(fit=True)

            # 生成图片
            img = qr.make_image()

            # 保存二维码到临时文件
            temp_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "temp_qr.png")
            img.save(temp_path)

            # 显示二维码
            pixmap = QPixmap(temp_path)
            scaled_pixmap = pixmap.scaled(240, 240, Qt.KeepAspectRatio, Qt.SmoothTransformation)

            # 验证生成的图片
            if pixmap.isNull():
                raise ValueError("二维码图片生成失败")

            self.qr_label.setPixmap(scaled_pixmap)

            # 删除临时文件
            os.remove(temp_path)

            # 在窗口标题显示刷新状态
            self.setWindowTitle(f"登录 - 二维码已刷新 ({self.state})")

        except Exception as e:
            error_msg = f"刷新二维码失败: {str(e)}"
            print(f"错误: {error_msg}")
            QMessageBox.critical(self, "错误", error_msg)

    def check_login_status(self):
        """检查登录状态"""
        try:
            if not self.state:
                return

            token = AuthService.check_login_status(self.state)
            if token == "SCAN_FAILED":
                # 增加查询计数
                self.query_count += 1

                # 只有在达到最大查询次数后才刷新二维码
                if self.query_count >= self.max_query_attempts:
                    print(f"查询{self.query_count}次后扫码仍未成功，刷新二维码")
                    self.refresh_qr_code()
            elif token:  # 获取到access token
                # 停止定时器
                self.login_timer.stop()
                self.refresh_timer.stop()

                # 保存token
                AuthService.save_token(token)

                # 打开主窗口
                self.open_main_window()

        except Exception as e:
            QMessageBox.critical(self, "错误", f"检查登录状态失败: {str(e)}")

    def open_main_window(self):
        """打开主窗口"""
        from views.main_window import MainWindow

        self.main_window = MainWindow()

        # 设置测试用户信息
        self.main_window.update_user_info(
            nickname="测试用户",
            avatar_path="docs/default_avatar.png",
            is_vip=True,
            vip_expire_date="2024-12-31",
        )

        self.main_window.show()
        self.close()

    def closeEvent(self, event):
        """窗口关闭事件"""
        self.login_timer.stop()
        self.refresh_timer.stop()
        super().closeEvent(event)
