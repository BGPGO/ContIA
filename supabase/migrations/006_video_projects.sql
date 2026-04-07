CREATE TABLE IF NOT EXISTS video_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  title TEXT NOT NULL,
  original_url TEXT,
  storage_path TEXT,
  duration_seconds FLOAT,
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'analyzed', 'editing', 'exporting', 'done', 'error')),
  gemini_analysis JSONB DEFAULT '{}',
  transcription JSONB DEFAULT '{}',
  cut_suggestions JSONB DEFAULT '[]',
  edits JSONB DEFAULT '[]',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE video_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own videos" ON video_projects
  FOR ALL USING (user_id = auth.uid());
