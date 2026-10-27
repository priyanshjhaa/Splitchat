import { NextResponse } from "next/server";
import { z } from "zod";
import { extractExpenses } from "@/lib/llm";

const requestSchema = z.object({
  participants: z.array(z.string().min(1)).min(1),
  messages: z
    .array(
      z.object({
        id: z.number().int(),
        timestamp: z.string(),
        sender: z.string(),
        text: z.string(),
      }),
    )
    .min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const result = await extractExpenses(
      parsed.data.messages,
      parsed.data.participants,
    );
    return NextResponse.json({ ...result, error: false });
  } catch {
    // All models failed. Never log or return chat contents.
    return NextResponse.json({ expenses: [], error: true });
  }
}
