from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),   # interface d'administration Django
    path("", include("vehicule.urls")),  # pages du site + API
]
