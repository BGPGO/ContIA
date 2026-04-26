# Deploy Cortes 2h+ — Checklist

Pipeline assíncrono completo (Waves 3-6) pra processar podcasts longos (até 2h30).
Stack: Next.js 16 + Supabase + Whisper + Gemini 2.5 Flash + Sonnet 4.6 + FFmpeg.

---

## 1. Banco de dados

- [ ] Conectar no Supabase Dashboard SQL Editor do projeto ContIA (`hvpbrlczzqhroerogylu`)
- [ ] Rodar migration `supabase/migrations/020_video_async_pipeline.sql` na íntegra
      - Migration é **idempotente** (todos `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`)
      - Pode ser re-executada com segurança
- [ ] Verificar pós-migration com:
      ```sql
      -- Tabela nova existe e está vazia
      SELECT * FROM video_jobs LIMIT 1;

      -- Colunas novas existem em video_projects
      SELECT processing_step, processing_progress, error_step, error_message,
             cost_estimate_cents, cuts
      FROM video_projects
      LIMIT 1;

      -- Bucket cuts existe (privado)
      SELECT id, name, public FROM storage.buckets WHERE id = 'cuts';

      -- Policies do bucket cuts ativas (4: select/insert/update/delete)
      SELECT policyname FROM pg_policies
      WHERE tablename = 'objects' AND policyname LIKE 'cuts_%';
      ```

---

## 2. Variáveis de ambiente Coolify (ContIA)

UUID do app Coolify: `u5gr1pwn7x320gb92ej1kb4s` (projeto `frrqapqbem8i13ncaifx9xzo`).

Verificar/adicionar no painel Coolify > ContIA > Environment Variables:

- [ ] `SUPABASE_SERVICE_ROLE_KEY` — **CRÍTICA**, service role key (não a anon)
      - Pegar no Supabase Dashboard > Project Settings > API > `service_role` (secret)
      - Sem ela, job-runner falha ao gravar progresso e cuts
- [ ] `OPENAI_API_KEY` — já existe (Whisper + outras IAs)
- [ ] `GEMINI_API_KEY` — já existe (Gemini 2.5 Flash detector de cortes)
- [ ] `ANTHROPIC_API_KEY` — já existe (Sonnet 4.6 refinement)
- [ ] `CLEANUP_SECRET` — gerar string aleatória de 32+ chars
      - Ex: `openssl rand -hex 32`
      - Sem ela, endpoint `/api/admin/cleanup-video-tmp` retorna 500
- [ ] `NEXT_PUBLIC_SUPABASE_URL` — já existe
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — já existe

---

## 3. Build local antes de subir (opcional mas recomendado)

```bash
cd ContIA
npm install                # vai instalar tus-js-client se ainda não tiver
npx tsc --noEmit           # JÁ VALIDADO PELA WAVE 6 — exit 0
```

> **Nota**: `npm run build` local pode falhar com Turbopack em path com acentos
> ("Área de Trabalho"). Isso **NÃO bloqueia produção** (build no Linux Coolify
> é limpo). Ignorar erro local de Turbopack.

---

## 4. Deploy Coolify (manual — sem webhook GitHub)

ContIA **não tem webhook GitHub configurado**. Push pra `main` não dispara deploy.

- [ ] Commit local:
      ```bash
      cd ContIA
      git add -A
      git commit -m "feat(cortes): pipeline async pra podcasts 2h+ (Waves 3-6)"
      ```
- [ ] Push:
      ```bash
      git push origin main
      ```
- [ ] Disparar deploy via API Coolify:
      ```bash
      curl -X POST "https://187.77.238.125:8000/api/v1/deploy?uuid=u5gr1pwn7x320gb92ej1kb4s&force=false" \
        -H "Authorization: Bearer <COOLIFY_API_TOKEN>"
      ```
      (substituir `<COOLIFY_API_TOKEN>` pelo token salvo no 1Password / cofre)
- [ ] Acompanhar logs do deploy no painel Coolify (aba "Deployments")
- [ ] Aguardar build verde (~5-8 min em prod com ffmpeg no Dockerfile)

---

## 5. Validação pós-deploy

- [ ] Acessar `https://contia.bertuzzipatrimonial.com.br/cortes`
- [ ] Confirmar que `UploadTUSPanel` renderiza (área drag-and-drop)
- [ ] **Subir vídeo TESTE de ~10min primeiro** (NÃO pular pra 2h direto)
- [ ] Acompanhar `JobStatusPanel` mostrando etapas em sequência:
      ```
      queued → extracting_audio → chunking_audio → transcribing →
      merging_transcription → detecting_cuts → refining_cuts →
      rendering → uploading_clips → completed
      ```
