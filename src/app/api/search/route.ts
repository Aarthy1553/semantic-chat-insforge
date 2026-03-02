import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@insforge/sdk';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const insforge = createClient({
  baseUrl: process.env.INSFORGE_URL!,
  anonKey: process.env.INSFORGE_ANON_KEY!,
});

async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (model as any).embedContent({
    content: { role: 'user', parts: [{ text }] },
    outputDimensionality: 768,
  });
  return result.embedding.values;
}

export async function POST(req: NextRequest) {
  const { query, room_id } = await req.json();
  if (!query || !room_id) {
    return NextResponse.json({ error: 'query and room_id are required' }, { status: 400 });
  }
  try {
    const embedding = await generateEmbedding(query);
    const { data, error } = await insforge.database.rpc('match_messages', {
      query_embedding: embedding,
      match_room: room_id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ results: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}