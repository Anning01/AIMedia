import shutil
import os
import time

from PySide6.QtCore import Qt, QThread, Signal, QTimer
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout,
                               QPushButton, QLabel, QTableWidget, QTableWidgetItem, QComboBox,
                               QHeaderView, QFrame, QDialog, QTextEdit)
from utils.task_service import TaskService
from utils.token_check import check_user_token

from api.api_all import get_news_list, get_account_info, partial_update_news, check_vip
from utils.precess_image import precess_image

# 添加时间戳
from datetime import datetime

from utils.get_user_ope import user_opt


class LogWindow(QDialog):
    """日志窗口"""
    def __init__(self, title, position=None, parent=None):
        super().__init__(parent)
        self.setWindowTitle(title)
        self.setFixedSize(600, 400)
        # 设置窗口标志，允许最小化
        self.setWindowFlags(Qt.Window | Qt.WindowMinimizeButtonHint | Qt.WindowCloseButtonHint)

        # 如果指定了位置，则设置窗口位置
        if position:
            self.move(position[0], position[1])

        self.init_ui()

        # 模拟日志更新
        # self.timer = QTimer()
        # self.timer.timeout.connect(self.append_log)
        # self.timer.start(1000)  # 每秒更新一次

    def init_ui(self):
        layout = QVBoxLayout()
        layout.setContentsMargins(10, 10, 10, 10)
        layout.setSpacing(10)
        self.setLayout(layout)

        # 标题栏
        title_bar = QFrame()
        title_bar.setObjectName("titleBar")
        title_bar_layout = QHBoxLayout()
        title_bar_layout.setContentsMargins(5, 5, 5, 5)
        title_bar.setLayout(title_bar_layout)

        # 标题
        title_label = QLabel(self.windowTitle())
        title_label.setObjectName("titleLabel")
        title_bar_layout.addWidget(title_label)

        # 添加伸缩
        title_bar_layout.addStretch()

        # 最小化按钮
        minimize_btn = QPushButton("—")
        minimize_btn.setObjectName("minimizeBtn")
        minimize_btn.setFixedSize(30, 24)
        minimize_btn.clicked.connect(self.showMinimized)
        title_bar_layout.addWidget(minimize_btn)

        # 关闭按钮
        close_btn = QPushButton("×")
        close_btn.setObjectName("closeBtn")
        close_btn.setFixedSize(30, 24)
        close_btn.clicked.connect(self.close)
        title_bar_layout.addWidget(close_btn)

        layout.addWidget(title_bar)

        # 日志文本框
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        layout.addWidget(self.log_text)

        # 设置样式
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

    def append_log(self, log):
        """添加日志"""


        timestamp = datetime.now().strftime("%H:%M:%S")
        formatted_log = f"[{timestamp}] {log}\n"

        # 添加到文本框
        self.log_text.append(formatted_log)

        # 滚动到底部
        scrollbar = self.log_text.verticalScrollBar()
        scrollbar.setValue(scrollbar.maximum())

    def clear_log(self):
        self.log_text.clear()


