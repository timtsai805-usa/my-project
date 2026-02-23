// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET or JWT_REFRESH_SECRET is not defined in environment variables!');
}

interface JwtPayload {
  id: string;
  identifier: string;
}

// -------------------- Middleware --------------------
// 只处理 Access Token 验证
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1]; // Bearer <token>

  if (!token) return res.status(401).json({ message: 'Access token missing' });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as any).user = payload; // 放到 req.user 方便后续使用
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Access token expired' });
    }
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// -------------------- 可选 Refresh Token 验证中间件 --------------------
// 如果你希望某些路由直接验证 refresh token
export const authenticateRefreshToken = (req: Request, res: Response, next: NextFunction) => {
  const { refreshToken } = req.body; // 或者 header
  if (!refreshToken) return res.status(401).json({ message: 'Refresh token missing' });

  try {
    const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JwtPayload;
    (req as any).user = payload;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid refresh token' });
  }
};