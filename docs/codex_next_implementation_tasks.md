# Codex Next Implementation Tasks: Hardening Creator-Grade Atlas Pipeline

## Kontekst

Branch `feat/creator-grade-atlas-pipeline` wdrożył dużą część poprzedniego planu:

- input manifest,
- creator answers,
- research pack,
- GPX analyzer,
- approvals,
- guide v2,
- media v1,
- demo golden route,
- nowe komendy CLI.

To dobry krok, ale część funkcji nadal działa jako MVP/mock/placeholder. Ten sprint ma doprowadzić pipeline do uczciwego, deterministycznego i trudnego do „oszukania” stanu.

Najważniejsza zasada: **nie maskować braków danych ładnym tekstem**. Jeśli brakuje danych, pipeline ma zapisać `missing_inputs.json` i zatrzymać publikowalny output.

---

## Etap A: Merge discipline i czystość repo

### Problem

Branch zawiera wygenerowane foldery testowe w `routes/`:

- `routes/etap-1-test-project/`
- `routes/etap-6-test/`
- `routes/the-golden-alps/`

To wygląda jak output runtime, nie kod źródłowy. Nie powinno trafić do repo jako stałe dane, poza świadomymi fixtures.

### Zadania

1. Usuń z repo wygenerowane foldery `routes/etap-*` i `routes/the-golden-alps`.
2. Dodaj do `.gitignore`, jeśli jeszcze nie ma:

```gitignore
routes/*
!routes/.gitkeep
```

3. Dodaj `routes/.gitkeep`, jeśli potrzebny pusty folder.
4. Test/demo dane trzymaj tylko w `fixtures/`.

### Definition of Done

- `git status` nie pokazuje runtime output w `routes/`.
- Golden route fixture zostaje w `fixtures/golden-route/`.
- Demo script generuje output lokalnie, ale nie wymaga commitowania `routes/`.

---

## Etap B: Build/check/test jako bramka obowiązkowa

### Problem

Nie wiadomo, czy branch po dużych zmianach przechodzi pełny TypeScript check i testy. Kolejne zmiany muszą zacząć się od stabilizacji.

### Zadania

Uruchom:

```bash
npm install
npm run check
npm test
npm run atlas -- --help
```

Napraw wszystkie błędy przed dalszą implementacją.

### Definition of Done

- `npm run check` przechodzi.
- `npm test` przechodzi.
- `npm run atlas -- --help` pokazuje wszystkie nowe komendy.

---

## Etap C: Guide Writer v2 nie może maskować braków

### Problem

`packages/atlas-writer/src/guide-v2.ts` obecnie:

- używa fallbacków typu `Unknown`, `Moderate`, `May - October`, `Mixed`, `Low`,
- zamienia zakazane frazy regexem na inne słowa,
- generuje finalny guide nawet przy braku kluczowych danych.

To jest niebezpieczne, bo może stworzyć pozornie gotowy przewodnik bez realnej walidacji.

### Zadania

1. Usuń mechanizm regexowego podmieniania zakazanych fraz.
2. Dodaj funkcję `validateGuideInputs(project)`.
3. Jeśli brakuje danych krytycznych, zapisz `missing_inputs.json` i nie twórz finalnego `guide.md`.
4. `guide_outline.md` może zawierać braki, ale finalny `guide.md` nie.
5. Braki w finalnym guide mają blokować `quality-gates`.

### Minimalne wymagane dane do finalnego guide

Finalny `guide.md` wymaga:

- `route_summary.json`,
- `route_summary.distanceKm > 0`,
- `route_summary.validationStatus !== "needs_validation"`,
- `claims.json` z minimum 3 claimami, z czego minimum 2 mają status `verified` lub `likely`,
- `research_pack.json` z minimum 1 materiałem creator/source/deep_research,
- `guide_outline_approval` approved,
- jeśli trasa ma GPX: `route_summary.startPoint` i `route_summary.endPoint`.

### `missing_inputs.json`

Format:

```json
{
  "projectId": "string",
  "generatedAt": "ISO string",
  "blocking": true,
  "missing": [
    {
      "code": "missing_route_summary",
      "message": "route_summary.json is missing.",
      "requiredFor": "guide_final"
    }
  ]
}
```

