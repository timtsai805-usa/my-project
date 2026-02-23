// src/routes/aiReport.ts
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { LocationPoint, calculateConfidence, calcDistance } from '../utils/Location';
import { aiAdapter } from '../services/aiAdapter';

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
 * GET /api/v1/report/:deviceId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
router.get('/:deviceId', async (req, res) => {
  const deviceId = Number(req.params.deviceId);
  const startDateStr = req.query.startDate as string;
  const endDateStr   = req.query.endDate as string;

  if (!deviceId || !startDateStr || !endDateStr) {
    return res.status(400).json({ message: 'deviceId, startDate and endDate are required' });
  }

  const startDate = new Date(`${startDateStr}T00:00:00.000Z`);
  const endDate   = new Date(`${endDateStr}T23:59:59.999Z`);

  try {
    //  從 Prisma track model 取得集合
    const tracks = await prisma.track.findMany({
      where: { deviceId, deviceTime: { gte: startDate, lte: endDate } },
      orderBy: { deviceTime: 'asc' },
    });

    if (!tracks.length) {
      return res.status(404).json({ message: 'No tracks found for this device and date range' });
    }

    //  計算每個點的 confidence、距離、停留時間
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

      let distance = 0;
      let duration = 0;

      if (prev) {
        distance = calcDistance(prev, curr) / 1000; // 公尺 → 公里
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

    //  格式化總距離與總時間
    const totalDistanceText = formatDistance(totalDistance);
    const totalTimeText     = formatDuration(totalTime);

    // 取得最後一筆 track
    const lastTrack = trackDetails[trackDetails.length - 1];

//     //  生成 AI summary
//     const summary = `【AI Report Summary】
// - Total location points: ${trackDetails.length}
// - Total distance: ${totalDistanceText}
// - Total time: ${totalTimeText}
// - Last known location: (${lastTrack.latitude.toFixed(5)}, ${lastTrack.longitude.toFixed(5)})
// - Motion status: ${lastTrack.motion ? 'Moving' : 'Stationary'}
// - Last confidence: ${lastTrack.confidence.toFixed(2)}%
// - Tracks detail includes distance (km) and duration (s) for each point
// - Anomalies or rapid movements are automatically flagged if confidence is low.`;

    // 生成 AI summary
    const aiResult = await aiAdapter(trackDetails);
    const summary = aiResult.summary;

    //  存入 AiReport
    const aiReport = await prisma.aiReport.create({
      data: {
        deviceId,
        total_distance: totalDistance.toFixed(3),       // km
        total_time: Math.round(totalTime).toString(),   // sec
        tracks: trackDetails,
        summary,
        confidence: lastTrack.confidence,
      },
    });

    //  回傳 JSON
    res.status(200).json({ success: true, report: aiReport });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;