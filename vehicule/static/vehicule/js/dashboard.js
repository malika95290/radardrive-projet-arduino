/* =========================================================
   RadarDrive — mise à jour du dashboard
   Toutes les secondes : on demande les dernières mesures au site
   (URL_API, définie dans dashboard.html), puis on redessine tout.
   ========================================================= */

// ---------- Réglages à ajuster après avoir chronométré la voiture ----------
const VITESSE_MAX_CM_PAR_S = 40;   // distance parcourue en 1 s à 100 % de puissance
const ANGLE_PIVOT = 90;            // angle d'un pivot à gauche ou à droite (en degrés)
const PIXELS_PAR_CM = 2.2;         // échelle de la carte
const FENETRE_SECONDES = 60;       // durée affichée sur la carte et le graphique
const DISTANCE_MAX_GRAPHIQUE = 150; // haut du graphique, en cm
const DELAI_DECONNEXION = 5;       // sans mesure depuis 5 s -> "Déconnectée"
const TAILLE_VOITURE = 0.95;       // taille du dessin de la voiture sur la carte
const AVANT_VOITURE_PX = 82 * TAILLE_VOITURE; // du centre de la voiture à son pare-chocs avant (capteur)
const RAYON_CONE_PX = 20;          // demi-largeur de la base du cône de chantier

// Textes et couleurs de chaque zone
const ZONES = {
    0: { titre: "Route libre", explication: "Zone 0 · la voiture avance normalement", couleur: "#2e9e6b" },
    1: { titre: "Obstacle proche", explication: "Zone 1 · la voiture ralentit", couleur: "#e08a1e" },
    2: { titre: "Obstacle très proche", explication: "Zone 2 · arrêt et contournement", couleur: "#d6453d" },
};


// ---------- Boucle principale ----------

async function mettreAJour() {
    try {
        const reponse = await fetch(URL_API);
        const donnees = await reponse.json();
        const mesures = donnees.mesures; // de la plus récente à la plus ancienne

        afficherStatut(mesures, donnees.maintenant);
        if (mesures.length === 0) return;

        const derniere = mesures[0];
        afficherVitesse(derniere.vitesse);
        afficherZone(derniere);
        afficherPhares(derniere.phares);
        afficherRecul(derniere.feux_recul);
        afficherTableau(mesures.slice(0, 10));

        // Pour le graphique et la carte : seulement la fenêtre des 60 dernières secondes,
        // remise dans l'ordre chronologique (de la plus ancienne à la plus récente)
        const debut = derniere.horodatage - FENETRE_SECONDES;
        const recentes = mesures.filter(m => m.horodatage >= debut).reverse();
        afficherGraphique(recentes, derniere.horodatage);
        afficherCarte(recentes);
    } catch (erreur) {
        document.getElementById("texte-statut").textContent = "Site injoignable";
        document.getElementById("point-statut").className = "point deconnecte";
    }
}

mettreAJour();
setInterval(mettreAJour, 1000);


// ---------- En-tête : voiture connectée ou non ----------

function afficherStatut(mesures, maintenant) {
    const point = document.getElementById("point-statut");
    const texte = document.getElementById("texte-statut");

    if (mesures.length === 0) {
        point.className = "point";
        texte.textContent = "En attente de données…";
        return;
    }

    const age = Math.round(maintenant - mesures[0].horodatage);
    if (age <= DELAI_DECONNEXION) {
        point.className = "point connecte";
        texte.textContent = "Connectée · il y a " + Math.max(age, 0) + " s";
    } else {
        point.className = "point deconnecte";
        texte.textContent = "Déconnectée · dernière mesure il y a " + formaterDuree(age);
    }
}

function formaterDuree(secondes) {
    if (secondes < 60) return secondes + " s";
    if (secondes < 3600) return Math.floor(secondes / 60) + " min";
    return Math.floor(secondes / 3600) + " h";
}


// ---------- Compteur de vitesse ----------

function afficherVitesse(vitesse) {
    // L'arc complet (3/4 de cercle) mesure 339,3 : on en remplit la part de la vitesse
    const longueur = (vitesse / 100) * 339.3;
    const arc = document.getElementById("arc-vitesse");
    arc.setAttribute("stroke-dasharray", longueur + " 452.4");
    arc.style.opacity = vitesse === 0 ? 0 : 1; // à 0 %, on cache l'arc (sinon un petit point reste visible)
    document.getElementById("texte-vitesse").textContent = vitesse + "%";
}


