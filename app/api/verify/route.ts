import { NextResponse } from 'next/server';
import { turso } from '../../../lib/turso';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ico = searchParams.get('ico')?.trim();

  if (!ico) {
    return NextResponse.json({ error: 'IČO je povinné' }, { status: 400 });
  }

  if (!/^\d{8}$/.test(ico)) {
    return NextResponse.json({ error: 'IČO musí obsahovat přesně 8 číslic' }, { status: 400 });
  }

  try {
    const cachedResult = await turso.execute({
      sql: 'SELECT * FROM companies WHERE ico = ?',
      args: [ico],
    });

    if (cachedResult.rows.length > 0) {
      const company = cachedResult.rows[0];
      await turso.execute({
        sql: "UPDATE companies SET source = 'SQLite cache', last_updated = CURRENT_TIMESTAMP WHERE ico = ?",
        args: [ico],
      });

      return NextResponse.json({
        ...company,
        source: 'SQLite cache',
        geocoding_source: company.lat && company.lng ? 'SQLite cache' : 'Nedostupné',
      });
    }

    const aresResponse = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`);
    
    if (!aresResponse.ok) {
      return NextResponse.json({ error: 'Firma nenalezena' }, { status: 404 });
    }

    const aresData = await aresResponse.json();
    const addressString = aresData.sidlo?.textovaAdresa || 'Adresa nedostupná';

    let lat: number | null = null;
    let lng: number | null = null;
    let geocodingSource = 'Nedostupné';

    if (addressString !== 'Adresa nedostupná') {
      try {
        const cachedGeocode = await turso.execute({
          sql: `SELECT lat, lng FROM companies
                WHERE address = ? AND lat IS NOT NULL AND lng IS NOT NULL
                LIMIT 1`,
          args: [addressString],
        });

        if (cachedGeocode.rows.length > 0) {
          lat = Number(cachedGeocode.rows[0].lat);
          lng = Number(cachedGeocode.rows[0].lng);
          geocodingSource = 'SQLite cache';
        } else {
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addressString)}&format=json&limit=1`, {
            headers: { 'User-Agent': 'FirmaCheck-App/1.0' },
          });
          const geoData = await geoRes.json();
          if (geoData && geoData.length > 0) {
            lat = parseFloat(geoData[0].lat);
            lng = parseFloat(geoData[0].lon);
            geocodingSource = 'API';
          }
        }
      } catch (geoError) {
        console.error('Chyba geocodingu:', geoError);
      }
    }

    const companyData = {
      ico: aresData.ico,
      name: aresData.obchodniJmeno,
      legal_form: aresData.pravniForma,
      status: aresData.stavSubjektu || null,
      address: addressString,
      established_date: aresData.datumVzniku || null,
      dic: aresData.dic || null,
      lat,
      lng,
      source: 'API',
      geocoding_source: geocodingSource,
    };

    await turso.execute({
      sql: `INSERT INTO companies (ico, name, legal_form, status, address, established_date, dic, lat, lng, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        companyData.ico, companyData.name, companyData.legal_form, companyData.status,
        companyData.address, companyData.established_date, companyData.dic,
        companyData.lat, companyData.lng, 'API',
      ],
    });

    return NextResponse.json(companyData);

  } catch (error) {
    console.error('Chyba serveru:', error);
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 });
  }
}
