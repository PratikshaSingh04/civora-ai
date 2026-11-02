#!/usr/bin/env bash
# ==============================================================================
# CIVORA AI — 1-Click AWS EC2 / Lightsail Deployment Script (Ubuntu 22.04 / 24.04)
# ==============================================================================
set -e

echo "🚀 Starting CIVORA AI Backend Setup on AWS..."

# 1. Update and install prerequisites
sudo apt-get update -y
sudo apt-get install -y curl git ufw ca-certificates

# 2. Add 2GB Swap Memory (Crucial for t3.micro or t3.small during ML package loading)
if [ ! -f /swapfile ]; then
    echo "💾 Creating 2GB swap file to prevent OOM errors..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# 3. Install Docker & Docker Compose
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker Engine..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    sudo rm get-docker.sh
fi

# 4. Open Firewall Port 8000 & 80/443
sudo ufw allow 22/tcp || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
sudo ufw allow 8000/tcp || true

# 5. Build and launch CIVORA Backend Container
echo "🏗️ Building CIVORA Backend Container..."
sudo docker compose build
sudo docker compose up -d

echo ""
echo "✅ CIVORA AI Backend is LIVE and running on port 8000!"
echo "Check status with: sudo docker compose ps"
echo "View logs with:   sudo docker compose logs -f"
echo ""

