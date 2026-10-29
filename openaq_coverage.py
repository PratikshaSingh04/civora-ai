import requests
import csv
import time

API_KEY = "ca6a6a82611269912a4cc87d203df0fd1b5d0555fa1bb902d94502a5db380d85"

headers = {
    "X-API-Key": API_KEY
}

input_file = "K_East_Air_Quality_Sensors.csv"
output_file = "K_East_Air_Quality_Coverage.csv"

# Pollutants we care about
wanted = {
    "pm25",
    "pm10",
    "no2",
    "so2",
    "co",
    "o3"
}

rows = []

with open(input_file, "r", encoding="utf-8") as f:

    reader = csv.DictReader(f)

    for row in reader:

        parameter = row["parameter"].lower()

        if parameter not in wanted:
            continue

        sensor_id = row["sensor_id"]

        url = f"https://api.openaq.org/v3/sensors/{sensor_id}"

        response = requests.get(
            url,
            headers=headers
        )

        if response.status_code != 200:
            print(
                "Failed:",
                sensor_id,
                response.status_code
            )
            continue

        result = response.json()["results"][0]

        first = result.get("datetimeFirst", {})
        last = result.get("datetimeLast", {})
        coverage = result.get("coverage", {})

        rows.append({
            "location_id": row["location_id"],
            "location_name": row["location_name"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "sensor_id": sensor_id,
            "parameter": parameter,
            "units": row["units"],
            "first_date": first.get("local"),
            "last_date": last.get("local"),
            "percent_coverage": coverage.get("percentCoverage")
        })

        print(
            row["location_name"],
            "|",
            parameter,
            "|",
            first.get("local"),
            "to",
            last.get("local")
        )

        time.sleep(0.15)


with open(
    output_file,
    "w",
    newline="",
    encoding="utf-8"
) as f:

    fieldnames = [
        "location_id",
        "location_name",
        "latitude",
        "longitude",
        "sensor_id",
        "parameter",
        "units",
        "first_date",
        "last_date",
        "percent_coverage"
    ]

    writer = csv.DictWriter(
        f,
        fieldnames=fieldnames
    )

    writer.writeheader()
    writer.writerows(rows)

print("\n==============================")
print("DONE!")
print("Sensors checked:", len(rows))
print("Saved:", output_file)
print("==============================")