### Definition of Done

- Guide v2 nie tworzy finalnego guide, jeśli brakuje danych.
- Nie ma regexowego „upiększania” zakazanych fraz.
- Test potwierdza, że przy braku route summary powstaje `missing_inputs.json` i nie powstaje finalny `guide.md`.

---

## Etap D: Claim Engine v2.1 — zero meta-claimów

### Problem

`generateClaims` poprawił techniczne claimy z GPX, ale nadal generuje meta-claim:

`Creator note: X provides authoritative details about the route.`

To nadal nie jest fakt o trasie.

### Zadania

1. Usuń wszystkie meta-claimy o źródłach i materiałach.
2. Dla creator notes dodaj prosty extractor heurystyczny, który wyciąga zdania z notatek i klasyfikuje je jako claimy.
3. Jeśli extractor nie znajduje sensownych claimów, zapisz `missing_inputs.json` z `insufficient_claims`, zamiast tworzyć fałszywy claim.

### Minimalny heurystyczny extractor

Dla materiałów `trustLevel === "creator"`:

- podziel content na zdania,
- ignoruj zdania krótsze niż 40 znaków,
- ignoruj zdania bez słów trasowych/logistycznych,
- klasyfikuj typ po słowach kluczowych:
  - water, fuel, food, parking, ferry, border, hotel, campsite → `logistics`,
  - danger, risk, avalanche, flood, closed, police, theft, exposed → `safety`,
  - asphalt, gravel, offroad, paved, mud, sand → `surface`,
  - season, snow, winter, summer, rain, heat → `season`,
  - permit, legal, allowed, forbidden, access → `access`,
  - km, kilometers, distance, elevation, climb → `distance` or `difficulty`.

Status dla creator note claimów:

```txt
status: needs_creator_review
confidence: 0.75
needsHumanReview: true
```

Po approval claims mogą zostać oznaczone jako `verified`.

### Definition of Done

- Nie istnieją claimy o tym, że źródło „dostarcza szczegółów”.
- Claimy są realnymi twierdzeniami o trasie.
- Test pokazuje ekstrakcję claimów z przykładowej notatki.

---

## Etap E: Approval decision must update claim statuses

### Problem

Approval flow zapisuje decyzje, ale nie aktualizuje statusów artefaktów. Jeśli user zatwierdzi `claims_approval`, claimy powinny dostać status `verified` albo przynajmniej `likely`, zależnie od źródła.

### Zadania

1. W `submitReviewDecision` albo osobnym handlerze dodaj skutki uboczne approvali:

- `claims_approval` approved:
  - claimy z `needs_creator_review` → `verified`, jeśli źródłem jest creator materiał,
  - claimy z `uncertain` → `likely`, jeśli mają minimum 2 sources,
  - reszta bez zmian.

- `gpx_summary_approval` approved:
  - `route_summary.validationStatus` → `validated`.

- `poi_approval` approved:
  - POI candidates dostają `approvalStatus: approved`, jeśli mają koordynaty.

- `guide_final_approval` approved:
  - zapisz approval required by publish.

2. Dodaj eventy do `events.json`.

### Definition of Done

- Po zatwierdzeniu GPX, route summary ma `validationStatus: validated`.
- Po zatwierdzeniu claims, claimy nie zostają wiecznie `needs_creator_review`.
- Testy pokrywają co najmniej GPX approval i claims approval.

---

## Etap F: GPX Analyzer v1.1 — pełniejsze i bezpieczniejsze dane

### Problem

Obecny GPX analyzer:

- używa regex XML parsera,
- nie zapisuje `route_segments.geojson`,
- nie zapisuje `route_warnings.json`,
- szacuje czas jako `distance / 15`, co jest dziwne dla motocykla,
- ustawia sezon i surface na sztywno,
- nie liczy bbox,
- nie czyta waypointów.

### Zadania

1. Zostaw prosty parser, ale popraw odporność:
   - obsłuż single quotes w atrybutach,
   - obsłuż namespace prefix, jeśli łatwe,
   - ignoruj błędne punkty NaN.

2. Dodaj output:

```txt
route_segments.geojson
route_warnings.json
```

3. `route_segments.geojson`:
   - minimum jeden LineString z całym trackiem,
   - properties: distanceKm, elevationGainM, pointCount.

