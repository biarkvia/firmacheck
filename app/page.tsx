'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

type Company = {
  ico: string;
  name: string;
  legal_form?: string | null;
  status?: string | null;
  address?: string | null;
  established_date?: string | null;
  dic?: string | null;
  lat?: number | null;
  lng?: number | null;
  source?: string | null;
  geocoding_source?: string | null;
  last_updated?: string | null;
};

type ApiError = {
  error?: string;
};

const normalizeString = (str: string) => {
  return str.toLowerCase().replace(/[\s,.]/g, '');
};

const csvEscape = (value: unknown) => {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('cs-CZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

const loadSavedCompanies = async () => {
  const res = await fetch('/api/saved');
  return res.ok ? ((await res.json()) as Company[]) : [];
};

export default function Home() {
  const [ico, setIco] = useState('');
  const [searchName, setSearchName] = useState('');
  const [result, setResult] = useState<Company | null>(null);
  const [nameMatchResult, setNameMatchResult] = useState<string | null>(null);
  const [savedCompanies, setSavedCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchSavedCompanies = useCallback(async () => {
    try {
      const data = await loadSavedCompanies();
      setSavedCompanies(data);
    } catch (err) {
      console.error('Chyba při načítání uložených firem', err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadSavedCompanies()
      .then((data) => {
        if (!cancelled) {
          setSavedCompanies(data);
        }
      })
      .catch((err) => {
        console.error('Chyba při načítání uložených firem', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const normalizedIco = ico.trim();
  const isIcoValid = /^\d{8}$/.test(normalizedIco);

  const verifyCompany = async (icoToVerify = normalizedIco) => {
    const trimmedIco = icoToVerify.trim();

    if (!/^\d{8}$/.test(trimmedIco)) {
      setError('IČO musí obsahovat přesně 8 číslic.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setNameMatchResult(null);
    setIco(trimmedIco);

    try {
      const res = await fetch(`/api/verify?ico=${encodeURIComponent(trimmedIco)}`);
      const data = (await res.json()) as Company & ApiError;

      if (!res.ok) {
        throw new Error(data.error || 'Chyba při načítání dat');
      }

      setResult(data);
      await fetchSavedCompanies();

      if (searchName.trim()) {
        const normalizedSearch = normalizeString(searchName);
        const normalizedAres = normalizeString(data.name);

        if (normalizedSearch === normalizedAres) {
          setNameMatchResult(`Shoda: Zadaný název "${searchName}" odpovídá firmě "${data.name}"`);
        } else if (normalizedAres.includes(normalizedSearch) || normalizedSearch.includes(normalizedAres)) {
          setNameMatchResult(`Částečná shoda: Zadaný název "${searchName}" je podobný s "${data.name}"`);
        } else {
          setNameMatchResult('Neshoda: Zadaný název se liší od názvu uvedeného v ARES.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neznámá chyba');
    } finally {
      setLoading(false);
    }
  };

  const saveCompany = async () => {
    if (!result) return;

    try {
      const res = await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ico: result.ico }),
      });

      if (!res.ok) {
        const data = (await res.json()) as ApiError;
        throw new Error(data.error || 'Chyba při ukládání');
      }

      await fetchSavedCompanies();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba při ukládání');
    }
  };

  const removeCompany = async (icoToRemove: string) => {
    try {
      const res = await fetch(`/api/saved?ico=${encodeURIComponent(icoToRemove)}`, { method: 'DELETE' });

      if (!res.ok) {
        const data = (await res.json()) as ApiError;
        throw new Error(data.error || 'Chyba při mazání');
      }

      await fetchSavedCompanies();
      if (result?.ico === icoToRemove) {
        setResult(null);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba při mazání');
    }
  };

  const exportCSV = () => {
    if (savedCompanies.length === 0) {
      alert('Žádné firmy k exportu');
      return;
    }

    const headers = [
      'IČO',
      'Obchodní název',
      'Právní forma',
      'Stav subjektu',
      'DIČ',
      'Adresa sídla',
      'Datum vzniku',
      'Datum posledního ověření',
      'Zdroj posledního načtení dat',
      'Souřadnice sídla',
    ];
    const csvRows = [headers.map(csvEscape).join(',')];

    savedCompanies.forEach((company) => {
      const coordinates = company.lat && company.lng ? `${company.lat}, ${company.lng}` : '';
      const row = [
        company.ico,
        company.name,
        company.legal_form,
        company.status,
        company.dic,
        company.address,
        company.established_date,
        company.last_updated,
        company.source,
        coordinates,
      ];
      csvRows.push(row.map(csvEscape).join(','));
    });

    const csvContent = `data:text/csv;charset=utf-8,\uFEFF${csvRows.join('\n')}`;
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'ulozene_firmy.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isCurrentlySaved = result && savedCompanies.some((company) => company.ico === result.ico);

  return (
    <main className="min-h-screen p-4 sm:p-8 max-w-2xl mx-auto font-sans">
      <div className="mb-8 flex flex-col md:flex-row items-center gap-6 bg-blue-50 p-6 rounded-xl">
        <div className="flex-1">
          <h1 className="text-4xl font-bold text-blue-900 mb-2">FirmaCheck</h1>
          <p className="text-blue-700">Rychlé ověření českých firem z ARES vč. zobrazení na mapě.</p>
        </div>
        <Image
          src="/hero-image.png"
          alt="AI generated hero illustration"
          width={128}
          height={128}
          className="w-32 h-32 object-cover rounded-full shadow-md"
          priority
        />
      </div>

      <form
        className="flex flex-col gap-4 mb-8"
        onSubmit={(event) => {
          event.preventDefault();
          verifyCompany(normalizedIco);
        }}
      >
        <div>
          <input
            type="text"
            value={ico}
            onChange={(event) => setIco(event.target.value)}
            placeholder="Zadejte IČO (např. 02823519)"
            inputMode="numeric"
            maxLength={8}
            className="border p-2 rounded text-black w-full"
          />
          {normalizedIco && !isIcoValid && (
            <p className="mt-1 text-sm text-red-600">IČO musí obsahovat přesně 8 číslic.</p>
          )}
        </div>
        <input
          type="text"
          value={searchName}
          onChange={(event) => setSearchName(event.target.value)}
          placeholder="Název firmy (volitelné)"
          className="border p-2 rounded text-black"
        />
        <button
          type="submit"
          disabled={loading || !isIcoValid}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Načítám...' : 'Ověřit firmu'}
        </button>
      </form>

      {error && <p className="text-red-500 bg-red-50 p-4 rounded mb-6">{error}</p>}

      {result && (
        <div className="border p-6 rounded-lg bg-gray-50 text-black shadow-sm mb-8 relative">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
            <h2 className="text-2xl font-bold">{result.name}</h2>
            <span className="bg-yellow-200 px-2 py-1 rounded text-sm font-semibold whitespace-nowrap">
              ARES data: {result.source}
            </span>
          </div>

          <div className="space-y-2 mb-6">
            <p><strong>IČO:</strong> {result.ico}</p>
            {result.dic && <p><strong>DIČ:</strong> {result.dic}</p>}
            <p><strong>Adresa:</strong> {result.address}</p>
            {result.legal_form && <p><strong>Právní forma:</strong> {result.legal_form}</p>}
            {result.status && <p><strong>Stav subjektu:</strong> {result.status}</p>}
            {result.established_date && <p><strong>Datum vzniku:</strong> {result.established_date}</p>}
          </div>

          {nameMatchResult && (
            <div className={`mt-4 mb-6 p-3 rounded text-sm font-medium ${
              nameMatchResult.startsWith('Shoda') ? 'bg-green-100 text-green-800' :
              nameMatchResult.startsWith('Částečná') ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {nameMatchResult}
            </div>
          )}

          <div className="border-t pt-4 flex justify-end">
            {!isCurrentlySaved ? (
              <button
                onClick={saveCompany}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
              >
                + Uložit firmu
              </button>
            ) : (
              <span className="bg-green-100 text-green-800 px-4 py-2 rounded font-medium">
                Firma uložena
              </span>
            )}
          </div>

          {result.lat && result.lng && (
            <div className="mt-6 border-t pt-4">
              <div className="mb-3 flex flex-col gap-1">
                <h3 className="text-lg font-bold">Sídlo na mapě</h3>
                <p className="text-sm"><strong>Geocoding:</strong> {result.geocoding_source}</p>
                <p className="text-sm">
                  <strong>Souřadnice:</strong> {result.lat}, {result.lng}
                  <a
                    href={`https://mapy.cz/zakladni?x=${result.lng}&y=${result.lat}&z=16&source=coor&id=${result.lng}%2C${result.lat}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-4 text-blue-600 hover:text-blue-800 font-medium underline"
                  >
                    Otevřít v Mapy.cz
                  </a>
                </p>
              </div>
              <iframe
                title={`Mapa sídla ${result.name}`}
                width="100%"
                height="300"
                className="rounded-lg border shadow-inner"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${result.lng - 0.005},${result.lat - 0.005},${result.lng + 0.005},${result.lat + 0.005}&layer=mapnik&marker=${result.lat},${result.lng}`}
              />
            </div>
          )}
        </div>
      )}

      <div className="border-t-2 border-gray-200 pt-8 mt-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <h2 className="text-2xl font-bold">Uložené firmy ({savedCompanies.length})</h2>
          <button
            onClick={exportCSV}
            disabled={savedCompanies.length === 0}
            className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900 disabled:opacity-50"
          >
            Exportovat do CSV
          </button>
        </div>

        {savedCompanies.length === 0 ? (
          <p className="text-gray-500">Zatím nemáte uložené žádné firmy.</p>
        ) : (
          <div className="space-y-4">
            {savedCompanies.map((company) => (
              <div key={company.ico} className="border p-4 rounded bg-white text-black shadow-sm hover:shadow transition">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                  <div className="text-left">
                    <button
                      type="button"
                      className="font-bold text-lg text-left hover:text-blue-600"
                      onClick={() => verifyCompany(company.ico)}
                    >
                      {company.name}
                    </button>
                    <p className="text-sm text-gray-600">IČO: {company.ico}</p>
                    <p className="text-sm text-gray-600">Adresa: {company.address || 'Neuvedeno'}</p>
                    <p className="text-sm text-gray-600">
                      Poslední ověření: {formatDateTime(company.last_updated) || 'Neuvedeno'}
                    </p>
                  </div>
                  <button
                    onClick={() => removeCompany(company.ico)}
                    className="self-start text-red-500 hover:text-red-700 font-medium px-3 py-1 border border-red-200 rounded hover:bg-red-50"
                  >
                    Odstranit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
