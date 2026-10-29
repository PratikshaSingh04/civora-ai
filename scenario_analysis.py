import pandas as pd

# ==========================================
# CIVORA SCENARIO ANALYSIS
# ==========================================

input_file = "CIVORA_Scenario_Results_All_Grids.csv"
output_file = "CIVORA_Scenario_Comparison.csv"

# Load scenario results
df = pd.read_csv(input_file)

print("Scenario dataset loaded successfully!")
print("Dataset shape:", df.shape)

# ------------------------------------------
# Rename columns using their position
# ------------------------------------------
# This avoids problems if Excel displays
# the long column names in truncated form.

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
# Calculate overall scenario statistics
# ------------------------------------------

scenarios = {
    "Baseline": "baseline_prediction",
    "NDVI +20%": "ndvi_prediction",
    "Road Density -20%": "road_prediction",
    "Building Density -20%": "building_prediction"
}

results = []

total_grids = len(df)

for scenario_name, prediction_column in scenarios.items():

    predictions = df[prediction_column]

    results.append({
        "scenario": scenario_name,
        "mean_prediction": predictions.mean(),
        "median_prediction": predictions.median(),
        "minimum_prediction": predictions.min(),
        "maximum_prediction": predictions.max()
    })

# ------------------------------------------
# Add scenario changes
# ------------------------------------------

comparison = pd.DataFrame(results)

baseline_mean = df["baseline_prediction"].mean()

comparison["mean_change_from_baseline"] = (
    comparison["mean_prediction"] - baseline_mean
)

comparison["percentage_change_from_baseline"] = (
    comparison["mean_change_from_baseline"]
    / baseline_mean
) * 100

# ------------------------------------------
# Count grid-level improvements/worsening
# ------------------------------------------

scenario_changes = {
    "NDVI +20%": "ndvi_change",
    "Road Density -20%": "road_change",
    "Building Density -20%": "building_change"
}

for scenario_name, change_column in scenario_changes.items():

    change_values = df[change_column]

    increased = (change_values > 0).sum()
    decreased = (change_values < 0).sum()
    unchanged = (change_values == 0).sum()

    mask = comparison["scenario"] == scenario_name

    comparison.loc[mask, "grids_increased"] = increased
    comparison.loc[mask, "grids_decreased"] = decreased
    comparison.loc[mask, "grids_unchanged"] = unchanged

    comparison.loc[mask, "percent_grids_increased"] = (
        increased / total_grids
    ) * 100

    comparison.loc[mask, "percent_grids_decreased"] = (
        decreased / total_grids
    ) * 100

# Baseline does not have a change
comparison.loc[
    comparison["scenario"] == "Baseline",
    [
        "grids_increased",
        "grids_decreased",
        "grids_unchanged",
        "percent_grids_increased",
        "percent_grids_decreased"
    ]
] = 0

# ------------------------------------------
# Round values
# ------------------------------------------

comparison = comparison.round(6)

# ------------------------------------------
# Save results
# ------------------------------------------

comparison.to_csv(output_file, index=False)

print("\n==========================================")
print("CIVORA SCENARIO COMPARISON")
print("==========================================")

print(comparison.to_string(index=False))

print("\n==========================================")
print("Analysis completed successfully!")
print("Output file:", output_file)
print("==========================================")