4. `route_warnings.json`:

```json
{
  "projectId": "string",
  "generatedAt": "ISO string",
  "warnings": [
    {
      "code": "missing_elevation",
      "severity": "low | medium | high",
      "message": "GPX contains no elevation data."
    }
  ]
}
```

5. `estimatedTimeH`:
   - jeśli GPX ma timestamps, użyj czasu z tracka,
   - jeśli nie, użyj category-based fallback:
     - motorcycle: distance / 45,
     - bike: distance / 15,
     - hiking/trekking: distance / 4 plus elevationGainM / 600,
     - running: distance / 8,
     - default: distance / 10.

6. `season` i `surfaceType`:
   - jeśli nie wynikają z danych, ustaw `undefined`, nie zmyślaj `May-October` ani `mixed`.

### Definition of Done

- Analyzer tworzy `route_summary.json`, `elevation_profile.json`, `route_segments.geojson`, `route_warnings.json`.
- Nie zmyśla sezonu i surface.
- Testy dla motocykla i hiking mają różne estimated time.

---

## Etap G: POI Extractor v2.1 — input/gpx i deep_research structure

### Problem

`extractPois` szuka waypointów tylko w `route.gpx`, a GPX może być dodany przez input manager do `input/gpx/...`. Dodatkowo deep research report ma strukturę `runs[].candidatePois`, a obecny extractor szuka `deep.pois`, więc może nic nie znaleźć.

### Zadania

1. POI extractor ma szukać GPX w tej samej kolejności co GPX analyzer:
   - `route.gpx`,
   - pierwszy plik GPX z `input_manifest.json`.

2. Obsłuż `deep_research.json`:
   - `runs[].candidatePois`,
   - `runs[].candidateClaims` jeśli przydatne.

3. Nie filtruj POI `lat=0/lng=0` tylko przez `p.lat !== 0 && p.lng !== 0`, bo `undefined` może przejść dziwnie.
   Użyj warunku:

```ts
typeof p.lat === "number" && Number.isFinite(p.lat) && typeof p.lng === "number" && Number.isFinite(p.lng) && !(p.lat === 0 && p.lng === 0)
```

4. Dodaj `approvalStatus` do POI candidates.

5. POI bez koordynatów zapisuj w `poi_candidates.json`, ale nie w `poi.geojson`.

### Definition of Done

- Waypoint z GPX w `input/gpx/` trafia do POI candidates.
- Deep research candidate POIs trafiają do candidates.
- Brak współrzędnych nie daje 0,0.
- Test pokrywa GPX input manifest.

---

## Etap H: Research Pack Builder v1.1 — mniej udawania, więcej normalizacji

### Problem

Research pack istnieje, ale musi stać się głównym, wiarygodnym wejściem dla guide/claims.

### Zadania

1. Dodaj `contentHash` dla materiałów, żeby wykrywać duplikaty.
2. Dodaj `excerpt` i `contentLength`.
3. Dodaj statusy:

```txt
usable
weak
duplicate
unsupported
needs_review
```

4. Dla `.pdf`, `.docx`, `.heic` bez parsera ustaw `unsupported`, nie próbuj udawać że materiał jest przetworzony.
5. Dla notatek creator ustaw `trustLevel: creator`.
6. Dla linków ustaw `trustLevel: unknown`, dopóki nie są pobrane/przetworzone.

### Definition of Done

- Research pack ma contentHash.
- Duplikaty notatek/linków są oznaczone jako duplicate.
- Unsupported format nie psuje pipeline, ale pokazuje się w missing/needs review.

---

## Etap I: Quality Gates v2 — zablokować pozorną jakość

### Problem

Obecne quality gates wykrywają część placeholderów, ale po Guide v2 można nadal przepchnąć przewodnik z `Unknown`, `Standard outdoor safety rules apply`, fallbackami itd.

### Zadania

1. Dodaj blokady dla finalnego `guide.md`, jeśli zawiera:

```txt
Unknown
TBD
TODO
Standard outdoor safety rules apply
Plan ahead for water stops
Check local access rules before departure
This route offers a unique combination of scenery and challenge
Based on collected research
```

