import sys
from PySide6.QtWidgets import QApplication
from views.login_window import LoginWindow
from views.main_window import MainWindow
from utils.local_data import LocalData
from PySide6.QtCore import QSettings
from PySide6.QtGui import QFont
from api.api_all import get_user
from utils.auth_service import AuthService

def main():
    app = QApplication(sys.argv)

    # 移除特定字体路径依赖
    # QFontDatabase.removeAllApplicationFonts()

    # 设置全局字体（根据操作系统选择合适的字体）
    default_font = QFont()
    if sys.platform == "darwin":  # macOS
        font_families = ["PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "SimSun", "Arial"]
    else:  # Windows
        font_families = ["Microsoft YaHei", "SimSun", "Arial"]
    
    # 设置第一个可用的字体
    font_set = False
    for font_family in font_families:
        default_font.setFamily(font_family)
        if default_font.exactMatch():  # 检查字体是否真实可用
            font_set = True
            break
    
    if not font_set:
        default_font.setFamily("Arial")  # 如果没有找到合适的字体，使用 Arial 作为后备
    
    default_font.setPointSize(9)
    app.setFont(default_font)

    # 设置全局样式表
    app.setStyleSheet("""
        /* 全局文本设置 */
        * {
            font-family: "Microsoft YaHei", SimSun, Arial;
            font-size: 12px;
        }

        /* 表格设置 */
        QTableWidget, QTableView {
            font-family: "Microsoft YaHei", SimSun, Arial;
            font-size: 12px;
            gridline-color: #E0E0E0;
        }
        
        QTableWidget::item, QTableView::item {
            color: #333333;
            padding: 4px;
        }

        /* 下拉框设置 */
        QComboBox {
            font-family: "Microsoft YaHei", SimSun, Arial;
            font-size: 12px;
            color: #333333;
            padding: 4px 8px;
        }
        
        QComboBox QAbstractItemView {
            font-family: "Microsoft YaHei", SimSun, Arial;
            font-size: 12px;
            color: #333333;
            background-color: white;
            selection-background-color: #E8E8E8;
        }

        QComboBox::drop-down {
            border: none;
            padding-right: 4px;
        }

        /* 表头设置 */
        QHeaderView {
            font-family: "Microsoft YaHei", SimSun, Arial;
            font-size: 12px;
        }
        
        QHeaderView::section {
            font-family: "Microsoft YaHei", SimSun, Arial;
            font-size: 12px;
            font-weight: bold;
            color: #333333;
            background-color: #F5F5F5;
            padding: 6px;
            border: none;
            border-bottom: 1px solid #E0E0E0;
        }

        /* 标签设置 */
        QLabel {
            font-family: "Microsoft YaHei", SimSun, Arial;
            font-size: 12px;
            color: #333333;
        }

        /* 按钮设置 */
        QPushButton {
            font-family: "Microsoft YaHei", SimSun, Arial;
            font-size: 12px;
            min-height: 24px;
            padding: 4px 12px;
        }

        /* 文本框设置 */
        QLineEdit, QTextEdit, QPlainTextEdit {
            font-family: "Microsoft YaHei", SimSun, Arial;
            font-size: 12px;
            color: #333333;
            padding: 4px 8px;
        }

        /* 菜单和工具提示设置 */
        QMenu, QToolTip {
            font-family: "Microsoft YaHei", SimSun, Arial;
            font-size: 12px;
            color: #333333;
            background-color: white;
            padding: 4px;
        }

        /* 状态栏设置 */
        QStatusBar {
            font-family: "Microsoft YaHei", SimSun, Arial;
            font-size: 12px;
            color: #666666;
        }

        /* 选项卡设置 */
        QTabWidget::pane {
            border: 1px solid #E0E0E0;
        }

        QTabBar::tab {
            font-family: "Microsoft YaHei", SimSun, Arial;
            font-size: 12px;
            color: #333333;
            padding: 6px 12px;
        }

        /* 滚动条设置 */
        QScrollBar {
            background-color: #F5F5F5;
            width: 12px;
            height: 12px;
        }

        QScrollBar::handle {
            background-color: #CCCCCC;
            border-radius: 6px;
            min-height: 24px;
        }

        QScrollBar::handle:hover {
            background-color: #BBBBBB;
        }
    """)

    settings = QSettings("AiMedia", "ai-media")
    token = settings.value("token", None)
    if token:
        try:
            openid = get_user()['open_id']
            settings = QSettings("AiMedia", "ai-media")
            settings.setValue("openid", openid)
            main_window = MainWindow()
            main_window.show()
        except Exception as e:
            print(e)
            AuthService().delete_token()
            login_window = LoginWindow()
            login_window.show()
    else:
        # 正常模式：从登录界面开始
        AuthService().delete_token()
        login_window = LoginWindow()
        login_window.show()

    # 初始化数据库
    local_data = LocalData()
    local_data.update_status()
    # 关闭数据库连接
    local_data.close()

    sys.exit(app.exec())

if __name__ == "__main__":
    main()
