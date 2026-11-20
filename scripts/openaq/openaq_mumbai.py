import os
import requests

API_KEY = os.getenv("OPENAQ_API_KEY", "")

url = "https://api.openaq.org/v3/locations"

params = {
    "coordinates": "19.113,72.867",
    "radius": 10000,
    "limit": 100
}

headers = {
    "X-API-Key": API_KEY
}

response = requests.get(url, params=params, headers=headers)

print("Status:", response.status_code)

data = response.json()

for location in data.get("results", []):
    print(
        location["id"],
        "|",
        location.get("name"),
        "|",
        location["coordinates"]["latitude"],
        location["coordinates"]["longitude"]
    )