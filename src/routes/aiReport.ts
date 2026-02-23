// src/routes/aiReport.ts
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { LocationPoint, calculateConfidence, generateTimeline } from '../utils/Location';
import { aiAdapter, AiResult } from '../services/aiAdapter';

export const router = Router();

/** 生成自然語言 summary */
function jsonToTextSummary(aiResult: AiResult, timeline: string[]): string {
  const {
    totalPoints,
    totalDistance,
    totalTime,
    lastLocation,
    anomalies,
    avgAccuracy,
    motionStatus,
  } = aiResult;

  return `
📍 設備總覽：
- 記錄位置點：${totalPoints}
- 總距離：${totalDistance}
- 總耗時：${totalTime}
- 平均精度：${avgAccuracy} m
- 運動狀態：${motionStatus}
- 異常狀態：${anomalies ? '有' : '無'}
- 移動預覽：You have been moving total distance ${totalDistance} in ${totalTime}

🕒 軌跡時間軸：
${timeline.join('\n')}

🗺️ 最後位置：
- 緯度/經度：${lastLocation.lat}, ${lastLocation.lng}
- 定位模式：${lastLocation.method?.toUpperCase() ?? 'Unknown'}
- 定位精度：${lastLocation.accuracyLevel ?? 'Unknown'}
- 異常狀態：${anomalies ? '有' : '無'}
  `.trim();
}

/** GET /api/v1/report/:deviceId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD */
router.get('/:deviceId', async (req, res) => {
  const deviceId = Number(req.params.deviceId);
  const startDateStr = req.query.startDate as string;
  const endDateStr = req.query.endDate as string;

  if (!deviceId || !startDateStr || !endDateStr) {
    return res.status(400).json({ message: 'deviceId, startDate and endDate are required' });
  }

  const startDate = new Date(`${startDateStr}T00:00:00.000Z`);
  const endDate = new Date(`${endDateStr}T23:59:59.999Z`);

  try {
    // 取得該設備在時間範圍內的 track
    const tracks = await prisma.track.findMany({
      where: { deviceId, deviceTime: { gte: startDate, lte: endDate } },
      orderBy: { deviceTime: 'asc' },
    });

    if (!tracks.length) {
      return res.status(404).json({ message: 'No tracks found for this device and date range' });
    }

    const points: LocationPoint[] = tracks
      .filter(t => t.latitude != null && t.longitude != null && t.deviceTime != null)
      .map(t => ({
        latitude: t.latitude!,
        longitude: t.longitude!,
        timestamp: t.deviceTime!,
        motion: t.motion ?? false,
        method: (t.method === 'wifi' ? 'wifi' : 'gps') as 'gps' | 'wifi',
        accuracy: t.accuracy ?? undefined,
      }));

    const lastPoint = points[points.length - 1];
    const lastConfidence = points.length >= 2
      ? calculateConfidence(points[points.length - 2], lastPoint).confidence
      : 100;

    // 呼叫 AI Adapter
    const aiResult: AiResult = await aiAdapter(points);

    // 生成時間軸
    const timeline = generateTimeline(points);

    // 存入資料庫
    await prisma.aiReport.create({
      data: {
        deviceId,
        summary: JSON.stringify(aiResult),
        confidence: lastConfidence,
      },
    });

    // 回傳自然語言 summary
    res.status(200).json({
      success: true,
      summary: jsonToTextSummary(aiResult, timeline),
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;