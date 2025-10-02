from datetime import datetime, timedelta
import json
import uuid
import time
from urllib.parse import urlencode
from django.db import transaction
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render, redirect
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.users.models import (
    ActivationCode,
    Accounts,
    AccountNews,
    Subscription,
    UserSubscriptionLog,
    WechatPayOrder, Users, AiArticle, UserNotice,
)
from apps.users.serializers import AiArticleSerializer
from utils import mixins, viewsets
from utils.ai_model.writing_assistant import WritingAssistant
from utils.common import generate_order_no
from utils.encipher import initialize_fernet, encrypt_string, generate_key_from_string
from utils.permissons import IsNotExpiredUser
from utils.redis_cli import rate_limit
from utils.response import error_response, success_response
from utils.wechatpay import WeChatPay
from wechatpy import WeChatOAuth


# Create your views here.

class AccountsViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsNotExpiredUser]

    def get_permissions(self):
        if self.action == "list":
            self.permission_classes = [IsAuthenticated]
        return super().get_permissions()

    def create(self, request, *args, **kwargs):
        # 获取请求中的 uid
        data = request.data.copy()
        uid = data.get("uid")
        # 检查是否存在相同的 uid
        account = Accounts.objects.filter(uid=uid).first()
        if account:
            account_count = Accounts.objects.filter(user=self.request.user).exclude(status=4).count()
            if self.request.user.level.level == 0 and account_count >= 5:
                return error_response(400, "普通用户最多只能绑定5个账号")
            # 因为uid是唯一约束 所以更新要去掉这个字段
            data.pop("uid", None)
            # 如果存在相同的 uid，则调用 update 方法更新记录
            serializer = self.get_serializer(account, data=data, partial=True)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)  # 执行更新操作
            return success_response(serializer.data, "账户创建成功")
        return super().create(request, *args, **kwargs)

    def perform_update(self, serializer):
        serializer.save(user=self.request.user)

    def perform_destroy(self, instance):
        instance.status = 4
        instance.save()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user).exclude(status=4)


class AccountNewsViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsNotExpiredUser]
    filterset_fields = [
        "status", "account__id"
    ]

    def get_permissions(self):
        if self.action == "list":
            self.permission_classes = [IsAuthenticated]
        return super().get_permissions()

    def get_queryset(self):
        query_set = super().get_queryset()
        if self.action == "list":
            # 性能优化 预取 account
            three_days_ago = datetime.now() - timedelta(days=3)
            return (
                query_set
                .prefetch_related("account")
                .exclude(account__status=4)
                .filter(account__user=self.request.user, created_at__gte=three_days_ago)
            )
        return query_set.filter(account__user=self.request.user)


class UsersViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [
        IsAuthenticated,
    ]

    def get_queryset(self):
        return [self.request.user]


class ActivationCodeView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    @rate_limit(user_limit=100, ip_limit=200)
    def post(self, request, *args, **kwargs):
        code = request.data.get("code", "")
        if code:
            activation_code = ActivationCode.objects.filter(
                code=code, status=True
            ).first()
            if activation_code:
                activation_code.use_time = datetime.now()
                activation_code.use_user = request.user
                activation_code.status = False
                activation_code.save()

                request.user.expiry_time += timedelta(days=activation_code.duration)
                request.user.save()
                return success_response()
        return error_response(400, "激活失败")


