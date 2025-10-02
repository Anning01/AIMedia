from datetime import datetime

from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QLabel, QTableWidget, QTableWidgetItem, QComboBox,
    QHeaderView, QFrame, QDialog, QTextEdit, QMessageBox)
from PySide6.QtCore import Qt, QThread, Signal, QTimer
from PySide6.QtGui import QColor, QFont
from utils.account_service import AccountService
from utils.task_service import TaskService
from utils.hot_spot_service import HotSpotService

from api.api_all import check_vip
from components.task_center_widget import LogWindow
from utils.local_data import LocalData
from utils.message_popup import MessagePopup

class MonitorTaskThread(QThread):
    def __init__(self, task_service, monitor_window):
        super().__init__()
        self.task_service = task_service
        self.monitor_window = monitor_window

    def run(self):
        self.monitor_window.append_log('启动新闻监控')
        self.task_service.start_monitor_task(self.monitor_window)

class ProductionTaskThread(QThread):
    def __init__(self, task_service, production_window):
        super().__init__()
        self.task_service = task_service
        self.production_window = production_window

    def run(self):
        self.production_window.append_log('启动任务生产')
        self.task_service.start_production_task(self.production_window)

class AutoPublishThread(QThread):
    log_signal = Signal(str)
    error_signal = Signal(str)

    def __init__(self, task_service, production_window):
        super().__init__()
        self.task_service = task_service
        self.production_window = production_window
        self._running = True

    def stop(self):
        self._running = False

    def run(self):
        code = check_vip()
        if code == 2000:
            self.production_window.append_log('会员过期')
            return
        while self._running:
            try:
                # 传递日志窗口给任务
                self.task_service.start_auto_publish_task(self.production_window)
                if not self._running:
                    break  # 检查_running标志
            except Exception as e:
                # 异常时也检查_running状态
                if not self._running:
                    break
                self.error_signal.emit(f'Error: {str(e)}')
                self.msleep(1000)

class LogWindow(QDialog):
    closed = Signal()
    log_signal = Signal(str)  

    def __init__(self, title, position=None, parent=None):
        super().__init__(parent)
        self.setWindowTitle(title)
        self.setFixedSize(600, 400)
        self.setWindowFlags(Qt.Window | Qt.WindowMinimizeButtonHint | Qt.WindowCloseButtonHint)

        if position:
            self.move(position[0], position[1])

        self.init_ui()
        self.log_signal.connect(self._append_log)

    def init_ui(self):
        layout = QVBoxLayout()
        layout.setContentsMargins(10, 10, 10, 10)
        layout.setSpacing(10)
        self.setLayout(layout)

        title_bar = QFrame()
        title_bar.setObjectName("titleBar")
        title_bar_layout = QHBoxLayout()
        title_bar_layout.setContentsMargins(5, 5, 5, 5)
        title_bar.setLayout(title_bar_layout)

        title_label = QLabel(self.windowTitle())
        title_label.setObjectName("titleLabel")
        title_bar_layout.addWidget(title_label)

        title_bar_layout.addStretch()

        minimize_btn = QPushButton("—")
        minimize_btn.setObjectName("minimizeBtn")
        minimize_btn.setFixedSize(30, 24)
        minimize_btn.clicked.connect(self.showMinimized)
        title_bar_layout.addWidget(minimize_btn)

        close_btn = QPushButton("×")
        close_btn.setObjectName("closeBtn")
        close_btn.setFixedSize(30, 24)
        close_btn.clicked.connect(self.close)
        title_bar_layout.addWidget(close_btn)

        layout.addWidget(title_bar)

        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        layout.addWidget(self.log_text)

        self.setStyleSheet("""
            QDialog {
                background-color: #2C3E50;
                border: 1px solid #34495E;
            }
            #titleBar {
                background-color: #34495E;
                border-top-left-radius: 4px;
                border-top-right-radius: 4px;
            }
            #titleLabel {
                color: #ECF0F1;
                font-weight: bold;
                font-size: 14px;
            }
            QPushButton#minimizeBtn, QPushButton#closeBtn {
                background: transparent;
                border: none;
                color: #ECF0F1;
                font-size: 16px;
                font-weight: bold;
            }
            QPushButton#minimizeBtn:hover, QPushButton#closeBtn:hover {
                background-color: #2980B9;
            }
            QPushButton#closeBtn:hover {
                background-color: #E74C3C;
            }
            QTextEdit {
                background-color: #34495E;
                color: #ECF0F1;
                border: none;
                font-size: 12px;
            }
            QScrollBar:vertical {
                border: none;
                background: #2C3E50;
                width: 10px;
                margin: 0;
            }
            QScrollBar::handle:vertical {
                background: #95A5A6;
                min-height: 20px;
                border-radius: 5px;
            }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
                border: none;
                background: none;
            }
        """)

    def closeEvent(self, event):
        try:
            self.closed.emit()
            super().closeEvent(event)
        except Exception as e:
            print(f"关闭事件时出错: {str(e)}")

    def append_log(self, log):

        timestamp = datetime.now().strftime("%H:%M:%S")
        formatted_log = f"[{timestamp}] {log}\n"

        # # 添加到文本框
        # self.log_text.append(formatted_log)
        #
        # # 滚动到底部
        # scrollbar = self.log_text.verticalScrollBar()
        # scrollbar.setValue(scrollbar.maximum())
        self.log_signal.emit(formatted_log)

    def _append_log(self, log):
        self.log_text.append(log)

    def clear_log(self):
        self.log_text.clear()


