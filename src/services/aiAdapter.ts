import OpenAI from 'openai';

export interface AiResult {
  summary: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const aiAdapter = async (trackDetails: any[]): Promise<AiResult> => {
  // 將 track array 轉成 prompt
  const trackLines = trackDetails.map((t, i) =>
    `${i + 1}. Time: ${t.timestamp}, Lat: ${t.latitude}, Lng: ${t.longitude}, Motion: ${t.motion}, Distance: ${t.distanceKm} km, Duration: ${t.durationSec} s`
  ).join('\n');

  const prompt = `
You are an AI assistant. Generate a concise natural language report for a device's movement.
Input track data:
${trackLines}

Output a summary including:
- total points
- total distance and total time
- last known location and motion status
- last confidence
- note any anomalies if confidence < 70%
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo', // 或 'gpt-4'
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens: 500,
  });

  const summary = response.choices?.[0]?.message?.content?.trim() || '';
  return { summary };
};