- [ ] Validar que cortes aparecem com botão **"Baixar MP4"** ativo
- [ ] Baixar 1 corte e verificar:
      - [ ] Vídeo abre corretamente
      - [ ] Crop 9:16 está OK
      - [ ] Legendas ASS aparecem queimadas no vídeo
      - [ ] Áudio está sincronizado
- [ ] Testar botão **"Baixar todos"** (download em sequência)
- [ ] Só então fazer upload do podcast 2h+ real

---

## 6. Cron de cleanup (1x por dia)

Diretórios `video-job-*` em `/var/tmp/` ficam órfãos se o job crashar antes do
finally. Cron limpa qualquer dir com mais de 24h.

Opção A — **Coolify Scheduled Tasks** (recomendado):
- [ ] Coolify > ContIA > Scheduled Tasks > Add
- [ ] Cron: `0 3 * * *` (3h da manhã, horário do servidor)
- [ ] Command:
      ```bash
      curl -X POST https://contia.bertuzzipatrimonial.com.br/api/admin/cleanup-video-tmp \
        -H "x-cleanup-secret: <CLEANUP_SECRET>"
      ```

Opção B — **GitHub Actions** (alternativa):
- [ ] Criar `.github/workflows/cleanup-video-tmp.yml`
- [ ] Schedule: `cron: '0 3 * * *'`
- [ ] Step: `curl` igual acima, com `CLEANUP_SECRET` em GitHub Secrets

---

## 7. Rollback (se algo quebrar)

> **ATENÇÃO**: a Wave 6 (Theta) **deletou as rotas legacy** (`/api/video/upload`,
> `/api/video/transcribe`, `/api/video/process`, `/api/video/cuts`,
> `/api/video/analyze-cuts`) e os módulos `whisper-transcription.ts` e
> `gemini-video.ts`. Rollback simples (revert) restaura tudo, mas qualquer
> upload no estado intermediário ficará órfão.

- [ ] `git revert <merge-commit-da-wave-6>` (sem `-m` no commit normal; com `-m 1` se for merge)
- [ ] `git push origin main`
- [ ] Re-disparar deploy via API Coolify (mesmo comando da seção 4)
- [ ] Verificar que `/cortes` voltou ao fluxo antigo (browser-render)
- [ ] **Nota**: o banco fica com colunas/tabela novas (não afeta fluxo legacy).
      Não rolar `down migration` — perderia jobs em andamento.

---

## Custo esperado (4 podcasts/mês de 2h)

| Componente | Cálculo | Custo |
|------------|---------|-------|
| Whisper OpenAI | 8h × $0.36/h | **$2.88** |
| Gemini 2.5 Flash (5 prompts/podcast) | 4 × $0.10 | **$0.40** |
| Sonnet 4.6 refinement (1 prompt/podcast) | 4 × $0.05 | **$0.20** |
| Storage Supabase | ~10 GB | **~$0** |
| Bandwidth | clipes baixados pelo cliente | **~$0** |
| **TOTAL** |  | **~$3.50/mês** |

---

## Limitações conhecidas (MVP)

- **Cap 2h30** — vídeos maiores são rejeitados client-side e server-side
- **Render serial** — 1 corte por vez (não paraleliza ffmpeg pra evitar OOM)
- **Re-render com novo estilo** — endpoint stub retorna 501 (Wave 6.1 implementa)
- **Crop 9:16 estático centrado** — sem face tracking (mais caro, deixar pra v2)
- **Sem diarização** — Whisper não traz speaker labels; cortes mostram texto sem
  identificação de quem falou
- **ASS captions** — emojis coloridos têm suporte limitado em estilos
  Hormozi/MrBeast (libass renderiza preto e branco em certos casos)

---

## Pipeline ponta-a-ponta validado pelo Squad OMEGA

```
Upload TUS → start-job (202)
  └─> job-runner (in-process, fire-and-forget)
        ├─ extracting_audio (10-30%)        [audio-extractor.ts]
        ├─ chunking_audio (30-35%)          [audio-extractor.ts]
        ├─ transcribing (35-60%)            [whisper-chunked.ts]
        ├─ merging_transcription (60-65%)   [persistTranscription]
        ├─ detecting_cuts (65-78%)          [cut-detector.ts — Gemini Flash]
        ├─ refining_cuts (78-82%)           [cut-refiner.ts — Sonnet 4.6]
        ├─ rendering (82-95%, loop)         [clip-renderer.ts + ass-generator.ts]
        ├─ uploading_clips (95-100%)        [clip-uploader.ts]
        └─ completed (100%) → status=ready  [video_projects]
```

Cleanup de `audio` + `renderedVideoPath` garantido em `finally`.
Loop de render tem try/catch interno: 1 corte falhando não interrompe os outros.
