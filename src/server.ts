import express, { Express } from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import YAML from 'yamljs'
import userRoutes from './routes/users'
import authRoutes from './routes/auth'
import deviceRoutes from './routes/devices'
import aiRoutes from './routes/aiReport'  

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
