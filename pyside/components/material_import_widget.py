from datetime import datetime

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (
    QComboBox,
    QDialog,
    QFrame,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from components.material_import_dialog import MaterialImportDialog
from services.material_service import MaterialService
from threads.material_thread import MaterialThread
from utils.message_popup import MessagePopup


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
                background-color: #4A6278;
            }
            QPushButton#minimizeBtn:pressed, QPushButton#closeBtn:pressed {
                background-color: #2C3E50;
            }
            QTextEdit {
                background-color: #34495E;
                color: #ECF0F1;
                border: none;
                font-family: Consolas, Monaco, monospace;
                font-size: 12px;
            }
            QScrollBar:vertical {
                border: none;
                background: #2C3E50;
                width: 10px;
                margin: 0px;
            }
            QScrollBar::handle:vertical {
                background: #4A6278;
                min-height: 20px;
                border-radius: 5px;
            }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
                height: 0px;
            }
            QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {
                background: none;
            }
        """)

    def append_log(self, log):
        """添加日志"""
        current_time = datetime.now().strftime("%H:%M:%S")
        self.log_text.append(f"[{current_time}] {log}")
        # 滚动到底部
        scrollbar = self.log_text.verticalScrollBar()
        scrollbar.setValue(scrollbar.maximum())

    def clear_log(self):
        """清空日志"""
        self.log_text.clear()


class MaterialImportWidget(QWidget):
    """素材导入组件"""

    # 添加状态映射
    status_map = {-1: "全部", 0: "已配置", 1: "已生成", 2: "已发布", 3: "已失败"}

    def __init__(self):
        super().__init__()
        self.material_service = MaterialService()
        self.production_window = None
        self.current_status = -1  # 添加当前状态过滤
        self.init_ui()
        self.load_data()

    def init_ui(self):
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

        # 状态筛选下拉框
        status_label = QLabel()
        status_label.setObjectName("statusLabel")
        toolbar_layout.addWidget(status_label)

        self.status_combo = QComboBox()
        self.status_combo.setObjectName("statusCombo")
        self.status_combo.setFixedSize(100, 32)
        # 添加状态选项
        for status_code, status_name in self.status_map.items():
            self.status_combo.addItem(status_name, status_code)
        self.status_combo.currentIndexChanged.connect(self._on_status_changed)
        toolbar_layout.addWidget(self.status_combo)

        # 导入素材按钮
        import_btn = QPushButton("导入素材")
        import_btn.setObjectName("importBtn")
        import_btn.setFixedSize(100, 32)
        import_btn.clicked.connect(self.show_import_dialog)
        toolbar_layout.addWidget(import_btn)

        # 刷新按钮
        self.refresh_btn = QPushButton("刷新")
        self.refresh_btn.setObjectName("refreshBtn")
        self.refresh_btn.setFixedSize(80, 32)
        self.refresh_btn.clicked.connect(self.load_data)
        toolbar_layout.addWidget(self.refresh_btn)

        # 添加弹性空间
        toolbar_layout.addStretch()

        # 自定义发布按钮
        custom_publish_btn = QPushButton("自定义发布")
        custom_publish_btn.setObjectName("customPublishBtn")
        custom_publish_btn.setFixedSize(100, 32)
        custom_publish_btn.clicked.connect(self.show_custom_publish_dialog)
        toolbar_layout.addWidget(custom_publish_btn)

        layout.addWidget(toolbar)

        # 素材列表
        self.table = QTableWidget()
        self.table.setObjectName("materialTable")
        self.table.setColumnCount(6)
        self.table.setHorizontalHeaderLabels(
            ["昵称", "标题", "上传时间", "平台", "任务进度", "操作"]
        )
        self.table.setEditTriggers(QTableWidget.NoEditTriggers)

        # 设置表格样式
        self.table.setShowGrid(False)
        self.table.setAlternatingRowColors(True)
        self.table.verticalHeader().hide()
        self.table.setSelectionMode(QTableWidget.NoSelection)

        # 设置列宽
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.Fixed)  # 昵称
        header.setSectionResizeMode(1, QHeaderView.Stretch)  # 标题自适应
        header.setSectionResizeMode(2, QHeaderView.Fixed)  # 上传时间
        header.setSectionResizeMode(3, QHeaderView.Fixed)  # 平台
        header.setSectionResizeMode(4, QHeaderView.Fixed)  # 任务进度
        header.setSectionResizeMode(5, QHeaderView.Fixed)  # 操作

        self.table.setColumnWidth(0, 120)  # 昵称
        self.table.setColumnWidth(2, 150)  # 上传时间
        self.table.setColumnWidth(3, 100)  # 平台
        self.table.setColumnWidth(4, 100)  # 任务进度
        self.table.setColumnWidth(5, 80)  # 操作

        layout.addWidget(self.table)

        # 设置样式
        self.setStyleSheet("""
            QWidget {
                background-color: #F8F9FA;
                font-family: -apple-system, "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif;
                font-size: 14px;
            }
            
            #toolbar {
                background-color: white;
                border: 1px solid #E9ECEF;
                border-radius: 6px;
            }
            
            #statusCombo {
                border: 1px solid #dcdcdc;
                border-radius: 4px;
                padding: 0 10px;
                background-color: white;
            }
            
            #statusCombo:focus {
                border-color: #2ECC71;
            }
            
            QPushButton#importBtn {
                background-color: #2475A8;
                color: white;
                border: none;
                border-radius: 4px;
                font-weight: bold;
                font-size: 14px;
            }
            
            QPushButton#importBtn:hover {
                background-color: #1E638C;
            }
            
            QPushButton#importBtn:pressed {
                background-color: #195272;
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
            
            QPushButton#customPublishBtn {
                background-color: #2475A8;
                color: white;
                border: none;
                border-radius: 4px;
                font-weight: bold;
                font-size: 14px;
            }
            
            QPushButton#customPublishBtn:hover {
                background-color: #1E638C;
            }
            
            QPushButton#customPublishBtn:pressed {
                background-color: #195272;
            }
            
            #materialTable {
                background-color: white;
                border: 1px solid #E9ECEF;
                border-radius: 6px;
            }
            
            #materialTable::item {
                padding: 8px;
                border: none;
                color: #495057;
            }
            
            #materialTable::item:alternate {
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
            
            QPushButton#deleteBtn {
                background-color: #FF8C9C;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 4px 12px;
                font-size: 12px;
            }
            
            QPushButton#deleteBtn:hover {
                background-color: #FF9FAD;
            }
            
            QPushButton#deleteBtn:pressed {
                background-color: #FF7C8C;
            }
            
            QPushButton#deleteBtn:disabled {
                background-color: #CCCCCC;
                color: #666666;
            }
        """)

    def _on_status_changed(self):
        """状态筛选变化时的处理函数"""
        self.current_status = self.status_combo.currentData()
        self.load_data()

    def load_data(self):
        """加载素材数据"""
        # 根据当前选择的状态获取材料列表
        status = None if self.current_status == -1 else self.current_status
        material_list = self.material_service.get_material_list(status)

        # 清空表格
        self.table.setRowCount(0)

        # 填充数据
        for row, data in enumerate(material_list):
            self.table.insertRow(row)
            self.table.verticalHeader().setDefaultSectionSize(50)  # 设置行高

            # 昵称
            nickname_item = QTableWidgetItem(data["nickname"])
            nickname_item.setTextAlignment(Qt.AlignVCenter)
            self.table.setItem(row, 0, nickname_item)

            # 标题
            title_item = QTableWidgetItem(data["title"])
            title_item.setTextAlignment(Qt.AlignVCenter)
            self.table.setItem(row, 1, title_item)

            # 上传时间
            time_item = QTableWidgetItem(data["upload_time"])
            time_item.setTextAlignment(Qt.AlignVCenter)
            self.table.setItem(row, 2, time_item)

            # 平台
            platform_item = QTableWidgetItem(data["platform"])
            platform_item.setTextAlignment(Qt.AlignVCenter)
            platform_item.setForeground(QColor("#2475A8"))  # 设置平台文字为蓝色
            self.table.setItem(row, 3, platform_item)

            # 任务进度
            status_map = {0: "已配置", 1: "已生成", 2: "已发布", 3: "已失败"}
            status_colors = {
                "已配置": "#3498DB",
                "已生成": "#F1C40F",
                "已发布": "#27AE60",
                "已失败": "#E74C3C",
            }
            status = status_map.get(data["status"], "未知")
            status_item = QTableWidgetItem(status)
            status_item.setTextAlignment(Qt.AlignVCenter)
            status_item.setForeground(QColor(status_colors.get(status, "#666666")))
            self.table.setItem(row, 4, status_item)

            # 操作按钮
            delete_btn = QPushButton("删除")
            delete_btn.setObjectName("deleteBtn")
            delete_btn.setFixedSize(60, 24)
            delete_btn.clicked.connect(lambda checked, id=data["id"]: self.delete_material(id))
            # 只有在"已配置"状态下才能删除
            delete_btn.setEnabled(data["status"] == 0)
            self.table.setCellWidget(row, 5, delete_btn)

    def delete_material(self, material_id):
        """删除素材"""
        if self.material_service.delete_material(material_id):
            self.load_data()  # 重新加载数据

    def show_import_dialog(self):
        """显示导入素材对话框"""
        dialog = MaterialImportDialog(self)
        if dialog.exec():
            try:
                form_data = dialog.get_form_data()
                material_id = self.material_service.save_material(form_data)
                if material_id:
                    self.load_data()  # 重新加载数据
            except ValueError as e:
                QMessageBox.warning(self, "错误", str(e))
            except Exception as e:
                QMessageBox.critical(self, "错误", f"保存素材失败: {str(e)}")

    def show_custom_publish_dialog(self):
        """显示自定义发布对话框"""
        # 获取未发布的素材
        materials = self.material_service.get_material_list()
        unpublished_materials = [m for m in materials if m["status"] != 2 and m["status"] != 3]

        if not unpublished_materials:
            info_popup = MessagePopup(
                "没有可发布的素材，请先导入素材", parent=self, message_type="warning"
            )
            info_popup.move(self.mapToGlobal(self.rect().center()) - info_popup.rect().center())
            info_popup.show()
            return

        # 显示生产窗口
        if not self.production_window:
            self.production_window = LogWindow("自定义发布")
        else:
            self.production_window.clear_log()
        self.production_window.show()

        # 启动生产线程
        self.material_thread = MaterialThread(
            unpublished_materials, self.production_window, self.material_service
        )
        self.material_thread.log_signal.connect(self.production_window.append_log)
        self.material_thread.finished.connect(self.load_data)  # 生产完成后刷新列表
        self.material_thread.start()

    def import_material(self):
        """导入素材"""
        # TODO: 实现导入功能
        pass
