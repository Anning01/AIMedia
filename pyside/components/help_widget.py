from PySide6.QtCore import Qt, QUrl
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWidgets import QProgressBar, QVBoxLayout, QWidget

from api.request_handler import BASE_URL


class HelpWidget(QWidget):
    """使用帮助页面"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.init_ui()

    def init_ui(self):
        """初始化UI"""
        # 主布局
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # 创建进度条
        self.progress_bar = QProgressBar(self)
        self.progress_bar.setTextVisible(False)
        self.progress_bar.setMaximumHeight(2)
        self.progress_bar.hide()

        # 创建网页视图
        self.web_view = QWebEngineView()
        self.web_view.setUrl(QUrl(f"{BASE_URL}/crawler/docs/"))

        # 设置网页视图属性
        self.web_view.page().setBackgroundColor(Qt.white)  # 设置背景色为白色

        # 连接信号
        self.web_view.loadStarted.connect(self.handle_load_started)
        self.web_view.loadProgress.connect(self.handle_load_progress)
        self.web_view.loadFinished.connect(self.handle_load_finished)
        self.web_view.page().loadFinished.connect(self.on_page_load_finished)

        # 添加到布局
        layout.addWidget(self.progress_bar)
        layout.addWidget(self.web_view)

    def handle_load_started(self):
        """开始加载时显示进度条"""
        self.progress_bar.show()
        self.progress_bar.setValue(0)

    def handle_load_progress(self, progress):
        """更新加载进度"""
        self.progress_bar.setValue(progress)

    def handle_load_finished(self, success):
        """加载完成后隐藏进度条"""
        self.progress_bar.hide()

    def on_page_load_finished(self, ok):
        """页面加载完成的处理"""
        if not ok:
            # 如果加载失败，显示错误页面
            error_html = """
            <html>
            <body style="display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: Arial, sans-serif;">
                <div style="text-align: center;">
                    <h2>加载失败</h2>
                    <p>无法连接到帮助文档服务器，请检查网络连接后重试。</p>
                    <button onclick="window.location.reload()" style="padding: 10px 20px; cursor: pointer;">重新加载</button>
                </div>
            </body>
            </html>
            """
            self.web_view.setHtml(error_html)

    def resizeEvent(self, event):
        """处理窗口大小变化"""
        super().resizeEvent(event)
        # 确保网页视图填满整个窗口
        self.web_view.resize(self.size())
