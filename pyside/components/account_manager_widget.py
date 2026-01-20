from datetime import datetime, timedelta

from PySide6.QtCore import Qt, QThread, Signal
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QFrame,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QSpinBox,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from api.api_all import create_account, delete_account, get_account_info, update_account
from auto_browser.auto_base import AutoTools
from auto_browser.baijiahao import get_cookie_baijiahao
from auto_browser.qiehao import get_cookie_qiehao
from auto_browser.weixin import get_cookie_weixin
from utils.account_service import AccountService
from utils.local_data import LocalData
from utils.message_popup import MessagePopup


class AddAccountDialog(QDialog):
    """添加账号对话框"""

    account_added = Signal()  # 新增信号

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("添加账号")
        self.setFixedSize(400, 180)
        self.init_ui()

        # 初始化数据库
        local_data = LocalData()
        # 更新账号状态
        local_data.update_status()
        local_data.close()

    def init_ui(self):
        layout = QVBoxLayout()
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(15)
        self.setLayout(layout)

        # 提示文本
        tip_label = QLabel("选择要添加的平台，账号信息将通过自动化脚本获取")
        tip_label.setWordWrap(True)
        tip_label.setStyleSheet("color: #666;")
        layout.addWidget(tip_label)

        # 平台选择
        platform_layout = QHBoxLayout()
        platform_label = QLabel("平台:")
        self.platform_combo = QComboBox()
        self.platform_combo.addItems(["头条号", "百家号", "微信公众号", "企鹅号"])
        self.platform_combo.setFixedHeight(32)
        platform_layout.addWidget(platform_label)
        platform_layout.addWidget(self.platform_combo)
        layout.addLayout(platform_layout)

        # 按钮布局
        btn_layout = QHBoxLayout()
        btn_layout.setSpacing(10)

        # 取消按钮
        cancel_btn = QPushButton("取消")
        cancel_btn.setFixedSize(80, 32)
        cancel_btn.setObjectName("secondaryBtn")
        cancel_btn.clicked.connect(self.reject)

        # 确认按钮
        confirm_btn = QPushButton("确认")
        confirm_btn.setFixedSize(80, 32)
        confirm_btn.setObjectName("primaryBtn")
        confirm_btn.clicked.connect(self.accept)

        btn_layout.addStretch()
        btn_layout.addWidget(cancel_btn)
        btn_layout.addWidget(confirm_btn)
        layout.addLayout(btn_layout)

        # 设置样式
        self.setStyleSheet("""
            QDialog {
                background-color: white;
            }
            QComboBox {
                border: 1px solid #dcdcdc;
                border-radius: 4px;
                padding: 0 10px;
            }
            QComboBox:focus {
                border-color: #2ECC71;
            }
            QPushButton#primaryBtn {
                background-color: #2ECC71;
                color: white;
                border: none;
                border-radius: 4px;
            }
            QPushButton#primaryBtn:hover {
                background-color: #27AE60;
            }
            QPushButton#secondaryBtn {
                background-color: #ECF0F1;
                color: #2C3E50;
                border: none;
                border-radius: 4px;
            }
            QPushButton#secondaryBtn:hover {
                background-color: #BDC3C7;
            }
        """)

    class GetAccountDataThread(QThread):
        data_fetched = Signal(dict)  # 定义信号，传递数据

        def __init__(self, platform):
            super().__init__()
            self.platform = platform

        def run(self):
            """执行耗时操作"""
            auto = AutoTools()
            if self.platform == "头条号":
                nickname, cookie, uid = auto.get_cookies("头条号")
            elif self.platform == "微信公众号":
                nickname, cookie, uid = get_cookie_weixin(auto.get_driver())
            elif self.platform == "企鹅号":
                nickname, cookie, uid = get_cookie_qiehao(auto.get_driver())
            else:
                nickname, cookie, uid = get_cookie_baijiahao(auto.get_driver())
            account_data = {
                "platform": self.platform,
                "nickname": nickname,
                "uid": uid,
                "cookie": cookie,
            }

            self.data_fetched.emit(account_data)  # 发射信号，传递数据

    def get_account_data(self):
        """获取账号数据"""
        platform = self.platform_combo.currentText()
        # 创建并启动线程
        self.thread = self.GetAccountDataThread(platform)
        self.thread.data_fetched.connect(self.handle_data_fetched)  # 连接信号
        self.thread.start()  # 启动线程

    def handle_data_fetched(self, account_data):
        """处理获取到的数据"""
        # local_data = LocalData()
        # local_data.insert_account(account_data["platform"], account_data["nickname"], account_data["uid"], account_data["cookie"])
        # local_data.close()
        current_time = datetime.now()
        # 计算 15 天后的时间
        future_time = current_time + timedelta(days=30)
        # 格式化输出
        formatted_future_time = future_time.strftime("%Y-%m-%d %H:%M:%S")
        platform_dict = {"头条号": 0, "百家号": 1, "企鹅号": 2, "微信公众号": 3}
        data = {
            "nickname": account_data["nickname"],
            "uid": account_data["uid"],
            "platform": platform_dict[account_data["platform"]],
            "expiry_time": formatted_future_time,
            "cookie": account_data["cookie"],
            "status": 0,
        }
        create_account(data)
        self.account_added.emit()  # 发射信号通知账号已添加
        self.load_data()  # 重新加载数据

    def load_data(self):
        """重新加载数据"""
        self.accept()


