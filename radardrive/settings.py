"""
Configuration du projet RadarDrive.

En local : base SQLite (fichier db.sqlite3), DEBUG activé.
Sur Render : base PostgreSQL (variable DATABASE_URL), DEBUG désactivé.
Les valeurs secrètes sont lues dans les variables d'environnement.
"""

import os
from pathlib import Path

import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

# --- Sécurité -------------------------------------------------------------

# Clé secrète Django : générée automatiquement par Render (voir render.yaml)
SECRET_KEY = os.environ.get("SECRET_KEY", "cle-de-dev-a-ne-pas-utiliser-en-ligne")

# DEBUG est activé en local, désactivé sur Render
DEBUG = "RENDER" not in os.environ

ALLOWED_HOSTS = ["localhost", "127.0.0.1"]
RENDER_HOST = os.environ.get("RENDER_EXTERNAL_HOSTNAME")
if RENDER_HOST:
    ALLOWED_HOSTS.append(RENDER_HOST)
    CSRF_TRUSTED_ORIGINS = ["https://" + RENDER_HOST]

# En ligne : on force le HTTPS (Render gère le certificat)
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# Clé partagée avec le script du PC : seules les requêtes qui la
# fournissent peuvent ajouter une mesure dans la base.
API_KEY = os.environ.get("API_KEY", "cle-api-locale")

# --- Infos du véhicule (un seul véhicule) ---------------------------------

NOM_SITE = "RadarDrive"
VEHICULE_IMMATRICULATION = "RD-042-CR"  # plaque fictive

# --- Applications ---------------------------------------------------------

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "vehicule",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # sert le CSS/JS en ligne
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "radardrive.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "vehicule.views.infos_site",  # nom du site + plaque dans toutes les pages
            ],
        },
    },
]

WSGI_APPLICATION = "radardrive.wsgi.application"

# --- Base de données ------------------------------------------------------
# Sans DATABASE_URL -> SQLite en local. Avec -> PostgreSQL de Render.

DATABASES = {
    "default": dj_database_url.config(
        default="sqlite:///" + str(BASE_DIR / "db.sqlite3"),
        conn_max_age=600,
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- Langue et heure ------------------------------------------------------

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Europe/Paris"
USE_I18N = True
USE_TZ = True

# --- Fichiers statiques (CSS, JS) -----------------------------------------

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
