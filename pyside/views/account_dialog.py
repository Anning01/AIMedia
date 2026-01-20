from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QDialog,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
)

from utils.account_service import AccountService


class AccountDialog(QDialog):
    account_selected = Signal(dict)  # 发送选中的账号信息

    def __init__(self, parent=None):
        super().__init__(parent)
        self.selected_account = None
        self.setWindowTitle("选择账号")
        self.resize(500, 400)

        # 设置样式
        self.setStyleSheet("""
            QDialog {
                background-color: white;
            }
            QTableWidget {
                border: none;
                background-color: white;
            }
            QTableWidget::item {
                padding: 5px;
            }
            QHeaderView::section {
                background-color: #F8F9FA;
                padding: 5px;
                border: none;
                border-bottom: 1px solid #E0E0E0;
            }
            QPushButton {
                padding: 8px 20px;
                border-radius: 4px;
                border: none;
                color: white;
                font-weight: bold;
            }
            QPushButton#confirmBtn {
                background-color: #3498DB;
            }
            QPushButton#confirmBtn:hover {
                background-color: #2980B9;
            }
            QPushButton#confirmBtn:disabled {
                background-color: #BDC3C7;
            }
            QPushButton#cancelBtn {
                background-color: #E0E0E0;
                color: #333;
            }
            QPushButton#cancelBtn:hover {
                background-color: #BDC3C7;
            }
            QLabel#selectedLabel {
                color: #2C3E50;
                font-size: 14px;
                padding: 10px 0;
            }
        """)

        self.init_ui()

    def init_ui(self):
        """初始化UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(10)

        # 创建表格
        self.table = QTableWidget()
        self.table.setColumnCount(4)
        self.table.setHorizontalHeaderLabels(["UID", "昵称", "平台", "选择"])

        # 设置表格样式
        self.table.setShowGrid(False)  # 隐藏网格线
        self.table.setSelectionMode(QTableWidget.NoSelection)  # 禁用选择
        self.table.verticalHeader().setVisible(False)  # 隐藏垂直表头

        # 设置列宽
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.Stretch)
        header.setSectionResizeMode(1, QHeaderView.Stretch)
        header.setSectionResizeMode(2, QHeaderView.Stretch)
        header.setSectionResizeMode(3, QHeaderView.Fixed)  # 选择列固定宽度
        self.table.setColumnWidth(3, 70)  # 减小选择列宽度

        # 设置表头样式
        self.table.horizontalHeader().setStyleSheet("""
            QHeaderView::section {
                background-color: #F8F9FA;
                padding: 4px;
                border: none;
                border-bottom: 1px solid #E0E0E0;
                font-size: 12px;
            }
        """)

        layout.addWidget(self.table)

        # 已选择账号标签
        self.selected_label = QLabel("已选择账号：")
        self.selected_label.setObjectName("selectedLabel")
        layout.addWidget(self.selected_label)

        # 底部按钮
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()

        cancel_btn = QPushButton("取消")
        cancel_btn.setObjectName("cancelBtn")
        cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(cancel_btn)

        self.confirm_btn = QPushButton("确定")
        self.confirm_btn.setObjectName("confirmBtn")
        self.confirm_btn.setEnabled(False)
        self.confirm_btn.clicked.connect(self.accept_selection)
        btn_layout.addWidget(self.confirm_btn)

        layout.addLayout(btn_layout)

        # 加载账号数据
        self.load_accounts()

    def load_accounts(self):
        """加载账号数据"""
        account_service = AccountService()
        accounts = account_service._accounts
        self.table.setRowCount(len(accounts))

        for row, account in enumerate(accounts):
            # 设置行高
            self.table.setRowHeight(row, 32)  # 减小行高

            # UID
            uid_item = QTableWidgetItem(account["uid"])
            uid_item.setFlags(uid_item.flags() & ~Qt.ItemIsEditable)
            uid_item.setTextAlignment(Qt.AlignCenter)
            self.table.setItem(row, 0, uid_item)

            # 昵称
            nickname_item = QTableWidgetItem(account["nickname"])
            nickname_item.setFlags(nickname_item.flags() & ~Qt.ItemIsEditable)
            nickname_item.setTextAlignment(Qt.AlignCenter)
            self.table.setItem(row, 1, nickname_item)

            # 平台
            platform_item = QTableWidgetItem(account["platform"])
            platform_item.setFlags(platform_item.flags() & ~Qt.ItemIsEditable)
            platform_item.setTextAlignment(Qt.AlignCenter)
            self.table.setItem(row, 2, platform_item)

            # 选择按钮
            select_btn = QPushButton("选择")
            select_btn.setFixedSize(60, 24)  # 减小按钮大小
            select_btn.setStyleSheet("""
                QPushButton {
                    background-color: #E0E0E0;
                    color: #333;
                    border: none;
                    border-radius: 2px;
                    padding: 2px 8px;
                    font-size: 12px;
                }
                QPushButton:hover {
                    background-color: #2ECC71;
                    color: white;
                }
            """)
            select_btn.clicked.connect(lambda checked, r=row, a=account: self.select_account(r, a))
            self.table.setCellWidget(row, 3, select_btn)

    def select_account(self, row, account):
        """选择账号"""
        # 重置所有按钮样式
        for r in range(self.table.rowCount()):
            btn = self.table.cellWidget(r, 3)
            if btn:
                btn.setText("选择")
                btn.setStyleSheet("""
                    QPushButton {
                        background-color: #E0E0E0;
                        color: #333;
                        border: none;
                        border-radius: 2px;
                        padding: 2px 8px;
                        font-size: 12px;
                    }
                    QPushButton:hover {
                        background-color: #2ECC71;
                        color: white;
                    }
                """)

        # 设置选中按钮样式
        select_btn = self.table.cellWidget(row, 3)
        if select_btn:
            select_btn.setText("已选择")
            select_btn.setStyleSheet("""
                QPushButton {
                    background-color: #2ECC71;
                    color: white;
                    border: none;
                    border-radius: 2px;
                    padding: 2px 8px;
                    font-size: 12px;
                }
            """)

        # 更新选中状态
        self.selected_account = account
        self.selected_label.setText(f"已选择账号：{account['nickname']} ({account['platform']})")
        self.confirm_btn.setEnabled(True)

    def accept_selection(self):
        """确认选择"""
        if self.selected_account:
            # 发送选中的账号并关闭对话框
            self.account_selected.emit(self.selected_account)
            self.accept()
