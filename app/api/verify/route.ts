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
    const addressString = aresData.sidlo?.textovaAdresa || 'Adresa nedostupná';

    let lat = null;
    let lng = null;

    if (addressString !== 'Adresa nedostupná') {
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addressString)}&format=json&limit=1`, {
          headers: { 'User-Agent': 'FirmaCheck-App/1.0' }
        });
        const geoData = await geoRes.json();
        if (geoData && geoData.length > 0) {
          lat = parseFloat(geoData[0].lat);
          lng = parseFloat(geoData[0].lon);
        }
      } catch (geoError) {
        console.error('Chyba geocodingu:', geoError);
      }
    }

    const companyData = {
      ico: aresData.ico,
      name: aresData.obchodniJmeno,
      legal_form: aresData.pravniForma,
      address: addressString,
      established_date: aresData.datumVzniku || null,
      dic: aresData.dic || null,
      lat: lat,
      lng: lng,
      source: 'API',
    };

    await turso.execute({
      sql: `INSERT INTO companies (ico, name, legal_form, address, established_date, dic, lat, lng, source) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        companyData.ico, companyData.name, companyData.legal_form,
        companyData.address, companyData.established_date, companyData.dic,
        companyData.lat, companyData.lng, 'API'
      ],
    });

    return NextResponse.json(companyData);

  } catch (error) {
    console.error('Chyba serveru:', error);
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 });
  }
}