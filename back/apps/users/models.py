from django.contrib.auth.models import AbstractUser
from django.db import models

# Create your models here.

from django.contrib.auth.models import BaseUserManager

from utils.models import BaseModel


class CustomUserManager(BaseUserManager):
    def create_user(self, phone, password=None, **extra_fields):
        """
        创建普通用户
        """
        if not phone:
            raise ValueError("The Phone field must be set")
        # 设置默认字段
        extra_fields.setdefault("is_active", True)
        user = self.model(phone=phone, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, phone, password=None, **extra_fields):
        """
        创建超级用户
        """
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if not extra_fields.get("is_staff"):
            raise ValueError("Superuser must have is_staff=True.")
        if not extra_fields.get("is_superuser"):
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(phone, password, **extra_fields)


# 扩展用户表
class Users(AbstractUser):
    # 增加一个字段
    username = None  # 删除默认的 username 字段
    open_id = models.CharField(max_length=100, unique=True, db_index=True, verbose_name="微信OpenID")
    nickname = models.CharField(
        max_length=50, default="", verbose_name="昵称"
    )
    avatar = models.URLField(max_length=200, blank=True, verbose_name='头像URL')
    phone = models.CharField(
        max_length=20, default="", verbose_name="手机号"
    )

    expiry_time = models.DateTimeField(blank=True, null=True, verbose_name="到期时间")
    user = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="parent_user",
        null=True,
        blank=True,
        verbose_name="推荐人",
    )
    level = models.ForeignKey(
        "Level",
        on_delete=models.SET_NULL,
        related_name="user_level",
        null=True,
        blank=True,
        verbose_name="用户等级",
    )

    USERNAME_FIELD = "open_id"  # 使用 open_id 作为登录标识
    REQUIRED_FIELDS = []  # 去除 username 的必填要求
    objects = CustomUserManager()  # 指定自定义的用户管理器

    class Meta:
        verbose_name = "1.用户管理"
        verbose_name_plural = verbose_name
        ordering = ["-id"]

    def __str__(self):
        return self.nickname


class Level(BaseModel):
    LEVEL_CHOICES = (
        (0, "普通用户"),
        (1, "VIP用户"),
        (2, "SVIP用户"),
    )
    level = models.PositiveSmallIntegerField(
        choices=LEVEL_CHOICES, default=0, verbose_name="等级"
    )
    # 允许消耗token
    allow_token = models.PositiveIntegerField(default=0, verbose_name="允许消耗token")

    class Meta:
        verbose_name = "用户等级"
        verbose_name_plural = verbose_name
        ordering = ["-level"]

    def __str__(self):
        return self.get_level_display()


class Accounts(BaseModel):
    STATUS_CHOICES = (
        (0, "等待任务中"),
        (1, "发布任务中"),
        (2, "账号发布异常"),
        (3, "账号到期"),
        (4, "账号删除"),
    )
    PLATFORM_CHOICES = ((0, "头条号"), (1, "百家号"), (2, "企鹅号"), (3, "微信公众号"))
    user = models.ForeignKey(Users, on_delete=models.CASCADE, verbose_name="用户")
    platform = models.PositiveSmallIntegerField(
        choices=PLATFORM_CHOICES, default=0, verbose_name="平台"
    )
    expiry_time = models.DateTimeField(verbose_name="到期时间")
    nickname = models.CharField(max_length=50, verbose_name="昵称")
    news_category = models.ManyToManyField(
        "crawlers.NewsCategory",
        related_name="accounts_categories",
        verbose_name="对应新闻分类",
    )
    cookie = models.JSONField(default=list, verbose_name="cookie")
    uid = models.CharField(max_length=100, unique=True, verbose_name="uid")
    status = models.PositiveSmallIntegerField(
        choices=STATUS_CHOICES, default=0, verbose_name="状态"
    )
    openid = models.CharField(
        max_length=100, null=True, blank=True, verbose_name="openid"
    )
    # 每天发布数量
    daily_publish_count = models.PositiveSmallIntegerField(default=15, verbose_name="每天发布数量")

    class Meta:
        verbose_name = "2.账户管理"
        verbose_name_plural = verbose_name
        ordering = ["-id"]

    def __str__(self):
        return self.nickname


class AccountNews(BaseModel):
    STATUS_CHOICES = (
        (0, "已配置"),
        (1, "已生成"),
        (2, "已发布"),
        (3, "任务失败"),
        (4, "已删除"),
        (5, "生产中"),
    )
    # 由于考虑到托管生产，所以有托管生产的文章暂不绑定到account，而是由调度平台来分配，因此可以为null
    account = models.ForeignKey(
        Accounts, on_delete=models.SET_NULL, blank=True, null=True, verbose_name="账户"
    )
    # 冗余数据，各个平台的详细数据json
    platform_data = models.JSONField(default=dict, verbose_name="平台数据")
    pub_date = models.DateField(auto_now_add=True, verbose_name="配置日期")
    status = models.PositiveSmallIntegerField(
        choices=STATUS_CHOICES, default=0, verbose_name="状态"
    )

    title = models.CharField(max_length=255, unique=True, verbose_name="文章标题")
    article_url = models.URLField(unique=True, verbose_name="文章链接")
    cover_url = models.URLField(blank=True, null=True, verbose_name="封面链接")
    date_str = models.DateTimeField(null=True, blank=True, verbose_name="文章发布时间")
    article_info = models.TextField(verbose_name="文章内容")
    img_list = models.JSONField(default=list, verbose_name="图片列表")
    published_at = models.DateTimeField(null=True, blank=True, verbose_name="发布时间")

    class Meta:
        verbose_name = "3.账户新闻"
        verbose_name_plural = verbose_name
        ordering = ["-id"]


