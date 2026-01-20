from datetime import datetime

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont
from PySide6.QtWidgets import (
    QDialog,
    QFrame,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QScrollArea,
    QVBoxLayout,
    QWidget,
)

from utils.notice_service import NoticeService


class NoticeDialog(QDialog):
    """通知详情对话框"""

    def __init__(self, notice, parent=None):
        super().__init__(parent)
        self.notice = notice
        self.notice_service = NoticeService()
        self.setWindowTitle("通知详情")
        self.resize(600, 400)
        self.setup_ui()

    def setup_ui(self):
        # 设置主布局
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # 内容容器
        content_widget = QWidget()
        content_widget.setObjectName("contentWidget")
        content_layout = QVBoxLayout(content_widget)
        content_layout.setContentsMargins(20, 20, 20, 20)
        content_layout.setSpacing(10)

        # 标题和时间
        title = QLabel(self.notice["title"])
        title.setObjectName("title")

        time = datetime.strptime(self.notice["created_at"], "%Y-%m-%d %H:%M:%S")
        time_label = QLabel(time.strftime("%Y-%m-%d %H:%M:%S"))
        time_label.setObjectName("time")

        # 创建滚动区域
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setFrameShape(QFrame.NoFrame)
        scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        scroll_area.setVerticalScrollBarPolicy(Qt.ScrollBarAsNeeded)

        # 内容容器
        content_container = QWidget()
        content_container_layout = QVBoxLayout(content_container)
        content_container_layout.setContentsMargins(0, 0, 0, 0)

        # 内容文本
        content = QLabel(self.notice["content"])
        content.setObjectName("content")
        content.setWordWrap(True)
        content.setTextInteractionFlags(Qt.TextSelectableByMouse)  # 允许选择文本
        content_container_layout.addWidget(content)
        content_container_layout.addStretch()

        scroll_area.setWidget(content_container)

        content_layout.addWidget(title)
        content_layout.addWidget(time_label)
        content_layout.addWidget(scroll_area)

        # 按钮容器
        button_widget = QWidget()
        button_widget.setObjectName("buttonWidget")
        button_layout = QHBoxLayout(button_widget)
        button_layout.setContentsMargins(20, 15, 20, 15)

        if not self.notice["is_read"]:
            # 未读状态只显示"已读"按钮
            read_btn = QPushButton("已读")
            read_btn.setObjectName("primaryButton")
            read_btn.clicked.connect(self.mark_as_read)
            button_layout.addWidget(read_btn)
        else:
            # 已读状态只显示"关闭"按钮
            close_btn = QPushButton("关闭")
            close_btn.setObjectName("primaryButton")
            close_btn.clicked.connect(self.close)
            button_layout.addWidget(close_btn)

        # 添加到主布局
        main_layout.addWidget(content_widget)
        main_layout.addWidget(button_widget)

        # 设置样式
        self.setStyleSheet("""
            QDialog {
                background: white;
            }
            #contentWidget {
                background: white;
            }
            #buttonWidget {
                background: #F5F5F5;
                border-top: 1px solid #E5E5E5;
            }
            #title {
                font-family: Microsoft YaHei;
                font-size: 16px;
                font-weight: bold;
                color: #333333;
            }
            #time {
                font-family: Microsoft YaHei;
                font-size: 12px;
                color: #999999;
                margin-bottom: 10px;
            }
            #content {
                font-family: Microsoft YaHei;
                font-size: 14px;
                line-height: 1.6;
                color: #666666;
                background: transparent;
            }
            #primaryButton {
                min-width: 75px;
                padding: 6px 20px;
                background-color: #3498DB;
                border: none;
                border-radius: 3px;
                color: white;
                font-size: 13px;
            }
            #primaryButton:hover {
                background-color: #2980B9;
            }
            QScrollArea {
                border: none;
                background: transparent;
            }
            QScrollBar:vertical {
                width: 8px;
                background: transparent;
            }
            QScrollBar::handle:vertical {
                background: #CCCCCC;
                border-radius: 4px;
                min-height: 30px;
            }
            QScrollBar::handle:vertical:hover {
                background: #BBBBBB;
            }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
                height: 0px;
            }
            QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {
                background: transparent;
            }
        """)

    def mark_as_read(self):
        """标记为已读"""
        try:
            self.notice_service.mark_as_read(self.notice["id"])
            self.accept()  # 关闭对话框并返回接受状态
        except Exception:
            # 可以添加错误处理，比如显示一个错误消息框
            pass


