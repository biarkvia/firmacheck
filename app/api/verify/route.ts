import { NextResponse } from 'next/server';
import { turso } from '../../../lib/turso';

type AresData = {
  ico?: string;
  obchodniJmeno?: string;
  pravniForma?: string;
  datumVzniku?: string;
  dic?: string;
  stavSubjektu?: string;
  sidlo?: {
    textovaAdresa?: string;
  };
  seznamRegistraci?: {
    stavZdrojeRos?: string;
    stavZdrojeVr?: string;
    stavZdrojeRzp?: string;
    stavZdrojeRes?: string;
  };
};

type GeocodeResult = {
  lat: number | null;
  lng: number | null;
  source: string;
};

type CompanyFields = {
  name: string;
  legal_form: string | null;
  status: string;
  address: string;
  established_date: string | null;
  dic: string | null;
  lat: number | null;
  lng: number | null;
};

const getCompanyStatus = (aresData: AresData) => {
  return (
    aresData.stavSubjektu ||
    aresData.seznamRegistraci?.stavZdrojeRos ||
    aresData.seznamRegistraci?.stavZdrojeVr ||
    aresData.seznamRegistraci?.stavZdrojeRzp ||
    aresData.seznamRegistraci?.stavZdrojeRes ||
    'Neuvedeno'
  );
};

const geocodeAddress = async (addressString: string): Promise<GeocodeResult> => {
  if (addressString === 'Adresa nedostupná') {
    return { lat: null, lng: null, source: 'Nedostupné' };
  }

  try {
    const cachedGeocode = await turso.execute({
      sql: `SELECT lat, lng FROM companies
            WHERE address = ? AND lat IS NOT NULL AND lng IS NOT NULL
            LIMIT 1`,
      args: [addressString],
    });

    if (cachedGeocode.rows.length > 0) {
      return {
        lat: Number(cachedGeocode.rows[0].lat),
        lng: Number(cachedGeocode.rows[0].lng),
        source: 'SQLite cache',
      };
    }

    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addressString)}&format=json&limit=1`, {
      headers: { 'User-Agent': 'FirmaCheck-App/1.0' },
    });
    const geoData = await geoRes.json();

    if (geoData && geoData.length > 0) {
      return {
        lat: parseFloat(geoData[0].lat),
        lng: parseFloat(geoData[0].lon),
        source: 'API',
      };
    }
  } catch (geoError) {
    console.error('Chyba geocodingu:', geoError);
  }

  return { lat: null, lng: null, source: 'Nedostupné' };
};

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
      const needsAresRefresh = !company.status;
      const needsGeocodeRefresh = !company.lat || !company.lng;
      let geocodingSource = company.lat && company.lng ? 'SQLite cache' : 'Nedostupné';
      let refreshedFields: Partial<CompanyFields> = {};

      if (needsAresRefresh || needsGeocodeRefresh) {
        const refreshResponse = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`);

        if (refreshResponse.ok) {
          const refreshedAresData = (await refreshResponse.json()) as AresData;
          const refreshedAddress = refreshedAresData.sidlo?.textovaAdresa || String(company.address || 'Adresa nedostupná');
          const geocode = needsGeocodeRefresh
            ? await geocodeAddress(refreshedAddress)
            : { lat: company.lat ? Number(company.lat) : null, lng: company.lng ? Number(company.lng) : null, source: geocodingSource };

          geocodingSource = geocode.source;
          const updatedFields: CompanyFields = {
            name: refreshedAresData.obchodniJmeno || String(company.name || 'Název nedostupný'),
            legal_form: refreshedAresData.pravniForma || (company.legal_form ? String(company.legal_form) : null),
            status: getCompanyStatus(refreshedAresData),
            address: refreshedAddress,
            established_date: refreshedAresData.datumVzniku || (company.established_date ? String(company.established_date) : null),
            dic: refreshedAresData.dic || (company.dic ? String(company.dic) : null),
            lat: geocode.lat,
            lng: geocode.lng,
          };
          refreshedFields = updatedFields;

          await turso.execute({
            sql: `UPDATE companies
                  SET name = ?, legal_form = ?, status = ?, address = ?, established_date = ?,
                      dic = ?, lat = ?, lng = ?, source = 'SQLite cache', last_updated = CURRENT_TIMESTAMP
                  WHERE ico = ?`,
            args: [
              updatedFields.name,
              updatedFields.legal_form,
              updatedFields.status,
              updatedFields.address,
              updatedFields.established_date,
              updatedFields.dic,
              updatedFields.lat,
              updatedFields.lng,
              ico,
            ],
          });
        }
      }

      await turso.execute({
        sql: "UPDATE companies SET source = 'SQLite cache', last_updated = CURRENT_TIMESTAMP WHERE ico = ?",
        args: [ico],
      });

      return NextResponse.json({
        ...company,
        ...refreshedFields,
        source: 'SQLite cache',
        geocoding_source: geocodingSource,
      });
    }

    const aresResponse = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`);
    
    if (!aresResponse.ok) {
      return NextResponse.json({ error: 'Firma nenalezena' }, { status: 404 });
    }

    const aresData = (await aresResponse.json()) as AresData;
    const addressString = aresData.sidlo?.textovaAdresa || 'Adresa nedostupná';
    const geocode = await geocodeAddress(addressString);

    const companyData = {
      ico: aresData.ico || ico,
      name: aresData.obchodniJmeno || 'Název nedostupný',
      legal_form: aresData.pravniForma || null,
      status: getCompanyStatus(aresData),
      address: addressString,
      established_date: aresData.datumVzniku || null,
      dic: aresData.dic || null,
      lat: geocode.lat,
      lng: geocode.lng,
      source: 'API',
      geocoding_source: geocode.source,
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
