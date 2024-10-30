@echo off
powershell -Command "chcp 65001"

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo 当前没有管理员权限。重新启动并请求管理员权限...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo 已以管理员权限运行。
set folder_to_delete=C:\selenium
echo 删除文件夹: %folder_to_delete%
if exist "%folder_to_delete%" (
    rmdir /s /q "%folder_to_delete%"
    echo 文件夹已删除
) else (
    echo 文件夹不存在
)

echo 进入脚本所在磁盘
set script_drive=%~d0
cd /d "%script_drive%"
echo 当前路径: %cd%

echo 进入脚本所在目录
cd /d "%~dp0"
echo 当前路径: %cd%

set venv_path=%cd%\venv\Scripts\activate.bat
echo 虚拟环境路径: %venv_path%
echo 进入虚拟环境: %venv_path%
if exist "%venv_path%" (
    call %venv_path%
    echo 虚拟环境已激活
) else (
    echo 虚拟环境路径不存在，尝试第二种方法...
    goto second_method
)

echo 运行 streamlit run main.py
echo 当前路径: %cd%
python -m streamlit run main.py

pause
exit /b

:second_method
echo 第二种方法: 进入虚拟环境
set venv_path=.\venv\Scripts\activate
echo 进入虚拟环境: %venv_path%
call %venv_path%

echo 运行 streamlit run main.py
echo 当前路径: %cd%
python -m streamlit run main.py

pause