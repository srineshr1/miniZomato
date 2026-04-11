export interface Restaurant {
  id: number;
  name: string;
  lat: number;
  lng: number;
  address: string;
  area: string;
  cuisine: string;
  rating: string;
  source: string;
}

export const restaurants: Restaurant[] = [
  { id: 344033876, name: "KFC", lat: 17.4507642, lng: 78.3793915, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "chicken", rating: "N/A", source: "osm" },
  { id: 344033883, name: "Pizza Corner", lat: 17.4506168, lng: 78.3792198, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "pizza", rating: "N/A", source: "osm" },
  { id: 344033897, name: "Windows of the World", lat: 17.4502975, lng: 78.3816574, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "Varied", rating: "N/A", source: "osm" },
  { id: 349270034, name: "Olive Garden", lat: 17.4450343, lng: 78.3859699, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "italian", rating: "N/A", source: "osm" },
  { id: 654882404, name: "McDonald's", lat: 17.4346181, lng: 78.3864731, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "burger", rating: "N/A", source: "osm" },
  { id: 660914316, name: "Something Fishy", lat: 17.4314951, lng: 78.3887075, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "Varied", rating: "N/A", source: "osm" },
  { id: 708303182, name: "Hi-Tech Bawarchi", lat: 17.4410683, lng: 78.391636, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "Varied", rating: "N/A", source: "osm" },
  { id: 817353816, name: "Cafe Coffee Day", lat: 17.435846, lng: 78.4016464, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "coffee_shop", rating: "N/A", source: "osm" },
  { id: 817353890, name: "Cocos", lat: 17.4239168, lng: 78.4247745, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "indian", rating: "N/A", source: "osm" },
  { id: 817354056, name: "Blue Fox", lat: 17.4232236, lng: 78.4275415, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "Varied", rating: "N/A", source: "osm" },
  { id: 1042239879, name: "Subway", lat: 17.4579981, lng: 78.3716555, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "sandwich", rating: "N/A", source: "osm" },
  { id: 1042239883, name: "Barista", lat: 17.4579701, lng: 78.3717132, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "coffee_shop", rating: "N/A", source: "osm" },
  { id: 1275490943, name: "Pizza Hut", lat: 17.4453139, lng: 78.3863774, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "pizza", rating: "N/A", source: "osm" },
  { id: 1642224750, name: "Paradise Biriyani", lat: 17.4506315, lng: 78.3792865, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "Varied", rating: "N/A", source: "osm" },
  { id: 1885680325, name: "Cream Stone", lat: 17.4248564, lng: 78.4220264, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "ice_cream", rating: "N/A", source: "osm" },
  { id: 1885682076, name: "Berry Cool", lat: 17.425056, lng: 78.4214256, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "ice_cream", rating: "N/A", source: "osm" },
  { id: 2093444964, name: "Domino's", lat: 17.441271, lng: 78.358934, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "pizza", rating: "N/A", source: "osm" },
  { id: 2352130366, name: "Domino's", lat: 17.4308718, lng: 78.421055, address: "jubleehills, hyderabad", area: "Hyderabad Zone", cuisine: "pizza", rating: "N/A", source: "osm" },
  { id: 3159028268, name: "Paradise", lat: 17.4506148, lng: 78.3791786, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "indian", rating: "N/A", source: "osm" },
  { id: 3159028270, name: "Mainland China", lat: 17.4506078, lng: 78.3808666, address: "Hitec City - Kondapur Main Road", area: "Hyderabad Zone", cuisine: "chinese", rating: "N/A", source: "osm" },
  { id: 4566238603, name: "Absolute Barbecues (ABs)", lat: 17.4383572, lng: 78.3977922, address: "Jubilee Hills Road No 36", area: "Hyderabad Zone", cuisine: "Varied", rating: "N/A", source: "osm" },
  { id: 5289166893, name: "McDonald's", lat: 17.4480015, lng: 78.3789451, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "burger", rating: "N/A", source: "osm" },
  { id: 5515637837, name: "Starbucks", lat: 17.4414532, lng: 78.3807897, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "coffee_shop", rating: "N/A", source: "osm" },
  { id: 5515637838, name: "Domino's", lat: 17.4413058, lng: 78.3808629, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "pizza", rating: "N/A", source: "osm" },
  { id: 5973746986, name: "ISTANBUL AUTHENTIC DONER KEBAB", lat: 17.4306846, lng: 78.4080527, address: "Jubilee Hills Road No 36", area: "Hyderabad Zone", cuisine: "Varied", rating: "N/A", source: "osm" },
  { id: 6369867752, name: "Chai village", lat: 17.4409109, lng: 78.4431992, address: "Road No. 1 SR Nagar", area: "Hyderabad Zone", cuisine: "Varied", rating: "N/A", source: "osm" },
  { id: 6868660390, name: "Domino's", lat: 17.4559975, lng: 78.4227013, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "pizza", rating: "N/A", source: "osm" },
  { id: 7248877413, name: "Shah Ghouse", lat: 17.4266793, lng: 78.3764491, address: "Old Bombay Highway, Hyderabad", area: "Hyderabad Zone", cuisine: "Varied", rating: "N/A", source: "osm" },
  { id: 7721071786, name: "McDonald's", lat: 17.4572696, lng: 78.3643728, address: "Gachibowli - Miyapur Highway", area: "Hyderabad Zone", cuisine: "burger", rating: "N/A", source: "osm" },
  { id: 10178228307, name: "Nectar Kitchen & Bar", lat: 17.4384489, lng: 78.3990271, address: "Jubilee Hills Road No 36, Hyderabad", area: "Hyderabad Zone", cuisine: "indian, chinese, dessert, pizza, burger, chicken, kebab, ice_cream, seafood, juice", rating: "N/A", source: "osm" },
  { id: 10718148977, name: "Karachi Cafe", lat: 17.4415605, lng: 78.3767286, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "Varied", rating: "N/A", source: "osm" },
  { id: 10718148978, name: "Burger King", lat: 17.4416568, lng: 78.376817, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "burger", rating: "N/A", source: "osm" },
  { id: 10790318144, name: "Pista House", lat: 17.4316137, lng: 78.3720027, address: "Hyderabad", area: "Hyderabad Zone", cuisine: "Varied", rating: "N/A", source: "osm" },
  { id: 12695800228, name: "Stellar Reserve", lat: 17.4226437, lng: 78.4109735, address: "Nandagiri Hills, Jubilee Hills, Hyderabad", area: "Hyderabad Zone", cuisine: "american, italian, bakery, asian, cafe, burger, pizza", rating: "N/A", source: "osm" },
  { id: 12972335837, name: "Mamagoto", lat: 17.4580228, lng: 78.3729279, address: "Hitec City - Kondapur Main Road, Hyderabad", area: "Hyderabad Zone", cuisine: "chinese", rating: "N/A", source: "osm" },
  { id: 12972335840, name: "Taara South Indian Kitchen", lat: 17.4573947, lng: 78.3720037, address: "Hitec City - Kondapur Main Road, Hyderabad", area: "Hyderabad Zone", cuisine: "indian", rating: "N/A", source: "osm" },
];