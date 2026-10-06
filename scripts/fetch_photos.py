#!/usr/bin/env python3
"""Busca una foto representativa (og:image / twitter:image / primera <img> grande)
en la página de origen de cada punto y la guarda en data/photos.json.

Uso:  python scripts/fetch_photos.py [--all] [--limit N]
  --all    vuelve a comprobar también los puntos que ya tienen foto
  --limit  máximo de páginas a consultar en esta ejecución

No descarga imágenes: guarda la URL original y el enlace a la fuente,
que la app muestra con atribución ("Foto: sitio").
"""
import json, re, sys, time, argparse, html
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin, urlparse
import urllib.request

ROOT = __file__.rsplit("/scripts/", 1)[0]
PLACES = f"{ROOT}/data/places.json"
PHOTOS = f"{ROOT}/data/photos.json"
UA = "Mozilla/5.0 (compatible; donde-vamos/1.0; +https://josedavide.github.io/donde-vamos/)"
META_RE = [
    r'<meta[^>]+property=["\']og:image(?::secure_url)?["\'][^>]+content=["\']([^"\']+)',
    r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image(?::secure_url)?["\']',
    r'<meta[^>]+name=["\']twitter:image(?::src)?["\'][^>]+content=["\']([^"\']+)',
    r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']twitter:image(?::src)?["\']',
    r'<link[^>]+rel=["\']image_src["\'][^>]+href=["\']([^"\']+)',
]
BAD = re.compile(r"logo|favicon|icon|sprite|placeholder|default|blank|avatar|banner-cookies", re.I)


def fetch(url, timeout=15):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "es,ca;q=0.9,fr;q=0.8"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        ct = r.headers.get("Content-Type", "")
        if "html" not in ct:
            return None, r.geturl()
        return r.read(600_000).decode(r.headers.get_content_charset() or "utf-8", "replace"), r.geturl()


def find_image(page, base):
    for rx in META_RE:
        m = re.search(rx, page, re.I)
        if m:
            u = urljoin(base, html.unescape(m.group(1).strip()))
            if u.startswith("http") and not BAD.search(u.rsplit("/", 1)[-1]):
                return u
    for m in re.finditer(r'<img[^>]+src=["\']([^"\']+\.(?:jpe?g|webp))["\'][^>]*>', page, re.I):
        tag, u = m.group(0), m.group(1)
        if BAD.search(u):
            continue
        w = re.search(r'width=["\']?(\d+)', tag)
        if w and int(w.group(1)) < 400:
            continue
        return urljoin(base, html.unescape(u))
    return None


def site_name(page, url):
    m = re.search(r'<meta[^>]+property=["\']og:site_name["\'][^>]+content=["\']([^"\']+)', page or "", re.I)
    if m:
        return html.unescape(m.group(1)).strip()[:40]
    return urlparse(url).netloc.removeprefix("www.")


def work(p):
    url = p.get("url")
    try:
        page, final = fetch(url)
        if not page:
            return p["id"], None
        img = find_image(page, final)
        if not img:
            return p["id"], None
        return p["id"], {"img": img, "src": url, "site": site_name(page, final), "fecha": time.strftime("%Y-%m-%d")}
    except Exception as e:  # noqa: BLE001
        return p["id"], {"error": type(e).__name__}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    items = json.load(open(PLACES, encoding="utf-8"))["items"]
    try:
        photos = json.load(open(PHOTOS, encoding="utf-8"))
    except Exception:  # noqa: BLE001
        photos = {}
    ids = {p["id"] for p in items}
    photos = {k: v for k, v in photos.items() if k in ids}
    todo = [p for p in items if p.get("url") and (a.all or not photos.get(p["id"], {}).get("img"))]
    # los que fallaron hace poco se reintentan, pero al final de la cola
    todo.sort(key=lambda p: "error" in photos.get(p["id"], {}))
    if a.limit:
        todo = todo[: a.limit]
    print(f"Consultando {len(todo)} páginas…", flush=True)
    ok = 0
    with ThreadPoolExecutor(8) as ex:
        for pid, res in ex.map(work, todo):
            if res and res.get("img"):
                photos[pid] = res
                ok += 1
            elif res and pid not in photos:
                photos[pid] = res
            elif res is None and pid not in photos:
                photos[pid] = {"error": "sin-imagen"}
    with open(PHOTOS, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(photos.items())), f, ensure_ascii=False, indent=0)
        f.write("\n")
    total = sum(1 for v in photos.values() if v.get("img"))
    print(f"Nuevas fotos: {ok}. Puntos con foto: {total}/{len(items)}")


if __name__ == "__main__":
    sys.exit(main())