class TaskThread(QThread):
    log_signal = Signal(str)
    finished = Signal()  # 添加完成信号

    def __init__(self, task_service, production_window):
        super().__init__()
        self.task_service = task_service
        self.production_window = production_window
        self._running = True

    def stop(self):
        """安全停止线程"""
        self._running = False
        self.wait()  # 等待线程结束

    def run(self):
        try:
            code = check_vip()
            if code == 2000:
                print('会员过期')
                self.production_window.append_log('会员过期')
                return

            selected_model, api_key,config = user_opt()
            if False in [selected_model, api_key]:
                self.production_window.append_log("请先配置模型和api_key")
                time.sleep(10)
                return

            while self._running:
                print("11")
                try:
                    if not self.production_window or not self.production_window.isVisible():
                        break

                    self.production_window.append_log('检测用户信息')
                    is_publish,is_not_full, api_key, selected_model, prompt = check_user_token()
                    print("是否可以发布：", is_publish)
                    print("是否使用我们的key：", is_not_full)
                    
                    if not is_publish:
                        self.production_window.append_log('用户配置无效')
                        break

                    self.production_window.append_log('开始任务')
                    data = get_news_list()
                    if not data:
                        self.production_window.append_log('获取任务列表失败')
                        break

                    task = [{
                        'id': t['id'],
                        'account': t['account'],
                        'platform': t['account_platform_name'],
                        'title': t['title'],
                        'article_info': t['article_info'],
                        'img_list': t['img_list'],
                        'status': t['status'],
                    }
                    for t in data if t["status"] in [0, 1]]

                    task_num = len(task)
                    self.production_window.append_log('任务数量：' + str(task_num))
                    
                    if task_num == 0:
                        self.production_window.append_log('配置任务已经全部完成')
                        break

                    for item in task:
                        if not self._running:
                            break

                        img_list = None
                        try:
                            self.production_window.append_log(f'任务平台：{item["platform"]}')
                            topic = item['title'] + '\n' + item['article_info']

                            if item['status'] in [0, 1]:
                                self.production_window.append_log('开始生产内容')
                                print("222")
                                is_create, article = self.task_service.produce_content(
                                    topic, selected_model, api_key, prompt, item['id'], is_not_full
                                )
                                print("444")
                                if not self._running:
                                    break
                                if not is_create or not article:
                                    self.production_window.append_log('内容生成失败')
                                    continue
                                if not self._running:
                                    break
                                self.production_window.append_log('开始处理图片')
                                img_list = precess_image(item['img_list'], item['id'], self.production_window, article)

                                if is_create:
                                    self.production_window.append_log('检测到文章已经生成，获取文章')
                                    cookies = get_account_info(item['account'])
                                    if not self._running:
                                        break
                                    if not cookies or 'cookie' not in cookies:
                                        self.production_window.append_log('获取账号信息失败')
                                        continue
                                        
                                    cookie = cookies['cookie']
                                    self.production_window.append_log('开始发布，等待浏览器启动')
                                    
                                    if not self._running:
                                        break
                                        
                                    self.task_service.publish_content(
                                        article, cookie, img_list, item['platform'], item['id']
                                    )
                                    self.production_window.append_log('发布完成')

                        except Exception as e:
                            self.production_window.append_log(f'处理任务出错: {str(e)}')
                        finally:
                            if img_list:
                                try:
                                    if os.path.exists(img_list):
                                        shutil.rmtree(img_list)
                                except Exception as e:
                                    self.production_window.append_log(f"清理图片失败: {str(e)}")

                    time.sleep(1)  # 避免CPU过度使用

                except Exception as e:
                    self.production_window.append_log(f'任务处理出错: {str(e)}')
                    time.sleep(5)  # 出错后等待一段时间再继续

        except Exception as e:
            self.production_window.append_log(f'任务线程出错: {str(e)}')
        finally:
            self.finished.emit()


