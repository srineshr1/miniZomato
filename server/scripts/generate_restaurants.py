"""
Generate synthetic restaurant data covering the 10km Hyderabad zone.
Saves to restaurants_cleaned.csv and upserts into the DB.

Center: Hyderabad (17.4369, 78.4001)
Radius: 10 km

Usage:
    python scripts/generate_restaurants.py         # 10km, CSV + DB
    python scripts/generate_restaurants.py --help
"""

import argparse
import csv
import math
import random
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

AREA_CENTER_LAT = 17.4369
AREA_CENTER_LNG = 78.4001
RADIUS_KM = 10
EARTH_RADIUS_M = 6371000


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (math.sin(d_lat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2)
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


RESTAURANT_TEMPLATES = [
    ("Paradise Biriyani", "biryani", "N/A", "Hyderabad Zone"),
    ("KFC", "burger", "3.8", "Hi-Tech City"),
    ("Pizza Hut", "pizza", "3.9", "Jubilee Hills"),
    ("McDonald's", "burger", "3.7", "Banjara Hills"),
    ("Domino's Pizza", "pizza", "3.6", "Kondapur"),
    ("Burger King", "burger", "3.8", "Gachibowli"),
    ("Subway", "sandwich", "3.9", "Madhapur"),
    ("Cream Stone", "ice_cream", "4.2", "Jubilee Hills"),
    ("Barista", "coffee_shop", "3.5", "Banjara Hills"),
    ("Cafe Coffee Day", "coffee_shop", "3.4", "Hi-Tech City"),
    ("Taj Falaknama Palace", "fine_dining", "4.7", "Falaknuma"),
    ("Olive Garden", "italian", "4.1", "Jubilee Hills"),
    ("Mainland China", "chinese", "4.0", "Banjara Hills"),
    ("Mamagoto", "chinese", "3.9", "Kondapur"),
    ("Pista House", "biryani", "4.0", "Hyderabad Zone"),
    ("Shah Ghouse Hotel", "biryani", "4.1", "Tolichowki"),
    ("Nectar Kitchen & Bar", "indian", "4.3", "Jubilee Hills"),
    ("Absolute Barbecues", "indian", "4.4", "Jubilee Hills"),
    ("Karachi Cafe", "south_indian", "4.2", "Secunderabad"),
    ("Imperial Multi-Cuisine", "indian", "3.8", "Gachibowli"),
    ("Grameen Kangan", "indian", "3.6", "Madhapur"),
    ("Sizza", "pizza", "3.5", "Kukatpally"),
    ("Fried Rice Center", "chinese", "3.4", "SR Nagar"),
    ("Dhabha", "indian", "3.7", "Mehdipatnam"),
    ("Amul Ice Cream Parlour", "ice_cream", "4.1", "Banjara Hills"),
    ("Hitech Bawarchi", "indian", "3.8", "Madhapur"),
    ("Universal Biryani Point", "biryani", "4.0", "Langer Houz"),
    ("Blue Fox", "fine_dining", "4.2", "Banjara Hills"),
    ("Chili's American Grill", "american", "3.9", "Jubilee Hills"),
    ("Itmenaan Biryani", "biryani", "4.3", "Attapur"),
    ("The Biryani House", "biryani", "4.1", "Charminar"),
    ("Meridian Restaurant", "indian", "3.7", "Koti"),
    ("Spice Khazana", "indian", "3.8", "Abids"),
    ("Delhi Dhaba", "indian", "3.5", "Koti"),
    ("Aromas of China", "chinese", "3.9", "Banjara Hills"),
    ("Tara Birista", "biryani", "4.0", "Shamshabad"),
    ("Hyderabadi Dum Biryani", "biryani", "4.4", "Salar Jung Colony"),
    ("Lucky Restaurant", "indian", "3.6", "Nampally"),
    ("Almond House", "dessert", "4.1", "Secunderabad"),
    ("Sweet Magic", "dessert", "3.8", "Banjara Hills"),
    ("Haldiram's", "indian", "3.7", "Abids"),
    ("Namaste", "south_indian", "3.9", "Koti"),
    ("Mossk Coffee", "coffee_shop", "3.5", "Gachibowli"),
    ("Starbucks", "coffee_shop", "3.8", "Jubilee Hills"),
    ("Costa Coffee", "coffee_shop", "3.6", "Banjara Hills"),
    ("Chaayos", "tea", "3.7", "Hi-Tech City"),
    ("Madhura Sweets", "dessert", "4.0", "Secunderabad"),
    ("MTR", "south_indian", "4.2", "Brabourne Road"),
    ("Vellore Kitchen", "south_indian", "4.1", "Madhura"),
    ("Chennai Kitchen", "south_indian", "4.0", "Charminar"),
    ("A2B", "south_indian", "4.1", "Koti"),
    ("Kritunga", "south_indian", "3.8", "Abids"),
    ("爪子小笼包", "chinese", "4.0", "Banjara Hills"),
    ("Korean Restaurant", "korean", "3.9", "Jubilee Hills"),
    ("Sushi Bay", "sushi", "4.1", "Banjara Hills"),
    ("Thai Street Food", "thai", "3.8", "Kondapur"),
    ("Mexican Loco", "mexican", "3.7", "Jubilee Hills"),
    ("Spice Garden", "indian", "3.6", "Madhapur"),
    ("Royal China", "chinese", "4.1", "Banjara Hills"),
    ("Effingut Brewerkz", "indian", "4.2", "Jubilee Hills"),
    ("The Fisherman's Wharf", "seafood", "4.3", "Banjara Hills"),
    ("Kashmir Grill", "indian", "3.9", "Banjara Hills"),
    ("Punjabi Grill", "indian", "3.8", "Abids"),
    ("Bawarchi Biryani", "biryani", "4.3", "Banjara Hills"),
    ("Café Eclare", "coffee_shop", "3.9", "Jubilee Hills"),
    ("Gloria Jean's", "coffee_shop", "3.5", "Banjara Hills"),
    ("Taco Bell", "mexican", "3.6", "Kondapur"),
    ("Wow Momo", "nepalese", "3.8", "Madhapur"),
    ("Wendy's", "burger", "3.7", "Gachibowli"),
    ("FreshMenu", "indian", "3.4", "Hi-Tech City"),
    ("BOX8", "indian", "3.6", "Madhapur"),
    ("Food Bucket", "indian", "3.5", "Kukatpally"),
    ("Zorkem", "indian", "3.8", "Secunderabad"),
    ("Deccan Spice", "indian", "4.0", "Charminar"),
    ("Paradise", "biryani", "4.2", "Secunderabad"),
    ("Sagar Ratna", "south_indian", "4.1", "Abids"),
    ("Sagar", "south_indian", "4.0", "Banjara Hills"),
    ("Aditya", "south_indian", "3.9", "Koti"),
    ("Maharaja's", "indian", "4.1", "Secunderabad"),
    ("The Yellow Chilli", "indian", "4.2", "Banjara Hills"),
    ("Showline", "indian", "3.8", "Abids"),
    ("Grand Hotel", "indian", "4.0", "Secunderabad"),
    ("Minerva Coffee House", "south_indian", "4.1", "Secunderabad"),
    ("Crystal", "indian", "3.9", "Koti"),
    ("Blue Danube", "indian", "4.0", "Banjara Hills"),
    ("Little Italy", "italian", "3.9", "Jubilee Hills"),
    ("Serenity", "indian", "4.1", "Jubilee Hills"),
    ("F张嘴", "chinese", "4.0", "Banjara Hills"),
    ("Rajdhani", "indian", "3.7", "Madhapur"),
    ("Kaveri", "south_indian", "4.2", "Secunderabad"),
    ("Anand", "south_indian", "4.1", "Banjara Hills"),
    ("Sujatha", "south_indian", "4.0", "Koti"),
    ("Madhura", "south_indian", "3.9", "Mehdipatnam"),
    ("Taj Restaurant", "indian", "4.3", "Falaknuma"),
    ("Parthena", "greek", "3.8", "Jubilee Hills"),
    ("Ichiban", "japanese", "4.0", "Banjara Hills"),
    ("Yum", "indian", "3.6", "Madhapur"),
    ("Bengaluru Express", "indian", "3.7", "Gachibowli"),
]

AREAS = [
    "Jubilee Hills", "Banjara Hills", "Hi-Tech City", "Gachibowli", "Kondapur",
    "Madhapur", "SR Nagar", "Kukatpally", "Bachupally", "Miyapur",
    "Koti", "Abids", "Secunderabad", "Falaknuma", "Charminar",
    "Tolichowki", "Mehdipatnam", "Langer Houz", "Attapur", "Salar Jung Colony",
    "Brabourne Road", "Nampally", "Shamshabad", "Lingampally", "Patancheru",
]


def generate_lat_lng_in_radius(center_lat, center_lng, radius_km):
    r = radius_km * 1000
    u = random.random()
    v = random.random()
    w = r * math.sqrt(u)
    t = 2 * math.pi * v
    x = w * math.cos(t)
    y = w * math.sin(t)
    lat_offset = (y / EARTH_RADIUS_M) * (180 / math.pi)
    lng_offset = (x / (EARTH_RADIUS_M * math.cos(math.radians(center_lat)))) * (180 / math.pi)
    return center_lat + lat_offset, center_lng + lng_offset


def generate_restaurants(count=80):
    restaurants = []
    used_names = set()
    areas_pool = AREAS * (len(RESTAURANT_TEMPLATES) // len(AREAS) + 2)

    for i in range(count):
        if i < len(RESTAURANT_TEMPLATES):
            name, cuisine, rating, _ = RESTAURANT_TEMPLATES[i]
        else:
            name = f"{random.choice(['Royal', 'Urban', 'Fresh', 'Tasty', 'Golden', 'Spicy', 'Deluxe', 'Classic', 'Authentic', 'Original'])} {random.choice(['Kitchen', 'Grill', 'Bistro', 'House', 'Cafe', 'Diner', 'Point', 'Hub', 'Eatery', 'Restaurant'])}"
            cuisine = random.choice(list(set(c[1] for c in RESTAURANT_TEMPLATES)))
            rating = f"{random.uniform(3.0, 4.5):.1f}"

        if name in used_names:
            name = f"{name} {random.choice(['Express', '2', 'Outlet', 'Hub', 'X'])}"
        used_names.add(name)

        lat, lng = generate_lat_lng_in_radius(AREA_CENTER_LAT, AREA_CENTER_LNG, RADIUS_KM)
        area = areas_pool[i % len(areas_pool)]
        address = f"{area}, Hyderabad"

        restaurants.append({
            "name": name,
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "address": address,
            "area": area,
            "cuisine": cuisine,
            "rating": rating,
            "source": "generated",
        })

    return restaurants


def upsert_to_db(restaurants):
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
                address=r["address"],
                area=r["area"],
                cuisine=r["cuisine"],
                rating=r["rating"],
                source=r["source"],
                menu_scraped=False,
            )
            db.add(rest)

        db.commit()
        print(f"Upserted {len(new_restaurants)} new restaurants to DB.")


def main(csv_only: bool, count: int):
    output_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "restaurants_cleaned.csv")
    restaurants = generate_restaurants(count=count)

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "lat", "lng", "address", "area", "cuisine", "rating", "source"])
        writer.writeheader()
        writer.writerows(restaurants)
    print(f"Generated {len(restaurants)} restaurants -> {output_path}")

    if not csv_only:
        upsert_to_db(restaurants)

    return restaurants


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic restaurant data")
    parser.add_argument("--csv", action="store_true", help="Save to CSV only, skip DB upsert")
    parser.add_argument("--count", type=int, default=80, help="Number of restaurants to generate (default: 80)")
    args = parser.parse_args()
    main(csv_only=args.csv, count=args.count)
