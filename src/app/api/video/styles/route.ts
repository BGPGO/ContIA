import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { CaptionCategory, CaptionStyle } from '@/types/captions';

const VALID_CATEGORIES: CaptionCategory[] = ['viral', 'minimal', 'entertainment', 'business', 'aesthetic'];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const q = url.searchParams.get('q');

  const supabase = await createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let query = supabase
    .from('caption_styles')
    .select('*')
    .order('is_preset', { ascending: false })
    .order('name', { ascending: true });

  if (category && (VALID_CATEGORIES as string[]).includes(category)) {
    query = query.eq('category', category);
  }
  if (q && q.trim()) {
    query = query.ilike('name', `%${q.trim()}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ styles: (data ?? []) as CaptionStyle[] });
}