class TaskCenterWidget(QWidget):
    """任务中心组件"""
    def __init__(self):
        super().__init__()
        self.task_service = TaskService()
        self.production_window = None
        self.task_thread = None
        self.status_timer = QTimer(self)  # 在主线程中创建定时器
        self.status_timer.timeout.connect(self.check_window_status)
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

        # 任务状态筛选
        filter_layout = QHBoxLayout()
        filter_layout.setSpacing(10)

        filter_label = QLabel("任务状态:")
        filter_label.setObjectName("filterLabel")
        filter_layout.addWidget(filter_label)

        self.status_combo = QComboBox()
        self.status_combo.addItems(["全部", "已配置", "生产中", "已生成", "已发布", "任务失败"])
        self.status_combo.setFixedSize(120, 32)
        self.status_combo.currentTextChanged.connect(self.filter_tasks)
        filter_layout.addWidget(self.status_combo)

        toolbar_layout.addLayout(filter_layout)
        toolbar_layout.addStretch()

        # 刷新按钮
        refresh_btn = QPushButton("刷新")
        refresh_btn.setObjectName("refreshBtn")
        refresh_btn.setFixedSize(100, 32)
        refresh_btn.clicked.connect(self.load_data)
        toolbar_layout.addWidget(refresh_btn)

        # 启动任务按钮
        start_btn = QPushButton("启动任务")
        start_btn.setObjectName("startBtn")
        start_btn.setFixedSize(100, 32)
        start_btn.clicked.connect(self.start_tasks)
        toolbar_layout.addWidget(start_btn)

        layout.addWidget(toolbar)

        # 任务列表
        self.table = QTableWidget()
        self.table.setObjectName("taskTable")
        self.table.setColumnCount(7)
        self.table.setHorizontalHeaderLabels(["昵称", "UID", "标题", "平台", "任务进度", "开始时间", "操作"])
        self.table.setEditTriggers(QTableWidget.NoEditTriggers)  # 禁用编辑

        # 设置表格样式
        self.table.setShowGrid(False)
        self.table.setAlternatingRowColors(True)
        self.table.verticalHeader().hide()
        self.table.setSelectionMode(QTableWidget.NoSelection)

        # 设置列宽
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.Fixed)
        header.setSectionResizeMode(1, QHeaderView.Fixed)
        header.setSectionResizeMode(2, QHeaderView.Stretch)  # 标题列自适应
        header.setSectionResizeMode(3, QHeaderView.Fixed)
        header.setSectionResizeMode(4, QHeaderView.Fixed)
        header.setSectionResizeMode(5, QHeaderView.Fixed)
        header.setSectionResizeMode(6, QHeaderView.Fixed)

        self.table.setColumnWidth(0, 80)  # 昵称
        self.table.setColumnWidth(1, 150)  # UID
        self.table.setColumnWidth(3, 80)  # 平台
        self.table.setColumnWidth(4, 100)  # 任务进度
        self.table.setColumnWidth(5, 120)  # 开始时间
        self.table.setColumnWidth(6, 80)  # 操作按钮

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
            }
            QComboBox:focus {
                border-color: #2ECC71;
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
            QPushButton#startBtn {
                background-color: #2475A8;
                color: white;
                border: none;
                border-radius: 4px;
                font-weight: bold;
                font-size: 14px;
            }
            QPushButton#startBtn:hover {
                background-color: #1E638C;
            }
            QPushButton#startBtn:pressed {
                background-color: #195272;
            }
            QPushButton#cancelBtn {
                background-color: #E74C3C;
                color: white;
                border: none;
                border-radius: 4px;
            }
            QPushButton#cancelBtn:hover {
                background-color: #C0392B;
            }
            #taskTable {
                background-color: white;
                border: 1px solid #E9ECEF;
                border-radius: 6px;
            }
            #taskTable::item {
                padding: 8px;
                border: none;
            }
            #taskTable::item:alternate {
                background-color: #F8F9FA;
            }
            QHeaderView::section {
                background-color: white;
                padding: 8px;
                border: none;
                border-bottom: 2px solid #E9ECEF;
                color: #495057;
                font-weight: bold;
            }
        """)

    def load_data(self):
        """加载任务数据"""
        tasks = self.task_service.get_tasks()
        self.display_tasks(tasks)

    def display_tasks(self, tasks):
        """显示任务列表"""
        self.table.setRowCount(len(tasks))
        self.table.verticalHeader().setDefaultSectionSize(50)  # 设置行高

        status_colors = {
            "已配置": "#3498DB",
            "生产中": "#F1C40F",
            "已生产": "#2ECC71",
            "已发布": "#27AE60",
            "任务失败": "#E74C3C"
        }

        for row, task in enumerate(tasks):
            # 昵称
            nickname_item = QTableWidgetItem(task["nickname"])
            nickname_item.setTextAlignment(Qt.AlignVCenter)
            self.table.setItem(row, 0, nickname_item)

            # UID
            uid_item = QTableWidgetItem(task["uid"])
            uid_item.setTextAlignment(Qt.AlignVCenter)
            self.table.setItem(row, 1, uid_item)

            # 标题
            title_item = QTableWidgetItem(task["title"])
            title_item.setTextAlignment(Qt.AlignVCenter)
            self.table.setItem(row, 2, title_item)

            # 平台
            platform_item = QTableWidgetItem(task["platform"])
            platform_item.setTextAlignment(Qt.AlignVCenter)
            self.table.setItem(row, 3, platform_item)

            # 任务进度
            status_item = QTableWidgetItem(task["status"])
            status_item.setTextAlignment(Qt.AlignVCenter)
            status_item.setForeground(QColor(status_colors.get(task["status"], "#2C3E50")))
            self.table.setItem(row, 4, status_item)

            # 开始时间
            start_time_item = QTableWidgetItem(task["start_time"])
            start_time_item.setTextAlignment(Qt.AlignVCenter)
            self.table.setItem(row, 5, start_time_item)

            # 操作按钮
            operation_btn = self.create_operation_button(row, task)
            self.table.setCellWidget(row, 6, operation_btn)

    def create_operation_button(self, row, task):
        """创建操作按钮"""
        btn = QPushButton("取消")
        btn.setFixedSize(60, 24)
        btn.setObjectName("operationBtn")

        # 根据任务状态设置按钮状态和样式
        if task["status"] == "已发布":
            btn.setEnabled(False)
            btn.setStyleSheet("""
                QPushButton#operationBtn {
                    background-color: #E0E0E0;
                    color: #999;
                    border: none;
                    border-radius: 4px;
                    padding: 4px 8px;
                }
                QPushButton#operationBtn:disabled {
                    background-color: #E0E0E0;
                    color: #999;
                }
            """)
        else:
            btn.setStyleSheet("""
                QPushButton#operationBtn {
                    background-color: #E74C3C;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 4px 8px;
                }
                QPushButton#operationBtn:hover {
                    background-color: #C0392B;
                }
                QPushButton#operationBtn:pressed {
                    background-color: #A93226;
                }
            """)
            btn.clicked.connect(lambda: self.cancel_task(task))

        return btn

    def filter_tasks(self):
        """根据状态筛选任务"""
        status = self.status_combo.currentText()
        tasks = self.task_service.get_tasks(status)
        self.display_tasks(tasks)

    def cancel_task(self, task):
        """取消任务"""
        # 获取当前行的任务信息

        self.task_service.cancel_task(task["id"])
        # 重新加载数据
        self.load_data()

    def start_tasks(self):
        """启动任务"""
        if not self.production_window:
            self.production_window = LogWindow("任务生产")
        else:
            self.production_window.clear_log()
        self.production_window.show()

        if not self.task_thread:
            self.task_thread = TaskThread(self.task_service, self.production_window)
            self.task_thread.log_signal.connect(self.production_window.append_log)
            self.task_thread.finished.connect(self.cleanup_resources)
            self.task_thread.start()
            self.status_timer.start(1000)  # 启动定时器

    def check_window_status(self):
        """检查窗口状态"""
        if self.task_thread and self.task_thread.isRunning() and \
           (not self.production_window or not self.production_window.isVisible()):
            self.cleanup_resources()

    def cleanup_resources(self):
        """清理所有资源"""
        if self.status_timer.isActive():
            self.status_timer.stop()
        
        if self.task_thread:
            if self.task_thread.isRunning():
                self.task_thread.stop()  # 这会等待线程结束
            self.task_thread = None
        
        if self.production_window:
            self.production_window.close()
            self.production_window = None

    def closeEvent(self, event):
        """窗口关闭事件"""
        self.cleanup_resources()
        super().closeEvent(event)
