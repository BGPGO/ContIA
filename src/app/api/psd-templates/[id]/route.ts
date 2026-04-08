import { NextResponse } from 'next/server';
import { getPsdTemplateById } from '@/lib/psd-templates';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = getPsdTemplateById(id);
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  return NextResponse.json(template);
}
