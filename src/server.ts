import express, { Express } from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import YAML from 'yamljs'
import userRoutes from './routes/users'
import authRoutes from './routes/auth'
import deviceRoutes from './routes/devices'
import aiRoutes from './routes/aiReport'  
import 'dotenv/config';

// 读取环境变量
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;

console.log('OPENAI_API_KEY:', OPENAI_API_KEY ? 'loaded' : 'missing');
console.log('JWT_SECRET:', JWT_SECRET ? 'loaded' : 'missing');
console.log('JWT_REFRESH_SECRET:', JWT_REFRESH_SECRET ? 'loaded' : 'missing');
console.log('DATABASE_URL:', DATABASE_URL ? 'loaded' : 'missing');

const app: Express = express()
const swaggerDocument = YAML.load('./openapi.bundle.yaml')

app.use(cors())
app.use(express.json())

app.use('/api/v1/report', aiRoutes)
app.use('/api/v1/devices', deviceRoutes)
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/users', userRoutes)
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
  console.log(`Swagger UI at http://0.0.0.0:${PORT}/docs`);
})
