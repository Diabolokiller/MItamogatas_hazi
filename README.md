# Factory Forge - Házi Feladat Dokumentáció

**Tárgy:** Szoftverfejlesztés MI támogatással  
**Készítette:** Bálint  
**Projekt:** Factory Forge (2D rács-alapú gyárépítő és nyersanyag-menedzsment játék)  
**Specifikáció:** [spec.md](file:///C:/Users/balint/Suli/5/vibe/spec.md)  
**Követelmények:** [Hazi_feladat_kovetelmenyek.pdf](file:///C:/Users/balint/Suli/5/vibe/Hazi_feladat_kovetelmenyek.pdf)  

---

## 1. A Projekt Bemutatása és Architektúrája

A **Factory Forge** egy "Assembly Line" stílusú, 2D rács-alapú gyárépítő és automatizálási játék kliens-szerver architektúrával. A játékos gépeket (Bányász, Futószalag, Készítő, Eladó) helyez el a játéktéren, nyersanyagokat dolgoz fel, és a bevételéből fejleszti a gyárat.

### Architektúra
- **Frontend (Kliens):** Modern HTML5 Canvas és moduláris Vanilla JavaScript (`public/js/`). 60 FPS determinisztikus szimuláció, sima animációk (futószalag chevrons, fúrófejek, forgó fogaskerekek, lebegő eladási részecskék), és ergonomikus ipari témájú felület.
- **Backend (Szerver):** Node.js 22+ beépített natív modulokra (`node:http`, `node:sqlite`, `node:crypto`) épülő REST API szerver (`server.js`, `src/routes.js`).
- **Adatbázis (Perzisztencia):** Beépített SQLite (`data/factory.db`), amely tárolja a felhasználók fiókjait, sózott jelszavait, egyenlegét, a gyárrács állapotát és a szerveroldali időbélyegeket.
- **Megosztott szimulációs mag:** `src/simulation.js`, amely mind a kliensen, mind az automatizált backend tesztekben azonos szabályokat biztosít.
- **Külső függőségmentesség:** A projekt **0 külső npm csomagot** igényel, így azonnal, hálózati letöltés nélkül, másodpercek alatt elindítható és tesztelhető bármilyen Node.js 22+ környezetben!

---

## 2. Indítási és Használati Útmutató

### Rendszerkövetelmények
- **Node.js:** v22.0.0 vagy újabb (a projekt a beépített `node:sqlite` és `node:test` modulokat használja).

### Alkalmazás indítása

1. **Szerver indítása:**
   ```bash
   npm start
   # vagy közvetlenül:
   node server.js
   ```
2. Nyisd meg a böngészőt: **[http://localhost:3000](http://localhost:3000)**

### Játékmenet és Kezelőszervek

| Funkció | Billentyű | Leírás |
| :--- | :---: | :--- |
| **Kijelölés (Inspect)** | `1` | Rákattintva egy gépre megnyitja az oldalsó panelt a szinttel, belső tárolóval és fejlesztéssel. |
| **Bányász (Miner)** | `2` | Nyersanyagot (Vasérc vagy Rézérc) bányászik periodikusan ($100). |
| **Futószalag (Conveyor)** | `3` | Nyersanyagokat szállít a nyíl irányába ($10). |
| **Készítő (Crafter)** | `4` | Összetett recepteket gyárt (pl. 2 Vasérc ➔ 1 Fogaskerék) ($250). |
| **Eladó (Seller)** | `5` | Beérkező elemeket automatikusan eladja és jóváírja az egyenlegen ($150). |
| **Lebontás (Demolish)** | `6` | Gép lebontása az eredeti ár 70%-ának visszatérítésével. |
| **Forgatás** | `R` vagy jobbklikk | Az építés irányának forgatása (Fel, Jobbra, Le, Balra). |
| **Mentés** | `S` | Azonnali felhőalapú mentés a szerverre (a játék 15 másodpercenként automatikusan is ment). |
| **Kijelölés törlése** | `Esc` | Bezárja a gépvizsgálót. |

---

## 3. Elfogadási Feltételek és Tesztmátrix

Az alábbi táblázat tartalmazza a `spec.md`-ben rögzített 8 elfogadási feltétel és az automatizált tesztek megfeleltetését:

| # | Típus | Elfogadási Feltétel | Ellenőrzés Módja | Automatizált Teszt Fájl | Állapot |
|---|---|---|---|---|:---:|
| **1.** | Normál | **Termelés:** Miner ➔ Conveyor ➔ Seller láncon a legenerált érc eléri az eladót és növeli az egyenleget. | Automatizált teszt | [normal-production.test.js](file:///C:/Users/balint/Suli/5/vibe/tests/normal-production.test.js) | ✅ PASS |
| **2.** | Normál | **Kombinálás:** Crafter bemenetére érkező alapanyagokból a gyártási idő után elkészül a késztermék. | Automatizált teszt | [normal-production.test.js](file:///C:/Users/balint/Suli/5/vibe/tests/normal-production.test.js) | ✅ PASS |
| **3.** | Normál | **Perzisztencia:** Bejelentkezés után a rendszer betölti a szerverről a rács elrendezését és az egyenleget. | Automatizált teszt | [persistence.test.js](file:///C:/Users/balint/Suli/5/vibe/tests/persistence.test.js) | ✅ PASS |
| **4.** | Határeset | **Torlódás (Backpressure):** Ha a gép/szalag megtelik, az előtte lévő gépek leállítják a termelést, nincs elemvesztés. | Automatizált teszt | [backpressure.test.js](file:///C:/Users/balint/Suli/5/vibe/tests/backpressure.test.js) | ✅ PASS |
| **5.** | Határeset | **Offline profit limit:** A szerver az offline időt számolja, de a jóváírást szigorúan legfeljebb 24 órában (86400s) korlátozza. | Automatizált teszt | [offline-profit.test.js](file:///C:/Users/balint/Suli/5/vibe/tests/offline-profit.test.js) | ✅ PASS |
| **6.** | Hibás bemenet | **Fedezet hiánya:** Ha az ár meghaladja az egyenleget, hibaüzenetet ad, az építés meghiúsul, az egyenleg nem csökken. | Automatizált teszt | [invalid-inputs.test.js](file:///C:/Users/balint/Suli/5/vibe/tests/invalid-inputs.test.js) | ✅ PASS |
| **7.** | Hibás bemenet | **Ütközés:** Foglalt mezőre építés meghiúsul, vizuális hibaüzenet jelenik meg, az egyenleg változatlan marad. | Automatizált teszt | [invalid-inputs.test.js](file:///C:/Users/balint/Suli/5/vibe/tests/invalid-inputs.test.js) | ✅ PASS |
| **8.** | Normál | **Gép fejlesztése:** Meglévő gép fejlesztése levonja a költséget, a szint nő, a termelési sebesség megnövekszik. | Automatizált teszt | [upgrade.test.js](file:///C:/Users/balint/Suli/5/vibe/tests/upgrade.test.js) | ✅ PASS |
| **+** | Jogosulatlan művelet | Érvénytelen/hiányzó token esetén az API 401 Unauthorized státusszal tiltja a műveletet. | Automatizált teszt | [invalid-inputs.test.js](file:///C:/Users/balint/Suli/5/vibe/tests/invalid-inputs.test.js) | ✅ PASS |
| **+** | Regresszió | Torlódott gép fejlesztésekor az elem megőrződik és a feloldás után már a megnövelt sebességgel folytatja a termelést. | Automatizált teszt | [regression.test.js](file:///C:/Users/balint/Suli/5/vibe/tests/regression.test.js) | ✅ PASS |
| **+** | Hibafeltárás | Hibás (korlátlan) offline kalkuláció vs. Javított (24h capped) kalkuláció futtatási összehasonlítása. | Automatizált teszt | [faulty-demo.test.js](file:///C:/Users/balint/Suli/5/vibe/tests/faulty-demo.test.js) | ✅ PASS |

### Tesztek futtatása

```bash
# Az összes automatizált teszt futtatása:
npm test

# Kizárólag a hibás vs. javított összehasonlítás futtatása:
npm run test:faulty
```

**Futási összesítő:**
```
ℹ tests 18
ℹ suites 11
ℹ pass 18
ℹ fail 0
ℹ duration_ms 219.7ms
```

---

## 4. Hibafeltárás és Tesztelés Bemutatása (Faulty vs. Fixed Demonstration)

A követelményeknek megfelelően elkészítettük a hibás és javított változat összehasonlítását (`tests/faulty-demo.test.js`).

### A Hiba Leírása
A naiv offline profit kalkulációban (`faultyCalculateOfflineProfit`) a következő kritikus sebezhetőségek és hibák voltak jelen:
1. **Felső korlát hiánya:** Nem érvényesítette a specifikáció 5. pontjában előírt 24 órás limitet. Így egy játékos, aki 30 óra (108 000 másodperc) után lépett be, jogosulatlanul a teljes 30 órára kapott jóváírást (691 200 $ helyett 864 000 $-t).
2. **Időmanipulációs sebezhetőség:** Nem kezelte az óra-visszaállítást vagy a negatív időkülönbséget, ami hibás számításokhoz vezetett.
3. **Lebegőpontos kerekítési hiba:** Nem végzett egész értékre kerekítést (`Math.floor`), így tört centek keletkeztek.

### A Javított Megoldás (`src/simulation.js`)
A javított függvényben (`calculateOfflineProfit`):
- `Math.max(0, ...)` védi ki a negatív időeltéréseket.
- `Math.min(rawElapsedSeconds, MAX_OFFLINE_SECONDS)` szigorúan rögzíti a 24 órás (86400s) plafont.
- `capped: true` jelző tájékoztatja a felhasználót az értesítő ablakban.
- `Math.floor(...)` biztosítja a pontos pénzügyi egész értékeket.

### Futtatási Eredmény (`npm run test:faulty`)
```text
--- HIBÁS VÁLTOZAT FUTÁSI EREDMÉNYE ---
Eltelt idő: 108000s (Elvárt max: 86400s)
Számolt profit: $864000 (Elvárt max: $691200)
Capped jelző: false (Elvárt: true)
✔ A hibás változat a várakozásnak megfelelően elbukott: "HIBA: A hibás kód 108000 másodpercet számolt 86400 helyett!

108000 !== 86400
"

--- JAVÍTOTT VÁLTOZAT FUTÁSI EREDMÉNYE ---
Eltelt idő: 86400s (Elvárt max: 86400s)
Számolt profit: $691200 (Elvárt: $691200)
Capped jelző: true (Elvárt: true)
✔ A javított változat sikeresen teljesítette az összes elfogadási feltételt!
▶ Hibás vs. Javított változat összehasonlítása (Faulty vs Fixed Demonstration)
  ✔ 1. A HIBÁS változat ELBUKIK a 24 órás felső korlát (86400s) tesztjén (2.6ms)
  ✔ 2. A JAVÍTOTT változat SIKERESEN ÁTMEGY a teszten a 24 órás limittel (0.7ms)
```

---

## 5. Az MI Használatának Dokumentálása

A házi feladat kidolgozása során a **Google Antigravity (Gemini 3.8 Flash)** mesterséges intelligencia ágens került alkalmazásra a szoftverfejlesztési életciklus mindhárom kötelező fázisában.

### MI Használat a Fejlesztési Fázisokban:
1. **Követelményelemzés & Tervezés:** A specifikációban szereplő 8 elfogadási feltételhez tartozó sarokpontok pontosítása, kliens-szerver feladatmegosztás modellezése, torlódási szabályok megfogalmazása.
2. **Implementáció:** A determinisztikus szimulációs motor (`src/simulation.js`), a beépített SQLite adatbázis réteg (`src/db.js`), és az interaktív Canvas renderer (`public/js/renderer.js`) megvalósítása.
3. **Tesztelés & Minőségbiztosítás:** Automatizált tesztcsomag megírása a Node.js natív `node:test` futtatójához, határesetek lefedése, regressziós teszt és hibás vs. javított demonstrációs teszt megalkotása.

---

### Három Érdemi Döntési Eset Dokumentálása

#### 1. Döntési Eset: Kliens-szerver szimuláció elosztása és offline profit hitelesítése
- **Probléma:** Egy egyjátékos gyárépítő játék esetén a teljes fizikai rácsszimuláció (nyersanyagok folyamatos léptetése, ütközésvizsgálat) szerveroldali futtatása és hálózati streamelése indokolatlanul magas szerver-erőforrást és késleltetést igényelne. Ugyanakkor az állapotmentésnek és az offline profitnak biztonságosnak kell lennie a csalásokkal szemben.
- **Eszköz:** Google Antigravity (Gemini 3.8 Flash)
- **Átadott kontextus és utasítás:** `spec.md` bizonytalanságok fejezete; hogyan alakítsunk ki olyan architektúrát, amely nem igényel folyamatos szerver tickelést, de garantálja az offline haladás hitelességét?
- **Kapott javaslat:** Hibrid architektúra: a kliens futtatja a 60 FPS fizikai tickeket és a gördülő átlagú profitráta-számítást (`profitRate = sales_sum / 10s`). Mentéskor a rács állapotát, az egyenleget és a rátát a szerver rögzíti, és a szerver a saját `Date.now()` órája alapján számolja ki az offline profitot belépéskor, maximum 24 órás korláttal.
- **Saját döntés és indoklás:** A javaslat elfogadásra került, azzal a kiegészítéssel, hogy a szimulációs mag (`src/simulation.js`) megosztott modullá vált. Ez lehetővé tette, hogy a backend oldali automatizált tesztek közvetlenül, headless módban ugyanazt a kódot teszteljék, amit a böngésző futtat.
- **Ellenőrzést bizonyító kód/teszt:** [tests/offline-profit.test.js](file:///C:/Users/balint/Suli/5/vibe/tests/offline-profit.test.js), [tests/normal-production.test.js](file:///C:/Users/balint/Suli/5/vibe/tests/normal-production.test.js).

#### 2. Döntési Eset: Torlódás (Backpressure) kezelése és teleportáció megakadályozása a futószalagokon
- **Probléma:** Ha egy feldolgozó gép (Crafter) bemeneti tárolója megtelik, vagy a szalag végén nincs felvevő gép, az érkező nyersanyagok nem veszhetnek el és nem írhatják felül egymást. Továbbá egyetlen szimulációs tick alatt egy elem nem "teleportálhat" át több egymást követő szalagelemen.
- **Eszköz:** Google Antigravity (Gemini 3.8 Flash)
- **Átadott kontextus és utasítás:** Determinisztikus torlódás-kezelő algoritmus tervezése 1 kapacitású szalagcellákhoz és véges gépi pufferekhez.
- **Kapott javaslat:** Kétlépcsős tick stratégia `movedThisTick` flag bevezetésével: minden tick elején a jelzők törlődnek. A gépek és szalagok ellenőrzik a célcella `canAcceptItem()` függvényét. Ha a célcella nem tudja fogadni az elemet, az elem a helyén marad (szalag esetén `progress = 1.0`, bányásznál `outputSlot`). Ha fogadni tudja, átkerül, és `movedThisTick = true` értéket kap, megelőzve az azonos tick alatti többszörös mozgást.
- **Saját döntés és indoklás:** Elfogadva. A crafter gépeknél 4 db/receptösszetevő maximális kapacitást vezettünk be (`CRAFTER_BUFFER_LIMIT = 4`), így ha a crafter nem tud dolgozni (mert a kimenete blokkolt), a bemeneti tárolója megtelik, és a bejövő szalag szabályosan megáll.
- **Ellenőrzést bizonyító kód/teszt:** [tests/backpressure.test.js](file:///C:/Users/balint/Suli/5/vibe/tests/backpressure.test.js).

#### 3. Döntési Eset: Külső függőségek eliminálása és beépített Node 22+ technológiák választása
- **Probléma:** Hagyományos Express + better-sqlite3 + Jest környezetben a natív C++ modulok (pl. SQLite fordítás Windows-on) és a több száz megabájtos `node_modules` gyakran okoznak környezeti hibát (EPERM, hiányzó C++ build toolok, hálózati timeout).
- **Eszköz:** Google Antigravity (Gemini 3.8 Flash)
- **Átadott kontextus és utasítás:** Hogyan tehető a házi feladat 100%-ban hordozhatóvá és reprodukálhatóvá bármely értékelő gépén?
- **Kapott javaslat:** Használjuk a Node.js 22-ben bevezetett natív képességeket: `node:sqlite` (`DatabaseSync`), a beépített tesztfuttatót (`node:test` és `node:assert`), a beépített `node:crypto`-t (PBKDF2 sózott hashelés) és a natív `node:http`-t.
- **Saját döntés és indoklás:** Elfogadva! Ennek köszönhetően a projektnek **0 külső npm függősége van**. Bárki, aki letölti a repót, egyetlen `node server.js` vagy `npm test` paranccsal azonnal, telepítési kockázat nélkül futtathatja a rendszert.
- **Ellenőrzést bizonyító kód/teszt:** [src/db.js](file:///C:/Users/balint/Suli/5/vibe/src/db.js), [package.json](file:///C:/Users/balint/Suli/5/vibe/package.json), valamennyi tesztállomány.

---

### Munkamódszerek Összehasonlítása és az MI Módszer Korlátai

#### Kézi kódolás vs. MI-vel támogatott fejlesztés:
| Szempont | Hagyományos kézi kódolás | MI-vel támogatott fejlesztés (Antigravity) |
| :--- | :--- | :--- |
| **Fejlesztési sebesség** | Boilerplate írás, API mockok és HTML struktúra készítése órákat vesz igénybe. | Perceken belül működő, típus- és konvencióhelyes prototípus áll elő. |
| **Hibakeresés** | Saját vakfoltok és rejtett aszinkron/állapotkezelési hibák nehezebben ismerhetők fel. | Az MI azonnal rámutat a logikai buktatókra (pl. időmanipuláció, torlódás). |
| **Architektúra tudatosság** | Hajlamos a gyors, ad-hoc hackelésre. | Az MI a megadott szabályok (`AGENTS.md`) mentén szigorúan követi a tiszta architektúrát. |
| **Emberi ellenőrzés szükségessége** | A fejlesztő fejében él az egész kód, de a tesztelés fárasztó. | **Elengedhetetlen:** Az MI hallucinálhat nem létező API-kat vagy felülbírálhat szabályokat, ha a kontextus nincs szigorúan definiálva. |

#### A módszer korlátai:
- **Kontextus-függőség:** Ha a specifikáció és a szabályok nincsenek pontosan rögzítve (pl. határesetek leírása), az MI hajlamos a legegyszerűbb, nem robusztus utat választani (pl. a határesetek és a torlódás kihagyása).
- **Validáció kötelezettsége:** Az MI által generált kódot és teszteket mindig futtatással és szigorú határérték-ellenőrzéssel (`assert`) kell igazolni; az MI önbevallása a helyességről nem elegendő bizonyíték.

---

## 6. AI Fejlesztést Támogató Elemek a Kódbázisban

A projektben kialakítottuk az automatizált és irányított MI fejlesztést segítő környezetet:
- **[AGENTS.md](file:///C:/Users/balint/Suli/5/vibe/AGENTS.md):** Részletes ágens szerepkörök (Architect, Game Engine, Backend API, QA Specialist), szigorú kódolási és biztonsági szabályok, valamint szabványos prompt sablonok a feladatok delegálásához.
- **[.cursorrules](file:///C:/Users/balint/Suli/5/vibe/.cursorrules):** Kifejezetten a modern IDE és MI asszisztensek (Cursor, Copilot, Antigravity) számára optimalizált szabályrendszer, amely tiltja a külső npm csomagok behúzását és előírja a determinisztikus szimulációs szabályokat.
- **Determinisztikus teszt-szkriptek:** Az `npm test` és `npm run test:faulty` parancsok, amelyek lehetővé teszik bármely autonóm ágens számára az azonnali regresszió-ellenőrzést.
