from PySide6.QtCore import Qt
from PySide6.QtWidgets import QDialog, QLabel, QPushButton, QVBoxLayout


class LoginModeSelector(QDialog):
    """登录方式选择对话框"""

    def __init__(self):
        super().__init__()
        self.setWindowTitle("选择登录方式")
        self.setFixedSize(350, 250)
        self.setStyleSheet("""
            QDialog {
                background-color: #F5F5F5;
            }
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(30, 30, 30, 30)
        layout.setSpacing(20)
        layout.setAlignment(Qt.AlignCenter)

        # 标题
        title_label = QLabel("请选择登录方式")
        title_label.setAlignment(Qt.AlignCenter)
        title_label.setStyleSheet("""
            QLabel {
                font-size: 18px;
                font-weight: bold;
                color: #333333;
                padding: 10px;
            }
        """)
        layout.addWidget(title_label)

        # 微信扫码登录按钮
        self.qr_button = QPushButton("📱 微信扫码登录")
        self.qr_button.setFixedHeight(50)
        self.qr_button.setStyleSheet("""
            QPushButton {
                background-color: #07C160;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 15px;
                font-weight: bold;
                padding: 5px;
            }
            QPushButton:hover {
                background-color: #06AD56;
            }
            QPushButton:pressed {
                background-color: #059449;
            }
        """)
        self.qr_button.clicked.connect(self.select_qr_login)
        layout.addWidget(self.qr_button)

        # 账号密码登录按钮
        self.password_button = QPushButton("🔑 账号密码登录")
        self.password_button.setFixedHeight(50)
        self.password_button.setStyleSheet("""
            QPushButton {
                background-color: #1890FF;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 15px;
                font-weight: bold;
                padding: 5px;
            }
            QPushButton:hover {
                background-color: #40A9FF;
            }
            QPushButton:pressed {
                background-color: #096DD9;
            }
        """)
        self.password_button.clicked.connect(self.select_password_login)
        layout.addWidget(self.password_button)

        # 选择的登录方式
        self.selected_mode = None

    def select_qr_login(self):
        """选择微信扫码登录"""
        self.selected_mode = "qr"
        self.accept()

    def select_password_login(self):
        """选择账号密码登录"""
        self.selected_mode = "password"
        self.accept()

    def get_mode(self):
        """获取选择的登录方式"""
        return self.selected_mode
