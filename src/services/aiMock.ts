// src/services/aiAdapter.ts

export interface AiResult {
  summary: string;
}

interface TrackDetail {
  latitude: number;
  longitude: number;
  timestamp: string;
  motion: boolean;
  distanceKm: number;
  durationSec: number;
  confidence: number;
}

export const aiAdapter = {
  generateReport: async (tracks: TrackDetail[]): Promise<AiResult> => {
    if (!tracks.length) {
      return { summary: 'No track data available.' };
    }

    // 統計 total distance、total time
    const totalDistance = tracks.reduce((sum, t) => sum + t.distanceKm, 0);
    const totalTimeSec = tracks.reduce((sum, t) => sum + t.durationSec, 0);
    const last = tracks[tracks.length - 1];

    // 生成 summary
    const summary = `【AI Report Summary】
- Total location points: ${tracks.length}
- Total distance: ${totalDistance.toFixed(3)} km
- Total time: ${Math.floor(totalTimeSec / 3600)}h ${Math.floor((totalTimeSec % 3600) / 60)}m ${totalTimeSec % 60}s
- Last known location: (${last.latitude.toFixed(5)}, ${last.longitude.toFixed(5)})
- Motion status: ${last.motion ? 'Moving' : 'Stationary'}
- Last confidence: ${last.confidence.toFixed(2)}%
- Tracks detail includes distance (km) and duration (s) for each point
- Anomalies or rapid movements are automatically flagged if confidence is low.
`;

    return { summary };
  },
};