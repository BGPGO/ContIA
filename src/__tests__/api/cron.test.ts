import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, parseResponse } from '../helpers/api-test-utils';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}));

vi.mock('@/lib/scheduler', () => ({
  getReadyJobs: vi.fn(),
  processJob: vi.fn(),
}));

import { GET } from '@/app/api/cron/publish-posts/route';
import { getReadyJobs } from '@/lib/scheduler';

const CRON_SECRET = 'test-cron-secret-123';

describe('GET /api/cron/publish-posts', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', CRON_SECRET);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fake.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'fake-anon-key');
  });

  it('retorna 401 sem header Authorization', async () => {
    const req = createMockRequest('/api/cron/publish-posts', {
      method: 'GET',
    });

    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(401);
    expect(body.error).toContain('autorizado');
  });

  it('retorna 401 com secret errado', async () => {
    const req = createMockRequest('/api/cron/publish-posts', {
      method: 'GET',
      headers: { Authorization: 'Bearer wrong-secret' },
    });

    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(401);
    expect(body.error).toContain('autorizado');
  });

  it('retorna 401 quando CRON_SECRET nao esta definido', async () => {
    vi.stubEnv('CRON_SECRET', '');

    const req = createMockRequest('/api/cron/publish-posts', {
      method: 'GET',
      headers: { Authorization: 'Bearer qualquer-valor' },
    });

    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(401);
    expect(body.error).toContain('autorizado');
  });

  it('retorna 200 com secret correto e nenhum job pronto', async () => {
    vi.mocked(getReadyJobs).mockResolvedValue([]);

    const req = createMockRequest('/api/cron/publish-posts', {
      method: 'GET',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });

    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.processed).toBe(0);
    expect(body.message).toContain('Nenhum post');
  });
});
