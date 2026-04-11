"""
Generate menus for all restaurants in the DB.
Fast version - no browser scraping, just generates realistic menus per cuisine.
Run: python scripts/generate_menus.py
"""

import sys
import os
import random
import math

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

EARTH_RADIUS_M = 6371000

engine = create_engine("sqlite:///./smartroute.db")


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
    ],
    "south_indian": [
        ("Masala Dosa", "BIRYANI", "🫓", 120, "Crispy crepe with spiced potatoes"),
        ("Idli Vada", "BIRYANI", "🍚", 100, "Steamed rice cakes with lentil fritters"),
        ("Rava Dosa", "BIRYANI", "🫓", 140, "Crispy semolina dosa"),
        ("Uttapam", "BIRYANI", "🍳", 130, "Thick pancake with toppings"),
        ("Filter Coffee", "DRINKS", "☕", 60, "Traditional South Indian filter coffee"),
        ("Medu Vada", "BIRYANI", "🍩", 110, "Crispy lentil fritters"),
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
    "indian": [
        ("Butter Chicken", "BIRYANI", "🍗", 320, "Creamy tomato butter chicken"),
        ("Naan", "BIRYANI", "🫓", 60, "Tandoori leavened flatbread"),
        ("Dal Makhani", "BIRYANI", "🍛", 220, "Creamy black lentils"),
        ("Raita", "HEALTHY", "🥣", 80, "Yogurt with cucumber and spices"),
        ("Sweet Lassi", "DRINKS", "🥛", 100, "Sweet yogurt drink"),
        ("Chicken Tikka", "BIRYANI", "🍗", 300, "Marinated grilled chicken"),
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
    ],
    "thai": [
        ("Pad Thai", "NOODLES", "🍜", 250, "Thai stir-fried noodles with shrimp"),
        ("Green Curry", "BIRYANI", "🍛", 300, "Coconut green curry with chicken"),
        ("Tom Yum Soup", "NOODLES", "🍲", 200, "Spicy and sour Thai soup"),
        ("Mango Sticky Rice", "HEALTHY", "🥭", 180, "Sweet mango with sticky rice"),
    ],
    "mexican": [
        ("Chicken Tacos", "BURGERS", "🌮", 220, "Three tacos with chicken filling"),
        ("Burrito Bowl", "BURGERS", "🥙", 280, "Rice bowl with beans and chicken"),
        ("Quesadilla", "BURGERS", "🌯", 250, "Grilled tortilla with cheese"),
        ("Nachos", "BURGERS", "🧀", 200, "Loaded nachos with cheese"),
        ("Guacamole", "HEALTHY", "🥑", 180, "Fresh avocado dip"),
    ],
    "korean": [
        ("Bibimbap", "NOODLES", "🍚", 320, "Mixed rice with vegetables and egg"),
        ("Tteokbokki", "NOODLES", "🍲", 250, "Spicy rice cakes"),
        ("Kimchi Fried Rice", "NOODLES", "🍚", 280, "Fried rice with kimchi"),
        ("Korean Fried Chicken", "BIRYANI", "🍗", 350, "Crispy fried chicken Korean style"),
    ],
    "seafood": [
        ("Fish Curry", "BIRYANI", "🐟", 320, "Coastal style fish curry"),
        ("Prawn Masala", "BIRYANI", "🦐", 380, "Spicy prawn masala"),
        ("Fish Fry", "BIRYANI", "🐟", 300, "Crispy fried fish with spices"),
        ("Crab Curry", "BIRYANI", "🦀", 420, "Fresh crab in spicy curry"),
    ],
    "american": [
        ("BBQ Ribs", "BIRYANI", "🍖", 450, "Smoky BBQ pork ribs"),
        ("Mac & Cheese", "NOODLES", "🧀", 250, "Creamy macaroni and cheese"),
        ("Wings", "BIRYANI", "🍗", 320, "Buffalo chicken wings"),
    ],
    "asian": [
        ("Dim Sum", "NOODLES", "🥟", 280, "Steamed dumplings"),
        ("Dan Dan Noodles", "NOODLES", "🍜", 260, "Sichuan spicy noodles"),
        ("Kung Pao Chicken", "BIRYANI", "🍗", 300, "Spicy stir-fried chicken"),
    ],
    "fast_food": [
        ("Chicken McNuggets", "BURGERS", "🍗", 220, "Crispy chicken nuggets"),
        ("French Fries", "BURGERS", "🍟", 120, "Golden crispy fries"),
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
    ],
    "bakery": [
        ("Chocolate Croissant", "HEALTHY", "🥐", 150, "Buttery flaky croissant"),
        ("Blueberry Muffin", "HEALTHY", "🧁", 130, "Fresh blueberry muffin"),
        ("Cinnamon Roll", "HEALTHY", "🍥", 140, "Warm cinnamon roll with glaze"),
        ("Cheesecake", "HEALTHY", "🍰", 220, "New York style cheesecake"),
    ],
    "dessert": [
        ("Chocolate Lava Cake", "HEALTHY", "🍫", 250, "Warm chocolate cake with molten center"),
        ("Gulab Jamun", "HEALTHY", "🟤", 120, "Fried milk balls in sugar syrup"),
        ("Rasmalai", "HEALTHY", "🧁", 150, "Soft cottage cheese in milk"),
        ("Tiramisu", "HEALTHY", "🍰", 250, "Coffee layered dessert"),
    ],
    "noodle": [
        ("Veg Noodles", "NOODLES", "🍜", 180, "Stir-fried vegetable noodles"),
        ("Chicken Noodles", "NOODLES", "🍜", 220, "Stir-fried chicken noodles"),
        ("Schezwan Noodles", "NOODLES", "🍜", 240, "Spicy schezwan sauce noodles"),
    ],
    "sandwich": [
        ("Club Sandwich", "BURGERS", "🥪", 220, "Triple-decker with chicken"),
        ("Grilled Cheese", "BURGERS", "🧀", 180, "Melted cheese grilled sandwich"),
        ("Chicken Caesar Wrap", "BURGERS", "🌯", 260, "Caesar salad in a wrap"),
        ("BLT", "BURGERS", "🥓", 200, "Bacon, lettuce, tomato sandwich"),
    ],
    "tea": [
        ("Masala Chai", "DRINKS", "☕", 50, "Spiced Indian tea"),
        ("Green Tea", "DRINKS", "🍵", 80, "Pure green tea"),
        ("Elaichi Chai", "DRINKS", "☕", 60, "Cardamom flavored tea"),
        ("Kulhad Chai", "DRINKS", "🫖", 70, "Traditional clay pot tea"),
    ],
    "wraps": [
        ("Chicken Shawarma", "BURGERS", "🌯", 220, "Spiced chicken in pita bread"),
        ("Falafel Wrap", "BURGERS", "🌯", 180, "Crispy falafel with tahini"),
        ("Doner Kebab Wrap", "BURGERS", "🌯", 250, "Sliced meat in flatbread"),
    ],
    "local": [
        ("Chapli Kebab", "BIRYANI", "🍢", 280, "Pakistani style minced meat kebab"),
        ("Sajji", "BIRYANI", "🍗", 400, "Balochi roasted chicken"),
        ("Peshawar Naan", "BIRYANI", "🫓", 80, "Stuffed flatbread from Peshawar"),
    ],
    "nepalese": [
        ("Momo", "NOODLES", "🥟", 200, "Nepali steamed dumplings"),
        ("Dal Bhat", "BIRYANI", "🍛", 220, "Rice and lentil meal"),
    ],
    "indonesian": [
        ("Nasi Goreng", "NOODLES", "🍚", 250, "Indonesian fried rice"),
        ("Satay", "BIRYANI", "🍢", 300, "Grilled meat skewers with peanut sauce"),
        ("Rendang", "BIRYANI", "🍖", 350, "Slow-cooked beef in coconut milk"),
    ],
    "spanish": [
        ("Paella", "NOODLES", "🍚", 380, "Spanish rice with seafood"),
        ("Patatas Bravas", "HEALTHY", "🥔", 150, "Fried potatoes with spicy sauce"),
    ],
    "vietnamese": [
        ("Pho", "NOODLES", "🍜", 280, "Vietnamese beef noodle soup"),
        ("Banh Mi", "BURGERS", "🥖", 220, "Vietnamese sandwich"),
        ("Spring Rolls", "NOODLES", "🥟", 180, "Fresh rice paper rolls"),
    ],
    "tex-mex": [
        ("Crunchy Taco", "BURGERS", "🌮", 200, "Crunchy taco with meat"),
        ("Burrito", "BURGERS", "🌯", 280, "Large tortilla with beans and rice"),
        ("Loaded Nachos", "BURGERS", "🧀", 250, "Tortilla chips with toppings"),
    ],
    "sushi": [
        ("California Roll", "BIRYANI", "🍣", 280, "Avocado and cucumber roll"),
        ("Spicy Tuna Roll", "BIRYANI", "🍣", 350, "Spicy tuna roll with mayo"),
        ("Dragon Roll", "BIRYANI", "🍣", 420, "Eel and avocado roll"),
    ],
    "fried_chicken": [
        ("Zinger Bucket", "BURGERS", "🍗", 380, "5 piece crispy chicken bucket"),
        ("Hot Wings", "BURGERS", "🍗", 280, "Spicy fried chicken wings"),
        ("Chicken Strip", "BURGERS", "🍗", 220, "Single chicken strip"),
    ],
    "grill": [
        ("Tandoori Platter", "BIRYANI", "🍗", 480, "Mixed tandoori grill platter"),
        ("Paneer Tikka", "BIRYANI", "🍢", 280, "Grilled cottage cheese"),
        ("Lamb Chops", "BIRYANI", "🍖", 420, "Grilled lamb chops"),
    ],
    "curry": [
        ("Butter Chicken", "BIRYANI", "🍗", 320, "Creamy butter chicken"),
        ("Rogan Josh", "BIRYANI", "🍖", 360, "Kashmiri lamb curry"),
        ("Prawn Curry", "BIRYANI", "🦐", 380, "Coastal prawn curry"),
    ],
    "cake": [
        ("Black Forest", "HEALTHY", "🍫", 220, "Chocolate cake with cherries"),
        ("Red Velvet", "HEALTHY", "🎂", 250, "Red velvet cream cake"),
        ("Cheesecake", "HEALTHY", "🍰", 240, "New York style cheesecake"),
    ],
    "donut": [
        ("Glazed Donut", "HEALTHY", "🍩", 80, "Classic sugar glazed donut"),
        ("Chocolate Donut", "HEALTHY", "🍫", 100, "Chocolate iced donut"),
        ("Boston Cream", "HEALTHY", "🍩", 120, "Donut filled with cream"),
    ],
    "fine_dining": [
        ("Tasting Menu", "BIRYANI", "🍽️", 1200, "5 course chef's tasting menu"),
        ("Lobster Thermidor", "BIRYANI", "🦞", 800, "Classic French lobster dish"),
        ("Wagyu Steak", "BIRYANI", "🥩", 1500, "Premium Japanese wagyu beef"),
    ],
    "international": [
        ("Chicken Biryani", "BIRYANI", "🍗", 280, "Fragrant basmati rice with chicken"),
        ("Butter Chicken", "BIRYANI", "🍗", 320, "Creamy tomato butter chicken"),
        ("Naan", "BIRYANI", "🫓", 60, "Tandoori flatbread"),
        ("Dal Makhani", "BIRYANI", "🍛", 220, "Creamy black lentils"),
        ("Veg Fried Rice", "NOODLES", "🍚", 180, "Wok-fried rice with vegetables"),
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

IMAGE_URLS = {
    "Chicken Biryani": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&h=420&fit=crop",
    "Mutton Biryani": "https://images.unsplash.com/photo-1642821373181-696a54913e93?w=600&h=420&fit=crop",
    "Veg Biryani": "https://images.unsplash.com/photo-1630383249896-424e482df921?w=600&h=420&fit=crop",
    "Butter Chicken": "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&h=420&fit=crop",
    "Chicken Tikka": "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&h=420&fit=crop",
    "Naan": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&h=420&fit=crop",
    "Dal Makhani": "https://images.unsplash.com/photo-1546833998-877b37c2e5c6?w=600&h=420&fit=crop",
    "Margherita": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&h=420&fit=crop",
    "Pepperoni": "https://images.unsplash.com/photo-1628840042765-356cda077dba?w=600&h=420&fit=crop",
    "Cheeseburger": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=420&fit=crop",
    "Double Patty": "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=600&h=420&fit=crop",
    "Veggie Burger": "https://images.unsplash.com/photo-1520072959219-c595dc870360?w=600&h=420&fit=crop",
    "Hakka Noodles": "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=600&h=420&fit=crop",
    "Chicken Fried Rice": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&h=420&fit=crop",
    "Schezwan Fried Rice": "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=600&h=420&fit=crop",
    "Pad Thai": "https://images.unsplash.com/photo-1559314809-0d1550143294?w=600&h=420&fit=crop",
    "Manchurian Dry": "https://images.unsplash.com/photo-1569058242567-93de6f36f8eb?w=600&h=420&fit=crop",
    "Masala Dosa": "https://images.unsplash.com/photo-1630383249896-424e482df921?w=600&h=420&fit=crop",
    "Idli Vada": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&h=420&fit=crop",
    "Filter Coffee": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&h=420&fit=crop",
    "Espresso": "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=600&h=420&fit=crop",
    "Cappuccino": "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=600&h=420&fit=crop",
    "Belgian Chocolate": "https://images.unsplash.com/photo-1570197571499-166b36435e9f?w=600&h=420&fit=crop",
    "Mango Sundae": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600&h=420&fit=crop",
    "Brownie Sundae": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&h=420&fit=crop",
    "Seekh Kebab": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&h=420&fit=crop",
    "Galouti Kebab": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=420&fit=crop",
    "Tandoori Chicken": "https://images.unsplash.com/photo-1599487488170-df0568f70950?w=600&h=420&fit=crop",
    "Chicken 65": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=600&h=420&fit=crop",
    "Pasta Alfredo": "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=600&h=420&fit=crop",
    "Lasagna": "https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=600&h=420&fit=crop",
    "Garlic Bread": "https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?w=600&h=420&fit=crop",
    "Tiramisu": "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&h=420&fit=crop",
    "Chicken Teriyaki": "https://images.unsplash.com/photo-1609183480237-ccdebc5f6b26?w=600&h=420&fit=crop",
    "Sushi Roll": "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=600&h=420&fit=crop",
    "Ramen": "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&h=420&fit=crop",
    "Green Curry": "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=600&h=420&fit=crop",
    "Tom Yum Soup": "https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=600&h=420&fit=crop",
    "Chicken Tacos": "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600&h=420&fit=crop",
    "Burrito Bowl": "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600&h=420&fit=crop",
    "Quesadilla": "https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=600&h=420&fit=crop",
    "Bibimbap": "https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=600&h=420&fit=crop",
    "Tteokbokki": "https://images.unsplash.com/photo-1612923521351-28c5c2ce6889?w=600&h=420&fit=crop",
    "Fish Curry": "https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?w=600&h=420&fit=crop",
    "BBQ Ribs": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=420&fit=crop",
    "Mac & Cheese": "https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?w=600&h=420&fit=crop",
    "Wings": "https://images.unsplash.com/photo-1608039755401-742074f0548d?w=600&h=420&fit=crop",
    "Chocolate Croissant": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&h=420&fit=crop",
    "Cheesecake": "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&h=420&fit=crop",
    "Chocolate Lava Cake": "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=600&h=420&fit=crop",
    "Fresh Orange Juice": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=600&h=420&fit=crop",
    "Mango Smoothie": "https://images.unsplash.com/photo-1546173159-315724a31696?w=600&h=420&fit=crop",
    "Classic Milk Tea": "https://images.unsplash.com/photo-1558857563-b371033873b8?w=600&h=420&fit=crop",
    "Taro Milk Tea": "https://images.unsplash.com/photo-1558857563-b371033873b8?w=600&h=420&fit=crop",
    "Veg Sandwich": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&h=420&fit=crop",
    "Club Sandwich": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&h=420&fit=crop",
    "Chicken Sandwich": "https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&h=420&fit=crop",
    "Fries": "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&h=420&fit=crop",
    "Momos": "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=600&h=420&fit=crop",
    "Paneer Tikka": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&h=420&fit=crop",
    "Spring Rolls": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=420&fit=crop",
    "Dim Sum": "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&h=420&fit=crop",
    "Samosa": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&h=420&fit=crop",
}

CUISINE_IMAGE_FALLBACK = {
    "chicken": "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=600&h=420&fit=crop",
    "biryani": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&h=420&fit=crop",
    "pizza": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&h=420&fit=crop",
    "burger": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=420&fit=crop",
    "ice_cream": "https://images.unsplash.com/photo-1570197571499-166b36435e9f?w=600&h=420&fit=crop",
    "chinese": "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=600&h=420&fit=crop",
    "south_indian": "https://images.unsplash.com/photo-1630383249896-424e482df921?w=600&h=420&fit=crop",
    "coffee_shop": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&h=420&fit=crop",
    "kebab": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&h=420&fit=crop",
    "indian": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&h=420&fit=crop",
    "varied": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=420&fit=crop",
    "regional": "https://images.unsplash.com/photo-1567337710282-00832b7d2a79?w=600&h=420&fit=crop",
    "italian": "https://images.unsplash.com/photo-1498579150354-977475b7ea0b?w=600&h=420&fit=crop",
    "japanese": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&h=420&fit=crop",
    "thai": "https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=600&h=420&fit=crop",
    "mexican": "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&h=420&fit=crop",
    "korean": "https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=600&h=420&fit=crop",
    "seafood": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&h=420&fit=crop",
    "american": "https://images.unsplash.com/photo-1550317138-10000687a72b?w=600&h=420&fit=crop",
    "asian": "https://images.unsplash.com/photo-1569058242567-93de6f36f8eb?w=600&h=420&fit=crop",
    "fast_food": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=420&fit=crop",
    "juice": "https://images.unsplash.com/photo-1622606579183-71a850b8d27e?w=600&h=420&fit=crop",
    "bubble_tea": "https://images.unsplash.com/photo-1558857563-b371033873b8?w=600&h=420&fit=crop",
    "bakery": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&h=420&fit=crop",
    "dessert": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600&h=420&fit=crop",
    "noodle": "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=600&h=420&fit=crop",
    "sandwich": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&h=420&fit=crop",
    "tea": "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&h=420&fit=crop",
    "wraps": "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600&h=420&fit=crop",
    "local": "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&h=420&fit=crop",
    "nepalese": "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=600&h=420&fit=crop",
    "indonesian": "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=600&h=420&fit=crop",
    "spanish": "https://images.unsplash.com/photo-1544511916-0148ccdeb877?w=600&h=420&fit=crop",
    "vietnamese": "https://images.unsplash.com/photo-1583168277918-355d9de45d17?w=600&h=420&fit=crop",
    "tex-mex": "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600&h=420&fit=crop",
    "sushi": "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=600&h=420&fit=crop",
    "fried_chicken": "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&h=420&fit=crop",
    "grill": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=420&fit=crop",
    "curry": "https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?w=600&h=420&fit=crop",
    "cake": "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&h=420&fit=crop",
    "donut": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600&h=420&fit=crop",
    "fine_dining": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=420&fit=crop",
    "international": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=420&fit=crop",
    "default": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=420&fit=crop",
}

ITEM_PREMUM_RATINGS = {
    "Galouti Kebab": 4.7, "Tandoori Platter": 4.7, "Wagyu Steak": 4.9, "Lobster Thermidor": 4.8,
    "Tasting Menu": 4.8, "Crab Curry": 4.6, "Prawn Masala": 4.6, "Mutton Biryani": 4.6,
    "Dragon Roll": 4.6, "Spicy Tuna Roll": 4.5, "Mango Sticky Rice": 4.4, "Bibimbap": 4.4,
    "Pad Thai": 4.3, "Lasagna": 4.4, "Chicken Teriyaki": 4.4, "Ramen": 4.5,
    "BBQ Ribs": 4.5, "Mac & Cheese": 4.2, "Cheesecake": 4.4, "Tiramisu": 4.5,
    "Brownie Sundae": 4.5, "Chocolate Lava Cake": 4.6, "Death By Chocolate": 4.6,
}


def get_item_image_url(item_name: str, cuisine: str) -> str:
    if item_name in IMAGE_URLS:
        return IMAGE_URLS[item_name]
    cuisine_lower = cuisine.lower().strip()
    for key in CUISINE_IMAGE_FALLBACK:
        if key.lower() in cuisine_lower or cuisine_lower in key.lower():
            return CUISINE_IMAGE_FALLBACK[key]
    return CUISINE_IMAGE_FALLBACK["default"]


def get_item_rating(item_name: str, category: str) -> float:
    if item_name in ITEM_PREMUM_RATINGS:
        return ITEM_PREMUM_RATINGS[item_name]
    base = random.uniform(3.5, 4.5)
    if category in ("HEALTHY", "DRINKS"):
        base += 0.1
    if category in ("FINE_DINING",):
        base += 0.3
    return round(min(base, 4.9), 1)


def get_menu_for_cuisine(cuisine: str):
    cuisine_lower = cuisine.lower().strip()
    for key in CUISINE_MENUS:
        if key.lower() in cuisine_lower or cuisine_lower in key.lower():
            return CUISINE_MENUS[key]
    return CUISINE_MENUS["default"]


def generate_menus():
    from app.models.restaurant import Restaurant
    from app.models.food_item import FoodItem, FoodCategory

    rescrape = len(sys.argv) > 1 and sys.argv[1] == "--rescrape"

    with Session(engine) as db:
        restaurants = db.query(Restaurant).all()
        print(f"Found {len(restaurants)} restaurants in DB")

        already_done = db.query(Restaurant).filter(Restaurant.menu_scraped == True).count()
        print(f"Already done: {already_done}")

        to_process = [r for r in restaurants if not r.menu_scraped]
        print(f"Generating menus for: {len(to_process)} restaurants")

        total_items = 0
        for i, restaurant in enumerate(to_process):
            template = get_menu_for_cuisine(restaurant.cuisine or "default")
            for name, category, emoji, base_price, description in template:
                price = base_price + random.randint(-20, 30)
                image_url = get_item_image_url(name, restaurant.cuisine or "default")
                item_rating = get_item_rating(name, category)
                food = FoodItem(
                    name=name,
                    description=description,
                    price=max(50, price),
                    category=FoodCategory[category],
                    emoji=emoji,
                    restaurant_name=restaurant.name,
                    restaurant_area=restaurant.area or "",
                    restaurant_id=restaurant.id,
                    image_gradient="linear-gradient(135deg,#1a0f00,#2d1800)",
                    rating=item_rating,
                    image_url=image_url,
                )
                db.add(food)
                total_items += 1

            restaurant.menu_scraped = True
            db.commit()
            print(f"[{i+1}/{len(to_process)}] {restaurant.name} -> {len(template)} items")

        if rescrape:
            print(f"\nRe-scrapping existing items to backfill image_url and rating...")
            existing_items = db.query(FoodItem).filter(
                (FoodItem.image_url == None) | (FoodItem.rating == None)
            ).all()
            print(f"Found {len(existing_items)} items needing backfill")
            for item in existing_items:
                cuisine = "default"
                if item.restaurant_name:
                    r = db.query(Restaurant).filter(Restaurant.name == item.restaurant_name).first()
                    if r and r.cuisine:
                        cuisine = r.cuisine
                if not item.image_url:
                    item.image_url = get_item_image_url(item.name, cuisine)
                if not item.rating:
                    item.rating = get_item_rating(item.name, item.category.value if item.category else "HEALTHY")
            db.commit()
            print(f"Backfilled {len(existing_items)} items")

    print(f"\nDone! Generated {total_items} new menu items across {len(to_process)} restaurants.")


if __name__ == "__main__":
    generate_menus()
