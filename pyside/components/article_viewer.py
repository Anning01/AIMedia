from PySide6.QtWidgets import QFrame, QHBoxLayout, QLabel, QPushButton, QVBoxLayout

from utils.message_popup import MessagePopup
from views.account_dialog import AccountDialog


class ArticleViewer(QFrame):
    def __init__(self, article_data, parent=None):
        super().__init__(parent)
        self.article_data = article_data
        self.selected_account = None
        self.init_ui()

    def init_ui(self):
        """初始化UI"""
        layout = QVBoxLayout(self)
        layout.setSpacing(3)
        layout.setContentsMargins(12, 8, 12, 8)

        # 标题和按钮行
        top_layout = QHBoxLayout()

        # 标题
        title_label = QLabel(self.article_data.get("title", "无标题"))
        title_label.setWordWrap(True)
        title_label.setStyleSheet("""
            QLabel {
                color: #333333;
                font-size: 14px;
                font-weight: bold;
            }
        """)
        top_layout.addWidget(title_label)

        # 按钮组
        button_layout = QHBoxLayout()
        button_layout.setSpacing(8)

        view_btn = QPushButton("查看")
        view_btn.setStyleSheet("""
            QPushButton {
                background-color: #2ECC71;
                color: white;
                border: none;
                border-radius: 3px;
                padding: 4px 8px;
                font-size: 12px;
                font-weight: bold;
                min-width: 45px;
                max-width: 45px;
                min-height: 24px;
            }
            QPushButton:hover {
                background-color: #27AE60;
            }
        """)
        view_btn.clicked.connect(self.view_article)

        config_btn = QPushButton("配置")
        config_btn.setStyleSheet("""
            QPushButton {
                background-color: #E67E22;
                color: white;
                border: none;
                border-radius: 3px;
                padding: 4px 8px;
                font-size: 12px;
                font-weight: bold;
                min-width: 45px;
                max-width: 45px;
                min-height: 24px;
            }
            QPushButton:hover {
                background-color: #D35400;
            }
        """)
        config_btn.clicked.connect(self.show_account_selector)

        button_layout.addWidget(view_btn)
        button_layout.addWidget(config_btn)
        top_layout.addLayout(button_layout)

        layout.addLayout(top_layout)

        # 底部信息行
        bottom_layout = QHBoxLayout()

        # 时间
        time_label = QLabel(self.article_data.get("created_at", "未知时间"))
        time_label.setStyleSheet("""
            QLabel {
                color: #666666;
                font-size: 12px;
            }
        """)
        bottom_layout.addWidget(time_label)

        bottom_layout.addStretch()

        # 账号信息
        self.account_label = QLabel("未配置账号")
        self.account_label.setStyleSheet("""
            QLabel {
                color: #666666;
                font-size: 12px;
            }
        """)
        bottom_layout.addWidget(self.account_label)

        layout.addLayout(bottom_layout)

        # 设置卡片样式
        self.setStyleSheet("""
            ArticleViewer {
                background-color: white;
                border: 1px solid #E0E0E0;
                border-radius: 4px;
            }
            ArticleViewer:hover {
                border-color: #2ECC71;
            }
        """)

    def view_article(self):
        """查看文章详情"""
        MessagePopup.info(
            "文章详情",
            f"标题：{self.article_data.get('title', '无标题')}\n\n"
            f"内容：{self.article_data.get('content', '暂无内容')}",
        )

    def show_account_selector(self):
        """显示账号选择器"""
        dialog = AccountDialog(self)
        if dialog.exec_():
            selected = dialog.get_selected_account()
            if selected:
                self.set_selected_account(selected)

    def set_selected_account(self, account):
        """设置选中的账号"""
        self.selected_account = account
        platform = account.get("platform", "")
        nickname = account.get("nickname", "")
        uid = account.get("uid", "")
        self.account_label.setText(f"{platform} - {nickname} (UID: {uid})")
