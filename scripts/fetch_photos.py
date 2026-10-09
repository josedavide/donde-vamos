#!/usr/bin/env python3
"""Busca una foto representativa de cada punto y la guarda en data/photos.json.

Orden de búsqueda por punto:
  1. og:image / twitter:image de la página fuente (url del punto).
  2. Si esa imagen es "genérica" (la comparten 3+ puntos: logos, portadas de
     agenda…) o no hay, la primera imagen grande del contenido de la página.
  3. Wikipedia (ca, es, fr): artículo cuyo título se parezca al nombre y cuyas
     coordenadas estén a < 3 km del punto → imagen principal.
  4. Wikimedia Commons: fotos geolocalizadas a < 250 m (solo visita/naturaleza).
Después comprueba que la imagen se descarga sin cabecera Referer (hotlink) y
que no es diminuta.

Uso:  python scripts/fetch_photos.py [--all] [--limit N]
  --all    vuelve a comprobar también los puntos que ya tienen foto
No descarga imágenes: guarda la URL original y el enlace a la fuente.
"""
import json, re, sys, time, argparse, html, math
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin, urlparse, quote, urlencode
import urllib.request

ROOT = __file__.rsplit("/scripts/", 1)[0]
PLACES = f"{ROOT}/data/places.json"
AREAS = f"{ROOT}/data/areas.json"
PHOTOS = f"{ROOT}/data/photos.json"
UA = "Mozilla/5.0 (compatible; donde-vamos/1.1; +https://josedavide.github.io/donde-vamos/)"
WIKI_UA = "donde-vamos/1.1 (https://github.com/josedavide/donde-vamos; mapa de salidas familiar)"
META_RE = [
    r'<meta[^>]+property=["\']og:image(?::secure_url)?["\'][^>]+content=["\']([^"\']+)',
    r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image(?::secure_url)?["\']',
    r'<meta[^>]+name=["\']twitter:image(?::src)?["\'][^>]+content=["\']([^"\']+)',
    r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']twitter:image(?::src)?["\']',
    r'<link[^>]+rel=["\']image_src["\'][^>]+href=["\']([^"\']+)',
]
BAD = re.compile(r"logo|favicon|icon|sprite|placeholder|default|blank|avatar|cookie|banner|pixel|loading|spacer|\.svg|\.gif", re.I)
BAD_TITLE = re.compile(r"map|mapa|plano|logo|escut|escudo|bandera|flag|coat|senyal|señal|cartell|plànol|diagram|esquema", re.I)
TODAY = time.strftime("%Y-%m-%d")
STATS = Counter()
ERRS = []


def safe_url(u):
    return quote(u, safe=":/?&=#%+,;@!$'()*[]~")


def km(a, b, c, d):
    a, b, c, d = map(math.radians, (a, b, c, d))
    return 6371 * 2 * math.asin(math.sqrt(math.sin((c - a) / 2) ** 2 + math.cos(a) * math.cos(c) * math.sin((d - b) / 2) ** 2))


def get(url, timeout=15, headers=None, maxbytes=700_000):
    req = urllib.request.Request(safe_url(url), headers={"User-Agent": UA, "Accept-Language": "es,ca;q=0.9,fr;q=0.8", **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(maxbytes), r.headers, r.geturl()


def page_candidates(url):
    """Devuelve (lista de imágenes candidatas en orden, nombre del sitio)."""
    try:
        data, hdr, final = get(url)
    except Exception as e:  # noqa: BLE001
        return None, type(e).__name__
    if "html" not in (hdr.get("Content-Type") or ""):
        return [], ""
    page = data.decode(hdr.get_content_charset() or "utf-8", "replace")
    cands = []
    for rx in META_RE:
        for m in re.finditer(rx, page, re.I):
            u = urljoin(final, html.unescape(m.group(1).strip()))
            if u.startswith("http") and not BAD.search(u.rsplit("/", 1)[-1]) and u not in cands:
                cands.append(u)
    # imágenes del contenido (lazy: data-src / srcset)
    for m in re.finditer(r'<img[^>]+>', page, re.I):
        tag = m.group(0)
        src = re.search(r'(?:data-src|data-lazy-src|data-original)=["\']([^"\']+)', tag) or re.search(r'\ssrc=["\']([^"\']+)', tag)
        if not src:
            continue
        u = html.unescape(src.group(1)).strip()
        if not re.search(r"\.(jpe?g|webp|png)(\?|$)", u, re.I) or BAD.search(u):
            continue
        w = re.search(r'width=["\']?(\d+)', tag)
        h = re.search(r'height=["\']?(\d+)', tag)
        if (w and int(w.group(1)) < 300) or (h and int(h.group(1)) < 200):
            continue
        u = urljoin(final, u)
        if u not in cands:
            cands.append(u)
        if len(cands) >= 6:
            break
    m = re.search(r'<meta[^>]+property=["\']og:site_name["\'][^>]+content=["\']([^"\']+)', page, re.I)
    site = html.unescape(m.group(1)).strip()[:40] if m else urlparse(final).netloc.removeprefix("www.")
    return cands, site


def wiki_api(lang, params):
    url = f"https://{lang}.wikipedia.org/w/api.php?" + urlencode({"format": "json", "formatversion": 2, **params})
    data, _, _ = get(url, headers={"User-Agent": WIKI_UA})
    return json.loads(data)


def clean_name(name):
    name = re.sub(r"\(.*?\)", "", name)
    name = re.split(r" [–-] | y | i |: ", name)[0]
    return name.strip()


def wikipedia_image(p):
    q = clean_name(p["nombre"])
    if len(q) < 4:
        return None
    for lang in ("ca", "es", "fr"):
        try:
            STATS["wiki_req"] += 1
            r = wiki_api(lang, {"action": "query", "generator": "search", "gsrsearch": q, "gsrlimit": 3,
                                "prop": "pageimages|coordinates", "piprop": "original|thumbnail", "pithumbsize": 1000})
        except Exception as e:  # noqa: BLE001
            STATS["wiki_err"] += 1
            if len(ERRS) < 5:
                ERRS.append(f"wiki {lang} {q!r}: {e}")
            continue
        for pg in (r.get("query", {}).get("pages") or []):
            co = (pg.get("coordinates") or [{}])[0]
            if "lat" not in co:
                continue
            if km(p["lat"], p["lng"], co["lat"], co["lon"]) > 3:
                continue
            img = (pg.get("original") or pg.get("thumbnail") or {}).get("source")
            if img and not BAD_TITLE.search(img.rsplit("/", 1)[-1]) and re.search(r"\.(jpe?g|png|webp)$", img, re.I):
                STATS["wiki_hit"] += 1
                return {"img": img, "src": f"https://{lang}.wikipedia.org/wiki/{quote(pg['title'].replace(' ', '_'))}", "site": "Wikipedia", "fecha": TODAY}
        time.sleep(0.2)
    return None


def commons_image(p):
    try:
        url = "https://commons.wikimedia.org/w/api.php?" + urlencode({
            "action": "query", "format": "json", "formatversion": 2, "generator": "geosearch",
            "ggscoord": f"{p['lat']}|{p['lng']}", "ggsradius": 250, "ggsnamespace": 6, "ggslimit": 12,
            "prop": "imageinfo", "iiprop": "url|size|mime", "iiurlwidth": 1000})
        data, _, _ = get(url, headers={"User-Agent": WIKI_UA})
        pages = json.loads(data).get("query", {}).get("pages") or []
    except Exception:  # noqa: BLE001
        return None
    best = None
    for pg in pages:
        ii = (pg.get("imageinfo") or [{}])[0]
        if ii.get("mime") not in ("image/jpeg", "image/png", "image/webp"):
            continue
        if BAD_TITLE.search(pg.get("title", "")) or ii.get("width", 0) < 600:
            continue
        if not best or ii.get("width", 0) > best[0]:
            best = (ii.get("width", 0), ii.get("thumburl") or ii.get("url"), ii.get("descriptionurl"))
    if best:
        return {"img": best[1], "src": best[2], "site": "Wikimedia Commons", "fecha": TODAY}
    return None


def image_ok(url):
    """Comprueba que la imagen se sirve sin Referer y que no es diminuta."""
    try:
        req = urllib.request.Request(safe_url(url), headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15", "Accept": "image/avif,image/webp,image/*,*/*;q=0.8"})
        with urllib.request.urlopen(req, timeout=12) as r:
            ct = r.headers.get("Content-Type", "")
            head = r.read(4096)
        if not ct.startswith("image/"):
            return False
        cl = int(r.headers.get("Content-Length") or 0)
        return cl == 0 or cl > 6000
    except Exception:  # noqa: BLE001
        return False


def work(args):
    try:
        return _work(args)
    except Exception as e:  # noqa: BLE001
        return args[0]["id"], {"error": type(e).__name__, "fecha": TODAY}


def _work(args):
    p, generic = args
    url = p.get("url")
    cands, site = ([], "") if not url or "openstreetmap.org" in url or generic is None else page_candidates(url)
    if cands is None:
        cands, site = [], ""
    for u in cands:
        if u in generic:
            continue
        if image_ok(u):
            return p["id"], {"img": u, "src": url, "site": site or urlparse(url).netloc.removeprefix("www."), "fecha": TODAY}
    if p.get("capa") in ("visita", "naturaleza", "evento", "ruta"):
        w = wikipedia_image(p)
        if w and image_ok(w["img"]):
            return p["id"], w
    if p.get("capa") in ("visita", "naturaleza"):
        c = commons_image(p)
        if c and image_ok(c["img"]):
            return p["id"], c
    return p["id"], {"error": "sin-imagen", "fecha": TODAY}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--retry-days", type=int, default=60, help="reintentar los fallidos hace más de N días")
    a = ap.parse_args()
    items = json.load(open(PLACES, encoding="utf-8"))["items"]
    try:
        items += [x for x in json.load(open(AREAS, encoding="utf-8"))["items"] if x.get("url") and "openstreetmap.org" not in x["url"]]
    except Exception:  # noqa: BLE001
        pass
    try:
        photos = json.load(open(PHOTOS, encoding="utf-8"))
    except Exception:  # noqa: BLE001
        photos = {}
    ids = {p["id"] for p in items}
    photos = {k: v for k, v in photos.items() if k in ids}
    uses = Counter(v["img"] for v in photos.values() if v.get("img"))
    generic = {u for u, n in uses.items() if n >= 3}
    for pid, v in photos.items():  # desmarcar las genéricas para reintentarlas
        if v.get("img") in generic:
            photos[pid] = {"error": "generica", "fecha": v.get("fecha", "")}
    cutoff = time.strftime("%Y-%m-%d", time.localtime(time.time() - a.retry_days * 86400))

    def pending(p):
        v = photos.get(p["id"]) or {}
        if a.all or not v:
            return True
        if v.get("img"):
            return False
        return v.get("error") == "generica" or (v.get("fecha") or "") < cutoff
    todo = [p for p in items if pending(p)]
    if a.limit:
        todo = todo[: a.limit]
    print(f"Consultando {len(todo)} puntos…", flush=True)
    ok = 0
    with ThreadPoolExecutor(8) as ex:
        for pid, res in ex.map(work, [(p, generic) for p in todo]):
            if res.get("img"):
                ok += 1
            photos[pid] = res
    # una misma imagen en 3+ sitios no representa a ninguno: segunda pasada solo con Wikipedia/Commons
    uses = Counter(v["img"] for v in photos.values() if v.get("img"))
    again = [p for p in items if photos.get(p["id"], {}).get("img") and uses[photos[p["id"]]["img"]] >= 3]
    print(f"Genéricas: {len(again)}; probando Wikipedia/Commons…", flush=True)
    with ThreadPoolExecutor(6) as ex:
        for pid, res in ex.map(work, [(p, None) for p in again]):
            photos[pid] = res if res.get("img") else {"error": "generica", "fecha": TODAY}
            ok += 1 if res.get("img") else 0
    print("Wikipedia:", dict(STATS), *ERRS, sep="\n")
    with open(PHOTOS, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(photos.items())), f, ensure_ascii=False, indent=0)
        f.write("\n")
    total = sum(1 for v in photos.values() if v.get("img"))
    print(f"Nuevas fotos: {ok}. Puntos con foto: {total}/{len(items)}")


if __name__ == "__main__":
    sys.exit(main())
