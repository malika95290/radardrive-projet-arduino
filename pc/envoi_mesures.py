"""
RadarDrive — script du PC
Lit les mesures envoyées par l'Arduino sur le câble USB et les envoie au site.

Format attendu de l'Arduino (une ligne par mesure, PROVISOIRE : à valider avec Nirmala) :
    D:32;Z:1;V:58;A:RALENTIT;S:90
    D = distance en cm (D:- si rien n'est détecté)
    Z = zone (0, 1 ou 2)
    V = vitesse en % (0 à 100)
    A = action : AVANCE, RALENTIT, ARRET, PIVOT_G, PIVOT_D, DEMI_TOUR
    S = angle du servo : 90 = devant, 180 = à gauche, 0 = à droite

Utilisation :
    python envoi_mesures.py --port COM3                 (avec la voiture branchée)
    python envoi_mesures.py --simulation                (sans voiture : fausses mesures)
    python envoi_mesures.py --simulation --site https://radardrive.onrender.com --cle MA_CLE

Installation : pip install pyserial requests
"""

import argparse
import math
import random
import time

import requests

# Correspondance entre les actions envoyées par l'Arduino et celles du site
ACTIONS = {
    "AVANCE": "avance",
    "RALENTIT": "ralentit",
    "ARRET": "arret",
    "PIVOT_G": "pivot_gauche",
    "PIVOT_D": "pivot_droite",
    "DEMI_TOUR": "demi_tour",
}

INTERVALLE_ENVOI = 1.0  # on envoie au maximum 1 mesure par seconde...


def lire_ligne(ligne):
    """Transforme 'D:32;Z:1;V:58;A:RALENTIT;S:90' en dictionnaire. Renvoie None si la ligne est invalide."""
    try:
        morceaux = {}
        for morceau in ligne.strip().split(";"):
            cle, valeur = morceau.split(":")
            morceaux[cle.strip()] = valeur.strip()

        distance = None if morceaux["D"] in ("-", "") else float(morceaux["D"])
        return {
            "distance": distance,
            "zone": int(morceaux["Z"]),
            "vitesse": int(morceaux["V"]),
            "action": ACTIONS[morceaux["A"]],
            "angle_capteur": int(morceaux.get("S", 90)),
        }
    except (ValueError, KeyError):
        return None


def envoyer(mesure, site, cle):
    """Envoie une mesure au site. Renvoie True si elle a été enregistrée."""
    try:
        reponse = requests.post(
            site.rstrip("/") + "/api/mesures/",
            json=mesure,
            headers={"X-API-KEY": cle},
            timeout=70,  # le site gratuit Render peut mettre ~1 min à se réveiller
        )
        if reponse.status_code == 201:
            return True
        print("  Refusée par le site :", reponse.status_code, reponse.text)
    except requests.RequestException as erreur:
        print("  Site injoignable :", erreur)
    return False


def faut_il_envoyer(mesure, derniere_envoyee, instant_dernier_envoi):
    """...sauf si la zone ou l'action change : dans ce cas on envoie tout de suite."""
    if derniere_envoyee is None:
        return True
    if mesure["zone"] != derniere_envoyee["zone"] or mesure["action"] != derniere_envoyee["action"]:
        return True
    return time.time() - instant_dernier_envoi >= INTERVALLE_ENVOI


# ---------- Source 1 : la vraie voiture sur le câble USB ----------

def lignes_arduino(port):
    import serial  # importé ici pour que le mode simulation marche sans pyserial

    with serial.Serial(port, 9600, timeout=2) as liaison:
        print("Connectée à l'Arduino sur", port)
        while True:
            ligne = liaison.readline().decode("utf-8", errors="ignore")
            if ligne:
                yield ligne


# ---------- Source 2 : une voiture simulée (pour tester sans matériel) ----------

def lignes_simulees():
    """Fabrique un trajet réaliste : avance, voit un obstacle, ralentit, s'arrête, regarde, contourne."""
    print("Mode simulation : fausses mesures, Ctrl+C pour arrêter")
    while True:
        # Route libre pendant quelques secondes
        for _ in range(random.randint(4, 8)):
            yield "D:-;Z:0;V:100;A:AVANCE;S:90"
            time.sleep(0.5)

        # Un obstacle approche : la distance baisse, la voiture ralentit
        distance = random.randint(80, 120)
        while distance > 18:
            if distance > 50:
                yield f"D:{distance};Z:0;V:100;A:AVANCE;S:90"
            else:
                vitesse = max(25, int(100 * (distance - 20) / 30))
                yield f"D:{distance};Z:1;V:{vitesse};A:RALENTIT;S:90"
            distance -= random.randint(5, 9)
            time.sleep(0.5)

        # Trop près : arrêt, le capteur regarde à gauche puis à droite
        yield f"D:{distance};Z:2;V:0;A:ARRET;S:90"
        time.sleep(1)
        gauche = random.choice([None, random.randint(25, 120)])
        droite = random.choice([None, random.randint(25, 120)])
        for angle, mesure in ((170, gauche), (10, droite)):
            if mesure is None:
                yield f"D:-;Z:0;V:0;A:ARRET;S:{angle}"
            else:
                zone = 0 if mesure > 50 else (1 if mesure >= 20 else 2)
                yield f"D:{mesure};Z:{zone};V:0;A:ARRET;S:{angle}"
            time.sleep(1)

        # Pivot vers le côté le plus libre
        libre_gauche = math.inf if gauche is None else gauche
        libre_droite = math.inf if droite is None else droite
        action = "PIVOT_G" if libre_gauche >= libre_droite else "PIVOT_D"
        yield f"D:-;Z:0;V:60;A:{action};S:90"
        time.sleep(1)


# ---------- Programme principal ----------

def main():
    parametres = argparse.ArgumentParser(description="Envoie les mesures de la voiture au site RadarDrive")
    parametres.add_argument("--port", help="port USB de l'Arduino, ex. COM3 (Windows) ou /dev/ttyUSB0")
    parametres.add_argument("--simulation", action="store_true", help="envoie de fausses mesures")
    parametres.add_argument("--site", default="http://127.0.0.1:8000", help="adresse du site")
    parametres.add_argument("--cle", default="cle-api-locale", help="clé API (variable API_KEY sur Render)")
    args = parametres.parse_args()

    if args.simulation:
        source = lignes_simulees()
    elif args.port:
        source = lignes_arduino(args.port)
    else:
        parametres.error("indique --port COM3 ou --simulation")

    print("Envoi vers", args.site)
    derniere_envoyee = None
    instant_dernier_envoi = 0

    for ligne in source:
        mesure = lire_ligne(ligne)
        if mesure is None:
            print("Ligne ignorée :", ligne.strip())
            continue

        if faut_il_envoyer(mesure, derniere_envoyee, instant_dernier_envoi):
            if envoyer(mesure, args.site, args.cle):
                print("Envoyée :", mesure)
            derniere_envoyee = mesure
            instant_dernier_envoi = time.time()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nArrêt du script.")
