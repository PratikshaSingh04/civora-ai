import requests

API_KEY = "ca6a6a82611269912a4cc87d203df0fd1b5d0555fa1bb902d94502a5db380d85"

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