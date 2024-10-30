<div align="center">
<h1 align="center"> AIMedia 🤖 </h1>

<p align="center">
  <a href="https://github.com/Anning01/AIMedia/stargazers"><img src="https://img.shields.io/github/stars/Anning01/AIMedia.svg?style=for-the-badge" alt="Stargazers"></a>
  <a href="https://github.com/Anning01/AIMedia/issues"><img src="https://img.shields.io/github/issues/Anning01/AIMedia.svg?style=for-the-badge" alt="Issues"></a>
  <a href="https://github.com/Anning01/AIMedia/network/members"><img src="https://img.shields.io/github/forks/Anning01/AIMedia.svg?style=for-the-badge" alt="Forks"></a>
  <a href="https://github.com/Anning01/AIMedia/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Anning01/AIMedia.svg?style=for-the-badge" alt="License"></a>
</p>
<br>
<h3>简体中文 | <a href="README-en.md">English</a></h3>
<div align="center">
  <a href="https://github.com/Anning01/AIMedia" target="_blank"><img src="docs/logo.png" style="width: 120px; height: 120px; border-radius: 50%;"/></a>
</div>
<br>
Automatically crawl hot topics, generate news, and publish to various platforms.  <b>Fully automated AI media software</b> 
<br>
</div>

## 功能特性 🎯

- [x] Support **hot news crawling**, automatically crawl hot news from various platforms
    - [x] Douyin hot topics
    - [x] NetEase News
    - [ ] Weibo hot topics
- [x] Support **AI-generated news creation**, automatically publish to various platforms
    - [x] Toutiao
    - [ ] Xiaohongshu
    - [ ] WeChat Official Account
    - [ ] Baijia Platform
- [x] For text-only content without images, use AI to generate images, increase originality, and improve reading experience

### 后期计划 📅

- [ ] Automatically generate videos and publish to various platforms

## 交流讨论 💬

<img src="docs/wechat.png" width="250">

## 视频演示 📺

ps: Coming soon `(>﹏<)′~

## 配置要求 📦

- Recommended minimum CPU 4 cores or above, memory 8G or above, GPU not required
- Windows 10 or above

## 快速开始 🚀

ownload the one-click startup package, unzip and use directly (path should not contain **Chinese**、**characters**、**special characters**, or spaces）

### Windows
- Baidu Netdisk: https://pan.baidu.com/s/1YIV2avc_i5V8IcltWoFh1g  Extraction Code：99k1


After downloading, first unzip venv.tar.gz to the current directory venv, with the following structure:
```
AIMedia  
  ├─venv
  ├─main.py
  ├─chrome
  ├─...
```

It is recommended to **double-click** `update.bat` to update to the **latest code** (requires git installation), then right-click and **run as administrator** `webui.bat` to start.

After starting, the browser will automatically open (if it opens blank, it is recommended to switch to **Chrome** or **Edge**)

### 其他系统

Not supported, only supports Windows

## 安装部署 📥

### 前提条件

- 尽量不要使用 **中文路径**，避免出现一些无法预料的问题
- 请确保你的 **网络** 是正常的，VPN需要打开`全局流量`模式

#### ① 克隆代码

```shell
git clone https://github.com/Anning01/AIMedia.git
```

#### ② 修改配置文件

- 将 `config.py` 文件复制一份，命名为 `local_config.py`
- 按照 `config.py` 文件中的说明，配置好 `zhipu_aip_key`，如需要AI配图，打开enable 配置相关的 stable diffusion api


### 手动部署 📦

> 视频教程

- 完整的使用演示：抓紧制作中 `(*>﹏<*)′~
- 如何在Windows上部署：抓紧制作中 `(*>﹏<*)′~

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

注意需要到 AIMedia 项目 `根目录` 下执行以下命令

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

注意需要到 AIMedia 项目 `根目录` 下执行以下命令

###### Windows

```bat
streamlit run main.py
或者
.\webui.bat（conda不可以这样执行）
```

> 注意：我们自动发布依赖chrome测试版，需要手动下载

下载地址：

- 百度网盘: 链接：https://pan.baidu.com/s/1x6J3K4KdWrI9vOG8yvSSBw  提取码：7jyw


模型下载后解压，整个目录放到 `.\AIMedia` 里面，
最终的文件路径应该是这样: `.\AIMedia\chrome`

## 反馈建议 📢

- 可以提交 [issue](https://github.com/Anning01/AIMedia/issues)
  或者 [pull request](https://github.com/Anning01/AIMedia/pulls)。


## 许可证 📝

点击查看 [`LICENSE`](LICENSE) 文件

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Anning01/AIMedia&type=Date)](https://star-history.com/#Anning01/AIMedia&Date)