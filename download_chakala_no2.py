import requests
import csv

API_KEY = "ca6a6a82611269912a4cc87d203df0fd1b5d0555fa1bb902d94502a5db380d85"

SENSOR_ID = 12236408

url = f"https://api.openaq.org/v3/sensors/{SENSOR_ID}/days"

headers = {
    "X-API-Key": API_KEY
}

params = {
    "date_from": "2025-02-19",
    "date_to": "2026-09-16",
    "limit": 1000,
    "page": 1
}

all_rows = []

while True:

    response = requests.get(
        url,
        headers=headers,
        params=params
    )

    print(
        "Page:",
        params["page"],
        "| Status:",
        response.status_code
    )

    if response.status_code != 200:
        print(response.text)
        break

    data = response.json()
    results = data.get("results", [])

    if not results:
        break

    for item in results:

        period = item.get("period", {})
        datetime_from = period.get("datetimeFrom", {})

        all_rows.append({
            "date": datetime_from.get("local"),
            "no2": item.get("value"),
            "units": item.get("parameter", {}).get("units"),
            "latitude": 19.11074,
            "longitude": 72.86084
        })

    if len(results) < 1000:
        break

    params["page"] += 1


output_file = "K_East_Chakala_NO2_Daily.csv"

with open(
    output_file,
    "w",
    newline="",
    encoding="utf-8"
) as f:

    writer = csv.DictWriter(
        f,
        fieldnames=[
            "date",
            "no2",
            "units",
            "latitude",
            "longitude"
        ]
    )

    writer.writeheader()
    writer.writerows(all_rows)


print("\n==============================")
print("DOWNLOAD COMPLETE")
print("Rows:", len(all_rows))
print("File:", output_file)
print("==============================")