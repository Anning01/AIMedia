from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QLabel, QPushButton,
    QScrollArea, QWidget, QApplication
)
from PySide6.QtCore import Qt, Signal, QThread

class PreviewWorker(QThread):
    """预览任务线程"""
    finished = Signal(tuple)  # (success, result)
    
    def __init__(self, preview_task):
        super().__init__()
        self.preview_task = preview_task
        
    def run(self):
        try:
            result = self.preview_task()
            self.finished.emit((True, result))
        except Exception as e:
            self.finished.emit((False, str(e)))

class PreviewDialog(QDialog):
    """预览对话框"""
    
    def __init__(self, preview_task, parent=None):
        super().__init__(parent)
        self.preview_task = preview_task
        self.worker = None
        self._is_loading = False
        self._content_loaded = False
        
        self.init_ui()
        self.setup_style()
        self.start_preview()
        
    def init_ui(self):
        """初始化UI"""
        self.setWindowTitle("预览结果")
        self.resize(600, 400)
        
        # 主布局
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(15)
        
        # 加载状态标签
        self.loading_label = QLabel("生成中...", self)
        self.loading_label.setAlignment(Qt.AlignCenter)
        self.loading_label.hide()
        layout.addWidget(self.loading_label)
        
        # 滚动区域
        scroll = QScrollArea(self)
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        layout.addWidget(scroll)
        
        # 内容容器
        content_widget = QWidget()
        content_layout = QVBoxLayout(content_widget)
        
        # 内容标签
        self.content_label = QLabel()
        self.content_label.setWordWrap(True)
        self.content_label.setTextInteractionFlags(Qt.TextSelectableByMouse)
        content_layout.addWidget(self.content_label)
        content_layout.addStretch()
        
        scroll.setWidget(content_widget)
        
        # 复制按钮
        self.copy_btn = QPushButton("复制内容", self)
        self.copy_btn.setEnabled(False)
        self.copy_btn.clicked.connect(self.copy_content)
        layout.addWidget(self.copy_btn)
        
    def setup_style(self):
        """设置样式"""
        self.setStyleSheet("""
            QDialog {
                background: white;
            }
            QLabel {
                font-size: 14px;
                color: #333;
            }
            QPushButton {
                padding: 8px 16px;
                background: #2d8cf0;
                border: none;
                border-radius: 4px;
                color: white;
                font-size: 14px;
            }
            QPushButton:hover {
                background: #2b85e4;
            }
            QPushButton:pressed {
                background: #2979d9;
            }
            QPushButton:disabled {
                background: #bbbec4;
            }
            QScrollArea {
                border: 1px solid #dcdee2;
                border-radius: 4px;
            }
        """)
        
    def start_preview(self):
        """开始预览任务"""
        if self._is_loading:
            return
            
        self._is_loading = True
        self._content_loaded = False
        self.loading_label.show()
        self.content_label.clear()
        self.copy_btn.setEnabled(False)
        
        self.worker = PreviewWorker(self.preview_task)
        self.worker.finished.connect(self._on_preview_finished)
        self.worker.start()
        
    def _on_preview_finished(self, result):
        """预览完成回调"""
        success, data = result
        self._is_loading = False
        self.loading_label.hide()
        
        if success:
            self._content_loaded = True
            self.content_label.setText(data)
            self.copy_btn.setEnabled(True)
        else:
            self.show_error(f"预览失败: {data}")
            
        self.worker = None
            
    def copy_content(self):
        """复制内容"""
        if not self._content_loaded:
            return
            
        text = self.content_label.text()
        QApplication.clipboard().setText(text)
        self.copy_btn.setText("已复制")
        self.copy_btn.setEnabled(False)
        
        # 1秒后恢复按钮状态
        QThread.msleep(1000)
        self.copy_btn.setText("复制内容")
        self.copy_btn.setEnabled(True)
        
    def show_error(self, message):
        """显示错误信息"""
        self.content_label.setText(f"<span style='color: #ed4014;'>{message}</span>")
