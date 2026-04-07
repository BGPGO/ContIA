import { NextRequest } from 'next/server';

export function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = 'GET', body, headers = {} } = options;

  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body) {
    init.body = JSON.stringify(body);
  }

  return new NextRequest(new URL(url, 'http://localhost:3000'), init as any);
}

export async function parseResponse(response: Response) {
  const json = await response.json();
  return { status: response.status, body: json };
}
