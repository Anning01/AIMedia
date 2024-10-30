@echo off

REM 使用 PowerShell 设置终端输出为 UTF-8 编码
powershell -Command "chcp 65001"

@echo off
REM 检查是否具有管理员权限
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo 当前没有管理员权限。重新启动并请求管理员权限...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo 已以管理员权限运行。
REM 删除 C 盘里的一个文件夹
set folder_to_delete=C:\selenium
echo 删除文件夹: %folder_to_delete%
if exist "%folder_to_delete%" (
    rmdir /s /q "%folder_to_delete%"
    echo 文件夹已删除
) else (
    echo 文件夹不存在
)

REM 进入虚拟环境
set venv_path=.\venv\Scripts\activate
echo 进入虚拟环境: %venv_path%
call %venv_path%

REM 运行 streamlit run main.py
echo 运行 streamlit run main.py
python -m streamlit run main.py

pause