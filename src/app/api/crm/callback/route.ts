/**
 * GET /api/crm/callback
 *
 * Placeholder — o CRM BGPGO não usa OAuth, então este endpoint nunca é chamado.
 * Existe apenas para manter consistência de interface com outros providers OAuth.
 */

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    {
      error:
        'O CRM BGPGO não usa OAuth. Use /api/crm/auth para conectar automaticamente.',
    },
    { status: 400 }
  )
}
