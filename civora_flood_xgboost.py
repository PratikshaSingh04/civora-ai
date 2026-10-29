import pandas as pd
import numpy as np
import xgboost as xgb
import shap

# Load CIVORA flood ML dataset
df = pd.read_csv("CIVORA_Flood_ML_Dataset.csv")

# Define input features and target
features = [
    "building_area_m2_sum",
    "building_density",
    "ndvi_mean",
    "road_length_m_sum",
    "road_density",
    "idw250_mean"
]

X = df[features]
y = df["flood_event"]

print("\nFeatures (X):")
print(X.head())

print("\nTarget (y):")
print(y.head())

print("\nX shape:", X.shape)
print("y shape:", y.shape)

from sklearn.model_selection import train_test_split

# Split data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

print("\nTraining set:", X_train.shape)
print("Testing set:", X_test.shape)

print("\nTraining target distribution:")
print(y_train.value_counts())

print("\nTesting target distribution:")
print(y_test.value_counts())

from xgboost import XGBClassifier

model = XGBClassifier(
    n_estimators=200,
    max_depth=4,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    scale_pos_weight=5,
    random_state=42,
    eval_metric="logloss"
)

# Train the model
model.fit(X_train, y_train)

print("\nXGBoost model trained successfully!")

# Make predictions on the test set
y_pred = model.predict(X_test)

# Evaluate the model
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

accuracy = accuracy_score(y_test, y_pred)

print("\nModel Accuracy:")
print(accuracy)

print("\nClassification Report:")
print(classification_report(y_test, y_pred))

print("\nConfusion Matrix:")
print(confusion_matrix(y_test, y_pred))

# -----------------------------
# SHAP EXPLAINABILITY
# -----------------------------

# Create SHAP Tree Explainer
explainer = shap.TreeExplainer(model)

# Calculate SHAP values for the test data
shap_values = explainer.shap_values(X_test)

print("\nSHAP values calculated successfully!")
print("SHAP shape:", shap_values.shape)

# Global SHAP feature importance
shap_importance = np.abs(shap_values).mean(axis=0)

feature_importance = pd.DataFrame({
    "feature": X.columns,
    "mean_abs_shap": shap_importance
})

feature_importance = feature_importance.sort_values(
    by="mean_abs_shap",
    ascending=False
)

print("\nSHAP Feature Importance:")
print(feature_importance)

# ============================================
# FLOOD PREDICTIONS FOR ALL 405 GRID CELLS
# ============================================

# Predict flood probability for every grid cell
flood_probability = model.predict_proba(X)[:, 1]

# Convert probability to binary prediction
flood_prediction = (flood_probability >= 0.5).astype(int)

# Create prediction output
prediction_output = pd.DataFrame({
    "grid_id": df["grid_id"],
    "flood_probability": flood_probability,
    "flood_prediction": flood_prediction
})

# Save predictions
prediction_output.to_csv(
    "CIVORA_Flood_Predictions.csv",
    index=False
)

print("\nFlood predictions generated successfully!")
print("\nPrediction distribution:")
print(prediction_output["flood_prediction"].value_counts())

print("\nFirst 10 predictions:")
print(prediction_output.head(10))

print("\nPrediction file saved as:")
print("CIVORA_Flood_Predictions.csv")

# SHAP Summary Plot
import matplotlib.pyplot as plt

shap.summary_plot(
    shap_values,
    X_test,
    show=False
)

plt.tight_layout()
plt.savefig("civora_shap_summary.png", dpi=300, bbox_inches="tight")
plt.show()

