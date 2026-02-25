import urllib.request
import json

token = "pk.eyJ1Ijoic2lkZGhhcnRoeDE3IiwiYSI6ImNtbHZ5NHd3NDA2cWEzZnF3MDh6cGtlZncifQ.k_80H99AtOTAyyqDTD4u1w"

# Mumbai as destination
dest_lat, dest_lng = 19.0760, 72.8777

# Test locations - simulate what would be in an itinerary for Mumbai
test_locations = [
    "Gateway of India",
    "Chhatrapati Shivaji Terminus",
    "Marine Drive",
    "Haji Ali Dargah",
    "Juhu Beach",
]

bbox = f"{dest_lng - 1},{dest_lat - 1},{dest_lng + 1},{dest_lat + 1}"

print(f"Destination: Mumbai ({dest_lat}, {dest_lng})")
print(f"Bounding box: {bbox}")
print("-" * 60)

for loc in test_locations:
    query = f"{loc}, Mumbai"
    encoded = urllib.request.quote(query)
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{encoded}.json?access_token={token}&limit=1&bbox={bbox}&proximity={dest_lng},{dest_lat}"
    
    try:
        resp = urllib.request.urlopen(url)
        data = json.loads(resp.read())
        if data["features"]:
            f = data["features"][0]
            coords = f["center"]
            print(f"OK  '{loc}' -> [{coords[1]:.4f}, {coords[0]:.4f}] ({f['place_name'][:60]})")
        else:
            print(f"MISS '{loc}' -> no results in bbox")
    except Exception as e:
        print(f"ERR  '{loc}' -> {e}")
