import pandas as pd

# ==========================================
# CIVORA UNIFIED SCENARIO DECISION ANALYSIS
# ==========================================

input_file = "CIVORA_Scenario_Results_All_Grids.csv"
output_file = "CIVORA_Scenario_Impact_All_Grids.csv"

# Load scenario results
df = pd.read_csv(input_file)

print("CIVORA scenario results loaded!")
print("Number of grids:", len(df))

# ------------------------------------------
# Standardize column names
# ------------------------------------------

df.columns = [
    "grid_id",
    "baseline_prediction",
    "ndvi_prediction",
    "road_prediction",
    "building_prediction",
    "ndvi_change",
    "road_change",
    "building_change"
]

# ------------------------------------------
# Find largest positive and negative changes
# ------------------------------------------

change_columns = [
    "ndvi_change",
    "road_change",
    "building_change"
]

df["largest_increase"] = df[change_columns].max(axis=1)

df["largest_decrease"] = df[change_columns].min(axis=1)

# ------------------------------------------
# Identify scenario with largest absolute
# change for each grid
# ------------------------------------------

def identify_dominant_scenario(row):

    changes = {
        "NDVI +20%": abs(row["ndvi_change"]),
        "Road Density -20%": abs(row["road_change"]),
        "Building Density -20%": abs(row["building_change"])
    }

    return max(changes, key=changes.get)


df["dominant_scenario"] = df.apply(
    identify_dominant_scenario,
    axis=1
)

# ------------------------------------------
# Calculate absolute maximum impact
# ------------------------------------------

df["maximum_absolute_change"] = df[change_columns].abs().max(axis=1)

# ------------------------------------------
# Categorize impact magnitude
# ------------------------------------------

def classify_impact(value):

    if value < 0.01:
        return "Very Low"

    elif value < 0.05:
        return "Low"

    elif value < 0.10:
        return "Moderate"

    elif value < 0.20:
        return "High"

    else:
        return "Very High"


df["impact_magnitude"] = df["maximum_absolute_change"].apply(
    classify_impact
)

# ------------------------------------------
# Save unified results
# ------------------------------------------

df.to_csv(output_file, index=False)

# ------------------------------------------
# Summary
# ------------------------------------------

print("\n==========================================")
print("CIVORA UNIFIED SCENARIO ANALYSIS")
print("==========================================")

print("\nScenario dominance:")
print(
    df["dominant_scenario"]
    .value_counts()
    .to_string()
)

print("\nImpact magnitude:")
print(
    df["impact_magnitude"]
    .value_counts()
    .to_string()
)

print("\nOutput columns:")
print(df.columns.tolist())

print("\n==========================================")
print("Analysis completed successfully!")
print("Output:", output_file)
print("==========================================")