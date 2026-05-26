import { NextResponse } from 'next/server';
import { turso } from '../../../lib/turso';

export async function GET() {
  try {
    const result = await turso.execute('SELECT * FROM companies WHERE is_saved = 1 ORDER BY last_updated DESC');
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('[GET /api/saved] Chyba:', error);
    return NextResponse.json({ error: 'Chyba při načítání uložených firem' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { ico } = await request.json();
    if (!ico || !/^\d{8}$/.test(String(ico))) {
      return NextResponse.json({ error: 'Platné IČO je povinné' }, { status: 400 });
    }

    await turso.execute({
      sql: 'UPDATE companies SET is_saved = 1 WHERE ico = ?',
      args: [ico],
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/saved] Chyba:', error);
    return NextResponse.json({ error: 'Chyba při ukládání' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ico = searchParams.get('ico');
    if (!ico || !/^\d{8}$/.test(ico)) {
      return NextResponse.json({ error: 'Platné IČO je povinné' }, { status: 400 });
    }

    await turso.execute({
      sql: 'UPDATE companies SET is_saved = 0 WHERE ico = ?',
      args: [ico],
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/saved] Chyba:', error);
    return NextResponse.json({ error: 'Chyba při mazání' }, { status: 500 });
  }
}
