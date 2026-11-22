"""Génère icons/icon-192.png et icons/icon-512.png (ENF-01).

Bibliothèque standard uniquement : lancer `python creer_icones.py` depuis le dossier du projet.
Dessin : fond sombre et trois anneaux aux couleurs des sports (natation, vélo, course).
"""

import struct
import zlib
from pathlib import Path

FOND = (0x0E, 0x10, 0x13)
ANNEAUX = [
    ((0.30, 0.42), (0x42, 0x8B, 0xFF)),  # natation (bleu éclairci pour le fond sombre)
    ((0.70, 0.42), (0xFF, 0x8A, 0x3D)),  # vélo
    ((0.50, 0.66), (0x4C, 0xC2, 0x5A)),  # course
]


def pixel(x, y, taille):
    """Couleur du pixel (x, y) : couleur d'un anneau ou fond."""
    rayon = taille * 0.16
    epaisseur = taille * 0.05
    for (cx, cy), couleur in ANNEAUX:
        d = ((x - cx * taille) ** 2 + (y - cy * taille) ** 2) ** 0.5
        if abs(d - rayon) <= epaisseur / 2:
            return couleur
    return FOND


def bloc_png(type_bloc, donnees):
    """Assemble un bloc PNG : longueur, type, données, CRC."""
    return (struct.pack(">I", len(donnees)) + type_bloc + donnees
            + struct.pack(">I", zlib.crc32(type_bloc + donnees) & 0xFFFFFFFF))


def creer_png(taille, chemin):
    """Écrit une image PNG carrée RGB de la taille demandée."""
    lignes = bytearray()
    for y in range(taille):
        lignes.append(0)
        for x in range(taille):
            lignes.extend(pixel(x + 0.5, y + 0.5, taille))
    entete = struct.pack(">IIBBBBB", taille, taille, 8, 2, 0, 0, 0)
    png = (b"\x89PNG\r\n\x1a\n" + bloc_png(b"IHDR", entete)
           + bloc_png(b"IDAT", zlib.compress(bytes(lignes), 9)) + bloc_png(b"IEND", b""))
    chemin.write_bytes(png)
    print(f"{chemin} : {taille} x {taille} px")


if __name__ == "__main__":
    dossier = Path(__file__).parent / "icons"
    dossier.mkdir(exist_ok=True)
    for t in (192, 512):
        creer_png(t, dossier / f"icon-{t}.png")
