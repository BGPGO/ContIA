import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, parseResponse } from '../helpers/api-test-utils';

// Mock do Supabase
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSupabase = {
  auth: { getUser: mockGetUser },
  from: mockFrom,
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock('@/lib/scheduler', () => ({
  schedulePost: vi.fn(),
  cancelSchedule: vi.fn(),
}));

import { POST, DELETE } from '@/app/api/posts/schedule/route';
import { schedulePost, cancelSchedule } from '@/lib/scheduler';

describe('POST /api/posts/schedule', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
  });

  it('retorna 401 se usuario nao autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = createMockRequest('/api/posts/schedule', {
      method: 'POST',
      body: { postId: 'p1', empresaId: 'e1', scheduledFor: '2030-01-01T00:00:00Z', platforms: ['instagram'] },
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(401);
    expect(body.error).toContain('autenticado');
  });

  it('retorna 400 sem postId', async () => {
    const req = createMockRequest('/api/posts/schedule', {
      method: 'POST',
      body: { empresaId: 'e1', scheduledFor: '2030-01-01T00:00:00Z', platforms: ['instagram'] },
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.error).toContain('obrigatorios');
  });

  it('retorna 400 sem empresaId', async () => {
    const req = createMockRequest('/api/posts/schedule', {
      method: 'POST',
      body: { postId: 'p1', scheduledFor: '2030-01-01T00:00:00Z', platforms: ['instagram'] },
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.error).toContain('obrigatorios');
  });

  it('retorna 400 sem scheduledFor', async () => {
    const req = createMockRequest('/api/posts/schedule', {
      method: 'POST',
      body: { postId: 'p1', empresaId: 'e1', platforms: ['instagram'] },
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.error).toContain('obrigatorios');
  });

  it('retorna 400 sem platforms', async () => {
    const req = createMockRequest('/api/posts/schedule', {
      method: 'POST',
      body: { postId: 'p1', empresaId: 'e1', scheduledFor: '2030-01-01T00:00:00Z' },
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.error).toContain('obrigatorios');
  });

  it('retorna 400 com platforms vazio', async () => {
    const req = createMockRequest('/api/posts/schedule', {
      method: 'POST',
      body: { postId: 'p1', empresaId: 'e1', scheduledFor: '2030-01-01T00:00:00Z', platforms: [] },
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.error).toContain('plataforma');
  });

  it('retorna 400 com data no passado (via scheduler throw)', async () => {
    // O route delega para schedulePost que lanca erro com "futuro"
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'e1' } }),
          }),
        }),
      }),
    });

    vi.mocked(schedulePost).mockRejectedValue(
      new Error('A data de agendamento deve ser no futuro.')
    );

    const req = createMockRequest('/api/posts/schedule', {
      method: 'POST',
      body: {
        postId: 'p1',
        empresaId: 'e1',
        scheduledFor: '2020-01-01T00:00:00Z',
        platforms: ['instagram'],
      },
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.error).toContain('futuro');
  });
});

describe('DELETE /api/posts/schedule', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
  });

  it('retorna 401 se usuario nao autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = createMockRequest('/api/posts/schedule', {
      method: 'DELETE',
      body: { jobId: 'job-1' },
    });

    const res = await DELETE(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(401);
    expect(body.error).toContain('autenticado');
  });

  it('retorna 400 sem jobId', async () => {
    const req = createMockRequest('/api/posts/schedule', {
      method: 'DELETE',
      body: {},
    });

    const res = await DELETE(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.error).toContain('jobId');
  });
});