// ---------- Zone de détection ----------

function afficherZone(mesure) {
    const zone = ZONES[mesure.zone];
    document.getElementById("zone-titre").className = "zone-titre z" + mesure.zone;
    document.getElementById("zone-nom").textContent = zone.titre;
    document.getElementById("zone-explication").textContent = zone.explication;
    document.getElementById("zone-distance").textContent = texteDistance(mesure.distance);
}

function texteDistance(distance) {
    if (distance === null) return "—";
    return Math.round(distance) + " cm";
}


// ---------- Phares et feux de recul ----------

function afficherPhares(allumes) {
    document.getElementById("phares").className = allumes ? "voyant allume" : "voyant";
    document.getElementById("texte-phares").textContent = allumes ? "Allumés" : "Éteints";
}

// Les feux de recul sont allumés quand la voiture fait marche arrière (action "recule")
function afficherRecul(allumes) {
    document.getElementById("recul").className = allumes ? "voyant allume" : "voyant";
    document.getElementById("texte-recul").textContent = allumes ? "Allumés" : "Éteints";
}


// ---------- Tableau des 10 dernières mesures ----------

function afficherTableau(mesures) {
    let lignes = "";
    for (const m of mesures) {
        lignes += `<tr>
            <td>${m.date}</td>
            <td>${texteDistance(m.distance)}</td>
            <td><span class="pastille z${m.zone}">Zone ${m.zone}</span></td>
            <td>${m.vitesse} %</td>
        </tr>`;
    }
    document.getElementById("tableau-mesures").innerHTML = lignes;
}


// ---------- Graphique : distance dans le temps ----------

function afficherGraphique(mesures, finFenetre) {
    // Le graphique s'adapte à la place disponible dans la carte
    const graphique = document.getElementById("graphique");
    const largeur = graphique.clientWidth || 880, hauteur = graphique.clientHeight || 190;
    graphique.setAttribute("viewBox", `0 0 ${largeur} ${hauteur}`);
    const gauche = 40, bas = 24, haut = 10;

    // Conversion temps -> x et distance -> y
    const x = t => gauche + (largeur - gauche) * (1 - (finFenetre - t) / FENETRE_SECONDES);
    const y = d => hauteur - bas - (Math.min(d, DISTANCE_MAX_GRAPHIQUE) / DISTANCE_MAX_GRAPHIQUE) * (hauteur - bas - haut);

    let svg = "";

    // Lignes horizontales et graduations
    for (const valeur of [0, 50, 100, 150]) {
        svg += `<line x1="${gauche}" x2="${largeur}" y1="${y(valeur)}" y2="${y(valeur)}" stroke="#eef1f5"/>`;
        svg += `<text x="0" y="${y(valeur) + 4}" fill="#6b7689" font-size="11">${valeur}</text>`;
    }

    // Seuils des zones
    svg += `<line x1="${gauche}" x2="${largeur}" y1="${y(50)}" y2="${y(50)}" stroke="#e08a1e" stroke-dasharray="5 5"/>`;
    svg += `<text x="${gauche + 6}" y="${y(50) - 5}" fill="#e08a1e" font-size="11">seuil zone 1 · 50 cm</text>`;
    svg += `<line x1="${gauche}" x2="${largeur}" y1="${y(20)}" y2="${y(20)}" stroke="#d6453d" stroke-dasharray="5 5"/>`;
    svg += `<text x="${gauche + 6}" y="${y(20) + 14}" fill="#d6453d" font-size="11">seuil zone 2 · 20 cm</text>`;

    // Courbe : une mesure sans obstacle (distance vide) est dessinée en haut du graphique
    if (mesures.length > 0) {
        let points = "";
        for (const m of mesures) {
            const distance = m.distance === null ? DISTANCE_MAX_GRAPHIQUE : m.distance;
            points += x(m.horodatage) + "," + y(distance) + " ";
        }
        const premier = x(mesures[0].horodatage);
        const dernier = x(mesures[mesures.length - 1].horodatage);
        svg += `<polygon points="${premier},${y(0)} ${points} ${dernier},${y(0)}" fill="#3b9ee8" opacity="0.10"/>`;
        svg += `<polyline points="${points}" fill="none" stroke="#3b9ee8" stroke-width="2.5" stroke-linejoin="round"/>`;

        const fin = mesures[mesures.length - 1];
        const distanceFin = fin.distance === null ? DISTANCE_MAX_GRAPHIQUE : fin.distance;
        svg += `<circle cx="${x(fin.horodatage)}" cy="${y(distanceFin)}" r="5" fill="#0f1d3a"/>`;
    }

    // Légende du temps
    const reperes = ["-60 s", "-45 s", "-30 s", "-15 s", "maintenant"];
    reperes.forEach((texte, i) => {
        const position = gauche + (largeur - gauche) * i / 4;
        const ancrage = i === 0 ? "start" : (i === 4 ? "end" : "middle");
        svg += `<text x="${position}" y="${hauteur - 4}" fill="#6b7689" font-size="11" text-anchor="${ancrage}">${texte}</text>`;
    });

    document.getElementById("graphique").innerHTML = svg;
}


