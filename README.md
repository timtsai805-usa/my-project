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