#!/usr/bin/env python3
"""Afina las coordenadas de los puntos marcados "aprox": true (centro del pueblo)
buscándolos por nombre en Nominatim (OpenStreetMap). Solo acepta resultados a
menos de 12 km de la posición actual. Respeta 1 petición/segundo.
Los que no encuentra se quedan como están (y la app sigue avisando).
"""
import json, math, re, time, urllib.parse, urllib.request

ROOT = __file__.rsplit("/scripts/", 1)[0]
PLACES = f"{ROOT}/data/places.json"
UA = "donde-vamos/1.0 (+https://github.com/josedavide/donde-vamos)"


def km(a, b, c, d):
    a, b, c, d = map(math.radians, (a, b, c, d))
    return 6371 * 2 * math.asin(math.sqrt(math.sin((c - a) / 2) ** 2 + math.cos(a) * math.cos(c) * math.sin((d - b) / 2) ** 2))


def search(q, p):
    vb = f"{p['lng']-0.15},{p['lat']+0.12},{p['lng']+0.15},{p['lat']-0.12}"
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": q, "format": "jsonv2", "limit": 3, "countrycodes": "es,fr,ad", "viewbox": vb, "bounded": 1})
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "es,ca"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def clean(name):
    name = re.sub(r"\(.*?\)", "", name)
    return re.split(r" [–-] | y ", name)[0].strip()


def main():
    raw = json.load(open(PLACES, encoding="utf-8"))
    todo = [p for p in raw["items"] if p.get("aprox")]
    fixed = 0
    for p in todo:
        for q in (f"{clean(p['nombre'])}, {p.get('municipio','')}", clean(p["nombre"])):
            try:
                res = search(q, p)
            except Exception as e:  # noqa: BLE001
                print("error", p["id"], e); res = []
            time.sleep(1.1)
            res = [r for r in res if r.get("addresstype") not in ("city", "town", "village", "municipality", "county", "state")]
            if res:
                r = res[0]; lat, lng = float(r["lat"]), float(r["lon"])
                if km(p["lat"], p["lng"], lat, lng) < 12:
                    p["lat"], p["lng"] = round(lat, 5), round(lng, 5)
                    p.pop("aprox", None); p["geo"] = "osm"; fixed += 1
                    break
    with open(PLACES, "w", encoding="utf-8") as f:
        f.write('{' + ",".join(f'"{k}":{json.dumps(v, ensure_ascii=False)}' for k, v in raw.items() if k != "items") + ',"items":[\n')
        f.write(",\n".join(json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in raw["items"]))
        f.write("\n]}\n")
    print(f"Coordenadas afinadas: {fixed} de {len(todo)}")


if __name__ == "__main__":
    main()
