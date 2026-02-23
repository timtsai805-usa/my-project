// src/routes/aiReport.ts
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { LocationPoint, calculateConfidence, calcDistance } from '../utils/Location';
import { aiAdapter, AiResult } from '../services/aiAdapter';

export const router = Router();

/**
 * 工具函數：格式化總距離
 */
function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  const kmPart = Math.floor(km);
  const mPart = Math.round((km - kmPart) * 1000);
  return `${kmPart} km ${mPart} m`;
}

/**
 * 工具函數：格式化總時間
 */
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

/**
 * 將 AI JSON 轉成自然語言 summary
 */
function jsonToTextSummary(aiResult: AiResult): string {
  const { totalPoints, totalDistance, totalTime, lastLocation, anomalies } = aiResult;
  return `設備目前共記錄 ${totalPoints} 個位置點，總距離 ${totalDistance}，總耗時 ${totalTime}，最後位置在 (${lastLocation.lat}, ${lastLocation.lng})，運動狀態: ${lastLocation.motion ? '移動' : '靜止'}，異常: ${anomalies ? '有' : '無'}。`;
}

/**
 * GET /api/v1/report/:deviceId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
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
    // 取得該設備在時間範圍內的所有 track
    const tracks = await prisma.track.findMany({
      where: { deviceId, deviceTime: { gte: startDate, lte: endDate } },
      orderBy: { deviceTime: 'asc' },
    });

    if (!tracks.length) {
      return res.status(404).json({ message: 'No tracks found for this device and date range' });
    }

    // 計算每個點的 distance、duration、confidence
    let prev: LocationPoint | null = null;
    let totalDistance = 0; // km
    let totalTime = 0;     // sec
    const trackDetails: any[] = [];

    for (const track of tracks) {
      if (track.latitude == null || track.longitude == null || track.deviceTime == null) continue;

      const curr: LocationPoint = {
        latitude: track.latitude!,
        longitude: track.longitude!,
        timestamp: track.deviceTime!,
        motion: track.motion ?? false,
      };

      const { confidence } = calculateConfidence(prev, curr);
      let distance = 0, duration = 0;

      if (prev) {
        distance = calcDistance(prev, curr) / 1000; // 公尺 -> 公里
        duration = (curr.timestamp.getTime() - prev.timestamp.getTime()) / 1000; // 秒
      }

      totalDistance += distance;
      totalTime += duration;

      trackDetails.push({
        latitude: curr.latitude,
        longitude: curr.longitude,
        timestamp: curr.timestamp.toISOString(),
        motion: curr.motion,
        distanceKm: parseFloat(distance.toFixed(3)),
        durationSec: Math.round(duration),
        confidence,
      });

      prev = curr;
    }

    const lastTrack = trackDetails[trackDetails.length - 1];

    // 🔹 呼叫 AI Adapter (返回 JSON)
    const aiResult: AiResult = await aiAdapter(trackDetails);

    // 🔹 存入資料庫 (summary 保存 JSON 字符串)
    await prisma.aiReport.create({
      data: {
        deviceId,
        total_distance: totalDistance.toFixed(3),
        total_time: Math.round(totalTime).toString(),
        tracks: trackDetails,
        summary: JSON.stringify(aiResult),
        confidence: lastTrack.confidence,
      },
    });

    // 🔹 回傳自然語言 summary 給前端
    res.status(200).json({
      success: true,
      summary: jsonToTextSummary(aiResult),
      tracks: trackDetails,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;