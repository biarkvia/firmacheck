'use client';

import { useState } from 'react';

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

  const verifyCompany = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    setNameMatchResult(null);

    try {
      const res = await fetch(`/api/verify?ico=${ico}`);
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

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto font-sans">
      <h1 className="text-3xl font-bold mb-6">FirmaCheck</h1>
      
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
          onClick={verifyCompany}
          disabled={loading || !ico}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Načítám...' : 'Ověřit firmu'}
        </button>
      </div>

      {error && <p className="text-red-500 bg-red-50 p-4 rounded">{error}</p>}

      {result && (
        <div className="border p-6 rounded-lg bg-gray-50 text-black shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold">{result.name}</h2>
            <span className="bg-yellow-200 px-2 py-1 rounded text-sm font-semibold">
              Zdroj: {result.source}
            </span>
          </div>
          
          <div className="space-y-2">
            <p><strong>IČO:</strong> {result.ico}</p>
            <p><strong>Adresa:</strong> {result.address}</p>
            {result.legal_form && <p><strong>Právní forma:</strong> {result.legal_form}</p>}
            {result.established_date && <p><strong>Datum vzniku:</strong> {result.established_date}</p>}
          </div>

          {nameMatchResult && (
            <div className={`mt-4 p-3 rounded text-sm font-medium ${
              nameMatchResult.startsWith('Shoda') ? 'bg-green-100 text-green-800' :
              nameMatchResult.startsWith('Částečná') ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {nameMatchResult}
            </div>
          )}
        </div>
      )}
    </main>
  );
}