from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, 
    QPushButton, QScrollArea, QWidget, QFrame,
    QTableWidget, QTableWidgetItem, QHeaderView
)
from PySide6.QtCore import Qt, Signal

class AccountSelector(QDialog):
    account_selected = Signal(dict)  # 发送选中的账号
    
    def __init__(self, accounts, current_account=None, parent=None):
        super().__init__(parent)
        self.accounts = accounts
        self.current_account = current_account
        self.selected_account = None
        self.init_ui()
        
    def init_ui(self):
        """初始化UI"""
        self.setWindowTitle("选择账号")
        self.setMinimumSize(500, 400)
        self.setWindowFlags(Qt.Dialog | Qt.WindowStaysOnTopHint)
        
        # 创建主布局
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(15)
        
        # 创建表格
        self.table = QTableWidget()
        self.table.setColumnCount(4)  # UID, 昵称, 平台, 选择
        self.table.setHorizontalHeaderLabels(["UID", "昵称", "平台", "选择"])
        self.table.setSelectionMode(QTableWidget.NoSelection)
        
        # 设置表格样式
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(1, QHeaderView.Stretch)
        header.setSectionResizeMode(2, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(3, QHeaderView.Fixed)
        header.setDefaultSectionSize(120)  # 设置选择按钮列的宽度
        
        # 设置行高
        self.table.verticalHeader().setDefaultSectionSize(45)  # 设置行高
        
        # 添加账号数据
        self.populate_table()
        layout.addWidget(self.table)
        
        # 已选账号显示区域
        selection_frame = QFrame()
        selection_frame.setObjectName("selection_frame")
        selection_layout = QVBoxLayout(selection_frame)
        
        selection_label = QLabel("已选择账号：")
        selection_label.setObjectName("selection_label")
        selection_layout.addWidget(selection_label)
        
        self.selection_content = QLabel()
        self.selection_content.setObjectName("selection_content")
        self.selection_content.setWordWrap(True)
        selection_layout.addWidget(self.selection_content)
        
        layout.addWidget(selection_frame)
        
        # 底部按钮
        button_layout = QHBoxLayout()
        
        cancel_btn = QPushButton("取消")
        cancel_btn.setObjectName("cancel_btn")
        cancel_btn.setStyleSheet("""
            QPushButton {
                background-color: #E0E0E0;
                color: #333333;
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
                background-color: #CCCCCC;
            }
        """)
        cancel_btn.clicked.connect(self.reject)
        
        confirm_btn = QPushButton("确定")
        confirm_btn.setObjectName("confirm_btn")
        confirm_btn.setStyleSheet("""
            QPushButton {
                background-color: #3498DB;
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
                background-color: #2980B9;
            }
        """)
        confirm_btn.clicked.connect(self.accept_selection)
        
        button_layout.addStretch()
        button_layout.addWidget(cancel_btn)
        button_layout.addWidget(confirm_btn)
        layout.addLayout(button_layout)
        
        # 设置样式
        self.setStyleSheet("""
            QDialog {
                background-color: white;
            }
            
            QTableWidget {
                border: 1px solid #E0E0E0;
                border-radius: 5px;
                background-color: white;
                gridline-color: #E0E0E0;
            }
            
            QTableWidget::item {
                padding: 8px;
                border: none;
            }
            
            QHeaderView::section {
                background-color: #F5F5F5;
                padding: 12px 8px;
                border: none;
                border-right: 1px solid #E0E0E0;
                border-bottom: 1px solid #E0E0E0;
                font-weight: bold;
                color: #2C3E50;
                font-size: 14px;
            }
            
            #selection_frame {
                background-color: #F8F9FA;
                border-radius: 5px;
                padding: 15px;
                margin-top: 10px;
            }
            
            #selection_label {
                font-weight: bold;
                color: #2C3E50;
                font-size: 14px;
            }
            
            #selection_content {
                color: #34495E;
                font-size: 14px;
                margin-top: 5px;
            }
            
            QPushButton {
                border: none;
                border-radius: 4px;
                padding: 8px 20px;
                font-weight: bold;
                font-size: 14px;
            }
            
            #cancel_btn {
                background-color: #E0E0E0;
                color: #2C3E50;
                min-width: 100px;
                min-height: 35px;
            }
            
            #confirm_btn {
                background-color: #3498DB;
                color: white;
                min-width: 100px;
                min-height: 35px;
            }
            
            #cancel_btn:hover {
                background-color: #BDBDBD;
            }
            
            #confirm_btn:hover {
                background-color: #2980B9;
            }
            
            QPushButton[objectName^="select_btn"] {
                background-color: #F5F5F5;
                color: #2C3E50;
                border: 2px solid #E0E0E0;
                padding: 8px 15px;
                border-radius: 4px;
                min-width: 90px;
                min-height: 35px;
                margin: 3px;
            }
            
            QPushButton[objectName^="select_btn"]:checked {
                background-color: #2ECC71;
                color: white;
                border: none;
            }
            
            QPushButton[objectName^="select_btn"]:hover:!checked {
                background-color: #E0E0E0;
                border-color: #BDBDBD;
            }
        """)
        
        # 如果有当前账号，更新显示
        if self.current_account:
            self.selected_account = self.current_account
            self.update_selection_display()
    
    def populate_table(self):
        """填充表格数据"""
        self.table.setRowCount(len(self.accounts))
        for row, account in enumerate(self.accounts):
            # UID
            uid_item = QTableWidgetItem(account['uid'])
            uid_item.setFlags(uid_item.flags() & ~Qt.ItemIsEditable)
            self.table.setItem(row, 0, uid_item)
            
            # 昵称
            nickname_item = QTableWidgetItem(account['nickname'])
            nickname_item.setFlags(nickname_item.flags() & ~Qt.ItemIsEditable)
            self.table.setItem(row, 1, nickname_item)
            
            # 平台
            platform_item = QTableWidgetItem(account['platform'])
            platform_item.setFlags(platform_item.flags() & ~Qt.ItemIsEditable)
            self.table.setItem(row, 2, platform_item)
            
            # 选择框
            btn_widget = QWidget()
            btn_layout = QHBoxLayout(btn_widget)
            btn_layout.setContentsMargins(5, 5, 5, 5)
            
            select_btn = QPushButton("选择")
            select_btn.setObjectName(f"select_btn_{row}")
            select_btn.setCheckable(True)
            select_btn.setMinimumWidth(90)
            select_btn.setMinimumHeight(35)
            
            # 如果是当前选中的账号，设置为选中状态
            if self.current_account and self.current_account['uid'] == account['uid']:
                select_btn.setChecked(True)
                select_btn.setText("已选")
            
            select_btn.clicked.connect(lambda checked, r=row: self.on_account_selected(r))
            
            btn_layout.addWidget(select_btn)
            btn_layout.setAlignment(Qt.AlignCenter)
            self.table.setCellWidget(row, 3, btn_widget)
    
    def on_account_selected(self, row):
        """处理账号选择"""
        # 取消其他所有按钮的选中状态
        for r in range(self.table.rowCount()):
            if r != row:
                btn = self.table.cellWidget(r, 3)
                btn_layout = btn.layout()
                select_btn = btn_layout.itemAt(0).widget()
                select_btn.setChecked(False)
                select_btn.setText("选择")
        
        # 处理当前按钮
        btn = self.table.cellWidget(row, 3)
        btn_layout = btn.layout()
        select_btn = btn_layout.itemAt(0).widget()
        if select_btn.isChecked():
            select_btn.setText("已选")
            self.selected_account = {
                'uid': self.table.item(row, 0).text(),
                'nickname': self.table.item(row, 1).text(),
                'platform': self.table.item(row, 2).text()
            }
        else:
            select_btn.setText("选择")
            self.selected_account = None
        
        self.update_selection_display()
    
    def update_selection_display(self):
        """更新已选账号显示"""
        if not self.selected_account:
            self.selection_content.setText("暂未选择任何账号")
            return
            
        text = f"{self.selected_account['nickname']}({self.selected_account['platform']})"
        self.selection_content.setText(text)
    
    def accept_selection(self):
        """确认选择"""
        if self.selected_account:
            self.account_selected.emit(self.selected_account)
            self.accept()
        else:
            from utils.message_popup import MessagePopup
            MessagePopup("请选择一个账号", parent=self).exec()
