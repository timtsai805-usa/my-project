# Tech
Node + Express + Docker PostgreSQL + Prisma + Openapi + Swagger + JWT

# Swagger-cli bundl
swagger-cli bundle ./api/openapi.yaml -o ./openapi.bundle.yaml --type yaml

# Docker
docker stop my_postgres
docker build -t my_postgres .
docker-compose up
docker-compose restart
docker ps

# Prisma
npx prisma reset --force
npx prisma migrate dev -name init
npx prisma generate

# Node
npm run dev

# Ai
my-api/
├─ src/
│  ├─ middleware/buildAiQuery.ts    ← 抓 Track 資料 + 計算 confidence + attach 到 req
│  ├─ routes/aiReport.ts           ← 決定查 DB + 組 AI prompt + 產生自然語言
│  ├─ service/aiAdapter.ts         ← 決定使用 mock AI 或其他 AI 模型
│  └─ utils/aiLocation.ts          ← 計算距離、方向、confidence（純邏輯）

# 規則
總結
- 平均精度 //avg accuracy
- 平均速度 //avg speed
- 異常狀態 
- 運動狀態 // motion: true > false = Very active, true=false = normal, false>true = Need to move around
- 移動預覽 // you have been moving total distance 1.24km in 2 hours and 45 minutes

軌跡時間軸
- 10:20 開始移動 
- 11:05 到達位置，移動距離 139 公尺
- 13:45 停留休息，持續 2 小時 40 分鐘
- 14:17 再次移動

最後位置：
- 緯度/經度：25.0623125, 121.5459833
- 定位模式: GPS (WiFi)
- 定位精度: High
- 異常狀態：無