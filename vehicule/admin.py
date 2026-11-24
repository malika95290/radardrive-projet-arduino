from django.contrib import admin

from .models import Mesure


@admin.register(Mesure)
class MesureAdmin(admin.ModelAdmin):
    list_display = ["date", "distance", "zone", "vitesse", "action", "angle_capteur"]
    list_filter = ["zone", "action"]
