import pandas as pd

# Files
files = {
    "pm25": "K_East_Chakala_PM25_Daily.csv",
    "pm10": "K_East_Chakala_PM10_Daily.csv",
    "no2": "K_East_Chakala_NO2_Daily.csv",
    "so2": "K_East_Chakala_SO2_Daily.csv",
    "co": "K_East_Chakala_CO_Daily.csv",
    "o3": "K_East_Chakala_O3_Daily.csv"
}

merged = None

for pollutant, filename in files.items():

    df = pd.read_csv(filename)

    # Keep only date and pollutant value
    df = df[["date", pollutant]]

    # Convert date to calendar date
    df["date"] = pd.to_datetime(df["date"]).dt.date

    # Merge
    if merged is None:
        merged = df
    else:
        merged = pd.merge(
            merged,
            df,
            on="date",
            how="outer"
        )

# Add station information
merged["station"] = "Chakala-Andheri East - IITM"
merged["latitude"] = 19.11074
merged["longitude"] = 72.86084

# Put columns in a clean order
merged = merged[
    [
        "date",
        "station",
        "latitude",
        "longitude",
        "pm25",
        "pm10",
        "no2",
        "so2",
        "co",
        "o3"
    ]
]

# Sort by date
merged = merged.sort_values("date")

# Save
output = "K_East_Air_Quality_Daily.csv"

merged.to_csv(
    output,
    index=False
)

print("\n================================")
print("AIR QUALITY MERGE COMPLETE")
print("================================")
print("Rows:", len(merged))
print("Columns:", len(merged.columns))
print("Output:", output)
print("\nDate range:")
print(merged["date"].min(), "to", merged["date"].max())

print("\nMissing values:")
print(merged.isna().sum())

print("\n================================")