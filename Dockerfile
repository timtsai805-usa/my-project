# Dockerfile
FROM node:20-alpine

WORKDIR /app

# 安裝依賴
COPY package*.json ./
RUN npm install

# 複製程式碼
COPY . .

# 暴露 port
EXPOSE 3000

# 啟動命令由 docker-compose.yml 指定
CMD ["npm", "run", "dev"]