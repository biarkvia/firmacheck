import { NextResponse } from 'next/server';
import { turso } from '../../../lib/turso';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ico = searchParams.get('ico');

  if (!ico) {
    return NextResponse.json({ error: 'IČO je povinné' }, { status: 400 });
  }

  try {
    const cachedResult = await turso.execute({
      sql: 'SELECT * FROM companies WHERE ico = ?',
      args: [ico],
    });

    if (cachedResult.rows.length > 0) {
      const company = cachedResult.rows[0];
      return NextResponse.json({ ...company, source: 'SQLite cache' });
    }

    const aresResponse = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`);
    
    if (!aresResponse.ok) {
      return NextResponse.json({ error: 'Firma nenalezena' }, { status: 404 });
    }

    const aresData = await aresResponse.json();

    const companyData = {
      ico: aresData.ico,
      name: aresData.obchodniJmeno,
      legal_form: aresData.pravniForma,
      address: aresData.sidlo?.textovaAdresa || 'Adresa nedostupná',
      established_date: aresData.datumVzniku || null,
      dic: aresData.dic || null,
      source: 'API',
    };

    await turso.execute({
      sql: `INSERT INTO companies (ico, name, legal_form, address, established_date, dic, source) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        companyData.ico,
        companyData.name,
        companyData.legal_form,
        companyData.address,
        companyData.established_date,
        companyData.dic,
        'API'
      ],
    });

    return NextResponse.json(companyData);

  } catch (error) {
    console.error('Chyba serveru:', error);
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 });
  }
}