from PySide6.QtCore import Qt, QTimer
from PySide6.QtWidgets import QDialog, QVBoxLayout, QLabel, QProgressBar
from PySide6.QtGui import QPainter, QColor

class MessagePopup(QDialog):
    def __init__(self, message, timeout=2000, parent=None, message_type="success"):
        super().__init__(parent)
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.Popup)
        self.setAttribute(Qt.WA_TranslucentBackground)
        
        # 设置固定大小
        self.setFixedSize(300, 40)
        
        # 创建布局
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        
        # 根据消息类型设置不同的背景色
        bg_color = {
            "success": "#2ECC71",  # 绿色
            "warning": "#F1C40F",  # 黄色
            "error": "#E74C3C"     # 红色
        }.get(message_type, "#2ECC71")
        
        # 创建消息标签
        self.message_label = QLabel(message)
        self.message_label.setAlignment(Qt.AlignCenter)
        self.message_label.setStyleSheet(
            "QLabel {"
            "    color: white;"
            "    font-size: 14px;"
            "    padding: 10px;"
            f"    background-color: {bg_color};"
            "}"
        )
        
        layout.addWidget(self.message_label)
        
        # 设置定时器自动关闭
        if timeout > 0:
            QTimer.singleShot(timeout, self.close)
    
    def show(self):
        if self.parent():
            parent_rect = self.parent().rect()
            x = parent_rect.center().x() - self.width() // 2
            y = parent_rect.center().y() - self.height() // 2
            global_pos = self.parent().mapToGlobal(parent_rect.topLeft())
            self.move(global_pos.x() + x, global_pos.y() + y)
        super().show()

class MyDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.Dialog)
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setModal(True)
        
        # 设置固定大小
        self.setFixedSize(200, 200)
        
        # 创建布局
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(10)
        layout.setAlignment(Qt.AlignCenter)
        
        # 创建加载动画
        self.progress = QProgressBar()
        self.progress.setTextVisible(False)
        self.progress.setFixedSize(80, 80)
        self.progress.setStyleSheet("""
            QProgressBar {
                border: 5px solid #BDC3C7;
                border-radius: 40px;
                background-color: transparent;
            }
            QProgressBar::chunk {
                background-color: #3498DB;
                border-radius: 35px;
            }
        """)
        self.progress.setMinimum(0)
        self.progress.setMaximum(0)  # 设置为0表示循环动画
        
        # 创建加载文本
        self.label = QLabel("加载中...")
        self.label.setStyleSheet("""
            QLabel {
                color: #2C3E50;
                font-size: 14px;
                font-weight: bold;
            }
        """)
        self.label.setAlignment(Qt.AlignCenter)
        
        # 添加到布局
        layout.addWidget(self.progress, 0, Qt.AlignCenter)
        layout.addWidget(self.label, 0, Qt.AlignCenter)
        
        # 如果有父窗口，居中显示
        if self.parent():
            self.move(
                self.parent().geometry().center() - self.rect().center()
            )
    
    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        # 绘制半透明背景
        painter.setBrush(QColor(255, 255, 255, 230))
        painter.setPen(Qt.NoPen)
        painter.drawRoundedRect(self.rect(), 10, 10)
