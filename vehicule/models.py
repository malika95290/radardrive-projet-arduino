from django.db import models


class Mesure(models.Model):
    """Une mesure envoyée par la voiture (Arduino -> câble USB -> script du PC -> site)."""

    ZONES = [
        (0, "Zone 0 - Route libre (> 50 cm)"),
        (1, "Zone 1 - Obstacle proche (20 à 50 cm)"),
        (2, "Zone 2 - Obstacle très proche (< 20 cm)"),
    ]

    ACTIONS = [
        ("avance", "Avance"),
        ("ralentit", "Ralentit"),
        ("arret", "Arrêt"),
        ("pivot_gauche", "Pivote à gauche"),
        ("pivot_droite", "Pivote à droite"),
        ("demi_tour", "Demi-tour"),
    ]

    # Date et heure de réception, remplie automatiquement par Django
    date = models.DateTimeField(auto_now_add=True)

    # Distance en cm. Vide quand le capteur ne détecte rien (route libre)
    distance = models.FloatField(null=True, blank=True)

    # 0, 1 ou 2 (voir ZONES)
    zone = models.PositiveSmallIntegerField(choices=ZONES)

    # Puissance des moteurs en % (0 à 100)
    vitesse = models.PositiveSmallIntegerField()

    # Ce que fait la voiture au moment de la mesure (voir ACTIONS)
    action = models.CharField(max_length=20, choices=ACTIONS, default="avance")

    # Direction du capteur sur le servo : 90 = devant, 180 = à gauche, 0 = à droite
    angle_capteur = models.PositiveSmallIntegerField(default=90)

    class Meta:
        ordering = ["-date"]  # les plus récentes en premier

    def __str__(self):
        return f"{self.date:%d/%m %H:%M:%S} - {self.distance} cm - zone {self.zone}"
