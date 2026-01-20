from rest_framework.pagination import (
    PageNumberPagination as OriginPageNumberPagination,
)
from rest_framework.pagination import (
    _positive_int,
)


class PageNumberPagination(OriginPageNumberPagination):
    """分页器"""

    max_page_size = 200
    page_size = 10
    page_query_param = "page"
    page_size_query_param = "size"

    def get_page_size(self, request):
        """
        重写此方法是为了支持以下场景

        - 当传入的数据包含分页参数时，返回对应的分页数据结构
        - 当传入的数据不包含分页参数时，也返回分页数据的数据结构
        """
        if self.page_size_query_param:
            try:
                return _positive_int(
                    request.query_params[self.page_size_query_param],
                    strict=True,
                    cutoff=self.max_page_size,
                )
            except (KeyError, ValueError):
                pass
        return self.page_size
