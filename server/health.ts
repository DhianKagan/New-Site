export interface DependencyHealthInput {
  dbHealth: { ok: boolean; latencyMs?: number; error?: string };
  redisHealth: { configured: boolean; ok: boolean; latencyMs?: number; error?: string };
  telegramConfigured: boolean;
  uptimeSec: number;
}

export function evaluateHealthResponse(input: DependencyHealthInput): {
  statusCode: 200 | 503;
  body: {
    ok: boolean;
    uptime: number;
    postgres: 'ok' | 'unavailable';
    redis: 'ok' | 'disabled' | 'unavailable';
    telegramConfigured: boolean;
  };
} {
  const postgresOk = input.dbHealth.ok;
  const redisOk = !input.redisHealth.configured || input.redisHealth.ok;
  const healthy = postgresOk && redisOk;

  return {
    statusCode: healthy ? 200 : 503,
    body: {
      ok: healthy,
      uptime: Math.max(0, Math.round(input.uptimeSec)),
      postgres: postgresOk ? 'ok' : 'unavailable',
      redis: !input.redisHealth.configured ? 'disabled' : input.redisHealth.ok ? 'ok' : 'unavailable',
      telegramConfigured: input.telegramConfigured,
    },
  };
}
