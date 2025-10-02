from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                             QPushButton, QFrame, QApplication, QMessageBox)
from PySide6.QtCore import Qt, Signal, QSettings
from PySide6.QtGui import QPixmap, QFont, QIcon
from utils.auth_service import AuthService

class UserInfoPopup(QFrame):
    logout_clicked = Signal()
    recharge_clicked = Signal()
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowFlags(Qt.Popup | Qt.FramelessWindowHint)
        self.setAttribute(Qt.WA_TranslucentBackground, False)  # 禁用透明背景
        self.setObjectName("user_info_popup")
        self.setFixedWidth(200)  # 设置固定宽度
        self.setup_ui()
        
        # 设置默认头像路径
        self.default_avatar = "docs/logo.png"
        
        # 设置样式
        self.setStyleSheet("""
            QFrame#user_info_popup {
                background-color: white;
                border: 1px solid #BDC3C7;
                border-radius: 8px;
            }
            
            QPushButton {
                border: none;
                text-align: left;
                padding: 8px;
                font-size: 14px;
                border-radius: 4px;
                margin: 0 5px;  /* 添加左右边距 */
            }
            
            QPushButton:hover {
                background-color: #f0f0f0;
            }
            
            #logout_btn {
                color: #E74C3C;
            }
            
            #vip_label {
                color: #F1C40F;
                font-weight: bold;
                margin: 5px 0;  /* 添加上下边距 */
            }
            
            #non_vip_label {
                color: gray;
                margin: 5px 0;  /* 添加上下边距 */
            }
            
            #nickname_label {
                font-size: 16px;
                font-weight: bold;
                margin: 5px 0;  /* 添加上下边距 */
            }
            
            #avatar_label {
                min-width: 50px;
                min-height: 50px;
                max-width: 50px;
                max-height: 50px;
                border-radius: 25px;
                margin: 5px;  /* 添加边距 */
            }
        """)
        
    def setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(10)
        layout.setContentsMargins(15, 15, 15, 15)
        
        # 用户头像和昵称区域
        user_info = QHBoxLayout()
        
        # 头像
        self.avatar_label = QLabel()
        self.avatar_label.setObjectName("avatar_label")
        self.avatar_label.setFixedSize(50, 50)
        self.avatar_label.setScaledContents(True)
        user_info.addWidget(self.avatar_label)
        
        # 昵称和会员状态
        name_vip = QVBoxLayout()
        name_vip.setSpacing(5)
        
        self.nickname_label = QLabel()
        self.nickname_label.setObjectName("nickname_label")
        # 设置最大宽度和省略模式
        self.nickname_label.setMaximumWidth(120)
        self.nickname_label.setWordWrap(True)
        name_vip.addWidget(self.nickname_label)
        
        self.vip_label = QLabel()
        name_vip.addWidget(self.vip_label)
        user_info.addLayout(name_vip)
        user_info.addStretch()
        layout.addLayout(user_info)
        

        
        # 按钮区域
        self.expiration_label = QLabel()
        font = self.font()  # 获取当前窗口的默认字体样式
        self.expiration_label.setFont(font)  # 设置到期时间标签的字体样式
        layout.addWidget(self.expiration_label)

        # 分隔线
        line = QFrame()
        line.setFrameShape(QFrame.HLine)
        line.setFrameShadow(QFrame.Sunken)
        line.setStyleSheet("background-color: #BDC3C7;")
        layout.addWidget(line)

        self.logout_btn = QPushButton("退出登录")
        self.logout_btn.setObjectName("logout_btn")
        self.logout_btn.clicked.connect(self.handle_logout)
        self.logout_btn.setCursor(Qt.PointingHandCursor)
        layout.addWidget(self.logout_btn)
    
    def handle_logout(self):
        """处理退出登录"""
        try:
            # 删除token
            AuthService.delete_token()
            # 删除openid
            settings = QSettings("AiMedia", "ai-media")
            settings.remove("openid")
            
            # 获取主窗口并关闭
            main_window = self.window()
            if main_window:
                main_window.close()
                
            # 退出应用程序
            QApplication.instance().quit()
            
        except Exception as e:
            QMessageBox.critical(self, "错误", f"退出登录失败: {str(e)}")
            
    def set_user_info(self, nickname, avatar_path=None, level='普通用户', vip_expire_date=None):
        # 设置昵称
        if len(nickname) > 12:
            display_name = nickname[:12] + "..."
        else:
            display_name = nickname
        self.nickname_label.setText(display_name)
        self.nickname_label.setToolTip(nickname)  # 显示完整昵称
        
        # 设置头像，如果没有则使用默认头像
        avatar_path = avatar_path if avatar_path else self.default_avatar
        pixmap = QPixmap(avatar_path)
        if pixmap.isNull():  # 如果加载失败也使用默认头像
            pixmap = QPixmap(self.default_avatar)
        self.avatar_label.setPixmap(pixmap.scaled(
            50, 50,
            Qt.KeepAspectRatio,
            Qt.SmoothTransformation
        ))

        self.vip_label.setText(f"{level}")
        self.vip_label.setObjectName("vip_label")
        
        if vip_expire_date:
            self.expiration_label.setText(f"到期时间：{vip_expire_date.split(' ')[0].rstrip('') }")
        else:
            self.expiration_label.setText("到期时间：未设置")