// ---------- Carte du trajet (navigation à l'estime) ----------
// La voiture n'a pas de GPS : on CALCULE sa position à partir de ce qu'elle fait.
//  - quand elle avance ou ralentit : distance = vitesse x temps
//  - quand elle pivote : on tourne son cap de 90° (ou 180° pour un demi-tour)
// La voiture reste toujours au centre de la carte, c'est le décor qui bouge.

function calculerTrajet(mesures) {
    let x = 0, y = 0;      // position en cm
    let cap = 0;           // direction en degrés : 0 = vers le haut, 90 = vers la droite
    const positions = [];
    const obstacles = [];

    for (let i = 0; i < mesures.length; i++) {
        const m = mesures[i];
        const precedente = i > 0 ? mesures[i - 1] : null;

        // 1. Déplacement depuis la mesure précédente
        if (precedente) {
            const duree = Math.min(m.horodatage - precedente.horodatage, 2); // max 2 s (coupure)
            if (precedente.action === "avance" || precedente.action === "ralentit" || precedente.action === "recule") {
                let distance = (precedente.vitesse / 100) * VITESSE_MAX_CM_PAR_S * duree;
                if (precedente.action === "recule") distance = -distance; // marche arrière
                x += distance * Math.sin(radians(cap));
                y -= distance * Math.cos(radians(cap));
            }
        }

        // 2. Rotation : une seule fois, au début d'un pivot
        const nouvelleAction = !precedente || precedente.action !== m.action;
        if (nouvelleAction && m.action === "pivot_gauche") cap -= ANGLE_PIVOT;
        if (nouvelleAction && m.action === "pivot_droite") cap += ANGLE_PIVOT;
        if (nouvelleAction && m.action === "demi_tour") cap += 180;

        positions.push({ x: x, y: y, cap: cap, horodatage: m.horodatage });

        // 3. Obstacle vu en zone 1 ou 2 : on le place sur la carte
        //    angle_capteur 90 = devant, 180 = à gauche, 0 = à droite
        if (m.distance !== null && m.zone >= 1) {
            const direction = cap + (90 - m.angle_capteur);
            // La distance mesurée va du capteur (avant de la voiture) jusqu'au BORD du cône :
            // on ajoute donc la moitié de la voiture et le rayon du cône pour placer son centre
            const eloignement = m.distance + (AVANT_VOITURE_PX + RAYON_CONE_PX) / PIXELS_PAR_CM;
            const obstacle = {
                x: x + eloignement * Math.sin(radians(direction)),
                y: y - eloignement * Math.cos(radians(direction)),
                direction: direction,
                zone: m.zone,
            };
            // On ignore un obstacle trop proche du précédent (c'est le même)
            const dernier = obstacles[obstacles.length - 1];
            if (!dernier || Math.hypot(obstacle.x - dernier.x, obstacle.y - dernier.y) > 60) {
                obstacles.push(obstacle);
            } else {
                // Même obstacle vu de plus près : on garde la mesure la plus récente, la plus précise
                dernier.x = obstacle.x;
                dernier.y = obstacle.y;
                dernier.zone = Math.max(dernier.zone, obstacle.zone);
            }
        }
    }

    return { positions: positions, obstacles: obstacles.slice(-5) }; // 5 derniers obstacles
}

