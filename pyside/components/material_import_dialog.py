from PySide6.QtWidgets import (
    QComboBox,
    QDialog,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QTextEdit,
    QVBoxLayout,
)

from utils.account_service import AccountService
from utils.message_popup import MessagePopup


class MaterialImportDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("导入素材")
        self.setMinimumWidth(500)
        self.account_service = AccountService()  # 初始化账号服务
        self.init_ui()
        self.on_platform_changed(self.platform_combo.currentText())  # 初始加载账号列表

    def init_ui(self):
        layout = QVBoxLayout()
        layout.setSpacing(15)
        layout.setContentsMargins(20, 20, 20, 20)

        # 标题
        title_layout = QHBoxLayout()
        title_label = QLabel("标题:")
        title_label.setFixedWidth(80)
        self.title_input = QLineEdit()
        title_layout.addWidget(title_label)
        title_layout.addWidget(self.title_input)
        layout.addLayout(title_layout)

        # 内容
        content_layout = QHBoxLayout()
        content_label = QLabel("内容:")
        content_label.setFixedWidth(80)
        self.content_input = QTextEdit()
        self.content_input.setMinimumHeight(150)
        content_layout.addWidget(content_label)
        content_layout.addWidget(self.content_input)
        layout.addLayout(content_layout)

        # 图片链接
        for i in range(3):
            image_layout = QHBoxLayout()
            image_label = QLabel(f"图片{i + 1}:")
            image_label.setFixedWidth(80)
            image_input = QLineEdit()
            image_input.setPlaceholderText("必填")
            setattr(self, f"image_input_{i + 1}", image_input)
            image_layout.addWidget(image_label)
            image_layout.addWidget(image_input)
            layout.addLayout(image_layout)

        # 发布平台
        platform_layout = QHBoxLayout()
        platform_label = QLabel("发布平台:")
        platform_label.setFixedWidth(80)
        self.platform_combo = QComboBox()
        self.platform_combo.addItems(["百家号", "微信公众号", "头条号"])
        self.platform_combo.currentTextChanged.connect(self.on_platform_changed)
        platform_layout.addWidget(platform_label)
        platform_layout.addWidget(self.platform_combo)
        layout.addLayout(platform_layout)

        # 发布账号
        account_layout = QHBoxLayout()
        account_label = QLabel("发布账号:")
        account_label.setFixedWidth(80)
        self.account_combo = QComboBox()
        account_layout.addWidget(account_label)
        account_layout.addWidget(self.account_combo)
        layout.addLayout(account_layout)

        # 按钮
        button_layout = QHBoxLayout()
        button_layout.addStretch()
        self.cancel_btn = QPushButton("取消")
        self.save_btn = QPushButton("保存")
        self.cancel_btn.setObjectName("cancelBtn")
        self.save_btn.setObjectName("saveBtn")
        self.cancel_btn.clicked.connect(self.reject)
        self.save_btn.clicked.connect(self.accept)
        button_layout.addWidget(self.cancel_btn)
        button_layout.addWidget(self.save_btn)
        layout.addLayout(button_layout)

        self.setLayout(layout)

        # 设置样式
        self.setStyleSheet("""
            QDialog {
                background-color: white;
                font-family: -apple-system, "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif;
                font-size: 14px;
            }
            QLabel {
                color: #495057;
                font-family: -apple-system, "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif;
            }
            QLineEdit, QTextEdit {
                padding: 8px;
                border: 1px solid #E9ECEF;
                border-radius: 4px;
                background-color: white;
                font-family: -apple-system, "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif;
            }
            QLineEdit:focus, QTextEdit:focus {
                border-color: #2475A8;
            }
            QComboBox {
                padding: 8px;
                border: 1px solid #E9ECEF;
                border-radius: 4px;
                background-color: white;
                font-family: -apple-system, "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif;
            }
            QComboBox:focus {
                border-color: #2475A8;
            }
            QPushButton {
                padding: 8px 16px;
                border-radius: 4px;
                font-size: 14px;
                min-width: 80px;
                font-family: -apple-system, "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif;
            }
            QPushButton#saveBtn {
                background-color: #2ECC71;
                color: white;
                border: none;
                font-weight: bold;
            }
            QPushButton#saveBtn:hover {
                background-color: #27AE60;
            }
            QPushButton#saveBtn:pressed {
                background-color: #219A52;
            }
            QPushButton#cancelBtn {
                background-color: white;
                color: #495057;
                border: 1px solid #E9ECEF;
            }
            QPushButton#cancelBtn:hover {
                background-color: #F8F9FA;
            }
        """)

    def on_platform_changed(self, platform):
        """当平台选择改变时，更新账号下拉框"""
        self.account_combo.clear()

        # 获取所有账号
        accounts = self.account_service.get_accounts()

        # 平台代码映射
        platform_codes = {"百家号": 1, "微信公众号": 3, "头条号": 0}

        # 根据选择的平台筛选账号
        platform_code = platform_codes.get(platform)
        if platform_code is not None:
            filtered_accounts = [acc for acc in accounts if acc["platform_code"] == platform_code]

            # 如果有账号，添加到下拉框
            if filtered_accounts:
                for account in filtered_accounts:
                    self.account_combo.addItem(account["nickname"])
            else:
                self.account_combo.addItem("暂无账号")

    def get_form_data(self):
        """获取表单数据"""
        # 验证必填项
        title = self.title_input.text().strip()
        if not title:
            raise ValueError("标题不能为空")

        content = self.content_input.toPlainText().strip()
        if not content:
            raise ValueError("内容不能为空")

        platform = self.platform_combo.currentText()
        if not platform:
            raise ValueError("请选择发布平台")

        account_nickname = self.account_combo.currentText()
        if account_nickname == "暂无账号":
            raise ValueError("请选择发布账号")

        # 验证图片链接（必须三张）
        image_list = []
        for i in range(3):
            image_url = getattr(self, f"image_input_{i + 1}").text().strip()
            if not image_url:
                raise ValueError(f"请填写第{i + 1}张图片链接")
            image_list.append(image_url)

        # 获取当前平台的账号列表
        platform_codes = {"百家号": 1, "微信公众号": 3, "头条号": 0}
        accounts = self.account_service.get_accounts()
        platform_code = platform_codes.get(platform)
        account = next(
            (
                acc
                for acc in accounts
                if acc["platform_code"] == platform_code and acc["nickname"] == account_nickname
            ),
            None,
        )

        if not account:
            raise ValueError("未找到选中的账号信息")

        return {
            "title": title,
            "content": content,
            "image_list": image_list,
            "platform": platform,
            "account_id": str(account["id"]),
            "nickname": account["nickname"],
        }

    def accept(self):
        """点击保存按钮时的处理"""
        try:
            self.get_form_data()  # 验证数据
            super().accept()  # 只有验证通过才关闭对话框
        except ValueError as e:
            error_popup = MessagePopup(str(e), parent=self, message_type="error")
            error_popup.move(self.mapToGlobal(self.rect().center()) - error_popup.rect().center())
            error_popup.show()
