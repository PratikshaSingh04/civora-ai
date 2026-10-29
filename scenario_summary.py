import pandas as pd
import json

# ==========================================
# CIVORA SCENARIO SUMMARY GENERATOR
# ==========================================

comparison_file = "CIVORA_Scenario_Comparison.csv"
impact_file = "CIVORA_Scenario_Impact_All_Grids.csv"

output_file = "CIVORA_Scenario_Summary.json"

# ------------------------------------------
# Load datasets
# ------------------------------------------

comparison = pd.read_csv(comparison_file)
impact = pd.read_csv(impact_file)

print("CIVORA scenario datasets loaded successfully!")

# ------------------------------------------
# Scenario statistics
# ------------------------------------------

scenario_statistics = {}

for _, row in comparison.iterrows():

    scenario = row["scenario"]

    scenario_statistics[scenario] = {
        "mean_prediction": float(row["mean_prediction"]),
        "median_prediction": float(row["median_prediction"]),
        "minimum_prediction": float(row["minimum_prediction"]),
        "maximum_prediction": float(row["maximum_prediction"]),
        "mean_change_from_baseline": float(
            row["mean_change_from_baseline"]
        ),
        "percentage_change_from_baseline": float(
            row["percentage_change_from_baseline"]
        ),
        "grids_increased": int(row["grids_increased"]),
        "grids_decreased": int(row["grids_decreased"]),
        "grids_unchanged": int(row["grids_unchanged"]),
        "percent_grids_increased": float(
            row["percent_grids_increased"]
        ),
        "percent_grids_decreased": float(
            row["percent_grids_decreased"]
        )
    }

# ------------------------------------------
# Dominant scenario statistics
# ------------------------------------------

dominant_counts = (
    impact["dominant_scenario"]
    .value_counts()
    .to_dict()
)

dominant_scenarios = {
    str(key): int(value)
    for key, value in dominant_counts.items()
}

# ------------------------------------------
# Impact magnitude statistics
# ------------------------------------------

impact_counts = (
    impact["impact_magnitude"]
    .value_counts()
    .to_dict()
)

impact_magnitude = {
    str(key): int(value)
    for key, value in impact_counts.items()
}

# ------------------------------------------
# Overall summary
# ------------------------------------------

summary = {

    "project": "CIVORA AI",

    "study_area": "K East, Andheri East, Mumbai",

    "analysis": "Flood Scenario Simulation",

    "total_grids": int(len(impact)),

    "baseline_mean_prediction": float(
        comparison.loc[
            comparison["scenario"] == "Baseline",
            "mean_prediction"
        ].iloc[0]
    ),

    "scenario_statistics": scenario_statistics,

    "dominant_scenario_by_grid": dominant_scenarios,

    "impact_magnitude_distribution": impact_magnitude
}

# ------------------------------------------
# Save JSON
# ------------------------------------------

with open(output_file, "w") as file:

    json.dump(
        summary,
        file,
        indent=4
    )

# ------------------------------------------
# Display summary
# ------------------------------------------

print("\n==========================================")
print("CIVORA SCENARIO SUMMARY")
print("==========================================")

print(
    json.dumps(
        summary,
        indent=4
    )
)

print("\n==========================================")
print("Summary created successfully!")
print("Output:", output_file)
print("==========================================")