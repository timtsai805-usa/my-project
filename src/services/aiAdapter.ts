// src/services/aiAdapter.ts
import OpenAI from 'openai';

export interface AiResult {
  totalPoints: number;
  totalDistance: string;
  totalTime: string;
  lastLocation: {
    lat: number;
    lng: number;
    motion: boolean;
  };
  lastConfidence: number;
  anomalies: boolean;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export const aiAdapter = async (trackDetails: any[]): Promise<AiResult> => {
  try {
    if (!trackDetails.length) {
      throw new Error("No track details provided to AI");
    }

    //  格式化 track 数据
    const trackLines = trackDetails.map((t, i) =>
      `${i + 1}. Time: ${t.timestamp}, Lat: ${t.latitude}, Lng: ${t.longitude}, Motion: ${t.motion}, Distance: ${t.distanceKm} km, Duration: ${t.durationSec} s, Confidence: ${t.confidence}`
    ).join('\n');

    //  构建 prompt，要求返回 JSON
    const prompt = `
You are an AI assistant. Analyze the following device track data and generate a JSON summary.
Input track data:
${trackLines}

Output JSON with the following fields:
{
  "totalPoints": number,                   // total number of points
  "totalDistance": string,                 // formatted like "1 km 234 m"
  "totalTime": string,                     // formatted like "1h 23m 45s"
  "lastLocation": { "lat": number, "lng": number, "motion": boolean },
  "lastConfidence": number,               // confidence of the last track
  "anomalies": boolean                     // true if lastConfidence < 70%
}

Ensure the output is valid JSON and do NOT include any extra text.
`;

    console.log('🔹 Calling OpenAI...');
    const start = Date.now();

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // 或 gpt-4
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 500,
    });

    const duration = Date.now() - start;
    console.log(` OpenAI call SUCCESS (${duration}ms)`);

    const raw = response.choices?.[0]?.message?.content?.trim() || '';
    let result: AiResult;

    try {
      result = JSON.parse(raw);
    } catch (err) {
      console.error(' Failed to parse AI response as JSON');
      console.error('AI raw response:', raw);
      throw err;
    }

    return result;
  } catch (error: any) {
    console.error(' OpenAI call FAILED');
    console.error(error?.message || error);
    throw error;
  }
};