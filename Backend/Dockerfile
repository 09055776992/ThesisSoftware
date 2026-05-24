# Backend Dockerfile (Node.js)
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
