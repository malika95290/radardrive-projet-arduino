# RadarDrive

Site de suivi en direct de la voiture autonome du projet (Arduino + capteur ultrason).
La voiture envoie ses mesures par câble USB à un PC, qui les transmet au site.

```
Arduino --USB--> pc/envoi_mesures.py --internet--> site Django (Render) --> base PostgreSQL
```

## Structure

```
radardrive/            réglages du projet Django (settings.py, urls.py)
vehicule/              l'application
  models.py            table Mesure : date, distance, zone, vitesse, action, angle_capteur
  views.py             pages (accueil, dashboard, historique) + API
  templates/vehicule/  pages HTML
  static/vehicule/     style.css + dashboard.js (mise à jour toutes les secondes)
pc/envoi_mesures.py    script du PC : lit l'USB et envoie au site (ou simule la voiture)
render.yaml, build.sh  déploiement sur Render
```

## Lancer le site en local

```bash
python -m venv .venv
.venv\Scripts\activate            # Windows  (Mac/Linux : source .venv/bin/activate)
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser   # compte pour /admin
python manage.py runserver
```

Ouvrir http://127.0.0.1:8000. Dans un 2e terminal, simuler la voiture :

```bash
pip install -r pc/requirements.txt
python pc/envoi_mesures.py --simulation
```

## Mettre en ligne sur Render (gratuit)

1. Pousser le projet sur GitHub (dépôt public).
2. Sur https://dashboard.render.com : **New > Blueprint**, choisir le dépôt.
   Render lit `render.yaml` et crée le site **et** la base PostgreSQL.
3. Remplir les 3 variables demandées : `DJANGO_SUPERUSER_USERNAME`, `DJANGO_SUPERUSER_EMAIL`,
   `DJANGO_SUPERUSER_PASSWORD` (compte admin créé au déploiement).
4. Attendre la fin du déploiement, puis ouvrir l'adresse `https://radardrive-xxxx.onrender.com`.
5. Récupérer la clé API : service **radardrive > Environment > API_KEY**.

Envoyer les mesures au site en ligne :

```bash
python pc/envoi_mesures.py --port COM3 --site https://radardrive-xxxx.onrender.com --cle LA_CLE_API
```

### Limites du plan gratuit

- Le site s'endort après 15 min sans visite et met ~1 min à se réveiller :
  **l'ouvrir quelques minutes avant la soutenance.**
- La base gratuite expire 30 jours après sa création : la créer après le 25/11
  pour qu'elle tienne jusqu'au rendu.

## Format des messages de l'Arduino (provisoire)

Une ligne par mesure, à 9600 bauds :

```
D:32;Z:1;V:58;A:RALENTIT;S:90
```

| Clé | Sens | Valeurs |
| --- | --- | --- |
| D | distance en cm | nombre, ou `-` si rien n'est détecté |
| Z | zone | 0 (> 50 cm), 1 (20 à 50 cm), 2 (< 20 cm) |
| V | vitesse | 0 à 100 (% de puissance) |
| A | action | AVANCE, RALENTIT, ARRET, PIVOT_G, PIVOT_D, DEMI_TOUR |
| S | angle du servo | 90 devant, 180 à gauche, 0 à droite |

## Réglages de la carte du trajet

La voiture n'a pas de GPS : sa position est **estimée** (navigation à l'estime).
Après avoir chronométré la voiture, ajuster en haut de `vehicule/static/vehicule/js/dashboard.js` :

- `VITESSE_MAX_CM_PAR_S` : distance parcourue en 1 s à 100 %
- `ANGLE_PIVOT` : angle réel d'un pivot
