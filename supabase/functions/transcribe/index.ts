import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_DURATION_SECONDS = 600;

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const groqKey = Deno.env.get("GROQ_API_KEY");

function quota(row: Record<string, unknown>, upgradeUrl?: string) {
  return {
    plan: String(row.plan_id),
    usedToday: Number(row.used_today),
    dailyLimit: Number(row.daily_limit),
    remaining: Number(row.remaining),
    upgradeUrl,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!groqKey) return json({ error: "Transcription provider is not configured" }, 503);

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "Authentication required" }, 401);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Audio file is required" }, 400);
  if (file.size <= 0 || file.size > MAX_AUDIO_BYTES) return json({ error: "Audio file exceeds the 10 MB limit" }, 413);
  const durationHeader = request.headers.get("X-Audio-Duration");
  const duration = durationHeader ? Number(durationHeader) : null;
  if (duration !== null && (!Number.isFinite(duration) || duration < 0 || duration > MAX_DURATION_SECONDS)) {
    return json({ error: "Audio duration exceeds the 10 minute limit" }, 413);
  }
  const requestId = request.headers.get("X-Request-Id");
  if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) return json({ error: "A valid request id is required" }, 400);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: reservation, error: reservationError } = await admin.rpc("reserve_transcription", {
    p_request_id: requestId,
    p_audio_bytes: file.size,
    p_duration_seconds: duration === null ? null : Math.floor(duration),
    p_user_id: user.id,
  });
  if (reservationError || !reservation?.[0]) return json({ error: "Could not check transcription quota" }, 500);
  const row = reservation[0] as Record<string, unknown>;
  const upgradeUrl = Deno.env.get("TRANSCRIPTION_UPGRADE_URL");
  const quotaData = quota(row, upgradeUrl);
  if (!row.accepted) return json({ error: "Daily transcription quota exceeded", quota: quotaData }, 429);

  try {
    const groqForm = new FormData();
    groqForm.append("file", file, file.name || "voice.webm");
    groqForm.append("model", "whisper-large-v3-turbo");
    const language = form.get("language");
    if (typeof language === "string" && language) groqForm.append("language", language);
    const groqResponse = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}` },
      body: groqForm,
    });
    const payload = await groqResponse.json().catch(() => ({}));
    if (!groqResponse.ok) throw new Error(`Provider returned ${groqResponse.status}`);
    await admin.from("transcription_usage").update({ status: "completed" }).eq("user_id", user.id).eq("request_id", requestId);
    return json({ text: typeof payload.text === "string" ? payload.text : "", quota: quotaData });
  } catch {
    await admin.from("transcription_usage").update({ status: "failed" }).eq("user_id", user.id).eq("request_id", requestId);
    return json({ error: "The transcription provider failed", quota: quotaData }, 502);
  }
});
