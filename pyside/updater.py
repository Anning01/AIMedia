import os
import sys
import json
import shutil
import time
import logging
import zipfile
from pathlib import Path
import subprocess

logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(message)s',
                   filename='update.log')

def update_app(zip_path: str, app_dir: str):
    """
    解压更新包并更新应用程序
    :param zip_path: ZIP文件路径
    :param app_dir: 应用程序目录
    """
    try:
        # 创建临时解压目录
        temp_dir = Path("temp_update")
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
        temp_dir.mkdir(parents=True)
        
        logging.info(f"开始解压更新包: {zip_path}")
        # 解压ZIP文件
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(str(temp_dir))
        
        # 等待主程序完全退出
        time.sleep(2)
        
        logging.info("开始复制文件")
        # 复制所有文件到应用程序目录
        for item in temp_dir.rglob("*"):
            if item.is_file():
                # 计算相对路径
                rel_path = item.relative_to(temp_dir)
                target_path = Path(app_dir) / rel_path
                
                # 确保目标目录存在
                target_path.parent.mkdir(parents=True, exist_ok=True)
                
                # 尝试删除旧文件
                if target_path.exists():
                    try:
                        target_path.unlink()
                    except PermissionError:
                        logging.warning(f"无法删除文件: {target_path}")
                        continue
                
                # 复制新文件
                shutil.copy2(item, target_path)
                logging.info(f"已更新: {rel_path}")
        
        logging.info("更新完成")
        
        # 清理临时文件
        shutil.rmtree(temp_dir)
        os.remove(zip_path)
        
        # 启动应用程序
        app_exe = Path(app_dir) / "AiMedia.exe"
        if app_exe.exists():
            subprocess.Popen([str(app_exe)], shell=True)
        
    except Exception as e:
        logging.error(f"更新失败: {str(e)}")
        raise

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: updater.py <zip_path> <app_dir>")
        sys.exit(1)
        
    zip_path = sys.argv[1]
    app_dir = sys.argv[2]
    
    update_app(zip_path, app_dir)
