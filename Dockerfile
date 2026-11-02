# CIVORA AI Backend Dockerfile
FROM python:3.11-slim

# Install system dependencies needed for XGBoost, GDAL/PROJ and C-extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all model files, datasets, and backend application code
COPY . .

# Set Python path so `app` modules can be imported directly
ENV PYTHONPATH=/app/backend
ENV CIVORA_HOST=0.0.0.0
ENV CIVORA_PORT=8000

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/ || exit 1

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