class UserInfoWidget(QWidget):
    logout_clicked = Signal()
    recharge_clicked = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setup_ui()
        self.popup = None
        self.vip_expire_date =None
        
        # 设置默认头像路径
        self.default_avatar = "docs/logo.png"
        
        # 设置样式
        self.setStyleSheet("""
            QWidget {
                background-color: transparent;
            }
            
            QPushButton {
                border: none;
                border-radius: 20px;
            }
            
            QPushButton:hover {
                background-color: rgba(0, 0, 0, 0.1);
            }
            
            #nickname_label {
                color: #2C3E50;
                font-size: 14px;
            }
            
            #vip_label {
                color: #F1C40F;
                font-weight: bold;
            }
            
            #non_vip_label {
                color: gray;
            }
        """)
    
    def setup_ui(self):
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(10)
        
        # 用户头像按钮
        self.avatar_btn = QPushButton()
        self.avatar_btn.setFixedSize(40, 40)
        self.avatar_btn.setCursor(Qt.PointingHandCursor)
        self.avatar_btn.clicked.connect(self.toggle_popup)
        layout.addWidget(self.avatar_btn)
        
        # 用户信息
        info_layout = QVBoxLayout()
        info_layout.setSpacing(0)
        
        self.nickname_label = QLabel()
        self.nickname_label.setObjectName("nickname_label")
        self.nickname_label.setMaximumWidth(100)
        self.nickname_label.setWordWrap(False)
        info_layout.addWidget(self.nickname_label)
        
        self.vip_label = QLabel()
        info_layout.addWidget(self.vip_label)
        
        layout.addLayout(info_layout)
    
    def set_user_info(self, nickname, avatar_path=None, level='普通用户', vip_expire_date=None):
        self.vip_expire_date = vip_expire_date
        # 设置昵称
        if len(nickname) > 8:
            display_name = nickname[:8] + "..."
        else:
            display_name = nickname
        self.nickname_label.setText(display_name)
        self.nickname_label.setToolTip(nickname)  # 显示完整昵称
        
        # 设置头像，如果没有则使用默认头像
        avatar_path = avatar_path if avatar_path else self.default_avatar
        pixmap = QPixmap(avatar_path)
        if pixmap.isNull():  # 如果加载失败也使用默认头像
            pixmap = QPixmap(self.default_avatar)
        self.avatar_btn.setIcon(QIcon(pixmap))
        self.avatar_btn.setIconSize(self.avatar_btn.size())
        
        # 设置会员状态
        self.vip_label.setText(level)
        self.vip_label.setObjectName("vip_label")

            
        if self.popup:
            self.popup.set_user_info(nickname, avatar_path, level, vip_expire_date)
    
    def toggle_popup(self):
        if not self.popup:
            self.popup = UserInfoPopup(self)
            # 连接信号
            self.popup.logout_clicked.connect(self.logout_clicked.emit)
            self.popup.recharge_clicked.connect(self.recharge_clicked.emit)
            
        if self.popup.isVisible():
            self.popup.hide()
        else:
            # 设置用户信息
            self.popup.set_user_info(
                self.nickname_label.toolTip(),  # 使用完整昵称
                self.avatar_btn.icon().pixmap(40, 40),
                self.vip_label.text(),  # 检查是否是VIP
                self.vip_expire_date
            )
            
            # 计算合适的弹出位置
            button_pos = self.mapToGlobal(self.rect().topRight())
            main_window = self.window()
            
            if main_window:
                window_geometry = main_window.frameGeometry()
                window_pos = main_window.mapToGlobal(window_geometry.topLeft())
                
                # 计算理想位置（右对齐，向左偏移一些）
                popup_x = button_pos.x() - self.popup.width() + 35
                popup_y = button_pos.y() + self.height() + 5
                
                # 确保不会超出主窗口右边界
                max_x = window_pos.x() + window_geometry.width() - self.popup.width() - 10
                popup_x = min(popup_x, max_x)
                
                # 确保不会超出主窗口底部
                if popup_y + self.popup.height() > window_pos.y() + window_geometry.height() - 10:
                    popup_y = button_pos.y() - self.popup.height() - 5
                
                self.popup.move(popup_x, popup_y)
                self.popup.show()
