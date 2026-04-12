"""
Scrape restaurants from Google Maps within a radius of Hyderabad center.
Saves to restaurants_cleaned.csv and optionally upserts into the DB.

Center: Hyderabad (17.4369, 78.4001)
Default radius: 10 km

Usage:
    python scripts/scrape_restaurants.py          # 10km, save to CSV + DB
    python scripts/scrape_restaurants.py --csv     # CSV only
    python scripts/scrape_restaurants.py --radius 5 # custom radius
"""

import argparse
import csv
import math
import random
import re
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

AREA_CENTER_LAT = 17.4369
AREA_CENTER_LNG = 78.4001
DEFAULT_RADIUS_KM = 10
EARTH_RADIUS_M = 6371000
REQUEST_DELAY = 3


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (math.sin(d_lat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2)
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def in_zone(lat: float, lng: float, radius_km: float) -> bool:
    return haversine_m(lat, lng, AREA_CENTER_LAT, AREA_CENTER_LNG) <= radius_km * 1000


def parse_rating(text: str) -> str:
    match = re.search(r'([\d.]+)\s*★', text)
    return match.group(1) if match else "N/A"


def parse_cuisine(text: str) -> str:
    return text.strip() if text else ""


SEARCH_TERMS = [
    "restaurant",
    "biryan",
    "pizza",
    "burger",
    "cafe",
    "coffee",
    "ice cream",
    "dining",
    "kebab",
    "chinese",
    "italian",
    "south indian",
    "north indian",
    "fast food",
    "bakery",
    "dessert",
]


def scrape_restaurants(radius_km: float = DEFAULT_RADIUS_KM, csv_only: bool = False):
    output_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "restaurants_cleaned.csv")

    all_restaurants = []
    seen_ids = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800},
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            }
        )
        page = context.new_page()
        page.set_default_timeout(30000)

        for term in SEARCH_TERMS:
            search_query = f"{term} restaurants Hyderabad"
            print(f"Searching: {search_query}", end=" ", flush=True)

            try:
                page.goto(f"https://www.google.com/maps/search/{search_query.replace(' ', '+')}",
                          wait_until="domcontentloaded", timeout=30000)
                time.sleep(random.uniform(3, 5))

                scroll_count = 0
                max_scrolls = 15

                while scroll_count < max_scrolls:
                    page.evaluate("""document.querySelectorAll('[aria-label*="Results for"], [class*="results"]').forEach(el => el.scrollTop += 800)""")
                    time.sleep(1.5)
                    scroll_count += 1

                content = page.content()
                soup = BeautifulSoup(content, "lxml")

                cards = soup.select('[class*="section-result"], [class*="result"], [class*="place-result"], [aria-label][role="button"]')

                if not cards:
                    cards = soup.select('a[href*="/place/"]')

                print(f"found {len(cards)} result links")

                for card in cards:
                    try:
                        link_el = card if card.name == 'a' else card.select_one('a[href*="/place/"]')
                        if not link_el:
                            link_el = card.select_one('a')

                        if not link_el:
                            continue

                        href = link_el.get("href", "")
                        if "/place/" not in href:
                            continue

                        place_id_match = re.search(r'/place/([^/]+)', href)
                        if not place_id_match:
                            continue

                        place_id = place_id_match.group(1)
                        if place_id in seen_ids:
                            continue
                        seen_ids.add(place_id)

                        name_el = card.select_one('[class*="title"], [class*="name"], [aria-label]')
                        name = name_el.get("aria-label", "") or name_el.get_text(strip=True) if name_el else ""

                        lat_match = re.search(r'!3d(-?[\d.]+)!4d(-?[\d.]+)', href)
                        lng_match = re.search(r'!4d(-?[\d.]+)', href)

                        if not lat_match or not lng_match:
                            continue

                        lat = float(lat_match.group(1))
                        lng = float(lat_match.group(2))

                        if not in_zone(lat, lng, radius_km):
                            continue

                        rating_el = card.select_one('[class*="rating"], [aria-label*="star"]')
                        rating = parse_rating(rating_el.get("aria-label", "") if rating_el else "")

                        cuisine_text = term if term != "restaurant" else "Varied"
                        cuisine_el = card.select_one('[class*="cuisine"], [class*="type"], [class*="category"]')
                        if cuisine_el:
                            cuisine_text = cuisine_el.get_text(strip=True)

                        area_el = card.select_one('[class*="address"], [class*="area"], [class*="location"]')
                        address = area_el.get_text(strip=True) if area_el else "Hyderabad"

                        area_match = re.search(r'(Hyderabad[^,]*| Jubilee Hills| Gachibowli| Hitec City| Kondapur| SR Nagar| Banjara)', address)
                        area = area_match.group(1).strip() if area_match else address.split(',')[0].strip() if ',' in address else address

                        all_restaurants.append({
                            "name": name[:100],
                            "lat": lat,
                            "lng": lng,
                            "address": address[:200],
                            "area": area[:100],
                            "cuisine": cuisine_text[:100],
                            "rating": rating,
                            "source": "google_maps",
                        })

                    except Exception as e:
                        continue

            except Exception as e:
                print(f"error: {e}")
                continue

            time.sleep(REQUEST_DELAY + random.uniform(1, 2))

        browser.close()

    unique = []
    seen_names = set()
    for r in all_restaurants:
        key = (r["name"].lower(), round(r["lat"], 4), round(r["lng"], 4))
        if key not in seen_names:
            seen_names.add(key)
            unique.append(r)

    in_zone_restaurants = [r for r in unique if in_zone(r["lat"], r["lng"], radius_km)]
    print(f"\nTotal unique restaurants in zone: {len(in_zone_restaurants)}")

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "lat", "lng", "address", "area", "cuisine", "rating", "source"])
        writer.writeheader()
        writer.writerows(in_zone_restaurants)
    print(f"Saved to {output_path}")

    if not csv_only:
        upsert_to_db(in_zone_restaurants)

    return in_zone_restaurants


