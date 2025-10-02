# Register your models here.

from django.apps import apps
from django.contrib import admin

from utils.admin import SmartModelAdmin

# Register your models here.
application = apps.get_app_config(__package__.split(".")[1])

for model in application.get_models():
    modeladmin = type("Model", (SmartModelAdmin,), {})
    admin.site.register(model, modeladmin)