class ActivationCode(BaseModel):
    user = models.ForeignKey(
        Users, on_delete=models.CASCADE, db_index=True, verbose_name="创建用户"
    )
    code = models.CharField(max_length=50, unique=True, verbose_name="激活码")
    use_time = models.DateTimeField(blank=True, null=True, verbose_name="使用时间")
    use_user = models.ForeignKey(
        Users,
        on_delete=models.CASCADE,
        db_index=True,
        null=True,
        blank=True,
        related_name="use_user",
        verbose_name="使用用户",
    )
    duration = models.PositiveSmallIntegerField(verbose_name="有效期")
    status = models.BooleanField(default=True, verbose_name="状态")
    remark = models.CharField(max_length=50, verbose_name="备注")

    class Meta:
        verbose_name = "激活码管理"
        verbose_name_plural = verbose_name
        ordering = ["-id"]

    def __str__(self):
        return self.code


class Subscription(BaseModel):
    """
    会员订阅服务
    """

    name = models.CharField(max_length=50, verbose_name="名称")
    original_price = models.PositiveSmallIntegerField(verbose_name="原价")
    price = models.PositiveSmallIntegerField(verbose_name="价格")
    duration = models.PositiveSmallIntegerField(verbose_name="有效期(天)")
    level = models.ForeignKey(
        "Level", on_delete=models.CASCADE, verbose_name="对应会员等级"
    )

    class Meta:
        verbose_name = "会员订阅服务"
        verbose_name_plural = verbose_name
        ordering = ["-id"]

    def __str__(self):
        return self.name


class SubscriptionContent(BaseModel):
    subscription = models.ForeignKey(
        Subscription, on_delete=models.CASCADE, verbose_name="订阅服务"
    )
    content = models.CharField(max_length=255, verbose_name="内容")

    class Meta:
        verbose_name = "会员订阅服务内容"
        verbose_name_plural = verbose_name
        ordering = ["-id"]

    def __str__(self):
        return self.content


class WechatPayOrder(BaseModel):
    """
    微信支付订单
    """

    STATUS_CHOICES = ((0, "未支付"), (1, "已支付"), (2, "支付失败"))
    order_no = models.CharField(max_length=50, unique=True, verbose_name="订单号")
    transaction_id = models.CharField(
        max_length=50, null=True, blank=True, verbose_name="微信订单号"
    )
    user = models.ForeignKey(Users, on_delete=models.CASCADE, verbose_name="用户")
    subscription = models.ForeignKey(
        Subscription, on_delete=models.CASCADE, verbose_name="订阅服务"
    )
    amount = models.PositiveSmallIntegerField(verbose_name="金额")
    status = models.PositiveSmallIntegerField(
        choices=STATUS_CHOICES, default=0, verbose_name="状态"
    )
    pay_time = models.DateTimeField(null=True, blank=True, verbose_name="支付时间")
    remark = models.CharField(max_length=255, default="", verbose_name="备注")

    class Meta:
        verbose_name = "微信支付订单"
        verbose_name_plural = verbose_name
        ordering = ["-id"]

    def __str__(self):
        return self.order_no


class UserSubscriptionLog(BaseModel):
    user = models.ForeignKey(Users, on_delete=models.CASCADE, verbose_name="用户")
    subscription = models.ForeignKey(
        Subscription, on_delete=models.CASCADE, verbose_name="订阅服务"
    )
    expiry_time = models.DateTimeField(verbose_name="到期时间")

    class Meta:
        verbose_name = "用户订阅记录"
        verbose_name_plural = verbose_name
        ordering = ["-id"]

    def __str__(self):
        return f"{self.user.phone} - {self.subscription.name}"


class AiArticle(BaseModel):
    """Ai生成文章"""
    original_title = models.CharField(max_length=100, verbose_name="原始标题")
    new_title = models.CharField(max_length=100, verbose_name="新标题")
    original_content = models.TextField(verbose_name="原始内容")
    image_list = models.JSONField(default=list, verbose_name="图片列表")
    new_content = models.TextField(verbose_name="新内容")
    use_token = models.IntegerField(default=0, verbose_name="使用token")
    user = models.ForeignKey(Users, on_delete=models.CASCADE, verbose_name="用户")
    enable = models.BooleanField(default=False, verbose_name="是否使用系统KEY")

    class Meta:
        verbose_name = "AI文章"
        verbose_name_plural = verbose_name
        ordering = ["-id"]


class Notice(BaseModel):
    title = models.CharField(max_length=100, verbose_name="标题")
    content = models.TextField(verbose_name="内容")
    is_show = models.BooleanField(default=True, verbose_name="是否显示")
    is_top = models.BooleanField(default=False, verbose_name="是否置顶")
    # 添加与公告的多对多关系，通过 UserNotice 关联模型
    users = models.ManyToManyField(
        'Users',
        through='UserNotice',
        related_name='notices',
        verbose_name="公告阅读状态"
    )

    class Meta:
        verbose_name = "公告消息"
        verbose_name_plural = verbose_name
        ordering = ["is_top", "-id"]

    def __str__(self):
        return self.title


class UserNotice(models.Model):
    user = models.ForeignKey(Users, on_delete=models.CASCADE, verbose_name="用户")
    notice = models.ForeignKey('Notice', on_delete=models.CASCADE, verbose_name="公告")
    is_read = models.BooleanField(default=False, verbose_name="是否已读")
    read_time = models.DateTimeField(auto_now=True, verbose_name="阅读时间")

    class Meta:
        verbose_name = "用户公告阅读状态"
        verbose_name_plural = verbose_name
        unique_together = ('user', 'notice')  # 确保每个用户和公告组合唯一

    def __str__(self):
        return f"{self.user.nickname} - {self.notice.title} - {'已读' if self.is_read else '未读'}"