class AccountManagerWidget(QWidget):
    """账号管理组件"""

    def __init__(self):
        super().__init__()
        self.account_service = AccountService()
        self.init_ui()
        self.load_data()

    def init_ui(self):
        """初始化UI"""
        layout = QVBoxLayout()
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(20)
        self.setLayout(layout)

        # 顶部工具栏
        toolbar = QFrame()
        toolbar.setObjectName("toolbar")
        toolbar_layout = QHBoxLayout()
        toolbar_layout.setContentsMargins(15, 10, 15, 10)
        toolbar.setLayout(toolbar_layout)

        # 平台筛选
        filter_layout = QHBoxLayout()
        filter_layout.setSpacing(10)

        filter_label = QLabel("平台:")
        filter_label.setObjectName("filterLabel")
        filter_layout.addWidget(filter_label)

        self.platform_combo = QComboBox()
        self.platform_combo.addItems(["全部", "头条号", "百家号", "微信公众号", "企鹅号"])
        self.platform_combo.setFixedSize(120, 32)
        self.platform_combo.currentTextChanged.connect(self.filter_accounts)
        filter_layout.addWidget(self.platform_combo)

        toolbar_layout.addLayout(filter_layout)
        toolbar_layout.addStretch()

        # 刷新按钮
        self.refresh_btn = QPushButton("刷新")
        self.refresh_btn.setFixedSize(80, 32)
        self.refresh_btn.clicked.connect(self.load_data)
        self.refresh_btn.setObjectName("refreshBtn")
        toolbar_layout.addWidget(self.refresh_btn)

        # 新增账号按钮
        add_btn = QPushButton("新增账号")
        add_btn.setObjectName("primaryBtn")
        add_btn.setFixedSize(100, 32)
        add_btn.clicked.connect(self.show_add_dialog)
        toolbar_layout.addWidget(add_btn)

        layout.addWidget(toolbar)

        # 账号列表
        self.table = QTableWidget()
        self.table.setObjectName("accountTable")
        self.table.setColumnCount(7)  # 增加一列
        self.table.setHorizontalHeaderLabels(
            ["昵称", "UID", "平台", "失效时间", "设置发布量", "账号删除", "数据分析"]
        )
        self.table.setEditTriggers(QTableWidget.NoEditTriggers)  # 禁用编辑

        # 设置表格样式
        self.table.setShowGrid(False)
        self.table.setAlternatingRowColors(True)
        self.table.verticalHeader().hide()
        self.table.setSelectionMode(QTableWidget.NoSelection)

        # 设置列宽为自适应
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(QHeaderView.Stretch)  # 所有列自适应
        header.setSectionResizeMode(4, QHeaderView.Fixed)  # 设置发布量列固定宽度
        header.setSectionResizeMode(5, QHeaderView.Fixed)  # 删除列固定宽度
        header.setSectionResizeMode(6, QHeaderView.Fixed)  # 数据列固定宽度
        self.table.setColumnWidth(4, 100)  # 设置发布量列宽
        self.table.setColumnWidth(5, 80)  # 设置删除列宽
        self.table.setColumnWidth(6, 80)  # 设置数据列宽

        layout.addWidget(self.table)

        # 设置样式
        self.setStyleSheet("""
            QWidget {
                background-color: #F8F9FA;
            }
            #toolbar {
                background-color: white;
                border: 1px solid #E9ECEF;
                border-radius: 6px;
            }
            #filterLabel {
                color: #495057;
                font-size: 14px;
            }
            QComboBox {
                border: 1px solid #dcdcdc;
                border-radius: 4px;
                padding: 0 10px;
                background-color: white;
                font-family: "Microsoft YaHei", SimSun, Arial;
                font-size: 12px;
            }
            QComboBox QAbstractItemView {
                border: 1px solid #dcdcdc;
                background-color: white;
                font-family: "Microsoft YaHei", SimSun, Arial;
                font-size: 12px;
            }
            QComboBox:focus {
                border-color: #2ECC71;
            }
            QPushButton#primaryBtn {
                background-color: #2ECC71;
                color: white;
                border: none;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton#primaryBtn:hover {
                background-color: #27AE60;
            }
            QPushButton#deleteBtn {
                background-color: #E74C3C;
                color: white;
                border: none;
                border-radius: 4px;
            }
            QPushButton#deleteBtn:hover {
                background-color: #C0392B;
            }
            QPushButton#dataBtn {
                background-color: #3498DB;
                color: white;
                border: none;
                border-radius: 4px;
            }
            QPushButton#dataBtn:hover {
                background-color: #2980B9;
            }
            QPushButton#refreshBtn {
                background-color: #2ECC71;
                color: white;
                border: none;
                border-radius: 4px;
                font-weight: bold;
                font-size: 14px;
            }
            QPushButton#refreshBtn:hover {
                background-color: #27AE60;
            }
            QPushButton#refreshBtn:pressed {
                background-color: #219A52;
            }
            #accountTable {
                background-color: white;
                border: 1px solid #E9ECEF;
                border-radius: 6px;
                font-family: "Microsoft YaHei", SimSun, Arial;
                font-size: 12px;
            }
            #accountTable::item {
                padding: 8px;
                border: none;
                color: #333333;
            }
            #accountTable::item:alternate {
                background-color: #F8F9FA;
            }
            QHeaderView::section {
                background-color: white;
                padding: 8px;
                border: none;
                border-bottom: 2px solid #E9ECEF;
                color: #495057;
                font-weight: bold;
                font-family: "Microsoft YaHei", SimSun, Arial;
                font-size: 12px;
            }
            QPushButton {
                background-color: #4a90e2;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 3px;
                min-width: 60px;
            }
            QPushButton:hover {
                background-color: #357abd;
            }
            QPushButton:pressed {
                background-color: #2a5f9e;
            }
            QPushButton[type="setting"] {
                background-color: #ff9933;
            }
            QPushButton[type="setting"]:hover {
                background-color: #ff8c1a;
            }
            QPushButton[type="setting"]:pressed {
                background-color: #e67300;
            }
        """)

    class DataAnalysisThread(QThread):
        analysis_completed = Signal()  # 定义信号，表示分析完成

        def __init__(self, account):
            super().__init__()
            self.account = account

        def run(self):
            """执行数据分析的耗时操作"""
            platform = self.account["platform"]
            # local_data = LocalData()
            # cookie = local_data.get_cooke(self.account['uid'])
            cookies = get_account_info(self.account["id"])
            cookie = cookies["cookie"]
            auto = AutoTools()
            auto.get_acconut_data(cookie, platform)
            self.analysis_completed.emit()  # 发射信号，表示分析完成

    def load_data(self):
        """加载账号数据"""
        accounts = self.account_service.get_accounts()
        self.display_accounts(accounts)

    def display_accounts(self, accounts):
        """显示账号列表"""
        self.table.setRowCount(len(accounts))
        self.table.verticalHeader().setDefaultSectionSize(50)  # 设置行高

        for row, account in enumerate(accounts):
            # 昵称
            nickname_item = QTableWidgetItem(account["nickname"])
            nickname_item.setTextAlignment(Qt.AlignVCenter)
            self.table.setItem(row, 0, nickname_item)

            # UID
            uid_item = QTableWidgetItem(account["uid"])
            uid_item.setTextAlignment(Qt.AlignVCenter)
            self.table.setItem(row, 1, uid_item)

            # 平台
            platform_item = QTableWidgetItem(account["platform"])
            platform_item.setTextAlignment(Qt.AlignVCenter)
            self.table.setItem(row, 2, platform_item)

            # 是否过期
            expired_text = account["is_expired"]
            expired_item = QTableWidgetItem(expired_text)
            expired_item.setTextAlignment(Qt.AlignVCenter)
            expired_item.setForeground(
                QColor("#E74C3C") if account["is_expired"] else QColor("#2ECC71")
            )
            self.table.setItem(row, 3, expired_item)

            # 设置发布量按钮
            publish_limit_btn = QPushButton("设置")
            publish_limit_btn.setProperty("type", "setting")  # 添加type属性以应用橙色样式
            publish_limit_btn.setFixedSize(80, 28)
            publish_limit_btn.clicked.connect(
                lambda checked, a=account: self.show_publish_limit_dialog(a)
            )
            self.table.setCellWidget(row, 4, publish_limit_btn)

            # 删除按钮
            delete_btn = QPushButton("删除")
            delete_btn.setObjectName("deleteBtn")
            delete_btn.setFixedSize(60, 28)
            delete_btn.clicked.connect(lambda checked, a=account: self.delete_account(a))
            self.table.setCellWidget(row, 5, delete_btn)

            # 数据按钮
            data_btn = QPushButton("数据")
            data_btn.setObjectName("dataBtn")
            data_btn.setFixedSize(60, 28)
            data_btn.clicked.connect(lambda checked, a=account: self.show_data_analysis(a))
            self.table.setCellWidget(row, 6, data_btn)

    def filter_accounts(self):
        """根据平台筛选账号"""
        platform = self.platform_combo.currentText()
        accounts = self.account_service.get_accounts()

        if platform != "全部":
            accounts = [a for a in accounts if a["platform"] == platform]

        self.display_accounts(accounts)

    def show_add_dialog(self):
        """显示添加账号对话框"""
        dialog = AddAccountDialog(self)
        dialog.account_added.connect(self.load_data)  # 连接信号
        if dialog.exec_():
            dialog.get_account_data()

    def delete_account(self, account):
        """删除账号"""
        local_data = LocalData()
        local_data.delete_publish_config(account["id"])
        delete_account(account["id"])
        self.load_data()

    def show_data_analysis(self, account):
        """显示数据分析"""
        self.thread = self.DataAnalysisThread(account)  # 创建线程
        self.thread.analysis_completed.connect(self.on_analysis_completed)  # 连接信号
        self.thread.start()  # 启动线程

    def on_analysis_completed(self):
        """处理分析完成后的操作"""
        # 在这里可以更新界面或显示提示
        print("数据分析完成")

    def show_publish_limit_dialog(self, account):
        print(account)
        """显示发布量设置对话框"""
        dialog = QDialog(self)
        dialog.setWindowTitle("设置发布量")
        dialog.setFixedSize(300, 150)

        layout = QVBoxLayout()

        # 输入框
        input_layout = QHBoxLayout()
        label = QLabel("每日发布量限制:")
        self.limit_input = QLineEdit()
        self.limit_input.setPlaceholderText("请输入数字")
        self.limit_input.setText(
            str(account.get("publish_limit", account["daily_publish_count"]))
        )  # 显示当前设置
        input_layout.addWidget(label)
        input_layout.addWidget(self.limit_input)
        layout.addLayout(input_layout)

        # 按钮
        btn_layout = QHBoxLayout()
        cancel_btn = QPushButton("取消")
        confirm_btn = QPushButton("确定")
        cancel_btn.clicked.connect(dialog.reject)
        confirm_btn.clicked.connect(lambda: self.save_publish_limit(account, dialog))
        btn_layout.addWidget(cancel_btn)
        btn_layout.addWidget(confirm_btn)
        layout.addLayout(btn_layout)

        dialog.setLayout(layout)

        # 设置样式
        dialog.setStyleSheet("""
            QDialog {
                background-color: white;
            }
            QLabel {
                font-size: 12px;
                color: #333333;
            }
            QLineEdit {
                padding: 5px;
                border: 1px solid #dcdcdc;
                border-radius: 4px;
                font-size: 12px;
            }
            QPushButton {
                padding: 5px 15px;
                border: none;
                border-radius: 4px;
                font-size: 12px;
                color: white;
                background-color: #2ECC71;
            }
            QPushButton:hover {
                background-color: #27AE60;
            }
            QPushButton[text="取消"] {
                background-color: #95A5A6;
            }
            QPushButton[text="取消"]:hover {
                background-color: #7F8C8D;
            }
        """)

        dialog.exec_()

    def save_publish_limit(self, account, dialog):
        """保存发布量设置"""
        try:
            limit = int(self.limit_input.text())

            if limit < 0:
                raise ValueError("发布量不能为负数")

            # 保存到数据库
            try:
                update_account(account["id"], {"daily_publish_count": limit})
                # 显示成功提示
                MessagePopup("已保存", parent=self, message_type="success").show()
                dialog.accept()
                self.load_data()  # 刷新列表
            except Exception as e:
                # 显示数据库更新失败提示
                MessagePopup(f"{str(e)}", parent=self, message_type="error").show()

        except ValueError:
            MessagePopup("请输入有效的数字！", parent=self, message_type="warning").show()

    def _init_table(self):
        self.table.setColumnCount(7)
        self.table.setHorizontalHeaderLabels(
            ["昵称", "UID", "平台", "失效时间", "设置发布量", "账号删除", "数据分析"]
        )

        # 设置各列的宽度
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)  # 昵称
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)  # UID
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.Fixed)  # 平台
        header.setFixedWidth(2, 80)  # 平台列固定宽度，减小到80
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)  # 失效时间
        header.setSectionResizeMode(4, QHeaderView.ResizeMode.Fixed)  # 设置发布量
        header.setFixedWidth(4, 100)  # 设置发布量列固定宽度
        header.setSectionResizeMode(5, QHeaderView.ResizeMode.Fixed)  # 账号删除
        header.setFixedWidth(5, 100)  # 账号删除列固定宽度
        header.setSectionResizeMode(6, QHeaderView.ResizeMode.Fixed)  # 数据分析
        header.setFixedWidth(6, 100)  # 数据分析列固定宽度

        # 设置表格样式
        self.table.setStyleSheet("""
            QTableWidget {
                border: none;
                background-color: white;
                gridline-color: #f0f0f0;
            }
            QTableWidget::item {
                padding: 5px;
            }
            QHeaderView::section {
                background-color: #f8f9fa;
                padding: 5px;
                border: none;
                border-bottom: 1px solid #dee2e6;
            }
        """)

    def _refresh_table(self):
        self.table.setRowCount(0)
        accounts = self.account_service.get_accounts()

        button_width = 70  # 统一设置按钮宽度
        button_spacing = 15  # 统一设置按钮间距

        for account in accounts:
            row = self.table.rowCount()
            self.table.insertRow(row)

            nickname_item = QTableWidgetItem(account["nickname"])
            uid_item = QTableWidgetItem(account["uid"])
            platform_item = QTableWidgetItem(account["platform"])
            status_item = QTableWidgetItem(account["status"])

            self.table.setItem(row, 0, nickname_item)
            self.table.setItem(row, 1, uid_item)
            self.table.setItem(row, 2, platform_item)
            self.table.setItem(row, 3, status_item)

            # 设置发布量按钮
            limit_widget = QWidget()
            limit_layout = QHBoxLayout(limit_widget)
            limit_layout.setContentsMargins(button_spacing, 2, button_spacing, 2)

            limit_btn = QPushButton("设置")
            limit_btn.setProperty("type", "setting")  # 添加type属性以应用橙色样式
            limit_btn.setFixedWidth(button_width)
            limit_btn.clicked.connect(lambda checked, r=row: self._set_publish_limit(r))

            limit_layout.addWidget(limit_btn, alignment=Qt.AlignmentFlag.AlignCenter)
            self.table.setCellWidget(row, 4, limit_widget)

            # 删除按钮
            delete_widget = QWidget()
            delete_layout = QHBoxLayout(delete_widget)
            delete_layout.setContentsMargins(button_spacing, 2, button_spacing, 2)

            delete_btn = QPushButton("删除")
            delete_btn.setFixedWidth(button_width)
            delete_btn.clicked.connect(lambda checked, r=row: self._delete_account(r))

            delete_layout.addWidget(delete_btn, alignment=Qt.AlignmentFlag.AlignCenter)
            self.table.setCellWidget(row, 5, delete_widget)

            # 数据分析按钮
            analysis_widget = QWidget()
            analysis_layout = QHBoxLayout(analysis_widget)
            analysis_layout.setContentsMargins(button_spacing, 2, button_spacing, 2)

            analysis_btn = QPushButton("数据")
            analysis_btn.setFixedWidth(button_width)
            analysis_btn.clicked.connect(lambda checked, r=row: self._show_data_analysis(r))

            analysis_layout.addWidget(analysis_btn, alignment=Qt.AlignmentFlag.AlignCenter)
            self.table.setCellWidget(row, 6, analysis_widget)

    def _set_publish_limit(self, row):
        """设置账号发布量限制"""
        uid = self.table.item(row, 1).text()
        current_limit = self.account_service.get_publish_limit(uid)

        dialog = QDialog(self)
        dialog.setWindowTitle("设置发布量限制")
        layout = QVBoxLayout(dialog)

        # 创建输入框和标签
        input_layout = QHBoxLayout()
        label = QLabel("每日发布量限制:")
        input_box = QSpinBox()
        input_box.setMinimum(0)
        input_box.setMaximum(999999)
        input_box.setValue(current_limit)

        input_layout.addWidget(label)
        input_layout.addWidget(input_box)
        layout.addLayout(input_layout)

        # 创建按钮
        button_box = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        button_box.accepted.connect(dialog.accept)
        button_box.rejected.connect(dialog.reject)
        layout.addWidget(button_box)

        if dialog.exec() == QDialog.DialogCode.Accepted:
            new_limit = input_box.value()
            if self.account_service.update_publish_limit(uid, new_limit):
                self._refresh_table()
            else:
                QMessageBox.warning(self, "错误", "更新发布量限制失败")