function afficherCarte(mesures) {
    const carte = document.getElementById("carte");
    if (mesures.length === 0) { carte.innerHTML = ""; return; }

    // La carte prend toute la place disponible, avec la voiture au centre
    const largeur = carte.clientWidth, hauteur = carte.clientHeight;
    carte.setAttribute("viewBox", `${-largeur / 2} ${-hauteur / 2} ${largeur} ${hauteur}`);

    const trajet = calculerTrajet(mesures);
    const ici = trajet.positions[trajet.positions.length - 1];
    const derniere = mesures[mesures.length - 1];

    // Convertit une position (en cm) en position sur la carte, la voiture étant au centre
    const px = valeur => (valeur * PIXELS_PAR_CM).toFixed(1);
    const versCarteX = xCm => px(xCm - ici.x);
    const versCarteY = yCm => px(yCm - ici.y);

    // Décalage de la grille pour donner l'impression que la voiture avance
    const decalageX = (-ici.x * PIXELS_PAR_CM) % 40;
    const decalageY = (-ici.y * PIXELS_PAR_CM) % 40;

    let svg = `
    <defs>
        <pattern id="grille" width="40" height="40" patternUnits="userSpaceOnUse"
                 patternTransform="translate(${decalageX.toFixed(1)} ${decalageY.toFixed(1)})">
            <path d="M40 0H0V40" fill="none" stroke="#1d2f55" stroke-width="1"/>
        </pattern>
        <filter id="ombre" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="3" dy="5" stdDeviation="3" flood-color="#000" flood-opacity="0.45"/>
        </filter>
    </defs>
    <rect x="${-largeur / 2}" y="${-hauteur / 2}" width="${largeur}" height="${hauteur}" fill="url(#grille)"/>`;

    // Traînée : plus le point est ancien, plus il est transparent
    const premierInstant = trajet.positions[0].horodatage;
    for (let i = 1; i < trajet.positions.length; i++) {
        const a = trajet.positions[i - 1], b = trajet.positions[i];
        const age = (b.horodatage - premierInstant) / FENETRE_SECONDES;
        const opacite = (0.15 + 0.85 * Math.min(Math.max(age, 0), 1)).toFixed(2);
        svg += `<line x1="${versCarteX(a.x)}" y1="${versCarteY(a.y)}" x2="${versCarteX(b.x)}" y2="${versCarteY(b.y)}"
                      stroke="#3b9ee8" stroke-width="4" stroke-linecap="round" opacity="${opacite}"/>`;
    }

    // Cône du capteur : part de l'avant de la voiture et s'arrête au bord de l'obstacle
    const directionCapteur = ici.cap + (90 - derniere.angle_capteur);
    if (derniere.distance !== null) {
        const longueur = Math.min(derniere.distance, 150) * PIXELS_PAR_CM;
        const couleur = ZONES[derniere.zone].couleur;
        const bout = AVANT_VOITURE_PX + longueur;
        const cote = (bout * Math.sin(radians(18))).toFixed(1);
        const haut = (-bout * Math.cos(radians(18))).toFixed(1);
        svg += `<g transform="rotate(${directionCapteur})">
                    <path d="M0 ${-AVANT_VOITURE_PX} L${-cote} ${haut} A${bout} ${bout} 0 0 1 ${cote} ${haut} Z"
                          fill="${couleur}" opacity="0.22"/>
                </g>`;
        // Texte de la distance, à droite du cône
        const centre = AVANT_VOITURE_PX + longueur + RAYON_CONE_PX;
        const texteX = Math.sin(radians(directionCapteur)) * centre + RAYON_CONE_PX + 8;
        const texteY = -Math.cos(radians(directionCapteur)) * centre - 12;
        svg += `<text x="${texteX.toFixed(1)}" y="${texteY.toFixed(1)}" fill="${couleur}" font-size="15" font-weight="700">${Math.round(derniere.distance)} cm</text>`;
    } else {
        svg += `<g transform="rotate(${directionCapteur})">
                    <path d="M0 ${-AVANT_VOITURE_PX} L-45 -170 A120 120 0 0 1 45 -170 Z" fill="#3b9ee8" opacity="0.10"/>
                </g>`;
    }

    // Obstacles : cônes de chantier (5 derniers), avec un halo de la couleur de la zone
    for (const o of trajet.obstacles) {
        svg += dessinCone(versCarteX(o.x), versCarteY(o.y), ZONES[o.zone].couleur);
    }

    // Faisceaux des phares devant la voiture quand ils sont allumés
    if (derniere.phares) {
        svg += `<g transform="rotate(${ici.cap})" opacity="0.35">
                    <path d="M-16 ${-AVANT_VOITURE_PX + 4} L-46 ${-AVANT_VOITURE_PX - 90} L-2 ${-AVANT_VOITURE_PX - 90} Z" fill="#ffe9a3"/>
                    <path d="M16 ${-AVANT_VOITURE_PX + 4} L2 ${-AVANT_VOITURE_PX - 90} L46 ${-AVANT_VOITURE_PX - 90} Z" fill="#ffe9a3"/>
                </g>`;
    }

    // Feux de recul : halo rouge derrière la voiture en marche arrière
    if (derniere.action === "recule") {
        svg += `<g transform="rotate(${ici.cap})">
                    <ellipse cx="-12" cy="${AVANT_VOITURE_PX * 0.9}" rx="14" ry="10" fill="#ff3b3b" opacity="0.5"/>
                    <ellipse cx="12" cy="${AVANT_VOITURE_PX * 0.9}" rx="14" ry="10" fill="#ff3b3b" opacity="0.5"/>
                </g>`;
    }

    // La voiture (dessin original, vue de dessus), tournée selon son cap
    svg += `<g transform="rotate(${ici.cap}) scale(${TAILLE_VOITURE})" filter="url(#ombre)">${dessinVoiture()}</g>`;

    carte.innerHTML = svg;
}