2. Quality gate ma blokować, jeśli istnieje `missing_inputs.json` z `blocking: true`.
3. Quality gate ma wymagać approvali:
   - `gpx_summary_approval`, jeśli jest GPX,
   - `claims_approval`,
   - `poi_approval`, jeśli są POI candidates,
   - `guide_final_approval`,
   - `publish_payload_approval` przed final publish mode.

4. Quality gate ma wymagać `route_segments.geojson`, jeśli jest GPX.

### Definition of Done

- Nie da się przepchnąć przewodnika opartego na fallbackach.
- Brak approvali blokuje publish payload.
- Testy quality gates obejmują fallback phrases i missing_inputs.

---

## Etap J: API contract i README aktualizacja

### Problem

README na `main` nie pokazuje nowych komend i endpointów. Po wdrożeniu zmian trzeba zaktualizować dokumentację.

### Zadania

1. Zaktualizuj `README.md` na branchu.
2. Zaktualizuj `docs/api_contract.md`.
3. Dodaj sekcję:

- creator input workflow,
- GPX workflow,
- approval workflow,
- guide v2 workflow,
- quality gates v2.

4. Dodaj przykładowy flow:

```bash
npm run atlas -- create-project --topic "Golden motorcycle route" --category motorcycle --region "Alps" --language en
npm run atlas -- input-add-note --project golden-motorcycle-route --file fixtures/golden-route/notes.md
npm run atlas -- input-add-gpx --project golden-motorcycle-route --file fixtures/golden-route/route.gpx
npm run atlas -- build-research-pack --project golden-motorcycle-route
npm run atlas -- analyze-gpx --project golden-motorcycle-route
npm run atlas -- generate-claims --project golden-motorcycle-route
npm run atlas -- extract-pois --project golden-motorcycle-route
npm run atlas -- run-mvp2 --project golden-motorcycle-route
npm run atlas -- review --project golden-motorcycle-route
```

### Definition of Done

- README pokazuje aktualny stan branchu.
- API contract zawiera nowe endpointy.
- Komendy z README działają.

---

## Etap K: Demo Golden Route jako test end-to-end

### Problem

Demo istnieje, ale powinno stać się realnym testem smoke/e2e, nie tylko script-generatorem.

### Zadania

1. `scripts/demo-golden-route.ts` ma:
   - czyścić poprzedni output dla demo slug,
   - tworzyć projekt,
   - dodawać inputy,
   - budować research pack,
   - analizować GPX,
   - generować claimy,
   - ekstrahować POI,
   - symulować approvale,
   - generować guide,
   - uruchamiać quality gates,
   - przygotować publish dry-run.

2. Dodaj test smoke:

```txt
tests/golden-route-smoke.test.ts
```

3. Test powinien sprawdzić istnienie:

- `research_pack.json`,
- `route_summary.json`,
- `route_segments.geojson`,
- `route_warnings.json`,
- `claims.json`,
- `poi_candidates.json`,
- `guide.md`,
- `routemarket_payload.json`.

### Definition of Done

- `npm run demo:golden-route` działa.
- `npm test` uruchamia smoke test.
- Demo nie wymaga commitowania outputu w `routes/`.

---

## Etap L: PR do main po stabilizacji

### Zadania

Po wykonaniu etapów A-K:

```bash
npm run check
npm test
npm run demo:golden-route
git status
git diff --stat
```

Następnie utwórz PR z `feat/creator-grade-atlas-pipeline` do `main`.

Opis PR powinien zawierać:

- co dodano,
- jak uruchomić demo,
- jakie quality gates działają,
- znane ograniczenia,
- co zostało celowo poza zakresem.

### Znane ograniczenia, które mogą zostać poza tym sprintem

- pełny PDF/DOCX parser,
- OCR zdjęć,
- AI vision na zdjęciach,
- real geocoding Google Places dla wszystkich POI,
- 3D map consumer app,
- automatyczne publikowanie do RouteMarket.

---

## Najważniejsze kryterium jakości

Pipeline ma być szczery. Lepiej zatrzymać projekt z `missing_inputs.json`, niż wygenerować piękny, ale pusty przewodnik.

Jeśli Codex ma wątpliwość, powinien wybrać zachowanie blokujące publikację, nie zachowanie „domyślne/fallbackowe”.
