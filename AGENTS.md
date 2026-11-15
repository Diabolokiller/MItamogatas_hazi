# AGENTS.md - MI Ágensek és Fejlesztési Irányelvek (Factory Forge)

Ez a dokumentum a **Factory Forge** projekt fejlesztésében résztvevő mesterséges intelligencia (MI) ágensek, autonóm eszközök és fejlesztők számára készült architektúra- és szabályrendszert tartalmazza.

---

## 1. Projekt Áttekintés és Architektúra

A **Factory Forge** egy 2D rács-alapú gyárépítő és nyersanyag-menedzsment játék ("Assembly Line" stílusban), kliens-szerver architektúrával:
- **Kliens (Frontend):** HTML5 Canvas + vanilla modern ES modulok (`public/js/`). 60 FPS tick-alapú renderelés, felhasználói interakciók, vizuális visszajelzések és gördülő profitráta számítás.
- **Szerver (Backend):** Node.js natív HTTP szerver (`server.js`), beépített SQLite (`node:sqlite`) perzisztens adatbázis (`src/db.js`), hitelesített REST API (`src/routes.js`).
- **Megosztott Szimulációs Mag (`src/simulation.js`):** Determinisztikus tick-alapú szimulációs logika, amely azonos szabályok szerint fut a kliensen és az automatizált backend tesztekben.

---

## 2. Ágens Szerepkörök és Kompetenciák

### 2.1 Architekt és Szabály Ágens (`Architect Agent`)
- **Felelősség:** A specifikációban (`spec.md`) rögzített üzleti és játékszabályok sértetlenségének biztosítása.
- **Szabályok:**
  - A játéktér mérete alapértelmezetten 12x12 (`GRID_WIDTH`, `GRID_HEIGHT`).
  - Az offline profit maximális időtartama szigorúan 24 óra (86400 másodperc). Ennek módosítása tilos!
  - A szimuláció nem használhat harmadik féltől származó, külső npm függőséget; kizárólag a Node 22+ beépített moduljaira (`node:sqlite`, `node:crypto`, `node:test`, `node:fs`, `node:http`) épül.

### 2.2 Szimulációs és Játékmenet Ágens (`Game Engine Agent`)
- **Felelősség:** A `simulation.js` és `renderer.js` modulok karbantartása.
- **Szabályok:**
  - **Determinizmus:** Egy `tick(dt)` hívás állapota kizárólag a megelőző állapottól és a rácson lévő gépek adataitól függhet.
  - **Torlódás (Backpressure):** Ha egy gép bemeneti tárolója (`inputBuffer`) megtelik vagy a futószalag célmezője foglalt, a nyersanyag mozgatása és a termelés megáll. Elem nem veszhet el és nem íródhat felül!
  - **Mozgási zászló:** Egy tick alatt egy elem legfeljebb 1 mezőt léphet előre (`movedThisTick` jelző használata teleportáció ellen).

### 2.3 Backend és Adatbázis Ágens (`Backend API Agent`)
- **Felelősség:** A REST API és a SQLite adatbázis kezelése.
- **Szabályok:**
  - Minden jelszót biztonságos sózással és PBKDF2 algoritmussal kell tárolni (`src/auth.js`).
  - Az offline profit kalkulációját (`calculateOfflineProfit`) mindig a szerveridő (`Date.now()`) alapján kell hitelesíteni. A kliens által beküldött időpont nem fogadható el!
  - A játékos egyenlegét és a gyárelrendezést atomi tranzakcióként kell menteni.

### 2.4 QA és Tesztelési Ágens (`Test & Verification Agent`)
- **Felelősség:** Automatizált tesztek futtatása és új tesztesetek készítése.
- **Szabályok:**
  - A tesztek a `node:test` és `node:assert/strict` csomaggal futnak (`npm test`).
  - Minden elfogadási feltételhez kötelező legalább egy dedikált tesztállományt fenntartani a `tests/` könyvtárban.
  - Új funkció hozzáadásakor regressziós tesztet kell írni.

---

## 3. Kódolási és Stílus Konvenciók

1. **Nyelv és Modulrendszer:** Modern ECMAScript 2024+, natív ES Modulok (`import` / `export`, `"type": "module"`).
2. **Függőségmentesség:** A backend nem tartalmazhat `node_modules` külső csomagot. Minden feladatot a Node.js standard lib eszközeivel kell megoldani.
3. **Hibakezelés:**
   - Validációs hibáknál strukturált válasz: `{ success: false, error: string, code: string }`.
   - Védett végpontok hiányzó token esetén `401 Unauthorized` választ adnak.
4. **Felhasználói felület:**
   - Minden felhasználói művelethez vizuális vagy szöveges (Toast) visszajelzés tartozik (pl. fedezethiány, ütközés, sikeres mentés).

---

## 4. MI Prompt Sablonok a Kódbázis Bővítéséhez

Ha új funkciót vagy receptet adsz a rendszerhez, használd a következő prompt sablont:

```markdown
Adott a Factory Forge projekt, amely a spec.md és AGENTS.md szerint működik.
Szeretnék egy új géptípust / receptet implementálni: [LEÍRÁS].
Kérlek:
1. Módosítsd a `src/config.js` fájlt a definíciókkal és árakkal.
2. Vezesd át a szimuláció logikáját a `src/simulation.js`-ben.
3. Készíts automatizált tesztet a `tests/` mappába a `node:test` használatával.
4. Biztosítsd, hogy a torlódási szabályok (backpressure) és az egyenleg-ellenőrzések ne sérüljenek.
```