def upsert_to_db(restaurants: list[dict]):
    try:
        from sqlalchemy import create_engine, text
        from sqlalchemy.orm import Session
        from app.config import settings
        from app.models.restaurant import Restaurant

        engine = create_engine(settings.DATABASE_URL)

        with Session(engine) as db:
            db.execute(text("PRAGMA foreign_keys=off"))
            try:
                db.execute(text("ALTER TABLE restaurants ADD COLUMN menu_scraped BOOLEAN DEFAULT 0"))
            except Exception:
                pass
            db.commit()

        with Session(engine) as db:
            existing = db.query(Restaurant).all()
            existing_keys = {(r.name.lower(), round(r.lat, 4), round(r.lng, 4)) for r in existing}
            new_restaurants = [
                r for r in restaurants
                if (r["name"].lower(), round(r["lat"], 4), round(r["lng"], 4)) not in existing_keys
            ]

            if not new_restaurants:
                print("All restaurants already in DB.")
                return

            for r in new_restaurants:
                rest = Restaurant(
                    name=r["name"],
                    lat=r["lat"],
                    lng=r["lng"],
                    address=r.get("address", ""),
                    area=r.get("area", ""),
                    cuisine=r.get("cuisine", ""),
                    rating=r.get("rating", ""),
                    source=r.get("source", "google_maps"),
                    menu_scraped=False,
                )
                db.add(rest)

            db.commit()
            print(f"Upserted {len(new_restaurants)} new restaurants to DB.")
    except Exception as e:
        print(f"DB upsert skipped: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape restaurants from Google Maps")
    parser.add_argument("--radius", type=float, default=DEFAULT_RADIUS_KM, help=f"Radius in km (default: {DEFAULT_RADIUS_KM})")
    parser.add_argument("--csv", action="store_true", help="Save to CSV only, skip DB upsert")
    args = parser.parse_args()

    scrape_restaurants(radius_km=args.radius, csv_only=args.csv)
