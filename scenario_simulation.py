import pandas as pd
import joblib

# -----------------------------------------
# 1. Load trained CIVORA flood model
# -----------------------------------------

model = joblib.load("CIVORA_Flood_XGBoost_Model.pkl")

print("CIVORA XGBoost model loaded successfully!")


# -----------------------------------------
# 2. Load dataset
# -----------------------------------------

df = pd.read_csv("CIVORA_Flood_ML_Dataset_Final.csv")

print("Flood dataset loaded successfully!")
print("Dataset shape:", df.shape)


# -----------------------------------------
# 3. Model features
# -----------------------------------------

features = [
    "building_area_m2_sum",
    "building_density",
    "ndvi_mean",
    "road_length_m_sum",
    "road_density",
    "idw250_mean"
]


# -----------------------------------------
# 4. Function to run a scenario
# -----------------------------------------

def simulate_scenario(data, feature, multiplier):

    scenario = data[features].copy()

    scenario[feature] = (
        scenario[feature] * multiplier
    )

    # Keep NDVI within valid range
    if feature == "ndvi_mean":

        scenario[feature] = (
            scenario[feature].clip(-1, 1)
        )

    probabilities = model.predict_proba(
        scenario
    )[:, 1]

    return probabilities


# -----------------------------------------
# 5. Baseline prediction for all grids
# -----------------------------------------

baseline_features = df[features].copy()

baseline_probability = model.predict_proba(
    baseline_features
)[:, 1]


# -----------------------------------------
# 6. Run scenarios
# -----------------------------------------

print("\nRunning CIVORA scenarios for all grids...")


# Green cover +20%
ndvi_probability = simulate_scenario(
    df,
    "ndvi_mean",
    1.20
)


# Road density -20%
road_probability = simulate_scenario(
    df,
    "road_density",
    0.80
)


# Building density -20%
building_probability = simulate_scenario(
    df,
    "building_density",
    0.80
)


# -----------------------------------------
# 7. Create results table
# -----------------------------------------

scenario_results = pd.DataFrame({

    "grid_id": df["grid_id"],

    "baseline_probability":
        baseline_probability,

    "ndvi_plus_20_probability":
        ndvi_probability,

    "road_density_minus_20_probability":
        road_probability,

    "building_density_minus_20_probability":
        building_probability

})


# -----------------------------------------
# 8. Calculate changes
# -----------------------------------------

scenario_results[
    "ndvi_change"
] = (
    scenario_results["ndvi_plus_20_probability"]
    - scenario_results["baseline_probability"]
)


scenario_results[
    "road_density_change"
] = (
    scenario_results["road_density_minus_20_probability"]
    - scenario_results["baseline_probability"]
)


scenario_results[
    "building_density_change"
] = (
    scenario_results["building_density_minus_20_probability"]
    - scenario_results["baseline_probability"]
)


# -----------------------------------------
# 9. Save results
# -----------------------------------------

output_file = (
    "CIVORA_Scenario_Results_All_Grids.csv"
)

scenario_results.to_csv(
    output_file,
    index=False
)


# -----------------------------------------
# 10. Display summary
# -----------------------------------------

print("\n========== CIVORA ALL-GRID SCENARIO ==========")

print(
    "Number of grids:",
    len(scenario_results)
)

print(
    "\nFirst 10 results:"
)

print(
    scenario_results.head(10).to_string(
        index=False
    )
)

print(
    "\nScenario results saved successfully!"
)

print(
    "File:",
    output_file
)

print("==============================================")