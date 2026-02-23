import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!JWT_SECRET || !JWT_REFRESH_SECRET) 
  throw new Error('JWT_SECRET or JWT_REFRESH_SECRET is not defined in environment variables!');

const router = Router();

interface LoginRequestBody {
  identifier: string;
  password: string;
  role?: 'user' | 'business';
}

interface RegisterRequestBody {
  identifier: string;
  name?: string;
  password: string;
  role?: 'user' | 'business';
}

// ===== Helper: 生成 Access + Refresh Token =====
function generateTokens(user: { id: string; identifier: string; role: string }) {
  const accessToken = jwt.sign(
    { id: user.id, identifier: user.identifier, role: user.role },
    JWT_SECRET!,
    { expiresIn: '1h' }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  );

  return {
    accessToken,
    accessTokenExpiresIn: 3600,
    refreshToken,
    refreshTokenExpiresIn: 604800 // 7 天
  };
}

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { identifier, password } = req.body as LoginRequestBody;

  const user = await prisma.user.findUnique({ where: { identifier } });
  if (!user) {
    return res.status(401).json({ message: 'Invalid identifier or password' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({ message: 'Invalid identifier or password' });
  }

  // 生成 tokens
  const tokens = generateTokens(user);

  // 將 accessToken 和 refreshToken 存到 Prisma
  await prisma.user.update({
    where: { id: user.id },
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    }
  });

  res.json(tokens);
});

// POST /auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { identifier, name, password, role } = req.body as RegisterRequestBody;

  if (!password || password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const newUser = await prisma.user.create({
      data: {
        identifier,
        name: name || '',
        password: hashedPassword,
        role: role || 'user'
      }
    });

    // 註冊後直接生成 tokens
    const tokens = generateTokens(newUser);

    // 存 tokens
    await prisma.user.update({
      where: { id: newUser.id },
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });

    res.status(200).json({
      id: newUser.id,
      identifier: newUser.identifier,
      name: newUser.name,
      role: newUser.role,
      ...tokens
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'User already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /auth/refresh - 新增 Refresh Token endpoint
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken: string };

  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token is required' });
  }

  try {
    // 驗證 refresh token
    const payload: any = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    // 生成新 tokens
    const tokens = generateTokens(user);

    // 更新資料庫
    await prisma.user.update({
      where: { id: user.id },
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });

    res.json(tokens);
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
});

export default router;