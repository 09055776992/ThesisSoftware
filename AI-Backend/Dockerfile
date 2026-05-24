# AI-Backend Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download ModernBERT model during build (optional, speeds up startup)
RUN python -c "from transformers import AutoModel, AutoTokenizer; AutoTokenizer.from_pretrained('answerdotai/ModernBERT-base'); AutoModel.from_pretrained('answerdotai/ModernBERT-base')"

# Copy application code
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
