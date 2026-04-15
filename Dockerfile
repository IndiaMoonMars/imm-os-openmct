FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy server code and assets
COPY server.js index.html ./
COPY plugins/ ./plugins/

EXPOSE 8080

CMD ["npm", "start"]
