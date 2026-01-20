from api.api_all import get_account_list
from utils.local_data import LocalData


class MaterialService:
    """素材服务类"""

    def __init__(self):
        self.local_data = LocalData()

    def get_material_list(self, status=None) -> list[dict]:
        """获取素材列表
        Args:
            status: 可选的状态过滤
        Returns:
            List[Dict]: 素材列表
        """
        materials = self.local_data.get_materials(status)
        accounts = [item["id"] for item in get_account_list()]
        result = []
        for material in materials:
            # 数据库列顺序：id, title, content, image_list, platform, account_id, nickname, status, upload_time
            if int(material[5]) in accounts:
                result.append(
                    {
                        "id": material[0],
                        "title": material[1],
                        "content": material[2],
                        "image_list": material[3].split("===") if material[3] else [],
                        "platform": material[4],
                        "account_id": material[5],
                        "nickname": material[6],
                        "status": material[7],
                        "upload_time": material[8],
                    }
                )
        return result

    def save_material(self, material_data):
        """保存素材"""
        try:
            # 将图片列表用===连接
            image_list = (
                "===".join(material_data["image_list"]) if material_data["image_list"] else ""
            )
            return self.local_data.insert_material(
                material_data["title"],
                material_data["content"],
                image_list,
                material_data["platform"],
                material_data["account_id"],
                material_data["nickname"],  # 添加昵称
            )
        except Exception as e:
            print(f"保存素材失败: {str(e)}")
            return None

    def get_material(self, material_id: int) -> dict:
        """获取单个素材
        Args:
            material_id: 素材ID
        Returns:
            Dict: 素材信息
        """
        material = self.local_data.get_material(material_id)
        if material:
            return {
                "id": material[0],
                "title": material[1],
                "content": material[2],
                "image_list": material[3].split(",") if material[3] else [],
                "platform": material[4],
                "account_id": material[5],
                "status": material[6],
                "upload_time": material[7],
            }
        return None

    def update_material_status(self, material_id: int, status: int) -> bool:
        """更新素材状态
        Args:
            material_id: 素材ID
            status: 新状态
        Returns:
            bool: 是否更新成功
        """
        try:
            self.local_data.update_material_status(material_id, status)
            return True
        except Exception as e:
            print(f"更新素材状态失败: {e}")
            return False

    def delete_material(self, material_id: int) -> bool:
        """删除素材
        Args:
            material_id: 素材ID
        Returns:
            bool: 是否删除成功
        """
        try:
            self.local_data.delete_material(material_id)
            return True
        except Exception as e:
            print(f"删除素材失败: {e}")
            return False

    def __del__(self):
        """析构函数，确保数据库连接被正确关闭"""
        if hasattr(self, "local_data"):
            self.local_data.close()
