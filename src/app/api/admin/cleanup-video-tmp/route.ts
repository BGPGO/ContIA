// src/app/api/admin/cleanup-video-tmp/route.ts
// POST /api/admin/cleanup-video-tmp
//
// Remove diretórios temporários de jobs de vídeo mais antigos que 24h.
// Os diretórios seguem o padrão video-job-* dentro de /var/tmp (prod) ou os.tmpdir() (dev).
//
// Auth: header x-cleanup-secret deve bater com env CLEANUP_SECRET
// Pode ser disparado via cron externo (Coolify Scheduled Tasks ou GitHub Actions).

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const JOB_DIR_PREFIX = 'video-job-';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 horas

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CLEANUP_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: 'CLEANUP_SECRET não configurado no servidor.' },
      { status: 500 }
    );
  }

  const headerSecret = req.headers.get('x-cleanup-secret');
  if (headerSecret !== secret) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  // Em prod usa /var/tmp; em dev usa os.tmpdir()
  const tmpBase =
    process.env.NODE_ENV === 'production' ? '/var/tmp' : os.tmpdir();

  let entries: string[];
  try {
    entries = await fs.readdir(tmpBase);
  } catch {
    return NextResponse.json(
      { error: `Não foi possível listar ${tmpBase}.` },
      { status: 500 }
    );
  }

  const now = Date.now();
  let deletedCount = 0;
  let freedBytes = 0;

  for (const entry of entries) {
    if (!entry.startsWith(JOB_DIR_PREFIX)) continue;

    const fullPath = path.join(tmpBase, entry);

    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(fullPath);
    } catch {
      continue;
    }

    if (!stat.isDirectory()) continue;

    const ageMs = now - stat.mtimeMs;
    if (ageMs < MAX_AGE_MS) continue;

    // Calcula tamanho antes de deletar
    const dirSize = await getDirSize(fullPath);

    try {
      await fs.rm(fullPath, { recursive: true, force: true });
      deletedCount++;
      freedBytes += dirSize;
    } catch {
      // Ignora erros individuais — segue para o próximo
    }
  }

  const freed_mb = Math.round((freedBytes / 1024 / 1024) * 100) / 100;

  return NextResponse.json({ deleted: deletedCount, freed_mb });
}

// ---------------------------------------------------------------------------
// Helper: calcula o tamanho total de um diretório recursivamente
// ---------------------------------------------------------------------------
async function getDirSize(dirPath: string): Promise<number> {
  let total = 0;
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);
      if (item.isDirectory()) {
        total += await getDirSize(itemPath);
      } else {
        try {
          const s = await fs.stat(itemPath);
          total += s.size;
        } catch {
          // ignora
        }
      }
    }
  } catch {
    // ignora erros de leitura
  }
  return total;
}
