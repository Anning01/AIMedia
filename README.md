<div align="center">
<h1 align="center"> AIMedia 🤖 </h1>

<p align="center">
  <a href="https://github.com/Anning01/AIMedia/stargazers"><img src="https://img.shields.io/github/stars/Anning01/AIMedia.svg?style=for-the-badge" alt="Stargazers"></a>
  <a href="https://github.com/Anning01/AIMedia/issues"><img src="https://img.shields.io/github/issues/Anning01/AIMedia.svg?style=for-the-badge" alt="Issues"></a>
  <a href="https://github.com/Anning01/AIMedia/network/members"><img src="https://img.shields.io/github/forks/Anning01/AIMedia.svg?style=for-the-badge" alt="Forks"></a>
  <a href="https://github.com/Anning01/AIMedia/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Anning01/AIMedia.svg?style=for-the-badge" alt="License"></a>
</p>
<br>
<h3>简体中文 | <a href="README.en.md">English</a></h3>
<div align="center">
  <a href="https://github.com/Anning01/AIMedia" target="_blank"><img src="docs/logo.png" style="width: 120px; height: 120px; border-radius: 50%;"/></a>
</div>
<br>
自动抓取热点，自动生成新闻，自动发布各大平台。  <b>全自动托管AI媒体软件</b> 
<br>
</div>

<a href="https://aimedia.daniu7.cn/" target="_blank"> 点击进入官网 </a>

## 功能特性 🎯

- [x] 支持 **热点新闻抓取**，自动抓取各大平台的热点新闻
    - [x] 抖音热点
    - [x] 网易新闻
    - [ ] 微博热点
- [x] 支持 **根据新闻AI自动创作**，自动发布各个平台
    - [x] 今日头条
    - [ ] 小红书
    - [ ] 公众号
    - [ ] 百家平台
- [x] 针对无图纯文本，使用AI生成图像，增加原创率，阅读体验

### 后期计划 📅

- [ ] 自动生成视频发布各个平台

## 交流讨论 💬

<img src="docs/wechat.png" width="250">

## 视频演示 📺

B站视频链接：https://www.bilibili.com/video/BV1oYSVYaEaa/?share_source=copy_web&vd_source=998582dcaa6c1a862619086e9dda59cb

## 配置要求 📦

- 建议最低 CPU 4核或以上，内存 8G 或以上，显卡非必须
- Windows 10 或以上

## 快速开始 🚀

下载一键启动包，解压直接使用（路径不要有 **中文**、**特殊字符**、**空格**）

### Windows
- 百度网盘: https://pan.baidu.com/s/1YIV2avc_i5V8IcltWoFh1g  提取码：99k1


下载后，首先解压 venv.tar.gz 到当前目录venv下,结构如下

```
AIMedia  
  ├─venv
  ├─main.py
  ├─chrome
  ├─...
```

建议先**双击执行** update.bat 更新到**最新代码**(需要安装git)，然后右键点击 **以管理员权限运行** webui.bat 启动

启动后，会自动打开浏览器（如果打开是空白，建议换成 **Chrome** 或者 **Edge** 打开）

### 其他系统

不支持，仅支持window

## 安装部署 📥

### 前提条件

- 尽量不要使用 **中文路径**，避免出现一些无法预料的问题
- 请确保你的 **网络** 是正常的，VPN需要打开全局流量模式

#### ① 克隆代码

```shell
git clone https://github.com/Anning01/AIMedia.git
```

#### ② 修改配置文件

- 将 config.py 文件复制一份，命名为 local_config.py
- 按照 config.py 文件中的说明，配置好 zhipu_aip_key，如需要AI配图，打开enable 配置相关的 stable diffusion api


### 手动部署 📦

> 视频教程

- 完整的使用演示：B站视频链接：https://www.bilibili.com/video/BV1oYSVYaEaa/?share_source=copy_web&vd_source=998582dcaa6c1a862619086e9dda59cb
- 如何在Windows上部署：抓紧制作中 (*>﹏<*)′~

#### ① 创建虚拟环境 （Conda）

建议使用 [conda](https://www.anaconda.com/download/success) 创建 python 虚拟环境

```shell
git clone https://github.com/Anning01/AIMedia.git
cd AIMedia
conda create -n AIMedia python=3.12.4
conda activate AIMedia
pip install -r requirements.txt
```

#### ② 启动Web界面 🌐

注意需要到 AIMedia 项目 根目录 下执行以下命令

###### Windows

```bat
conda activate AIMedia
streamlit run main.py
```

#### ① 使用venv (请确定 python 版本 3.12.4)

```shell
git clone https://github.com/Anning01/AIMedia.git
cd AIMedia
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

#### ② 启动Web界面 🌐

注意需要到 AIMedia 项目 根目录 下执行以下命令

###### Windows

```bat
streamlit run main.py
或者
.\webui.bat（conda不可以这样执行）
```

> 注意：我们自动发布依赖chrome测试版，需要手动下载

下载地址：

- 百度网盘: 链接：https://pan.baidu.com/s/1x6J3K4KdWrI9vOG8yvSSBw  提取码：7jyw


模型下载后解压，整个目录放到 .\AIMedia 里面，
最终的文件路径应该是这样: .\AIMedia\chrome

## 反馈建议 📢

- 可以提交 [issue](https://github.com/Anning01/AIMedia/issues)
  或者 [pull request](https://github.com/Anning01/AIMedia/pulls)。


## 许可证 📝

点击查看 [LICENSE](LICENSE) 文件

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Anning01/AIMedia&type=Date)](https://star-history.com/#Anning01/AIMedia&Date)