class NoticeCard(QFrame):
    """通知卡片组件"""

    clicked = Signal(dict)

    def __init__(self, notice):
        super().__init__()
        self.notice = notice
        self.setCursor(Qt.PointingHandCursor)  # 设置鼠标指针样式
        self.setup_ui()

    def setup_ui(self):
        layout = QVBoxLayout(self)

        # 标题行
        title_layout = QHBoxLayout()

        # 未读标记
        if not self.notice["is_read"]:
            unread_mark = QLabel("●")
            unread_mark.setStyleSheet("color: #E74C3C;")
            title_layout.addWidget(unread_mark)

        # 置顶标记
        if self.notice["is_top"]:
            top_mark = QLabel("[置顶]")
            top_mark.setStyleSheet("color: #E67E22;")
            title_layout.addWidget(top_mark)

        # 标题
        title = QLabel(self.notice["title"])
        title.setFont(QFont("Microsoft YaHei", 10, QFont.Bold))
        title_layout.addWidget(title)
        title_layout.addStretch()

        # 时间
        time = datetime.strptime(self.notice["created_at"], "%Y-%m-%d %H:%M:%S")
        time_label = QLabel(time.strftime("%Y-%m-%d %H:%M:%S"))
        time_label.setStyleSheet("color: #666666;")
        title_layout.addWidget(time_label)

        layout.addLayout(title_layout)

        # 设置样式
        self.setStyleSheet("""
            NoticeCard {
                background-color: white;
                border: 1px solid #DDDDDD;
                border-radius: 4px;
                padding: 10px;
                margin: 5px;
            }
            NoticeCard:hover {
                background-color: #F5F5F5;
            }
        """)

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.clicked.emit(self.notice)


class NoticeWidget(QWidget):
    """通知列表组件"""

    notice_read = Signal()  # 添加通知已读信号

    def __init__(self):
        super().__init__()
        self.notice_service = NoticeService()
        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        # 标题栏
        title_layout = QHBoxLayout()
        title = QLabel("")
        title.setFont(QFont("Microsoft YaHei", 12, QFont.Bold))
        title_layout.addWidget(title)
        title_layout.addStretch()

        # 刷新按钮
        refresh_btn = QPushButton("刷新")
        refresh_btn.setFixedWidth(80)
        refresh_btn.clicked.connect(self.load_notices)
        refresh_btn.setStyleSheet("""
            QPushButton {
                background-color: #3498DB;
                color: white;
                border: none;
                padding: 5px 15px;
                border-radius: 3px;
            }
            QPushButton:hover {
                background-color: #2980B9;
            }
        """)
        title_layout.addWidget(refresh_btn)
        layout.addLayout(title_layout)

        # 通知列表滚动区域
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)

        # 通知列表容器
        self.notice_container = QWidget()
        self.notice_layout = QVBoxLayout(self.notice_container)
        self.notice_layout.setContentsMargins(10, 10, 10, 10)
        self.notice_layout.setSpacing(10)

        # 加载状态标签
        self.loading_label = QLabel("加载中...")
        self.loading_label.setAlignment(Qt.AlignCenter)
        self.loading_label.setStyleSheet("color: #666666;")
        self.loading_label.hide()
        self.notice_layout.addWidget(self.loading_label)

        # 空状态标签
        self.empty_label = QLabel("暂无通知")
        self.empty_label.setAlignment(Qt.AlignCenter)
        self.empty_label.setStyleSheet("color: #666666;")
        self.empty_label.hide()
        self.notice_layout.addWidget(self.empty_label)

        self.notice_layout.addStretch()
        scroll.setWidget(self.notice_container)
        layout.addWidget(scroll)

    def load_notices(self):
        """加载通知列表"""
        # 清除现有内容
        for i in reversed(range(self.notice_layout.count())):
            item = self.notice_layout.itemAt(i)
            if item.widget() and item.widget() not in [self.loading_label, self.empty_label]:
                item.widget().deleteLater()

        # 显示加载状态
        self.loading_label.show()
        self.empty_label.hide()

        try:
            # 获取通知列表
            notices = self.notice_service.get_notices()

            # 隐藏加载状态
            self.loading_label.hide()

            if not notices:
                self.empty_label.show()
            else:
                self.empty_label.hide()

                # 先添加置顶通知
                for notice in sorted(
                    notices, key=lambda x: (not x["is_top"], x["created_at"]), reverse=True
                ):
                    if notice["is_show"]:  # 只显示is_show为True的通知
                        card = NoticeCard(notice)
                        card.clicked.connect(self.show_notice)
                        self.notice_layout.insertWidget(0, card)

        except Exception as e:
            # 显示错误状态
            self.loading_label.setText(f"加载失败: {str(e)}")
            self.loading_label.show()
            self.empty_label.hide()

        # 添加弹性空间
        self.notice_layout.addStretch()

    def show_notice(self, notice):
        """显示通知详情"""
        dialog = NoticeDialog(notice, self)
        result = dialog.exec_()

        # 如果用户点击了"已读"按钮（返回QDialog.Accepted）
        if result == QDialog.Accepted:
            self.load_notices()  # 刷新列表
            self.notice_read.emit()  # 发送通知已读信号
