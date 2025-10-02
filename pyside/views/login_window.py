import os
import qrcode
from PySide6.QtWidgets import QMainWindow, QWidget, QVBoxLayout, QLabel, QMessageBox
from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QPixmap, QIcon
from utils.auth_service import AuthService
from .main_window import MainWindow

class LoginWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        
        """界面渲染配置"""
        self.setWindowTitle("登录")
        self.setFixedSize(400, 500)  # 调整窗口高度
        self.setStyleSheet("""
            QMainWindow {
                background-color: white;
            }
        """)
        
        # 初始化状态
        self.state = None
        self.query_count = 0
        self.max_query_attempts = 30
        
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
        layout.setContentsMargins(50, 30, 50, 30)  # 调整边距
        layout.setSpacing(20)  # 调整间距
        
        # 添加logo图片
        logo_label = QLabel()
        logo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "docs", "logo.png")
        logo_pixmap = QPixmap(logo_path).scaled(
            100, 100,  # 调整logo大小
            Qt.KeepAspectRatio,
            Qt.SmoothTransformation
        )
        logo_label.setPixmap(logo_pixmap)
        logo_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(logo_label)
        
        # 添加提示标签
        tip_label = QLabel("请使用微信扫描二维码登录")
        tip_label.setAlignment(Qt.AlignCenter)
        tip_label.setStyleSheet("""
            QLabel {
                font-size: 16px;
                color: #333333;
                font-family: "Microsoft YaHei";
                margin: 10px 0;
                font-weight: 500;
            }
        """)
        layout.addWidget(tip_label)
        
        # 添加二维码容器（白色背景面板）
        qr_container = QWidget()
        qr_container.setStyleSheet("""
            QWidget {
                background-color: white;
                border: 1px solid #EEEEEE;
                border-radius: 12px;
            }
        """)
        qr_container.setFixedSize(260, 260)
        
        # 二维码容器使用垂直布局
        qr_layout = QVBoxLayout(qr_container)
        qr_layout.setContentsMargins(10, 10, 10, 10)
        
        # 添加二维码标签
        self.qr_label = QLabel()
        self.qr_label.setFixedSize(240, 240)
        self.qr_label.setAlignment(Qt.AlignCenter)
        self.qr_label.setStyleSheet("""
            QLabel {
                background-color: white;
            }
        """)
        qr_layout.addWidget(self.qr_label)
        
        # 将二维码容器添加到主布局
        layout.addWidget(qr_container, alignment=Qt.AlignCenter)
        
        # 添加底部提示（可选）
        bottom_tip = QLabel("扫码后请在手机上确认登录")
        bottom_tip.setAlignment(Qt.AlignCenter)
        bottom_tip.setStyleSheet("""
            QLabel {
                font-size: 14px;
                color: #666666;
                font-family: "Microsoft YaHei";
                margin-top: 10px;
            }
        """)
        layout.addWidget(bottom_tip)
        
        # 开始登录流程
        self.start_login()
    
    def start_login(self):
        """开始登录流程"""
        try:
            # 获取登录二维码
            self.refresh_qr_code()
            
            # 启动定时器
            self.login_timer.start(2000)  # 每2秒检查一次登录状态
            self.refresh_timer.start(55000)  # 55秒后刷新二维码
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
            print("\n" + "="*50)
            print("二维码链接信息:")
            print("-"*50)
            print(f"URL: {authorize_url}")
            print(f"State: {self.state}")
            print(f"URL长度: {len(authorize_url)}")
            print("-"*50)
            
            # 验证URL格式
            if not authorize_url.startswith('http'):
                raise ValueError(f"无效的URL格式: {authorize_url}")
            
            # 生成二维码前先测试URL
            import requests
            try:
                response = requests.head(authorize_url, timeout=5)
                print(f"URL状态码: {response.status_code}")
                if response.status_code != 200:
                    print(f"警告: URL可能无法访问，状态码: {response.status_code}")
            except Exception as e:
                print(f"警告: URL测试失败: {str(e)}")
            
            # 生成二维码
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,  # 降低错误纠正级别
                box_size=10,
                border=4
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
            scaled_pixmap = pixmap.scaled(
                240, 240,  # 调整显示尺寸
                Qt.KeepAspectRatio,
                Qt.SmoothTransformation
            )
            
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
            is_vip=True,  # 设置为VIP用户便于测试
            vip_expire_date="2024-12-31"  # 设置会员到期日期
        )
        
        self.main_window.show()
        self.close()
    
    def closeEvent(self, event):
        """窗口关闭事件"""
        self.login_timer.stop()
        self.refresh_timer.stop()
        super().closeEvent(event)
