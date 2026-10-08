#!/usr/bin/env python3
"""Descarga de OpenStreetMap (Overpass) las áreas de autocaravanas y campings que
admiten autocaravanas en el radio de la web, y escribe data/areas.json.

- tourism=caravan_site  -> área de autocaravanas (oficial o privada tipo área)
- tourism=camp_site con caravans/motorhome=yes -> camping
Descarta las que ya están en data/places.json (pernocta a menos de 250 m), que
son las revisadas a mano. Se ejecuta en GitHub Actions (aquí sí hay red).
"""
import json, math, time, urllib.parse, urllib.request

ROOT = __file__.rsplit("/scripts/", 1)[0]
BBOX = (39.4, -1.9, 44.6, 5.0)  # sur, oeste, norte, este (≈5 h desde Mataró)
ENDPOINTS = ["https://overpass-api.de/api/interpreter",
             "https://overpass.kumi.systems/api/interpreter"]
UA = "donde-vamos/1.0 (+https://github.com/josedavide/donde-vamos)"
Q = f"""[out:json][timeout:180];
(
  nwr["tourism"="caravan_site"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  nwr["tourism"="camp_site"]["caravans"="yes"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  nwr["tourism"="camp_site"]["motorhome"="yes"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
);
out center tags;"""


def km(a, b, c, d):
    a, b, c, d = map(math.radians, (a, b, c, d))
    return 6371 * 2 * math.asin(math.sqrt(math.sin((c - a) / 2) ** 2 + math.cos(a) * math.cos(c) * math.sin((d - b) / 2) ** 2))


def overpass():
    data = urllib.parse.urlencode({"data": Q}).encode()
    for url in ENDPOINTS:
        for _ in range(2):
            try:
                req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=240) as r:
                    return json.load(r)["elements"]
            except Exception as e:  # noqa: BLE001
                print("Overpass falló:", url, e)
                time.sleep(20)
    raise SystemExit("No se pudo consultar Overpass")


def yes(v):
    return (v or "").lower() in ("yes", "designated", "1", "true")


def item(e):
    t = e.get("tags", {})
    lat = e.get("lat") or e.get("center", {}).get("lat")
    lng = e.get("lon") or e.get("center", {}).get("lon")
    if lat is None or lng is None:
        return None
    camping = t.get("tourism") == "camp_site"
    name = t.get("name") or t.get("operator") or ("Camping" if camping else "Área de autocaravanas")
    town = t.get("addr:city") or t.get("addr:town") or t.get("addr:village") or t.get("addr:municipality") or ""
    serv = []
    if yes(t.get("drinking_water")) or yes(t.get("water_point")): serv.append("agua")
    if yes(t.get("sanitary_dump_station")): serv.append("vaciado")
    if yes(t.get("power_supply")) or (t.get("power_supply") or "").startswith("yes"): serv.append("electricidad")
    if yes(t.get("toilets")): serv.append("WC")
    if yes(t.get("shower")): serv.append("duchas")
    fee = (t.get("fee") or "").lower()
    precio = "gratis" if fee == "no" else "pago" if fee in ("yes", "donation") else "desconocido"
    bits = ["Camping que admite autocaravanas" if camping else "Área de autocaravanas"]
    if t.get("capacity"): bits.append(f"{t['capacity']} plazas")
    if serv: bits.append("servicios: " + ", ".join(serv))
    osm = f"https://www.openstreetmap.org/{e['type']}/{e['id']}"
    return {
        "id": f"osm-{e['type'][0]}{e['id']}", "nombre": name[:80],
        "tipos": ["camping"] if camping else ["area-ac"],
        "lat": round(lat, 5), "lng": round(lng, 5), "municipio": town, "zona": "",
        "pais": (t.get("addr:country") or "").upper() or None,
        "horario": t.get("opening_hours"), "temporada": None,
        "ac7m": "si" if not camping else "desconocido",
        "precio": precio, "precio_txt": t.get("charge"),
        "descripcion": ". ".join(bits) + ". Datos de OpenStreetMap: confirma antes de ir.",
        "consejo": None, "url": t.get("website") or t.get("contact:website") or osm, "osm": osm,
        "fuente": "OpenStreetMap", "nivel": 2, "verificado": t.get("check_date") or None,
    }


def main():
    places = json.load(open(f"{ROOT}/data/places.json", encoding="utf-8"))["items"]
    curated = [(p["lat"], p["lng"]) for p in places if p.get("capa") == "pernocta"]
    out, seen = [], set()
    for e in overpass():
        it = item(e)
        if not it or it["id"] in seen:
            continue
        if any(km(it["lat"], it["lng"], a, b) < 0.25 for a, b in curated):
            continue
        seen.add(it["id"]); out.append(it)
    out.sort(key=lambda x: x["id"])
    with open(f"{ROOT}/data/areas.json", "w", encoding="utf-8") as f:
        f.write('{"fuente":"OpenStreetMap (ODbL)","actualizado":"%s","items":[\n' % time.strftime("%Y-%m-%d"))
        f.write(",\n".join(json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in out))
        f.write("\n]}\n")
    print(f"Áreas/campings de OSM: {len(out)} (sin contar las {len(curated)} revisadas a mano)")


if __name__ == "__main__":
    main()
