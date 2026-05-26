# FirmaCheck

A mini web application for quickly verifying Czech companies by their IČO (Identification Number) via the ARES API, featuring map visualization, SQLite caching, and data save/export capabilities.

* **Live Demo (Vercel):** [https://firmacheck-seven.vercel.app/](https://firmacheck-seven.vercel.app/)
* **GitHub Repository:** [https://github.com/biarkvia/firmacheck/](https://github.com/biarkvia/firmacheck/)

---

## Tech Stack & Architecture

* **Frontend & Backend:** Next.js (App Router), React, Tailwind CSS
* **Database (Cache & Saved Companies):** Turso (Cloud SQLite / libSQL)
* **Third-Party APIs:** ARES API (company data), OpenStreetMap / Nominatim API (geocoding)
* **Hosting:** Vercel

### Why Turso (Cloud SQLite)?
The assignment required an SQLite cache. Since Vercel runs in a serverless environment with an ephemeral filesystem, a traditional local SQLite database would be wiped between requests. I chose **Turso** — a cloud implementation of SQLite (libSQL). It perfectly satisfies the SQLite architecture requirement while running reliably on Vercel.

For saving companies, I use the same table as the cache by simply toggling an `is_saved` boolean flag. This keeps the database architecture clean and straightforward.

### Why OpenStreetMap for Geocoding?
To speed up development and avoid the overhead of registering and managing API keys (which is required for Mapy.cz), I used the free Nominatim API (OpenStreetMap) to convert addresses into coordinates. The map itself is rendered via a simple iframe. However, for user convenience, I included a direct link to open the exact location on Mapy.cz.

---

## AI Tools Usage

This application was built with AI assistance to speed up routine tasks, design, and asset generation.
* **Tool Used:** Chat GPT 5.5 Thinking Extended

### AI-Generated Visual Element
A hero illustration is placed on the main page.
* **Prompt:** *"Minimalist 3D flat illustration of a magnifying glass over a modern office building, representing corporate verification, clean white background, UI web design style"*
* **Reasoning:** It visually lightens the UI and clearly communicates the tool's core purpose (company verification).

### 3 Examples of Prompts Used During Development:
1. *"Write a Next.js (App Router) API route to fetch data from the ARES API (gov.cz) by IČO. If the IČO is found in the Turso (libSQL) database, return it from there. If not, fetch it from ARES and save it to the database before returning."*
2. *"Write a frontend React function that takes an array of objects (saved companies) and generates a properly formatted CSV file for download. Include a UTF-8 BOM so Czech diacritics are not corrupted in Excel."*
3. *"What is the fastest way to convert a Czech address to lat/lng coordinates and display it in a Next.js app without API keys? Suggest a solution using OpenStreetMap."*

---

## Development Iterations

1. **Iteration 1 (Core & ARES):** Set up the Next.js skeleton and connected the ARES API without a database. Tested the actual data structure returned by ARES and handled error states (e.g., invalid/non-existent IČO).
2. **Iteration 2 (Persistence & Geocoding):** Integrated the Turso database and implemented the caching logic. Added the Nominatim API for geocoding and rendered the iframe map. Finally, built the frontend logic for bookmarking companies and exporting data to CSV.

---

## Time Spent & Future Improvements

* **Estimated time spent:** ~1 hour.

**What I would improve with more time:**
* Implement robust rate-limiting for the ARES and Nominatim APIs.
* Add full-text search within the saved companies list (e.g., using a debounce hook).
* Introduce pagination for the saved companies table if the list grows to hundreds of records.

---

## Local Setup

1. Clone the repository: `git clone https://github.com/biarkvia/firmacheck.git`
2. Install dependencies: `npm install`
3. Create a `.env.local` file with your Turso database credentials:
```env
   TURSO_DATABASE_URL=...
   TURSO_AUTH_TOKEN=...
```
4. Start the development server: `npm run dev`