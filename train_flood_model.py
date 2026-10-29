import pandas as pd

# Load the CIVORA flood dataset
df = pd.read_csv("CIVORA_Flood_ML_Dataset_Final.csv")

# Display basic information
print("Dataset shape:", df.shape)

print("\nColumns:")
print(df.columns.tolist())

print("\nFirst 5 rows:")
print(df.head())

print("\nFlood event distribution:")
print(df["flood_event"].value_counts())

# Define the input features
features = [
    "building_area_m2_sum",
    "building_density",
    "ndvi_mean",
    "road_length_m_sum",
    "road_density",
    "idw250_mean"
]

# X = input features
X = df[features]

# y = target variable
y = df["flood_event"]

print("\nFeatures (X):")
print(X.head())

print("\nTarget (y):")
print(y.head())

print("\nX shape:", X.shape)
print("y shape:", y.shape)

from sklearn.model_selection import train_test_split

# Split the dataset into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

print("\nTraining data:")
print("X_train:", X_train.shape)
print("y_train:", y_train.shape)

print("\nTesting data:")
print("X_test:", X_test.shape)
print("y_test:", y_test.shape)

from xgboost import XGBClassifier

# Create the XGBoost classification model
model = XGBClassifier(
    n_estimators=100,
    max_depth=4,
    learning_rate=0.05,
    random_state=42,
    eval_metric="logloss"
)

# Train the model
model.fit(X_train, y_train)

print("\nXGBoost model trained successfully!")

import joblib

# Save the trained XGBoost model
joblib.dump(model, "CIVORA_Flood_XGBoost_Model.pkl")

print("XGBoost model saved successfully!")

from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

# Make predictions on unseen test data
y_pred = model.predict(X_test)

# Calculate accuracy
accuracy = accuracy_score(y_test, y_pred)

print("\nModel Accuracy:", accuracy)

# Detailed performance report
print("\nClassification Report:")
print(classification_report(y_test, y_pred))

# Confusion matrix
print("\nConfusion Matrix:")
print(confusion_matrix(y_test, y_pred))

import matplotlib.pyplot as plt

# Get feature importance from the trained XGBoost model
importance = model.feature_importances_

# Create a table of features and their importance
feature_importance = pd.DataFrame({
    "Feature": features,
    "Importance": importance
})

# Sort from highest to lowest
feature_importance = feature_importance.sort_values(
    by="Importance",
    ascending=False
)

print("\nFeature Importance:")
print(feature_importance)

# Plot feature importance
plt.figure(figsize=(8, 5))
plt.barh(
    feature_importance["Feature"],
    feature_importance["Importance"]
)
plt.xlabel("Importance")
plt.ylabel("Feature")
plt.title("CIVORA Flood Prediction - Feature Importance")
plt.gca().invert_yaxis()
plt.tight_layout()
plt.close()

# Predict flood probability for all grid cells
X_all = X

flood_probability = model.predict_proba(X_all)[:, 1]

predicted_flood = (flood_probability >= 0.5).astype(int)

# Add predictions to the dataset
df["flood_probability"] = flood_probability
df["predicted_flood"] = predicted_flood

# Show first 10 predictions
print("\nFlood Predictions:")
print(df[["grid_id", "flood_probability", "predicted_flood"]].head(10))

# Save predictions
df.to_csv("CIVORA_Flood_Predictions.csv", index=False)

print("\nFlood predictions saved successfully!")

# ============================================
# SHAP EXPLAINABILITY
# ============================================

import shap
import matplotlib.pyplot as plt

print("\nGenerating SHAP explanations...")

explainer = shap.Explainer(model.predict, X_train)

shap_values = explainer(X_test)

print("SHAP values generated successfully!")

shap.summary_plot(
    shap_values,
    X_test,
    feature_names=X_test.columns,
    show=False
)

plt.title("CIVORA AI - SHAP Feature Impact")
plt.tight_layout()
plt.show()

# ============================================
# SHAP FEATURE IMPORTANCE BAR CHART
# ============================================

plt.figure()

shap.summary_plot(
    shap_values,
    X_test,
    feature_names=X_test.columns,
    plot_type="bar",
    show=False
)

plt.title("CIVORA - Overall Feature Importance using SHAP")
plt.tight_layout()

plt.savefig(
    r"C:\Users\prati\Downloads\CIVORA\CIVORA_SHAP_Feature_Importance.png",
    dpi=300,
    bbox_inches="tight"
)

plt.show()

print("SHAP feature importance chart saved successfully!")

# ============================================
# INDIVIDUAL GRID SHAP EXPLANATION
# ============================================

grid_id = "KE_G_0024"

grid_features = df[df["grid_id"] == grid_id][features]

grid_shap_values = explainer(grid_features)

print(f"SHAP explanation generated for {grid_id}!")

shap.plots.waterfall(
    grid_shap_values[0],
    show=False
)

plt.title(f"CIVORA AI - SHAP Explanation for {grid_id}")
plt.tight_layout()

plt.savefig(
    r"C:\Users\prati\Downloads\CIVORA\CIVORA_SHAP_KE_G_0024.png",
    dpi=300,
    bbox_inches="tight"
)

plt.show()

print(f"Individual SHAP explanation saved for {grid_id}!")