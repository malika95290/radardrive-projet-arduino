from django.urls import path

from . import views

urlpatterns = [
    # Pages
    path("", views.accueil, name="accueil"),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("historique/", views.historique, name="historique"),
    # API
    path("api/mesures/", views.api_ajouter_mesure, name="api_ajouter_mesure"),
    path("api/dernieres/", views.api_dernieres_mesures, name="api_dernieres_mesures"),
]