class CheckMember(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    def get(self, request, *args, **kwargs):
        if request.user.expiry_time < datetime.now():
            return error_response(2000, "会员已过期")
        return success_response()


def dashboard(request):
    # 支付
    """
    总用户数量
    会员数量
    总收款
    今日收款
    新闻总数量
    已发布新闻数量
    待发布新闻数量
    当前爬虫连接数量
    当前消费者连接数量
    """
    context = {"user_count": get_user_model().objects.count()}
    now = datetime.now()
    context["member_count"] = (
        get_user_model().objects.filter(expiry_time__gte=now).count()
    )
    context["total_income"] = WechatPayOrder.objects.filter(status=1).aggregate(Sum("amount"))["amount__sum"] or 0
    # 计算当日的金额
    today_start = datetime(now.year, now.month, now.day)
    context["today_income"] = \
        WechatPayOrder.objects.filter(status=1, created_at__gte=today_start).aggregate(Sum("amount"))[
            "amount__sum"] or 0
    context["news_count"] = AccountNews.objects.count()
    context["published_news_count"] = AccountNews.objects.filter(status=2).count()
    context["unpublished_news_count"] = AccountNews.objects.filter(status=0).count()
    # 今天新闻发布数量
    context["today_news_count"] = AccountNews.objects.filter(status=2, created_at__gte=today_start).count()
    # token总使用量
    context["token_count"] = AiArticle.objects.filter(enable=True).aggregate(Sum("use_token"))["use_token__sum"] or 0
    # token今日使用量
    context["today_token_count"] = \
        AiArticle.objects.filter(enable=True, created_at__gte=today_start).aggregate(Sum("use_token"))[
            "use_token__sum"] or 0
    return render(request, "dashboard.html", context)


def package(request):
    token = request.COOKIES.get('access_token')

    subscriptions = Subscription.objects.all()
    subscription_data = []
    for subscription in subscriptions:
        subscription_data.append(
            {
                "id": subscription.id,
                "name": subscription.name,
                "original_price": subscription.original_price,
                "price": subscription.price,
                "duration": subscription.duration,
                "contents": [
                    content.content
                    for content in subscription.subscriptioncontent_set.all()
                ],
            }
        )
    context = {
        "subscriptions": subscription_data,
    }
    if token:
        jwt_auth = JWTAuthentication()
        validated_token = jwt_auth.get_validated_token(token)
        user = jwt_auth.get_user(validated_token)
        if user:
            # 获取会员订阅服务
            context["pay_url"] = request.build_absolute_uri(reverse("wechat_login")).replace(
                "http://", "https://"
            )
            context["user_id"] = user.id
            context["user"] = user
    return render(request, "package.html", context)


def pay(request):
    subscription = request.GET.get("subscription")
    user_id = request.GET.get("user_id")
    openid = request.GET.get("openid")
    if openid and subscription and user_id:
        try:
            subscription = Subscription.objects.get(id=subscription)
        except Subscription.DoesNotExist:
            return HttpResponse("请选择正确的会员套餐")
        wechatpay = WeChatPay()
        order_no = generate_order_no("WX")
        code, message = wechatpay.pay_jsapi(order_no, subscription.price, openid)
        result = json.loads(message)
        if code in range(200, 300):
            prepay_id = result.get("prepay_id")
            timestamp = str(int(time.time()))
            noncestr = str(uuid.uuid4()).replace("-", "")
            package = "prepay_id=" + prepay_id
            sign = wechatpay.sign([wechatpay.APPID, timestamp, noncestr, package])
            signtype = "RSA"
            context = {
                "appId": wechatpay.APPID,
                "timeStamp": timestamp,
                "nonceStr": noncestr,
                "package": "prepay_id=%s" % prepay_id,
                "signType": signtype,
                "paySign": sign,
                "main_url": settings.main_url,
            }
            # 创建订单
            WechatPayOrder.objects.create(
                order_no=order_no, user_id=user_id, subscription=subscription, amount=subscription.price, status=0
            )
            return render(request, "pay.html", context)
        return HttpResponse(result.get("code"))
    return HttpResponse("请选择正确的会员套餐")


def wechat_login(request):
    subscription = request.GET.get("subscription")
    user_id = request.GET.get("user_id")
    if not subscription or not user_id:
        return HttpResponse("请选择正确的会员套餐")
    try:
        subscription = Subscription.objects.get(id=subscription)
    except Subscription.DoesNotExist:
        return HttpResponse("请选择正确的会员套餐")
    wechat_authorize_url = "https://open.weixin.qq.com/connect/oauth2/authorize"
    params = {
        "appid": settings.WECHAT_APPID,
        "redirect_uri": settings.WECHAT_REDIRECT_URI,
        "response_type": "code",
        "scope": "snsapi_base",  # 静默授权，仅获取openid
        "state": f"{subscription.id}_{user_id}",  # 可选
    }
    authorize_url = f"{wechat_authorize_url}?{urlencode(params)}#wechat_redirect"
    return redirect(authorize_url)


def wechat_callback(request):
    code = request.GET.get("code")
    state = request.GET.get("state")

    if not code:
        return JsonResponse({"error": "Missing code parameter"}, status=400)
    try:
        oauth = WeChatOAuth(
            settings.WECHAT_APPID, settings.WECHAT_SECRET, settings.WECHAT_REDIRECT_URI
        )
        oauth.fetch_access_token(code)
        openid = oauth.open_id
        url = request.build_absolute_uri(reverse("pay")).replace("http://", "https://")
        subscription_id, user_id = state.split("_")
        authorize_url = f"{url}?openid={openid}&subscription={subscription_id}&user_id={user_id}"
        return redirect(authorize_url)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def wx_notify(request):
    wechatpay = WeChatPay()
    notify_data = request.body.decode("utf-8")
    result = wechatpay.callback(request.headers, notify_data)
    if result and result.get("event_type") == "TRANSACTION.SUCCESS":
        resp = result.get("resource")
        appid = resp.get("appid")
        mchid = resp.get("mchid")
        out_trade_no = resp.get("out_trade_no")
        transaction_id = resp.get("transaction_id")
        trade_type = resp.get("trade_type")
        trade_state = resp.get("trade_state")
        trade_state_desc = resp.get("trade_state_desc")
        bank_type = resp.get("bank_type")
        attach = resp.get("attach")
        success_time = resp.get("success_time")
        payer = resp.get("payer")
        amount = resp.get("amount").get("total")
        amount = amount / 100
        with transaction.atomic():
            order = WechatPayOrder.objects.select_for_update().filter(
                order_no=out_trade_no,
                status=0  # 只处理未支付订单
            ).first()

            if order and order.amount == amount:  # 验证订单金额
                order.status = 1
                # 将success_time转换为naive datetime对象
                success_datetime = datetime.strptime(success_time, "%Y-%m-%dT%H:%M:%S%z").replace(tzinfo=None)
                order.pay_time = success_datetime
                order.transaction_id = transaction_id
                order.save()

                # 获取用户并更新会员有效期
                user = Users.objects.select_for_update().get(id=order.user_id)
                user.level = order.subscription.level
                now = datetime.now()
                if user.expiry_time and user.expiry_time > now:
                    user.expiry_time += timedelta(days=order.subscription.duration)
                else:
                    user.expiry_time = now + timedelta(days=order.subscription.duration)
                user.save()

                # 创建用户订阅日志
                UserSubscriptionLog.objects.create(
                    user=user,
                    subscription=order.subscription,
                    expiry_time=user.expiry_time
                )

        return JsonResponse({"code": "SUCCESS", "message": "成功"})
    return JsonResponse({"code": "FAILED", "message": "失败"})


class AiArticleView(APIView):

    def post(self, request):
        token = request.COOKIES.get('access_token')
        data = json.loads(request.body)
        # 获取url字段
        title = data.get('title')
        content = data.get('content')
        image_list = data.get('image_list')
        if token:
            jwt_auth = JWTAuthentication()
            validated_token = jwt_auth.get_validated_token(token)
            user = jwt_auth.get_user(validated_token)
            if user:
                text = title + "\n" + content
                assistant = WritingAssistant()
                result = assistant.generate_article(text)

                article = result["content"].replace("**", "").replace('### ', '')
                total_tokens = result.get('token_usage', {}).get('total_tokens', 0)

                # 使用 \n 分割两段 第一段是标题
                article_list = article.splitlines()

                new_title = article_list[0]
                new_content = "\n".join(article_list[1:]).strip()
                AiArticle.objects.create(
                    user=user,
                    original_title=title,
                    original_content=content,
                    new_title=new_title,
                    new_content=new_content,
                    image_list=image_list,
                    use_token=total_tokens,
                    enable=True
                )
                data = {
                    "modifiedContent": article,
                }
                return JsonResponse({"status": "success", "data": data}, status=200)
        return JsonResponse({"status": "error", "message": "未登录"}, status=401)


class AiArticleAPIView(APIView):
    queryset = AiArticle.objects.all()
    permission_classes = [
        IsAuthenticated,
    ]
    serializer_class = AiArticleSerializer

    def get(self, request):
        # 查找创建日期为当天的
        date = datetime.now()
        # 查找AiArticle创建日期为当天的use_token相加总和
        total_tokens = \
            AiArticle.objects.filter(user=request.user, enable=True, created_at__date=date.today()).aggregate(
                total_tokens=Sum('use_token')
            )['total_tokens'] or 0
        status = True
        if total_tokens >= self.request.user.level.allow_token:
            status = False
        return success_response(status)

    def post(self, request):
        data = request.data
        serializer = AiArticleSerializer(data=data)
        if serializer.is_valid():
            instance = serializer.save(user=request.user)
            serializer = AiArticleSerializer(instance, many=False)
            return success_response(serializer.data)
        return error_response(serializer.errors)


class GLMAPIView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    def get(self, request):
        # 查找创建日期为当天的
        date = datetime.now()
        # 查找AiArticle创建日期为当天的use_token相加总和
        total_tokens = \
            AiArticle.objects.filter(user=request.user, enable=True, created_at__date=date.today()).aggregate(
                total_tokens=Sum('use_token')
            )['total_tokens'] or 0
        if total_tokens >= self.request.user.level.allow_token:
            return success_response(False)

        key = generate_key_from_string(self.request.user.open_id)

        # 初始化加密器
        fernet = initialize_fernet(key)
        # 加密
        encrypted_text = encrypt_string(fernet, settings.GML_KEY)

        return success_response(encrypted_text)


class NoticeViewSet(
    mixins.ListModelMixin,
    viewsets.GenericViewSet
):
    permission_classes = [IsAuthenticated, ]

    def get_queryset(self):
        return super().get_queryset().filter(is_show=True)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def mark_as_read(self, request, *args, **kwargs):
        """
        自定义操作，用于用户标记公告为已读或未读。
        请求方式：POST
        请求URL：/notices/{id}/mark_as_read/
        """
        notice = self.get_object()
        user = request.user
        user_notice, created = UserNotice.objects.get_or_create(user=user, notice=notice)
        user_notice.is_read = True
        user_notice.save()
        return success_response()
