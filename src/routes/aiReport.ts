// src/routes/aiReport.ts

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import {
  LocationPoint,
  calculateConfidence,
  generateTimeline
} from '../utils/Location';
import { aiAdapter, AiResult } from '../services/aiAdapter';

export const router = Router();

/**
 * GET /api/v1/report/:deviceId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
router.get('/:deviceId', async (req, res) => {
  const deviceId = Number(req.params.deviceId);
  const startDateStr = req.query.startDate as string;
  const endDateStr = req.query.endDate as string;

  if (!deviceId || !startDateStr || !endDateStr) {
    return res.status(400).json({
      message: 'deviceId, startDate and endDate are required',
    });
  }

  const startDate = new Date(`${startDateStr}T00:00:00.000Z`);
  const endDate = new Date(`${endDateStr}T23:59:59.999Z`);

  try {
    //  取得資料
    const tracks = await prisma.track.findMany({
      where: {
        deviceId,
        deviceTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { deviceTime: 'asc' },
    });

    if (!tracks.length) {
      return res.status(404).json({
        message: 'No tracks found for this device and date range',
      });
    }

    //  轉成 LocationPoint[]
    const points: LocationPoint[] = tracks
      .filter(
        (t) =>
          t.latitude != null &&
          t.longitude != null &&
          t.deviceTime != null
      )
      .map((t) => ({
        latitude: t.latitude!,
        longitude: t.longitude!,
        timestamp: t.deviceTime!,
        motion: t.motion ?? false,
        method: (t.method === 'wifi' ? 'wifi' : 'gps') as 'gps' | 'wifi',
        accuracy: t.accuracy ?? undefined,
      }));

    if (!points.length) {
      return res.status(404).json({
        message: 'No valid location points found',
      });
    }

    //  計算最後 confidence
    const lastPoint = points[points.length - 1];
    const lastConfidence =
      points.length >= 2
        ? calculateConfidence(
            points[points.length - 2],
            lastPoint
          ).confidence
        : 100;

    //  呼叫 AI
    const aiResult: AiResult = await aiAdapter(points);

    //  產生時間軸（純演算法）
    const timeline = generateTimeline(points);

    //  存入資料庫（只存 structured）
    await prisma.aiReport.create({
      data: {
        deviceId,
        summary: JSON.stringify({
          ...aiResult,
          timeline,
        }),
        confidence: lastConfidence,
      },
    });

    //  回傳乾淨 API 結構
    res.status(200).json({
      success: true,
      overview: {
        totalPoints: aiResult.totalPoints,
        totalDistance: aiResult.totalDistance,
        totalTime: aiResult.totalTime,
        avgAccuracy: aiResult.avgAccuracy,
        motionStatus: aiResult.motionStatus,
        anomalies: aiResult.anomalies,
      },
      timeline,
      lastLocation: aiResult.lastLocation,
      confidence: lastConfidence,
    });

  } catch (err) {
    console.error('AI Report Error:', err);
    res.status(500).json({
      message: 'Internal Server Error',
    });
  }
});

export default router;