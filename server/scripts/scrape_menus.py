"""
Scrape restaurant menus from Google Maps and store in DB.
Falls back to generated menus when scraping fails.
Run from server/ directory: python scripts/scrape_menus.py
"""

import sys
import os
import time
import random
import math
import re

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

AREA_CENTER_LAT = 17.4369
AREA_CENTER_LNG = 78.4001
AREA_RADIUS_KM = 5
EARTH_RADIUS_M = 6371000
REQUEST_DELAY = 3

from app.config import settings
engine = create_engine(settings.DATABASE_URL)


def haversine_m(lat1, lng1, lat2, lng2):
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (math.sin(d_lat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2)
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def in_zone(lat, lng):
    return haversine_m(lat, lng, AREA_CENTER_LAT, AREA_CENTER_LNG) <= AREA_RADIUS_KM * 1000


CUISINE_MENUS = {
    "chicken": [
        ("Chicken Biryani", "BIRYANI", "🍗", 280, "Fragrant basmati rice with tender chicken"),
        ("Chicken 65", "BIRYANI", "🍗", 220, "Deep-fried spiced chicken appetizer"),
        ("Tandoori Chicken", "BIRYANI", "🍗", 320, "Clay oven roasted chicken with spices"),
        ("Chicken Curry", "BIRYANI", "🍗", 260, "Slow-cooked chicken in aromatic curry"),
        ("Roasted Chicken", "BIRYANI", "🍗", 300, "Whole roasted chicken with herbs"),
        ("Chicken Tikka", "BIRYANI", "🍗", 280, "Grilled marinated chicken pieces"),
    ],
    "biryani": [
        ("Chicken Biryani", "BIRYANI", "🍗", 280, "Fragrant basmati rice with tender chicken"),
        ("Mutton Biryani", "BIRYANI", "🍗", 350, "Slow-cooked mutton with aromatic rice"),
        ("Veg Biryani", "BIRYANI", "🍗", 220, "Fragrant rice with mixed vegetables"),
        ("Kachi Biryani", "BIRYANI", "🍗", 300, "Raw meat biryani with yogurt marination"),
        ("Chicken 65 Biryani", "BIRYANI", "🍗", 310, "Biryani with fried chicken 65"),
        ("Dum Biryani", "BIRYANI", "🍗", 330, "Slow-cooked dum style biryani"),
    ],
    "pizza": [
        ("Margherita", "PIZZA", "🍕", 250, "Classic tomato, mozzarella, and basil"),
        ("Pepperoni", "PIZZA", "🍕", 420, "Double pepperoni with mozzarella"),
        ("Farmhouse", "PIZZA", "🍕", 380, "Mushrooms, capsicum, onions, tomatoes"),
        ("Veg Extravaganza", "PIZZA", "🍕", 450, "Loaded with all vegetables"),
        ("Mexican Wave", "PIZZA", "🍕", 400, "Jalapenos, peppers, beans, spicy"),
        ("Garlic Bread", "PIZZA", "🍕", 150, "Crispy bread with garlic butter"),
        ("Coke", "DRINKS", "🥤", 60, "500ml Coca-Cola"),
    ],
    "burger": [
        ("Cheeseburger", "BURGERS", "🍔", 220, "Single patty with melted cheese"),
        ("Chicken Burger", "BURGERS", "🍔", 280, "Crispy chicken patty with mayo"),
        ("Double Patty", "BURGERS", "🍔", 380, "Two beef patties with cheese"),
        ("Crispy Strips", "BURGERS", "🍔", 260, "Crispy chicken strips with dip"),
        ("Fries", "BURGERS", "🍟", 120, "Golden crispy fries"),
        ("Chocolate Shake", "DRINKS", "🥤", 180, "Thick chocolate milkshake"),
        ("Veggie Burger", "BURGERS", "🍔", 200, "Crispy vegetable patty burger"),
    ],
    "chinese": [
        ("Hakka Noodles", "NOODLES", "🍜", 220, "Stir-fried noodles with vegetables"),
        ("Chicken Fried Rice", "NOODLES", "🍚", 250, "Wok-fried rice with chicken"),
        ("Manchurian Dry", "NOODLES", "🍗", 280, "Crispy fried chicken in manchurian sauce"),
        ("Schezwan Fried Rice", "NOODLES", "🍚", 270, "Spicy schezwan sauce fried rice"),
        ("Spring Rolls", "NOODLES", "🥟", 150, "Crispy vegetable spring rolls"),
        ("Paneer Chilli", "NOODLES", "🍳", 260, "Paneer in spicy chilli sauce"),
        ("Clear Soup", "NOODLES", "🍜", 100, "Light vegetable clear soup"),
    ],
    "south_indian": [
        ("Masala Dosa", "BIRYANI", "🫓", 120, "Crispy crepe with spiced potatoes"),
        ("Idli Vada", "BIRYANI", "🍚", 100, "Steamed rice cakes with lentil fritters"),
        ("Rava Dosa", "BIRYANI", "🫓", 140, "Crispy semolina dosa"),
        ("Uttapam", "BIRYANI", "🍳", 130, "Thick pancake with toppings"),
        ("Filter Coffee", "DRINKS", "☕", 60, "Traditional South Indian filter coffee"),
        ("Medu Vada", "BIRYANI", "🍩", 110, "Crispy lentil fritters"),
        ("Pongal", "BIRYANI", "🍚", 120, "Rice and lentil comfort dish"),
    ],
    "ice_cream": [
        ("Belgian Chocolate", "ICE_CREAM", "🍦", 195, "Rich Belgian chocolate ice cream"),
        ("Mango Sundae", "ICE_CREAM", "🍦", 180, "Fresh mango with ice cream"),
        ("Brownie Sundae", "ICE_CREAM", "🍫", 220, "Warm brownie with ice cream"),
        ("Classic Cone", "ICE_CREAM", "🍦", 90, "Single scoop in waffle cone"),
        ("Apple Pie", "ICE_CREAM", "🍎", 200, "Caramelized apple pie with ice cream"),
        ("Death By Chocolate", "ICE_CREAM", "🍫", 250, "Triple chocolate indulgence"),
    ],
    "coffee_shop": [
        ("Espresso", "DRINKS", "☕", 120, "Strong black coffee shot"),
        ("Cappuccino", "DRINKS", "☕", 180, "Espresso with steamed milk foam"),
        ("Cold Coffee", "DRINKS", "🧊", 200, "Iced coffee with ice cream"),
        ("Veg Sandwich", "BURGERS", "🥪", 220, "Grilled vegetable sandwich"),
        ("Chicken Sandwich", "BURGERS", "🥪", 260, "Grilled chicken sandwich"),
        ("Pastry", "HEALTHY", "🍰", 150, "Assorted cream pastry"),
        ("Bagel", "HEALTHY", "🥯", 130, "Toasted bagel with cream cheese"),
    ],
    "kebab": [
        ("Seekh Kebab", "BIRYANI", "🍢", 280, "Minced meat kebab on skewer"),
        ("Chicken Tikka", "BIRYANI", "🍗", 320, "Tandoori grilled chicken pieces"),
        ("Galouti Kebab", "BIRYANI", "🍖", 350, "Soft melt-in-mouth lamb kebab"),
        ("Roomali Roti", "BIRYANI", "🫓", 50, "Paper-thin flatbread"),
        ("Mint Raita", "HEALTHY", "🥣", 60, "Yogurt with mint sauce"),
        ("Mutton Curry", "BIRYANI", "🍖", 340, "Slow-cooked mutton in spices"),
    ],
    " Varied ": [
        ("Chicken Biryani", "BIRYANI", "🍗", 280, "Fragrant basmati rice with chicken"),
        ("Butter Chicken", "BIRYANI", "🍗", 320, "Creamy tomato butter chicken"),
        ("Naan", "BIRYANI", "🫓", 60, "Tandoori leavened flatbread"),
        ("Dal Makhani", "BIRYANI", "🍛", 220, "Creamy black lentils"),
        ("Veg Fried Rice", "NOODLES", "🍚", 180, "Wok-fried rice with vegetables"),
        ("Paneer Butter Masala", "BIRYANI", "🍳", 260, "Creamy paneer in tomato gravy"),
        ("Sweet Lassi", "DRINKS", "🥛", 100, "Sweet yogurt drink"),
    ],
    "indian": [
        ("Butter Chicken", "BIRYANI", "🍗", 320, "Creamy tomato butter chicken"),
        ("Naan", "BIRYANI", "🫓", 60, "Tandoori leavened flatbread"),
        ("Dal Makhani", "BIRYANI", "🍛", 220, "Creamy black lentils"),
        ("Raita", "HEALTHY", "🥣", 80, "Yogurt with cucumber and spices"),
        ("Sweet Lassi", "DRINKS", "🥛", 100, "Sweet yogurt drink"),
        ("Chicken Tikka", "BIRYANI", "🍗", 300, "Marinated grilled chicken"),
    ],
    "regional": [
        ("Hyderabadi Biryani", "BIRYANI", "🍗", 320, "Authentic Hyderabad style biryani"),
        ("Mirchi Ka Salan", "BIRYANI", "🌶️", 120, "Chilli curry with peanuts"),
        ("Dum Pukht", "BIRYANI", "🍖", 350, "Slow-cooked royal dish"),
        ("Khubani Ka Meetha", "HEALTHY", "🍑", 150, "Dried apricot dessert"),
        ("Sheer Khurma", "HEALTHY", "🥣", 180, "Vermicelli pudding with dates"),
    ],
    "italian": [
        ("Pasta Alfredo", "NOODLES", "🍝", 280, "Creamy white sauce pasta"),
        ("Lasagna", "NOODLES", "🍝", 340, "Layered pasta with meat sauce"),
        ("Chicken Parmesan", "BIRYANI", "🍗", 360, "Breaded chicken with pasta"),
        ("Minestrone Soup", "HEALTHY", "🍲", 180, "Italian vegetable soup"),
        ("Tiramisu", "HEALTHY", "🍰", 220, "Coffee layered dessert"),
        ("Garlic Bread", "PIZZA", "🍞", 150, "Crispy bread with garlic butter"),
    ],
    "japanese": [
        ("Chicken Teriyaki", "BIRYANI", "🍗", 320, "Grilled chicken with teriyaki sauce"),
        ("Sushi Roll", "BIRYANI", "🍣", 280, "Cucumber and avocado roll"),
        ("Ramen", "NOODLES", "🍜", 350, "Japanese noodle soup with chicken"),
        ("Edamame", "HEALTHY", "🫛", 150, "Steamed soybeans"),
        ("Miso Soup", "NOODLES", "🍲", 120, "Traditional miso soup"),
        ("Tempura", "BIRYANI", "🍤", 300, "Crispy battered shrimp"),
    ],
    "thai": [
        ("Pad Thai", "NOODLES", "🍜", 250, "Thai stir-fried noodles with shrimp"),
        ("Green Curry", "BIRYANI", "🍛", 300, "Coconut green curry with chicken"),
        ("Tom Yum Soup", "NOODLES", "🍲", 200, "Spicy and sour Thai soup"),
        ("Mango Sticky Rice", "HEALTHY", "🥭", 180, "Sweet mango with sticky rice"),
        ("Spring Rolls", "NOODLES", "🥟", 150, "Fresh Thai spring rolls"),
    ],
    "mexican": [
        ("Chicken Tacos", "BURGERS", "🌮", 220, "Three tacos with chicken filling"),
        ("Burrito Bowl", "BURGERS", "🥙", 280, "Rice bowl with beans and chicken"),
        ("Quesadilla", "BURGERS", "🌯", 250, "Grilled tortilla with cheese"),
        ("Nachos", "BURGERS", "🧀", 200, "Loaded nachos with cheese"),
        ("Guacamole", "HEALTHY", "🥑", 180, "Fresh avocado dip"),
        ("Churros", "HEALTHY", "🍫", 150, "Fried dough with chocolate sauce"),
    ],
    "korean": [
        ("Bibimbap", "NOODLES", "🍚", 320, "Mixed rice with vegetables and egg"),
        ("Tteokbokki", "NOODLES", "🍲", 250, "Spicy rice cakes"),
        ("Kimchi Fried Rice", "NOODLES", "🍚", 280, "Fried rice with kimchi"),
        ("Korean Fried Chicken", "BIRYANI", "🍗", 350, "Crispy fried chicken Korean style"),
        ("Japchae", "NOODLES", "🍜", 300, "Stir-fried glass noodles"),
    ],
    "seafood": [
        ("Fish Curry", "BIRYANI", "🐟", 320, "Coastal style fish curry"),
        ("Prawn Masala", "BIRYANI", "🦐", 380, "Spicy prawn masala"),
        ("Fish Fry", "BIRYANI", "🐟", 300, "Crispy fried fish with spices"),
        ("Crab Curry", "BIRYANI", "🦀", 420, "Fresh crab in spicy curry"),
        ("Prawn Tempura", "BIRYANI", "🍤", 350, "Crispy prawn tempura"),
    ],
    "american": [
        ("BBQ Ribs", "BIRYANI", "🍖", 450, "Smoky BBQ pork ribs"),
        ("Mac & Cheese", "NOODLES", "🧀", 250, "Creamy macaroni and cheese"),
        ("Coleslaw", "HEALTHY", "🥗", 120, "Creamy cabbage slaw"),
        ("Cornbread", "HEALTHY", "🍞", 100, "Sweet corn bread"),
        ("Wings", "BIRYANI", "🍗", 320, "Buffalo chicken wings"),
    ],
    "asian": [
        ("Dim Sum", "NOODLES", "🥟", 280, "Steamed dumplings"),
        ("Dan Dan Noodles", "NOODLES", "🍜", 260, "Sichuan spicy noodles"),
        ("Kung Pao Chicken", "BIRYANI", "🍗", 300, "Spicy stir-fried chicken"),
        ("Fried Wontons", "NOODLES", "🥟", 180, "Crispy fried wontons"),
        ("Hot & Sour Soup", "NOODLES", "🍲", 140, "Spicy and tangy soup"),
    ],
    "fast_food": [
        ("Chicken McNuggets", "BURGERS", "🍗", 220, "Crispy chicken nuggets"),
        ("French Fries", "BURGERS", "🍟", 120, "Golden crispy fries"),
        ("Veg Maharaja Mac", "BURGERS", "🍔", 200, "Veg double patty burger"),
        ("McChicken", "BURGERS", "🍔", 240, "Crispy chicken burger"),
        ("Ice Cream Sundae", "ICE_CREAM", "🍦", 120, "Soft serve with toppings"),
        ("Coke", "DRINKS", "🥤", 60, "500ml Coca-Cola"),
    ],
    "juice": [
        ("Fresh Orange Juice", "DRINKS", "🍊", 120, "Freshly squeezed orange juice"),
        ("Mango Smoothie", "DRINKS", "🥭", 180, "Fresh mango milkshake"),
        ("Green Detox", "DRINKS", "🥬", 200, "Green vegetable juice blend"),
        ("Energy Booster", "DRINKS", "🍌", 220, "Banana and protein shake"),
        ("Coconut Water", "DRINKS", "🥥", 80, "Fresh coconut water"),
    ],
    "bubble_tea": [
        ("Classic Milk Tea", "DRINKS", "🧋", 150, "Taiwanese milk tea with tapioca"),
        ("Taro Milk Tea", "DRINKS", "🧋", 180, "Purple taro bubble tea"),
        ("Brown Sugar Milk", "DRINKS", "🧋", 200, "Brown sugar boba milk tea"),
        ("Matcha Latte", "DRINKS", "🍵", 220, "Japanese matcha with milk"),
        ("Passion Fruit Green", "DRINKS", "🍋", 180, "Green tea with passion fruit"),
    ],
    "bakery": [
        ("Chocolate Croissant", "HEALTHY", "🥐", 150, "Buttery flaky croissant"),
        ("Blueberry Muffin", "HEALTHY", "🧁", 130, "Fresh blueberry muffin"),
        ("Cinnamon Roll", "HEALTHY", "🍥", 140, "Warm cinnamon roll with glaze"),
        ("Cheesecake", "HEALTHY", "🍰", 220, "New York style cheesecake"),
        ("Almond Croissant", "HEALTHY", "🥐", 180, "Croissant with almond paste"),
    ],
    "dessert": [
        ("Chocolate Lava Cake", "HEALTHY", "🍫", 250, "Warm chocolate cake with molten center"),
        ("Gulab Jamun", "HEALTHY", "🟤", 120, "Fried milk balls in sugar syrup"),
        ("Rasmalai", "HEALTHY", "🧁", 150, "Soft cottage cheese in milk"),
        ("Tiramisu", "HEALTHY", "🍰", 250, "Coffee layered dessert"),
        ("Ice Cream Sundae", "ICE_CREAM", "🍦", 200, "Vanilla ice cream with toppings"),
    ],
    "noodle": [
        ("Veg Noodles", "NOODLES", "🍜", 180, "Stir-fried vegetable noodles"),
        ("Chicken Noodles", "NOODLES", "🍜", 220, "Stir-fried chicken noodles"),
        ("Schezwan Noodles", "NOODLES", "🍜", 240, "Spicy schezwan sauce noodles"),
        ("Triple Noodles", "NOODLES", "🍜", 280, "Loaded noodles with multiple proteins"),
        ("Soup Noodles", "NOODLES", "🍲", 200, "Noodles in hot savory broth"),
    ],
    "sandwich": [
        ("Club Sandwich", "BURGERS", "🥪", 220, "Triple-decker with chicken"),
        ("Grilled Cheese", "BURGERS", "🧀", 180, "Melted cheese grilled sandwich"),
        ("Chicken Caesar Wrap", "BURGERS", "🌯", 260, "Caesar salad in a wrap"),
        ("Veggie Wrap", "BURGERS", "🌯", 200, "Fresh vegetables in a wrap"),
        ("BLT", "BURGERS", "🥓", 200, "Bacon, lettuce, tomato sandwich"),
    ],
    "tea": [
        ("Masala Chai", "DRINKS", "☕", 50, "Spiced Indian tea"),
        ("Green Tea", "DRINKS", "🍵", 80, "Pure green tea"),
        ("Elaichi Chai", "DRINKS", "☕", 60, "Cardamom flavored tea"),
        ("Ginger Tea", "DRINKS", "☕", 60, "Fresh ginger tea"),
        ("Kulhad Chai", "DRINKS", "🫖", 70, "Traditional clay pot tea"),
    ],
    " wraps": [
        ("Chicken Shawarma", "BURGERS", "🌯", 220, "Spiced chicken in pita bread"),
        ("Falafel Wrap", "BURGERS", "🌯", 180, "Crispy falafel with tahini"),
        ("Doner Kebab Wrap", "BURGERS", "🌯", 250, "Sliced meat in flatbread"),
        ("Hummus Wrap", "BURGERS", "🌯", 160, "Hummus and vegetable wrap"),
    ],
    "local": [
        ("Chapli Kebab", "BIRYANI", "🍢", 280, "Pakistani style minced meat kebab"),
        ("Sajji", "BIRYANI", "🍗", 400, "Balochi roasted chicken"),
        ("Peshawar Naan", "BIRYANI", "🫓", 80, "Stuffed flatbread from Peshawar"),
        ("Lobiya", "BIRYANI", "🍛", 180, "Black eyed peas curry"),
    ],
    "nepalese": [
        ("Momo", "NOODLES", "🥟", 200, "Nepali steamed dumplings"),
        ("Sekuwa", "BIRYANI", "🍗", 320, "Nepali grilled meat"),
        ("Dal Bhat", "BIRYANI", "🍛", 220, "Rice and lentil meal"),
        ("Tyko", "HEALTHY", "🍖", 280, "Nepali dried meat"),
    ],
    "indonesian": [
        ("Nasi Goreng", "NOODLES", "🍚", 250, "Indonesian fried rice"),
        ("Satay", "BIRYANI", "🍢", 300, "Grilled meat skewers with peanut sauce"),
        ("Rendang", "BIRYANI", "🍖", 350, "Slow-cooked beef in coconut milk"),
        ("Gado Gado", "HEALTHY", "🥗", 220, "Indonesian salad with peanut dressing"),
    ],
    "spanish": [
        ("Paella", "NOODLES", "🍚", 380, "Spanish rice with seafood"),
        ("Gazpacho", "HEALTHY", "🍲", 180, "Cold tomato soup"),
        ("Patatas Bravas", "HEALTHY", "🥔", 150, "Fried potatoes with spicy sauce"),
        ("Churros", "HEALTHY", "🍫", 160, "Fried dough with chocolate"),
    ],
    "vietnamese": [
        ("Pho", "NOODLES", "🍜", 280, "Vietnamese beef noodle soup"),
        ("Banh Mi", "BURGERS", "🥖", 220, "Vietnamese sandwich"),
        ("Spring Rolls", "NOODLES", "🥟", 180, "Fresh rice paper rolls"),
        ("Vietnamese Coffee", "DRINKS", "☕", 150, "Strong drip coffee with condensed milk"),
    ],
    "tex-mex": [
        ("Taco Bell", "BURGERS", "🌮", 200, "Crunchy taco with meat"),
        ("Burrito", "BURGERS", "🌯", 280, "Large tortilla with beans and rice"),
        (" Loaded Nachos", "BURGERS", "🧀", 250, "Tortilla chips with toppings"),
        ("Chimichanga", "BURGERS", "🌯", 300, "Deep-fried burrito"),
    ],
    "sushi": [
        ("California Roll", "BIRYANI", "🍣", 280, "Avocado and cucumber roll"),
        ("Spicy Tuna Roll", "BIRYANI", "🍣", 350, "Spicy tuna roll with mayo"),
        ("Dragon Roll", "BIRYANI", "🍣", 420, "Eel and avocado roll"),
        ("Miso Soup", "NOODLES", "🍲", 100, "Traditional miso soup"),
    ],
    "fried_chicken": [
        ("Zinger Bucket", "BURGERS", "🍗", 380, "5 piece crispy chicken bucket"),
        ("Hot Wings", "BURGERS", "🍗", 280, "Spicy fried chicken wings"),
        ("Chicken Strip", "BURGERS", "🍗", 220, "Single chicken strip"),
        ("Mashed Potato", "HEALTHY", "🥔", 120, "Creamy mashed potatoes"),
    ],
    "grill": [
        ("Tandoori Platter", "BIRYANI", "🍗", 480, "Mixed tandoori grill platter"),
        ("Paneer Tikka", "BIRYANI", "🍢", 280, "Grilled cottage cheese"),
        ("Lamb Chops", "BIRYANI", "🍖", 420, "Grilled lamb chops"),
        ("Afghani Chicken", "BIRYANI", "🍗", 340, "Creamy white grilled chicken"),
    ],
    "curry": [
        ("Butter Chicken", "BIRYANI", "🍗", 320, "Creamy butter chicken"),
        ("Rogan Josh", "BIRYANI", "🍖", 360, "Kashmiri lamb curry"),
        ("Prawn Curry", "BIRYANI", "🦐", 380, "Coastal prawn curry"),
        ("Kadai Paneer", "BIRYANI", "🍳", 280, "Paneer in spicy gravy"),
    ],
    "cake": [
        ("Black Forest", "HEALTHY", "🍫", 220, "Chocolate cake with cherries"),
        ("Red Velvet", "HEALTHY", "🎂", 250, "Red velvet cream cake"),
        ("Cheesecake", "HEALTHY", "🍰", 240, "New York style cheesecake"),
        ("Coffee Cake", "HEALTHY", "☕", 200, "Cake with coffee crumble"),
    ],
    "donut": [
        ("Glazed Donut", "HEALTHY", "🍩", 80, "Classic sugar glazed donut"),
        ("Chocolate Donut", "HEALTHY", "🍫", 100, "Chocolate iced donut"),
        ("Boston Cream", "HEALTHY", "🍩", 120, "Donut filled with cream"),
        ("Donut Holes", "HEALTHY", "🍩", 90, "Mini donut holes"),
    ],
    "fine_dining": [
        ("Tasting Menu", "BIRYANI", "🍽️", 1200, "5 course chef's tasting menu"),
        ("Lobster Thermidor", "BIRYANI", "🦞", 800, "Classic French lobster dish"),
        ("Wagyu Steak", "BIRYANI", "🥩", 1500, "Premium Japanese wagyu beef"),
        ("Foie Gras", "BIRYANI", "🍊", 600, "Duck liver delicacy"),
    ],
    "default": [
        ("Butter Chicken", "BIRYANI", "🍗", 320, "Creamy tomato butter chicken"),
        ("Biryani", "BIRYANI", "🍗", 280, "Fragrant rice with chicken"),
        ("Naan", "BIRYANI", "🫓", 60, "Tandoori flatbread"),
        ("Dal", "BIRYANI", "🍛", 180, "Lentil curry"),
        ("Rice", "BIRYANI", "🍚", 120, "Steamed basmati rice"),
        ("Raita", "HEALTHY", "🥣", 80, "Yogurt with spices"),
        ("Sweet Lassi", "DRINKS", "🥛", 100, "Sweet yogurt drink"),
    ],
}


def get_menu_for_cuisine(cuisine: str):
    cuisine_lower = cuisine.lower().strip()
    for key, items in CUISINE_MENUS.items():
        if key.lower() in cuisine_lower or cuisine_lower in key.lower():
            return items
    return CUISINE_MENUS["default"]


def parse_price(text: str) -> float | None:
    match = re.search(r'[\$₹]?\s*(\d+)', text.replace(',', ''))
    if match:
        return float(match.group(1))
    return None


def scrape_google_maps_menu(restaurant_name: str, page) -> list[dict]:
    try:
        search_url = f"https://www.google.com/maps/search/{restaurant_name.replace(' ', '+')}+Hyderabad"
        page.goto(search_url, wait_until="domcontentloaded", timeout=15000)
        time.sleep(random.uniform(2, 4))

        for _ in range(3):
            try:
                page.click('[aria-label*="Menu"]', timeout=3000)
                time.sleep(2)
                break
            except Exception:
                page.keyboard.press("Tab")
                time.sleep(0.5)

        content = page.content()
        soup = BeautifulSoup(content, "lxml")

        menu_items = []
        selectors = [
            "[class*='menu']", "[class*='Menu']",
            "[class*='item']", "[class*='Item']",
            "[class*='list'] [class*='item']",
        ]

        for sel in selectors:
            for el in soup.select(sel):
                text = el.get_text(separator=" ", strip=True)
                if len(text) > 4 and len(text) < 200:
                    price = parse_price(text)
                    name = re.sub(r'[\$₹]?\d+[\$₹]?\s*$', '', text).strip()
                    name = re.sub(r'^\d+\.?\s*', '', name).strip()
                    if name and len(name) > 2:
                        menu_items.append({
                            "name": name[:100],
                            "price": price if price else None,
                            "raw": text[:200],
                        })
                if len(menu_items) >= 20:
                    break
            if len(menu_items) >= 5:
                break

        seen = set()
        deduped = []
        for item in menu_items:
            key = item["name"].lower()[:30]
            if key not in seen:
                seen.add(key)
                deduped.append(item)

        return deduped[:15]

    except Exception as e:
        print(f"  Scrape error: {e}")
        return []


def generate_food_items(cuisine: str, restaurant_name: str, restaurant_area: str):
    template = get_menu_for_cuisine(cuisine)
    items = []
    for name, category, emoji, base_price, description in template:
        price = base_price + random.randint(-20, 30)
        items.append({
            "name": name,
            "description": description,
            "price": max(50, price),
            "category": category,
            "emoji": emoji,
            "restaurant_name": restaurant_name,
            "restaurant_area": restaurant_area,
        })
    return items


def mark_restaurant_scraped(db, restaurant_id: int):
    from app.models.restaurant import Restaurant
    r = db.query(Restaurant).get(restaurant_id)
    if r:
        r.menu_scraped = True
        db.commit()


def scrape_all():
    from app.models.restaurant import Restaurant
    from app.models.food_item import FoodItem, FoodCategory
    from app.config import settings

    db_url = settings.DATABASE_URL
    engine = create_engine(db_url)

    with Session(engine) as db:
        db.execute(text("PRAGMA foreign_keys=off"))
        try:
            db.execute(text("ALTER TABLE food_items ADD COLUMN restaurant_id INTEGER"))
        except Exception:
            pass
        try:
            db.execute(text("ALTER TABLE restaurants ADD COLUMN menu_scraped BOOLEAN DEFAULT 0"))
        except Exception:
            pass
        db.commit()

    with Session(engine) as db:
        restaurants = db.query(Restaurant).all()
        print(f"Found {len(restaurants)} restaurants in DB")

        already_done = db.query(Restaurant).filter(Restaurant.menu_scraped == True).count()
        print(f"Already scraped: {already_done}")

        restaurants_to_scrape = [r for r in restaurants if not r.menu_scraped]
        print(f"Need to scrape: {len(restaurants_to_scrape)}")

        if not restaurants_to_scrape:
            print("All restaurants already scraped!")
            return

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
        page.set_default_timeout(20000)

        total = len(restaurants_to_scrape)
        for i, restaurant in enumerate(restaurants_to_scrape):
            print(f"[{i+1}/{total}] {restaurant.name} ({restaurant.cuisine})...", end=" ", flush=True)

            menu_data = scrape_google_maps_menu(restaurant.name, page)

            with Session(engine) as db_session:
                from app.models.restaurant import Restaurant as R
                from app.models.food_item import FoodItem as F
                from app.models.food_item import FoodCategory as FC

                r = db_session.query(R).get(restaurant.id)
                if not r:
                    browser.close()
                    return

                if menu_data and len(menu_data) >= 3:
                    added = 0
                    for item in menu_data:
                        if item["price"] is None:
                            item["price"] = 200 + len(item["name"]) * 3
                        try:
                            cat_str = "BIRYANI"
                            for c in ["PIZZA", "BURGERS", "NOODLES", "ICE_CREAM", "HEALTHY", "DRINKS"]:
                                if c.lower() in item["name"].lower():
                                    cat_str = c
                                    break
                            fc = FC[cat_str]
                        except Exception:
                            fc = FC.BIRYANI

                        food = F(
                            name=item["name"],
                            description=item.get("raw", item["name"]),
                            price=item["price"],
                            category=fc,
                            emoji="🍽️",
                            restaurant_name=r.name,
                            restaurant_area=r.area or "",
                            restaurant_id=r.id,
                            image_gradient="linear-gradient(135deg,#1a0f00,#2d1800)",
                        )
                        db_session.add(food)
                        added += 1

                    r.menu_scraped = True
                    db_session.commit()
                    print(f"scraped {added} items")
                else:
                    generated = generate_food_items(r.cuisine or "default", r.name, r.area or "")
                    for item in generated:
                        try:
                            fc = FC[item["category"]]
                        except Exception:
                            fc = FC.BIRYANI
                        food = F(
                            name=item["name"],
                            description=item["description"],
                            price=item["price"],
                            category=fc,
                            emoji=item["emoji"],
                            restaurant_name=r.name,
                            restaurant_area=r.area or "",
                            restaurant_id=r.id,
                            image_gradient="linear-gradient(135deg,#1a0f00,#2d1800)",
                        )
                        db_session.add(food)
                    r.menu_scraped = True
                    db_session.commit()
                    print(f"generated {len(generated)} items")

            time.sleep(REQUEST_DELAY + random.uniform(1, 3))

        browser.close()

    print("\nDone! All restaurants have menus.")


if __name__ == "__main__":
    scrape_all()
