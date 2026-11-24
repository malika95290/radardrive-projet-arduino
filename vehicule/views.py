import json

from django.conf import settings
from django.core.paginator import Paginator
from django.http import JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from .models import Mesure

# Liste des actions acceptées, lue dans le modèle
ACTIONS_VALIDES = [code for code, nom in Mesure.ACTIONS]


def infos_site(request):
    """Rend le nom du site et la plaque disponibles dans tous les templates."""
    return {
        "nom_site": settings.NOM_SITE,
        "immatriculation": settings.VEHICULE_IMMATRICULATION,
    }


# --- Pages ----------------------------------------------------------------

def accueil(request):
    return render(request, "vehicule/accueil.html")


def dashboard(request):
    return render(request, "vehicule/dashboard.html")


def historique(request):
    """Toutes les mesures, 50 par page, avec un filtre facultatif par zone."""
    mesures = Mesure.objects.all()

    # Filtre : /historique/?zone=1 n'affiche que la zone 1
    zone_choisie = request.GET.get("zone", "")
    if zone_choisie in ("0", "1", "2"):
        mesures = mesures.filter(zone=int(zone_choisie))

    pagination = Paginator(mesures, 50)
    page = pagination.get_page(request.GET.get("page"))

    return render(request, "vehicule/historique.html", {
        "page": page,
        "zone_choisie": zone_choisie,
        "total": pagination.count,
    })


# --- API ------------------------------------------------------------------

@csrf_exempt   # le script du PC n'a pas de jeton CSRF : on vérifie la clé API à la place
@require_POST
def api_ajouter_mesure(request):
    """Reçoit une mesure en JSON depuis le script du PC et l'enregistre."""

    # 1. Vérifier la clé API
    if request.headers.get("X-API-KEY") != settings.API_KEY:
        return JsonResponse({"erreur": "cle API invalide"}, status=403)

    # 2. Lire le JSON envoyé
    try:
        donnees = json.loads(request.body)
        zone = int(donnees["zone"])
        vitesse = int(donnees["vitesse"])
        action = donnees.get("action", "avance")
        angle = int(donnees.get("angle_capteur", 90))
        distance = donnees.get("distance")  # None si rien n'est détecté
        if distance is not None:
            distance = float(distance)
    except (ValueError, KeyError, TypeError):
        return JsonResponse({"erreur": "donnees invalides"}, status=400)

    # 3. Vérifier que les valeurs ont du sens
    if zone not in (0, 1, 2):
        return JsonResponse({"erreur": "zone doit valoir 0, 1 ou 2"}, status=400)
    if not 0 <= vitesse <= 100:
        return JsonResponse({"erreur": "vitesse entre 0 et 100"}, status=400)
    if not 0 <= angle <= 180:
        return JsonResponse({"erreur": "angle entre 0 et 180"}, status=400)
    if action not in ACTIONS_VALIDES:
        return JsonResponse({"erreur": "action inconnue"}, status=400)

    # 4. Enregistrer
    mesure = Mesure.objects.create(
        distance=distance, zone=zone, vitesse=vitesse,
        action=action, angle_capteur=angle,
    )
    return JsonResponse({"ok": True, "id": mesure.id}, status=201)


@require_GET
def api_dernieres_mesures(request):
    """Renvoie les 120 dernières mesures en JSON. Le dashboard les lit toutes les secondes."""

    dernieres = Mesure.objects.all()[:120]  # déjà triées de la plus récente à la plus ancienne

    liste = []
    for m in dernieres:
        date_locale = timezone.localtime(m.date)
        liste.append({
            "horodatage": m.date.timestamp(),  # en secondes, pour les calculs en JavaScript
            "date": date_locale.strftime("%d/%m/%Y %H:%M:%S"),
            "distance": m.distance,
            "zone": m.zone,
            "vitesse": m.vitesse,
            "action": m.action,
            "angle_capteur": m.angle_capteur,
        })

    return JsonResponse({"maintenant": timezone.now().timestamp(), "mesures": liste})
