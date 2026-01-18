import json, re, urllib.request

airports = {
    "CYYZ": (43.68, -79.63),
    "CYVR": (49.19, -123.18),
    "CYUL": (45.47, -73.74),
    "CYYC": (51.11, -114.02),
    "CYOW": (45.32, -75.67),
    "CYWG": (49.91, -97.24),
    "CYHZ": (44.88, -63.51),
    "CYEG": (53.31, -113.58),
    "CYQB": (46.79, -71.39),
    "CYYJ": (48.65, -123.43),
    "CYYT": (47.62, -52.75),
    "CYXE": (52.17, -106.7),
}

wp_re = re.compile(r"(\\d+\\.?\\d*)N/(\\d+\\.?\\d*)W")


def parse_wp(s):
    m = wp_re.match(s)
    return (float(m.group(1)), -float(m.group(2))) if m else None


def get_coord(f):
    dep = f.get("departure airport")
    if dep in airports:
        return airports[dep]
    route = f.get("route") or ""
    for part in route.split():
        c = parse_wp(part)
        if c:
            return c
    return None


def count_markers(file):
    base = "http://localhost:8000"
    flights = json.load(urllib.request.urlopen(f"{base}/api/flights?file={file}"))
    conflicts = json.load(urllib.request.urlopen(f"{base}/api/flights/{file}/conflicts"))
    flight_by_id = {f["ACID"]: f for f in flights}
    markers = skipped = missing = 0
    coords = []
    for c in conflicts:
        f1 = flight_by_id.get(c["flight1"])
        f2 = flight_by_id.get(c["flight2"])
        if not f1 or not f2:
            missing += 1
            continue
        p1 = get_coord(f1)
        p2 = get_coord(f2)
        if not p1 or not p2:
            skipped += 1
            continue
        markers += 1
        coords.append(((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2))
    uniq = {(round(a, 4), round(b, 4)) for a, b in coords}
    return len(flights), len(conflicts), markers, skipped, missing, len(uniq)


for file in ["canadian_flights_250.json", "canadian_flights_1000.json"]:
    print(file, count_markers(file))
