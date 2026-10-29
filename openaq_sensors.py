import requests
import csv
import time

API_KEY = "ca6a6a82611269912a4cc87d203df0fd1b5d0555fa1bb902d94502a5db380d85"

headers = {
    "X-API-Key": API_KEY
}

# K/East representative point
url = "https://api.openaq.org/v3/locations"

params = {
    "coordinates": "19.113,72.867",
    "radius": 10000,
    "limit": 100
}

response = requests.get(url, params=params, headers=headers)

print("Locations status:", response.status_code)

locations = response.json()["results"]

# Remove duplicate location IDs
unique_locations = {loc["id"]: loc for loc in locations}

print("Unique locations found:", len(unique_locations))

rows = []

for location_id, location in unique_locations.items():

    print("\nChecking:", location["name"], "| ID:", location_id)

    sensor_url = f"https://api.openaq.org/v3/locations/{location_id}/sensors"

    sensor_response = requests.get(
        sensor_url,
        headers=headers
    )

    if sensor_response.status_code != 200:
        print("Could not retrieve sensors")
        continue

    sensors = sensor_response.json().get("results", [])

    for sensor in sensors:

        parameter = sensor.get("parameter", {})

        rows.append({
            "location_id": location_id,
            "location_name": location["name"],
            "latitude": location["coordinates"]["latitude"],
            "longitude": location["coordinates"]["longitude"],
            "sensor_id": sensor.get("id"),
            "parameter": parameter.get("name"),
            "units": parameter.get("units")
        })

    time.sleep(0.2)


# Save results
output_file = "K_East_Air_Quality_Sensors.csv"

with open(output_file, "w", newline="", encoding="utf-8") as f:

    writer = csv.DictWriter(
        f,
        fieldnames=[
            "location_id",
            "location_name",
            "latitude",
            "longitude",
            "sensor_id",
            "parameter",
            "units"
        ]
    )

    writer.writeheader()
    writer.writerows(rows)

print("\n--------------------------------")
print("DONE!")
print("Total sensors:", len(rows))
print("Saved as:", output_file)
print("--------------------------------")

# Print a readable summary
for row in rows:
    print(
        row["location_id"],
        "|",
        row["location_name"],
        "|",
        row["parameter"],
        "| Sensor:",
        row["sensor_id"]
    )