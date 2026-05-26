'use client';

import { useState, useEffect } from 'react';

const normalizeString = (str: string) => {
  return str.toLowerCase().replace(/[\s,\.]/g, '');
};

export default function Home() {
  const [ico, setIco] = useState('');
  const [searchName, setSearchName] = useState('');
  const [result, setResult] = useState<any>(null);
  const [nameMatchResult, setNameMatchResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [savedCompanies, setSavedCompanies] = useState<any[]>([]);

  useEffect(() => {
    fetchSavedCompanies();
  }, []);

  const fetchSavedCompanies = async () => {
    try {
      const res = await fetch('/api/saved');
      if (res.ok) {
        const data = await res.json();
        setSavedCompanies(data);
      }
    } catch (err) {
      console.error('Chyba při načítání uložených firem', err);
    }
  };

  const verifyCompany = async (icoToVerify = ico) => {
    setLoading(true);
    setError('');
    setResult(null);
    setNameMatchResult(null);
    setIco(icoToVerify);

    try {
      const res = await fetch(`/api/verify?ico=${icoToVerify}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Chyba při načítání dat');
      }

      setResult(data);

      if (searchName.trim()) {
        const normalizedSearch = normalizeString(searchName);
        const normalizedAres = normalizeString(data.name);

        if (normalizedSearch === normalizedAres) {
          setNameMatchResult(`Shoda: Zadaný název "${searchName}" odpovídá firmě "${data.name}"`);
        } else if (normalizedAres.includes(normalizedSearch) || normalizedSearch.includes(normalizedAres)) {
          setNameMatchResult(`Částečná shoda: Zadaný název "${searchName}" je podobný s "${data.name}"`);
        } else {
          setNameMatchResult(`Neshoda: Zadaný název se liší od názvu uvedeného v ARES.`);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveCompany = async () => {
    if (!result) return;
    try {
      await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ico: result.ico })
      });
      fetchSavedCompanies();
    } catch (err) {
      alert('Chyba při ukládání');
    }
  };

  const removeCompany = async (icoToRemove: string) => {
    try {
      await fetch(`/api/saved?ico=${icoToRemove}`, { method: 'DELETE' });
      fetchSavedCompanies();
      if (result && result.ico === icoToRemove) {
          setResult(null);
      }
    } catch (err) {
      alert('Chyba při mazání');
    }
  };

  const exportCSV = () => {
    if (savedCompanies.length === 0) return alert('Žádné firmy k exportu');

    const headers = ['IČO', 'Obchodní název', 'Právní forma', 'Adresa sídla', 'Datum vzniku', 'Zdroj dat', 'Lat', 'Lng'];
    const csvRows = [headers.join(',')];

    savedCompanies.forEach(c => {
      const row = [
        c.ico,
        `"${c.name}"`,
        `"${c.legal_form || ''}"`,
        `"${c.address}"`,
        c.established_date || '',
        c.source,
        c.lat || '',
        c.lng || ''
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "ulozene_firmy.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isCurrentlySaved = result && savedCompanies.some(c => c.ico === result.ico);

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto font-sans">
      
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">FirmaCheck</h1>
      </div>
      
      <div className="flex flex-col gap-4 mb-8">
        <input 
          type="text" 
          value={ico}
          onChange={(e) => setIco(e.target.value)}
          placeholder="Zadejte IČO (např. 02823519)"
          className="border p-2 rounded text-black"
        />
        <input 
          type="text" 
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          placeholder="Název firmy (volitelné)"
          className="border p-2 rounded text-black"
        />
        <button 
          onClick={() => verifyCompany(ico)}
          disabled={loading || !ico}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Načítám...' : 'Ověřit firmu'}
        </button>
      </div>

      {error && <p className="text-red-500 bg-red-50 p-4 rounded mb-6">{error}</p>}

      {result && (
        <div className="border p-6 rounded-lg bg-gray-50 text-black shadow-sm mb-8 relative">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold pr-20">{result.name}</h2>
            <span className="bg-yellow-200 px-2 py-1 rounded text-sm font-semibold whitespace-nowrap">
              Zdroj: {result.source}
            </span>
          </div>
          
          <div className="space-y-2 mb-6">
            <p><strong>IČO:</strong> {result.ico}</p>
            <p><strong>Adresa:</strong> {result.address}</p>
            {result.legal_form && <p><strong>Právní forma:</strong> {result.legal_form}</p>}
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
                ✓ Firma uložena
              </span>
            )}
          </div>

          {result.lat && result.lng && (
            <div className="mt-6 border-t pt-4">
              <h3 className="text-lg font-bold mb-2">Sídlo na mapě</h3>
              <p className="text-sm mb-3">
                <strong>Souřadnice:</strong> {result.lat}, {result.lng}
                <a
                  href={`https://mapy.cz/zakladni?x=${result.lng}&y=${result.lat}&z=16&source=coor&id=${result.lng}%2C${result.lat}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-4 text-blue-600 hover:text-blue-800 font-medium underline"
                >
                  ↗ Otevřít v Mapy.cz
                </a>
              </p>
              <iframe
                width="100%"
                height="300"
                className="rounded-lg border shadow-inner"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${result.lng - 0.005},${result.lat - 0.005},${result.lng + 0.005},${result.lat + 0.005}&layer=mapnik&marker=${result.lat},${result.lng}`}
              ></iframe>
            </div>
          )}
        </div>
      )}

      <div className="border-t-2 border-gray-200 pt-8 mt-8">
        <div className="flex justify-between items-center mb-6">
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
            {savedCompanies.map(company => (
              <div key={company.ico} className="border p-4 rounded flex justify-between items-center bg-white text-black shadow-sm hover:shadow transition">
                <div>
                  <h3 className="font-bold text-lg cursor-pointer hover:text-blue-600" onClick={() => verifyCompany(company.ico)}>
                    {company.name}
                  </h3>
                  <p className="text-sm text-gray-600">IČO: {company.ico}</p>
                </div>
                <button 
                  onClick={() => removeCompany(company.ico)}
                  className="text-red-500 hover:text-red-700 font-medium px-3 py-1 border border-red-200 rounded hover:bg-red-50"
                >
                  Odstranit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </main>
  );
}