class AutoPublishWidget(QWidget):
    """一键托管组件"""
    
    def __init__(self):
        super().__init__()
        self.account_service = AccountService()
        self.task_service = TaskService()
        self.production_window = None
        self.publish_thread = None
        
        # 设置系统默认字体
        default_font = QFont()  # 使用系统默认字体
        default_font.setPointSize(9)  # 只设置字体大小
        self.setFont(default_font)

        # 分类与代码映射
        self.category_code_map = {
            "政治": "1",
            "经济": "2",
            "社会": "3",
            "科技": "4",
            "体育": "5",
            "娱乐": "6",
            "国际": "7",
            "军事": "8",
            "文化": "9",
            "生活": "10",
            "教育": "11",
            "健康": "12",
            "民生": "13",
            "数码3C": "14",
            "时事热点": "16",
            "奇闻趣事": "17",
            "其他": "25",
            "游戏": "26"
        }

        # 使用category_code_map的key作为目标
        self.categories = {
            "第一目标": list(self.category_code_map.keys()),
            "第二目标": list(self.category_code_map.keys()),
            "第三目标": list(self.category_code_map.keys())
        }
        
        self.init_ui()
        self.load_data()
        
    def init_ui(self):
        """初始化UI"""
        layout = QVBoxLayout()
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(20)
        self.setLayout(layout)
        
        # 顶部区域
        top_frame = QFrame()
        top_frame.setObjectName("topFrame")
        top_layout = QHBoxLayout()
        top_layout.setContentsMargins(15, 10, 15, 10)
        top_frame.setLayout(top_layout)

        top_layout.addStretch()

        # 刷新按钮
        self.refresh_btn = QPushButton("刷新")
        self.refresh_btn.setFixedSize(80, 32)
        self.refresh_btn.setObjectName("refreshBtn")
        self.refresh_btn.clicked.connect(self.load_data)
        top_layout.addWidget(self.refresh_btn)

        # 启动托管按钮
        self.start_btn = QPushButton("启动托管")
        self.start_btn.setObjectName("startBtn")
        self.start_btn.setFixedSize(120, 32)
        self.start_btn.clicked.connect(self.start_auto_publish)
        top_layout.addWidget(self.start_btn)
        
        layout.addWidget(top_frame)
        
        # 账号配置表格
        self.table = QTableWidget()
        self.table.setObjectName("accountTable")
        self.table.setColumnCount(7)
        self.table.setHorizontalHeaderLabels(["昵称", "UID", "发布平台", "第一目标", "第二目标", "第三目标", "操作"])
        
        # 设置表格样式
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(6, QHeaderView.Fixed)
        self.table.setColumnWidth(6, 100)
        
        # 隐藏垂直表头
        self.table.verticalHeader().setVisible(False)
        
        layout.addWidget(self.table)
        
        # 设置样式
        self.setStyleSheet("""
            QWidget {
                background: #F8F9FA;
            }
            #topFrame {
                background: white;
                border-radius: 8px;
            }
            QLabel#title {
                color: #2C3E50;
                font-size: 18px;
                font-weight: bold;
            }
            QPushButton#startBtn {
                background-color: #3498DB;
                color: white;
                border: none;
                border-radius: 4px;
                font-weight: bold;
                font-size: 14px;
            }
            QPushButton#startBtn:hover {
                background-color: #2980B9;
            }
            QPushButton#startBtn:pressed {
                background-color: #2475A8;
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
            QTableWidget {
                background: white;
                border: none;
                border-radius: 8px;
            }
            QTableWidget::item {
                padding: 8px;
            }
            QHeaderView::section {
                background-color: #F8F9FA;
                padding: 8px;
                border: none;
                border-bottom: 1px solid #E0E0E0;
                font-weight: bold;
                color: #2C3E50;
            }
            QPushButton#saveBtn {
                background-color: #2ECC71;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 6px 12px;
            }
            QPushButton#saveBtn:hover {
                background-color: #27AE60;
            }
            QPushButton#saveBtn:pressed {
                background-color: #219A52;
            }
            QComboBox {
                border: 1px solid #BDC3C7;
                border-radius: 4px;
                padding: 4px 8px;
                background: white;
            }
            QComboBox::drop-down {
                border: none;
            }
            QComboBox::down-arrow {
                image: url(resources/icons/down-arrow.png);
                width: 12px;
                height: 12px;
            }
            QComboBox QAbstractItemView {
                border: 1px solid #BDC3C7;
                selection-background-color: #3498DB;
            }
        """)
        
    def load_data(self):
        """加载数据"""
        account_service = AccountService()
        accounts = account_service._accounts
        local_data = LocalData()
        cinfig_all = local_data.get_publish_configs_all()
        self.table.setRowCount(len(accounts))
        for row, account in enumerate(accounts):
            # 设置行高
            self.table.setRowHeight(row, 40)
            # 昵称
            nickname_item = QTableWidgetItem(account["nickname"])
            nickname_item.setFlags(nickname_item.flags() & ~Qt.ItemIsEditable)
            self.table.setItem(row, 0, nickname_item)
            
            # UID
            uid_item = QTableWidgetItem(account["uid"])
            uid_item.setFlags(uid_item.flags() & ~Qt.ItemIsEditable)
            self.table.setItem(row, 1, uid_item)
            
            # 发布平台
            platform_item = QTableWidgetItem(account["platform"])
            platform_item.setFlags(platform_item.flags() & ~Qt.ItemIsEditable)
            self.table.setItem(row, 2, platform_item)
            
            # 三个目标分类下拉框

            for c in cinfig_all:
                if str(account["id"]) == c[6] and str(account["uid"]) == c[2]:
                    local_data.update_publish_config_pat(
                        nickname=account["nickname"],
                        uid=account["uid"],
                        platform=account["platform"],
                        account_id=account['id']
                    )
                    break

            local_data.close()
            local_data = LocalData()
            data = local_data.get_publish_configs(account["uid"])

            for i, target in enumerate(["第一目标", "第二目标", "第三目标"]):
                if len(data) > 0:
                    data_target = data[0][4]
                    targets = data_target.split(',')
                    # 要移动到第一位的值
                    value_to_move = targets[i]
                    # 从列表中移除该值
                    self.categories[target].remove(value_to_move)
                    # 将该值插入到第一位
                    self.categories[target].insert(0, value_to_move)
                combo = QComboBox()
                combo.addItems(self.categories[target])
                self.table.setCellWidget(row, 3 + i, combo)
            
            # 保存按钮
            save_btn = QPushButton("保存配置")
            save_btn.setObjectName("saveBtn")
            save_btn.setFixedSize(80, 20)
            save_btn.clicked.connect(lambda checked, r=row,i=account['id']: self.save_config(r,i))
            self.table.setCellWidget(row, 6, save_btn)


    def save_config(self, row,_id):
        """保存账号配置"""
        try:
            # 获取基本信息
            nickname = self.table.item(row, 0).text()
            uid = self.table.item(row, 1).text()
            platform = self.table.item(row, 2).text()
            
            # 获取选择的目标
            targets = []
            codes = []
            for i in range(3):
                combo_box = self.table.cellWidget(row, i+3)
                if combo_box:
                    target = combo_box.currentText()
                    targets.append(target)
                    # 获取对应的代码
                    code = self.category_code_map.get(target)
                    if code:
                        codes.append(code)
            
            # 保存到数据库
            local_data = LocalData()
            print(targets)
            print(codes)
            local_data.save_publish_config(
                nickname=nickname,
                uid=uid,
                platform=platform,
                targets=targets,
                codes=codes,
                account_id=_id
            )
            local_data.close()
            
            # 添加成功提示
            success_popup = MessagePopup("配置保存成功", parent=self)
            success_popup.move(
                self.mapToGlobal(self.rect().center()) - success_popup.rect().center()
            )
            success_popup.show()
            
        except Exception as e:
            # 添加错误提示
            QMessageBox.critical(self, "错误", f"保存配置失败: {str(e)}")
        
    def get_category_code(self, category_name):
        """获取分类代码"""
        return self.category_code_map.get(category_name, None)

    def start_auto_publish(self):
        """启动一键托管"""
        try:
            if not self.production_window:
                self.production_window = LogWindow("一键托管日志", position=(100, 100))
                self.production_window.closed.connect(self.on_window_closed)
                self.production_window.show()

                # 创建并启动线程
                self.publish_thread = AutoPublishThread(self.task_service, self.production_window)
                self.publish_thread.log_signal.connect(self.production_window.append_log)
                self.publish_thread.error_signal.connect(self.handle_error)
                self.publish_thread.start()
        except Exception as e:
            print(f"启动托管时出错: {str(e)}")

    def handle_error(self, error_message):
        """处理线程中的错误信息"""
        print(error_message)

    def on_window_closed(self):
        """处理窗口关闭事件"""
        if self.publish_thread:
            # 首先停止线程循环
            self.publish_thread.stop()
            # 等待线程在一定时间内正常退出
            if not self.publish_thread.wait(3000):  # 等待3秒
                # 如果3秒后还没有退出，则强制终止
                self.publish_thread.terminate()
                self.publish_thread.wait()
        self.production_window = None
