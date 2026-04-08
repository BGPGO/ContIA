import { NextResponse } from 'next/server';
import { getPsdTemplates } from '@/lib/psd-templates';

export async function GET() {
  const templates = getPsdTemplates();
  return NextResponse.json(templates);
}
