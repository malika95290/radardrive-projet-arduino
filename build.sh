#!/usr/bin/env bash
# Script exécuté par Render à chaque déploiement
set -o errexit   # on s'arrête à la première erreur

pip install -r requirements.txt
python manage.py collectstatic --no-input   # rassemble le CSS/JS
python manage.py migrate                    # crée/met à jour les tables

# Crée le compte admin s'il n'existe pas encore
# (identifiants lus dans DJANGO_SUPERUSER_USERNAME / _EMAIL / _PASSWORD)
python manage.py createsuperuser --no-input || true
