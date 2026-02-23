import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { authenticateToken } from '../middleware/auth';

interface UpdateUserBody {
  name?: string;
  password?: string;
}

const router = Router();

// GET /users/me - 取得當前登入用戶，需要 JWT
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, identifier: true, name: true } // 不回傳密碼
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(user); // 對應 OpenAPI 200
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch current user' });
  }
});

// PUT /users/me - 更新當前登入用戶，需要 JWT
router.put('/me', authenticateToken, async (req: Request<{}, {}, UpdateUserBody>, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { name, password } = req.body;

    const data: any = {};

    if (name !== undefined) {
      data.name = name;
    }

    if (password !== undefined) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      data.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, identifier: true, name: true } // 不回傳密碼
    });

    res.status(200).json(updatedUser); // 對應 OpenAPI 200
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(500).json({ error: 'Failed to update user' });
  }
});

export default router;