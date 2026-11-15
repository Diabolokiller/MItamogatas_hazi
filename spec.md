# Házi feladat specifikáció: "Factory Forge"

## Cél, szerepkörök és forgatókönyvek
A projekt célja egy egy játékos "Assembly Line" stílusú, 2D rács-alapú gyárépítő és nyersanyag-menedzsment játék készítése, amely a követelményeknek megfelelően kliens-szerver architektúrát használ. Bár a játék egyszemélyes, a backend elengedhetetlen a felhőalapú mentés, a felhasználókezelés, valamint az időalapú offline haladás (profit) hitelesítésének biztosításához.

* **Szerepkörök:** Játékos (gyárépítő, aki menedzseli a termelést), Backend (felhasználókezelés, állapotmentés, offline profit hitelesítése).
* **Főbb forgatókönyvek:** 
    1. A játékos belép a fiókjába, és a rácson gépeket (Bányász, Futószalag, Készítő, Eladó) helyez el a termelési lánc kialakításához.
    2. A játékos a bevételeiből új, hatékonyabb gépeket vásárol, vagy a meglévőket fejleszti.
    3. A backend rendszeresen szinkronizálja a gyár állapotát. Kijelentkezés után a backend kiszámolja az offline eltelt időt, és a visszatéréskor szerveroldalon jóváírja az ezalatt termelt profitot.

## Lényeges bizonytalanságok és feloldásuk
* **Bizonytalanság:** A teljes gyárszimuláció folyamatos szerveroldali futtatása és hálózati szinkronizációja indokolatlanul nagy erőforrás-igényű lenne egy egyéni játék esetén.
* **Feloldás:** A játékszabályok (nyersanyagok fizikai mozgása, ütközések) a kliensen futnak. A backend csak a játéktér elrendezésének perzisztens tárolásáért, a játékos egyenlegéért és a hiteles "másodpercenkénti profit ráta" nyilvántartásáért felel.
* **Bizonytalanság:** Offline profit számításánál a kliens idejének manipulálása (csalás).
* **Feloldás:** Az offline profitot kizárólag a backend számolja a szerveridő és az utolsó mentett profit ráta alapján. Ez érdemi üzleti szabályt valósít meg, amely tesztelhető.

## Elfogadási feltételek

1. **Normál működés (Termelés):** Ha a játékos elhelyez egy 'Bányász' (Miner) gépet, amely egy futószalagon keresztül egy 'Eladó' (Seller) gépbe csatlakozik, a legenerált nyersanyag eléri az eladót, és a játékos egyenlege a nyersanyag értékével megnő.
2. **Normál működés (Kombinálás):** Ha egy 'Készítő' (Crafter) gép bemenetére megérkezik a kiválasztott recepthez szükséges összes alapanyag, a meghatározott gyártási idő elteltével a gép kiadja a készterméket a kimenetén.
3. **Normál működés (Perzisztencia):** Bejelentkezés után a rendszer sikeresen betölti a szerverről a játékos legutóbb elmentett gyárelrendezését (rács állapotát) és aktuális egyenlegét.
4. **Határeset (Torlódás):** Ha egy gép bemeneti tárolója megtelik, a hálózatban előtte lévő gépek automatikusan leállítják a termelést és a továbbítást, amíg nem szabadul fel újra hely, megelőzve az elemek elvesztését.
5. **Határeset (Offline profit limit):** Amikor a játékos újra bejelentkezik, a rendszer az eltelt szerveridő és a mentett termelési ráta alapján kiszámolja a bevételt, de az offline termelés maximális időtartamát 24 órában korlátozza (az efeletti inaktív időre nem ad profitot).
6. **Hibás bemenet kezelése (Fedezet hiánya):** Ha a játékos olyan elemet próbál letenni a rácsra, amelynek ára meghaladja a jelenlegi egyenlegét, a rendszer hibaüzenetet ad, a vizuális elhelyezés meghiúsul, és az egyenleg nem csökken.
7. **Hibás bemenet kezelése (Ütközés):** Ha a játékos egy már foglalt rács-mezőre próbál új elemet építeni (függetlenül attól, hogy gépről vagy szalagról van szó), az építési kísérlet sikertelen lesz, a kliens vizuálisan jelzi a hibát, és az egyenleg nem változik.
8. **Normál működés (Gép fejlesztése):** Ha a játékos kiválaszt egy már lerakott gépet és kifizeti annak fejlesztési költségét, az egyenlege a megfelelő összeggel csökken, a gép szintje megnő, és a termelési vagy feldolgozási sebessége a fejlesztéshez rendelt szorzóval megnövekszik.