function dessinCone(x, y, couleurZone) {
    // Cône de chantier vu de côté ; (x, y) = centre de sa base
    return `
    <g transform="translate(${x} ${y})">
        <ellipse cx="0" cy="0" rx="${RAYON_CONE_PX + 4}" ry="7" fill="none" stroke="${couleurZone}" stroke-width="3" opacity="0.9"/>
        <ellipse cx="3" cy="4" rx="${RAYON_CONE_PX}" ry="6" fill="#000" opacity="0.35"/>
        <rect x="${-RAYON_CONE_PX}" y="-7" width="${RAYON_CONE_PX * 2}" height="9" rx="2.5" fill="#d93a22"/>
        <path d="M-13 -6 L-3 -46 L3 -46 L13 -6 Z" fill="#f2512f"/>
        <path d="M-9.8 -18 L-8.3 -24 L8.3 -24 L9.8 -18 Z" fill="#ffffff"/>
        <path d="M-6.7 -30 L-5.4 -35 L5.4 -35 L6.7 -30 Z" fill="#ffffff"/>
        <path d="M-13 -6 L-3 -46 L-1 -46 L-8 -6 Z" fill="#ffffff" opacity="0.18"/>
        <rect x="-3.5" y="-48" width="7" height="3" rx="1.5" fill="#d93a22"/>
    </g>`;
}

function dessinVoiture() {
    return `
        <path d="M-24 -62 C-26 -74 -14 -82 0 -82 C14 -82 26 -74 24 -62 L28 -30 L29 40 C29 60 22 72 0 74 C-22 72 -29 60 -29 40 L-28 -30 Z"
              fill="#f4f6fa" stroke="#c9d1de" stroke-width="1.2"/>
        <path d="M-20 -34 C-12 -42 12 -42 20 -34 L22 44 C14 54 -14 54 -22 44 Z" fill="#141c2e"/>
        <path d="M-18 -37 C-10 -46 10 -46 18 -37" fill="none" stroke="#2b3550" stroke-width="2"/>
        <path d="M-29 -26 l-8 -2 l1 6 l7 1 z M29 -26 l8 -2 l-1 6 l-7 1 z" fill="#e7ebf2"/>
        <rect x="-20" y="-80" width="10" height="3" rx="1.5" fill="#bfe1ff"/>
        <rect x="10" y="-80" width="10" height="3" rx="1.5" fill="#bfe1ff"/>
        <rect x="-22" y="70" width="12" height="3" rx="1.5" fill="#e05a50"/>
        <rect x="10" y="70" width="12" height="3" rx="1.5" fill="#e05a50"/>`;
}

function radians(degres) {
    return degres * Math.PI / 180;
}
