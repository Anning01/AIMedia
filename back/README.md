# AIMediaPlus 后端服务

Django 后端服务，提供 RESTful API、数据管理、任务调度等功能。

## 技术栈

- **Django 5.1.3** - Web 框架
- **Django REST Framework** - API 框架
- **SimpleUI** - Django Admin 美化
- **MySQL / SQLite** - 数据库
- **Redis** - 缓存
- **Channels + Daphne** - WebSocket 支持

## 快速开始

### 1. 环境要求

- Python >= 3.12
- MySQL 8.0+ (可选，默认使用 SQLite)
- Redis (可选，用于缓存)

### 2. 克隆项目

```bash
git clone https://github.com/Anning01/AIMedia.git
cd AIMedia/back
```

### 3. 创建虚拟环境

**方式一：使用 uv (推荐)**

```bash
# 安装 uv
pip install uv

# 创建虚拟环境并安装依赖
uv sync
```

**方式二：使用 venv**

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

**方式三：使用 conda**

```bash
conda create -n AIMedia python=3.12
conda activate AIMedia
pip install -r requirements.txt
```

### 4. 配置环境变量

复制环境变量示例文件：

```bash
cp ArticleManagePlus/.example.env ArticleManagePlus/.env
```

编辑 `.env` 文件，配置以下内容：

```ini
# 数据库配置 (二选一)

# 方式1: 使用 SQLite (开发环境推荐，无需额外配置)
DEFAULT_DATABASE='sqlite:///db.sqlite3'

# 方式2: 使用 MySQL (生产环境推荐)
# DEFAULT_DATABASE='mysql://用户名:密码@127.0.0.1:3306/数据库名?charset=utf8mb4'

# Redis 缓存配置 (可选)
# 如果不使用 Redis，需要修改 settings.py 中的 CACHES 配置
REDIS_URL='redis://127.0.0.1:6379/0'

# 智谱 AI API Key (用于 AI 创作功能)
GML_KEY='your_zhipu_api_key'

# 以下为可选配置 (微信相关)
WECHAT_APPID=''
WECHAT_SECRET=''
WECHAT_REDIRECT_URI=''
CSRF_TRUSTED_ORIGINS=['http://localhost:8000']
WECHAT_PAY_MCHID=''
WECHAT_PAY_CERT_SERIAL_NO=''
WECHAT_PAY_APIV3_KEY=''
WECHAT_PAY_NOTIFY_URL=''
```

**如果不使用 Redis**，需要修改 `ArticleManagePlus/settings.py`，将缓存配置改为本地内存缓存：

```python
# 将这行注释掉
# CACHES = {
#     "default": env.cache_url("REDIS_URL"),
# }

# 使用本地内存缓存
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}
```

### 5. 数据库迁移

```bash
# 生成迁移文件
python manage.py makemigrations

# 执行迁移
python manage.py migrate
```

### 6. 创建超级用户

```bash
python manage.py createsuperuser
```

按提示输入用户名、邮箱和密码。

### 7. 启动开发服务器

```bash
python manage.py runserver
```

服务启动后访问：

- **首页**: http://127.0.0.1:8000/
- **管理后台**: http://127.0.0.1:8000/admin/
- **API 文档 (Swagger)**: http://127.0.0.1:8000/swagger/
- **API 文档 (ReDoc)**: http://127.0.0.1:8000/docs/

## 项目结构

```
back/
├── ArticleManagePlus/      # Django 项目配置
│   ├── settings.py         # 项目设置
│   ├── urls.py             # 路由配置
│   ├── wsgi.py             # WSGI 入口
│   └── asgi.py             # ASGI 入口
├── apps/                   # 应用目录
│   ├── users/              # 用户模块
│   └── crawlers/           # 爬虫模块
├── utils/                  # 工具函数
├── templates/              # 模板文件
├── manage.py               # Django 管理脚本
├── requirements.txt        # 依赖列表
└── pyproject.toml          # 项目配置
```

## 常用命令

```bash
# 启动开发服务器
python manage.py runserver

# 启动开发服务器（指定端口）
python manage.py runserver 0.0.0.0:8000

# 生成迁移文件
python manage.py makemigrations

# 执行迁移
python manage.py migrate

# 创建超级用户
python manage.py createsuperuser

# 收集静态文件（生产环境）
python manage.py collectstatic

# 进入 Django Shell
python manage.py shell

# 运行爬虫命令
python manage.py crawler
```

## 生产环境部署

生产环境建议使用 Daphne 或 Gunicorn + Nginx：

```bash
# 使用 Daphne (支持 WebSocket)
daphne -b 0.0.0.0 -p 8000 ArticleManagePlus.asgi:application

# 使用 Gunicorn (仅 HTTP)
gunicorn ArticleManagePlus.wsgi:application -b 0.0.0.0:8000
```

## 常见问题

### 1. mysqlclient 安装失败

**macOS:**
```bash
brew install mysql pkg-config
pip install mysqlclient
```

**Ubuntu/Debian:**
```bash
sudo apt-get install python3-dev default-libmysqlclient-dev build-essential
pip install mysqlclient
```

**Windows:**
下载预编译的 wheel 文件: https://www.lfd.uci.edu/~gohlke/pythonlibs/#mysqlclient

或者使用 SQLite 数据库开发。

### 2. Redis 连接失败

如果不需要 Redis，按照上述说明修改 settings.py 使用本地内存缓存。

如果需要 Redis：
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu
sudo apt install redis-server
sudo systemctl start redis
```

### 3. 静态文件 404

开发模式下确保 `DEBUG = True`，生产环境需要运行：
```bash
python manage.py collectstatic
```

## 反馈建议

- 提交 [Issue](https://github.com/Anning01/AIMedia/issues)
- 提交 [Pull Request](https://github.com/Anning01/AIMedia/pulls)

## 许可证

查看 [LICENSE](../LICENSE) 文件