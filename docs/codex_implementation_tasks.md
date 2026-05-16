# Codex Implementation Tasks: RouteMarket Atlas Engine

## Cel

Doprowadzić `routemarket-atlas-engine` z obecnego stanu workflow/orchestratora do realnego silnika produkcyjnego, który potrafi tworzyć wysokiej jakości przewodnik RouteMarket na podstawie:

- notatek twórcy,
- dokumentów,
- linków,
- zdjęć,
- plików GPX,
- danych mapowych/POI,
- pętli akceptacji człowieka po kluczowych etapach.

Nie budować jeszcze osobnej aplikacji 3D ani finalnego consumer app. Teraz celem jest stabilny backend/pipeline + artefakty gotowe do integracji z panelem twórcy i RouteMarket.

---

## Zasada nadrzędna

Każda zmiana musi wspierać proces:

1. Creator wrzuca materiały.
2. Atlas buduje research pack.
3. Atlas analizuje GPX i źródła.
4. Atlas ekstrahuje fakty, POI, ryzyka, segmenty.
5. Creator zatwierdza/odrzuca wyniki etapami.
6. Atlas pisze przewodnik bez placeholderów.
7. Atlas robi quality gates.
8. Atlas przygotowuje payload do RouteMarket jako draft.
9. Publikacja nigdy nie dzieje się automatycznie bez finalnej akceptacji człowieka.

---

## Etap 0: stabilizacja przed zmianami

### Zadania

1. Uruchom lokalnie:

```bash
npm install
npm run check
npm test
```

2. Jeśli coś nie przechodzi, napraw przed dodawaniem nowych funkcji.

3. Utwórz branch:

```bash
git checkout -b feat/creator-grade-atlas-pipeline
```

4. Nie zmieniaj nazw istniejących komend bez kompatybilności wstecznej.

### Definition of Done

- `npm run check` przechodzi.
- `npm test` przechodzi.
- Brak regresji w obecnym CLI/API.

---

## Etap 1: Project Input Intake Layer

### Cel

Dodać obsługę materiałów wejściowych projektu. Obecnie projekt pracuje głównie na źródłach web/mock. Potrzebujemy folderów i manifestu dla materiałów od twórcy.

### Struktura folderów projektu

Po `create-project` każdy projekt powinien mieć:

```txt
routes/<slug>/
  input/
    notes/
    docs/
    photos/
    gpx/
    links/
  input_manifest.json
  creator_answers.json
```

### Pliki/moduły do dodania lub zmiany

- `packages/atlas-core/src/projects/create-route-project.ts`
- `packages/atlas-core/src/models/input-manifest.ts` — nowy model
- `packages/atlas-core/src/index.ts`
- `packages/atlas-workflow/src/workflow-service.ts`
- `apps/cli/src/commands/` — nowe komendy CLI
- `apps/api/src/http.ts`
- `apps/api/src/schemas.ts`

### Nowe artefakty

`input_manifest.json`:

```json
{
  "projectId": "string",
  "updatedAt": "ISO string",
  "items": [
    {
      "id": "input_001",
      "type": "note | document | photo | gpx | link",
      "path": "input/notes/example.md",
      "originalName": "example.md",
      "mimeType": "text/markdown",
      "sizeBytes": 1234,
      "addedAt": "ISO string",
      "status": "added | processed | ignored | needs_review",
      "notes": "optional"
    }
  ]
}
```

`creator_answers.json`:

```json
{
  "projectId": "string",
  "updatedAt": "ISO string",
  "answers": []
}
```

### Nowe CLI

```bash
npm run atlas -- input-list --project <slug>
npm run atlas -- input-add-link --project <slug> --url "https://..." --note "optional"
npm run atlas -- input-add-note --project <slug> --file ./note.md
npm run atlas -- input-add-gpx --project <slug> --file ./route.gpx
npm run atlas -- input-add-photo --project <slug> --file ./photo.jpg
npm run atlas -- build-research-pack --project <slug>
```

### Nowe API

```txt
GET  /projects/:slug/input
POST /projects/:slug/input/links
POST /projects/:slug/build-research-pack
```

Na tym etapie upload binary przez HTTP może zostać pominięty, jeśli jest trudny bez dodatkowych bibliotek. Wystarczy obsługa lokalna przez CLI + linki przez API.

### Definition of Done

- `create-project` tworzy foldery `input/*`.
- Można dodać link i notatkę lokalnie przez CLI.
- `input_manifest.json` aktualizuje się poprawnie.
- Testy obejmują tworzenie projektu i manifestu.

---

## Etap 2: Research Pack Builder

### Cel

Zbudować `research_pack.json`, który łączy dane z:

- `sources.json`,
- notatek,
- dokumentów tekstowych,
- linków,
- deep research,
- później GPX/media.

### Nowy plik

`routes/<slug>/research_pack.json`

Przykład:

```json
{
  "projectId": "string",
  "topic": "string",
  "category": "motorcycle",
  "region": "Albania",
  "language": "en",
  "updatedAt": "ISO string",
  "materials": [
    {
      "id": "mat_001",
      "inputId": "input_001",
      "type": "note | document | link | source | deep_research",
      "title": "string",
      "content": "plain text excerpt or normalized text",
      "sourceUrl": "optional",
      "trustLevel": "creator | official | map | community | unknown",
      "status": "usable | weak | duplicate | needs_review"
    }
  ]
}
```

### Moduły

Dodaj:

- `packages/atlas-research/src/research-pack/build-research-pack.ts`
- eksport w `packages/atlas-research/src/index.ts`
- workflow method w `AtlasWorkflowService`
- CLI command `build-research-pack`

### Ważne

Nie próbuj jeszcze robić OCR ani pełnego PDF parsera, jeśli wymaga ciężkich zależności. Na start wspieraj:

- `.md`,
- `.txt`,
- linki z manifestu,
- `sources.json`,
- `deep_research.json` + pliki `research/deep/*.txt`.

Dokumenty PDF/DOCX oznaczaj jako `needs_review` lub `unsupported_pending_parser`.

### Definition of Done

- `build-research-pack` tworzy sensowny `research_pack.json`.
- Brak crasha, jeśli brakuje inputów.
- Test: notatka + sources.json → research_pack z dwoma materiałami.

---

## Etap 3: GPX Analyzer

### Cel

Dodać realną analizę GPX. To jest core wartości RouteMarket.

### Nowe artefakty

```txt
route_summary.json
route_segments.geojson
elevation_profile.json
route_warnings.json
```

### `route_summary.json`

Musi być zgodny z istniejącym `RouteSummarySchema`:

```json
{
  "distanceKm": 123.4,
  "elevationGainM": 1450,
  "estimatedTimeH": 6.5,
  "difficulty": "moderate",
  "riskLevel": "medium",
  "loopType": "loop",
  "season": "May-October",
  "startPoint": "string",
  "endPoint": "string",
  "surfaceType": "unknown / mixed / paved / gravel hypothesis",
  "validationStatus": "draft",
  "updatedAt": "ISO string"
}
```

### Minimalny zakres parsera GPX

Bez ciężkich zależności na start. Możesz napisać prosty parser XML albo dodać małą zależność, jeśli konieczne.

Obsłuż:

- `<trkpt lat="" lon="">`,
- `<ele>`,
- `<time>`,
- wiele track segmentów.

Oblicz:

- dystans haversine,
- suma podejść,
- suma zejść,
- start/end coordinates,
- bbox,
- czy pętla: dystans start-end < 1 km lub < 2% trasy,
- profil wysokości co N punktów.

### Nowe CLI

```bash
npm run atlas -- analyze-gpx --project <slug>
```

### Nowe API

```txt
POST /projects/:slug/analyze-gpx
```

### Moduły

Dodaj:

- `packages/atlas-research/src/gpx/analyze-gpx.ts`
- ewentualnie `packages/atlas-core/src/models/elevation-profile.ts`
- workflow method w `AtlasWorkflowService`
- CLI command
- API endpoint

### Quality Gate update

`prepare-publish` ma wymagać:

- `route_summary.json` istnieje,
- `validationStatus !== needs_validation`,
- distanceKm > 0,
- start/end obecne,
- jeśli brakuje GPX, route może przejść tylko jeśli typ trasy na to pozwala i creator ręcznie zatwierdzi wyjątek.

### Definition of Done

- Dla przykładowego GPX powstaje `route_summary.json`.
- `prepare-publish` nie przechodzi bez summary.
- Test jednostkowy dla haversine i elevation gain.

---

## Etap 4: Claim Engine v2

### Cel

Zastąpić placeholderowe claimy realnymi faktami z research packa, deep research i danych GPX.

### Obecny problem

Nie generuj claimów typu:

```txt
Source X may contain useful route intelligence...
```

To jest meta-komentarz, nie fakt.

### Nowe statusy claimów

Rozszerz model, jeśli trzeba:

```txt
extracted
likely
verified
contradicted
uncertain
needs_creator_review
```

### Claim powinien mieć

```json
{
  "id": "claim_001",
  "topicId": "string",
  "claim": "The section between X and Y is gravel and may be difficult after rain.",
  "claimType": "safety | season | distance | difficulty | logistics | route_segment | poi | surface | access | cost | legal",
  "confidence": 0.72,
  "status": "needs_creator_review",
  "sources": ["source_001", "mat_002"],
  "usedInSections": [],
  "needsHumanReview": true
}
```

### Implementacja minimalna

1. Jeśli jest `research_pack.json`, użyj go jako głównego wejścia.
2. Jeśli jest `route_summary.json`, dodaj fakty techniczne:
   - distance,
   - elevation,
   - loop/point-to-point,
   - estimated time.
3. Jeśli są deep research claims, zachowaj je, ale normalizuj statusy.
4. Jeśli brak realnych faktów, wygeneruj `missing_inputs.json`, nie udawaj jakości.

### Moduły

- `packages/atlas-research/src/workflow/claims.ts`
- ewentualnie nowy `packages/atlas-research/src/claims/claim-engine.ts`
- testy.

### Definition of Done

- Claimy opisują trasę, nie źródła.
- Placeholder claimy są usunięte.
- Quality gate blokuje projekt, jeśli wszystkie claimy są `uncertain` lub `needs_creator_review` bez approval.

---

## Etap 5: POI Extractor v2

### Cel

POI mają pochodzić z:

- deep research,
- research pack,
- GPX punktów/waypointów,
- Google Places enrichment, jeśli jest API key,
- ręcznej akceptacji twórcy.

### Obecny problem

`extractPois` ma hardcoded POI dla Albanii i pustą listę dla reszty. To zostawić tylko jako test fixture, nie jako produkcyjną logikę.

### Nowe zachowanie

1. Jeśli GPX ma waypoints `<wpt>`, dodaj je jako kandydatów.
2. Jeśli deep research ma POI, scalaj je.
3. Jeśli research pack zawiera nazwy miejsc, dodaj kandydatów bez koordynatów jako `needs_geocoding`.
4. Jeśli Google Places key istnieje, enrich/geocode.
5. Zapisz wszystko do `poi_candidates.json`.
6. Do `poi.geojson` trafiają tylko POI z koordynatami.
7. POI bez koordynatów zostają do review.

### Artefakty

```txt
poi_candidates.json
poi.geojson
```

### Definition of Done

- Brak hardcoded produkcyjnych POI.
- Albania fixture może istnieć tylko w mock/test path.
- POI z GPX waypointów są importowane.
- POI bez koordynatów nie powodują 0,0.

---

## Etap 6: Human Approval Gates v2

### Cel

Prawdziwa pętla akceptacji po etapach. Obecnie pause jest tylko przy POI i final verification, a resume logic zgaduje następny krok. To trzeba naprawić.

### Wymagane etapy approval

```txt
topic_approval
sources_approval
research_pack_approval
claims_approval
gpx_summary_approval
poi_approval
concept_approval
guide_outline_approval
guide_final_approval
media_approval
publish_payload_approval
```

### Nowe artefakty

`approvals.json`:

```json
{
  "projectId": "string",
  "updatedAt": "ISO string",
  "approvals": [
    {
      "stage": "claims_approval",
      "decision": "approved | changes_requested | rejected",
      "reviewer": "string",
      "notes": "string",
      "decidedAt": "ISO string",
      "dataPatchPath": "optional"
    }
  ]
}
```

### Job Manager

Zmień job context tak, aby przechowywał:

```json
{
  "projectSlug": "string",
  "workflow": "mvp2",
  "currentStep": "claims",
  "nextStep": "gpx",
  "waitingForStage": "claims_approval",
  "resumeFromStep": "gpx"
}
```

Nie zgaduj `nextStep` na podstawie stringa.

### API

```txt
GET  /projects/:slug/approvals
POST /projects/:slug/approvals
GET  /jobs/pending-approvals
POST /jobs/:id/approve
POST /jobs/:id/request-changes
```

### Definition of Done

- Job pause/resume działa deterministycznie.
- Approval zapisuje się w `approvals.json`.
- `run-mvp2` może zostać zatrzymany i wznowiony po approval.

---

## Etap 7: Guide Writer v2

### Cel

Zastąpić obecny template realnym generatorem przewodnika.

### Obecny problem

`guide.md` zawiera placeholdery typu `needs validation`, `pending`, `not yet validated`. Taki plik nigdy nie powinien być finalnym przewodnikiem.

### Nowe wejścia

Guide Writer ma czytać:

- `research_pack.json`,
- `route_summary.json`,
- `claims.json`,
- `poi.geojson`,
- `route_concept.md`,
- `tips.json`,
- `recommendations.json`,
- `approvals.json`,
- notatki twórcy.

### Nowe artefakty

```txt
guide_outline.md
guide.md
missing_inputs.json
```

### Zachowanie

1. Najpierw wygeneruj `guide_outline.md`.
2. Czekaj na `guide_outline_approval`.
3. Dopiero potem generuj `guide.md`.
4. Jeśli brakuje krytycznych danych, nie twórz udawanego przewodnika. Zapisz `missing_inputs.json`.
5. Finalny `guide.md` nie może zawierać zakazanych fraz:
   - `needs validation`
   - `needs review`
   - `not yet validated`
   - `pending`
   - `TBD`
   - `TODO`

### Struktura guide.md

Minimum:

```md
# Title

## Quick facts
- Distance
- Elevation gain
- Duration
- Difficulty
- Best season
- Start / finish
- Surface
- Risk level

## Who is this route for?
## Why this route is worth doing
## Route overview
## Segment-by-segment description
## Key POI
## Logistics
## Safety and risks
## Best season and weather notes
## Gear / preparation
## Variants and shortcuts
## Creator notes
## Sources and verification
## Disclaimer
```

### Definition of Done

- `guide.md` jest oparty na realnych artefaktach.
- Brak placeholderów.
- Jeśli brakuje danych, powstaje `missing_inputs.json` i quality gate blokuje publikację.

---

## Etap 8: Media / Photo Intake v1

### Cel

Obsłużyć realne zdjęcia twórcy, nawet minimalnie.

### Zakres MVP

1. CLI może dodać zdjęcie do `input/photos/`.
2. `prepare-media` czyta zdjęcia z manifestu.
3. Tworzy `media/manifest.json` z assetami:
   - cover candidate,
   - gallery candidate,
   - poi photo candidate.
4. Jeśli zdjęcie ma EXIF GPS i uda się odczytać bez ciężkiej zależności, dodaj lokalizację. Jeśli nie, zostaw `locationStatus: unknown`.
5. Nie generuj fikcyjnych zdjęć jako finalnych assetów. Prompt AI może być tylko fallbackiem/cover idea.

### Artefakt

`media/manifest.json` powinien obsługiwać:

```json
{
  "assets": [
    {
      "id": "media_001",
      "role": "cover_candidate | gallery | poi | warning | generated_prompt",
      "source": "creator_upload | ai_prompt",
      "inputId": "input_123",
      "path": "input/photos/photo.jpg",
      "licenseStatus": "creator_owned | ai_generated | unknown",
      "locationStatus": "gps_found | matched_to_route | unknown",
      "approvalStatus": "pending | approved | rejected"
    }
  ]
}
```

### Definition of Done

- Realne zdjęcia pojawiają się w media manifest.
- Obecny prompt covera nie znika, ale jest oznaczony jako `generated_prompt`, nie jako gotowy asset.

---

## Etap 9: Publish Adapter hardening

### Cel

`prepare-publish` ma być bezpieczne i draft-first.

### Zasady

1. `prepare-publish` nie publikuje automatycznie.
2. Musi wymagać:
   - final guide approval,
   - media approval,
   - publish payload approval albo tryb dry-run.
3. Payload musi zawierać odniesienie do GPX, POI, tips, recommendations, media manifest.
4. Jeśli brakuje GPX dla typu trasy, quality gate blokuje.

### Tryby

Na razie tylko:

```bash
npm run atlas -- prepare-publish --project <slug> --mode dry-run
```

Późniejsze tryby zostawić jako TODO bez implementacji:

```txt
create-draft
sync-draft
publish-after-approval
```

### Definition of Done

- `routemarket_payload.json` jest kompletny.
- Nie da się przygotować publish payload, jeśli quality gates fail.
- Tryb dry-run jest domyślny.

---

## Etap 10: Golden Route Test

### Cel

Dodać test/demo jednej realnej trasy end-to-end.

### Folder testowy

```txt
fixtures/golden-route/
  notes.md
  route.gpx
  links.json
  photos/README.md
```

Jeśli nie mamy realnych danych, stwórz mały syntetyczny GPX i notatkę, ale nazwij to jasno jako fixture.

### Komenda testowa

Dodaj npm script:

```json
"demo:golden-route": "tsx scripts/run-golden-route.ts"
```

Script ma:

1. stworzyć projekt,
2. dodać inputy,
3. collect-sources mock,
4. build-research-pack,
5. analyze-gpx,
6. generate-claims,
7. extract-pois,
8. write-guide-outline,
9. simulate approvals,
10. write-guide,
11. quality-check,
12. prepare-publish dry-run.

### Definition of Done

- Jedna komenda pokazuje cały pipeline.
- Wyniki są w `routes/<slug>/`.
- `npm run check` i `npm test` przechodzą.

---

## Komendy kontrolne po każdym etapie

Uruchamiaj po większych zmianach:

```bash
npm run check
npm test
```

Po dodaniu CLI:

```bash
npm run atlas -- --help
```

Po zmianach API:

```bash
npm run api
curl http://localhost:8787/health
curl http://localhost:8787/version
```

Po pipeline:

```bash
npm run atlas -- create-project --topic "Golden motorcycle route" --category motorcycle --region "Test Region" --language en
npm run atlas -- input-list --project golden-motorcycle-route
npm run atlas -- build-research-pack --project golden-motorcycle-route
npm run atlas -- analyze-gpx --project golden-motorcycle-route
npm run atlas -- run-mvp2 --project golden-motorcycle-route
npm run atlas -- review --project golden-motorcycle-route
npm run atlas -- prepare-publish --project golden-motorcycle-route --mode dry-run
```

---

## Kolejność wdrażania

Nie rób wszystkiego naraz. Implementuj w PR-ach lub commitach etapami:

1. Input Intake Layer
2. Research Pack Builder
3. GPX Analyzer
4. Claim Engine v2
5. POI Extractor v2
6. Approval Gates v2
7. Guide Writer v2
8. Media/Photo Intake v1
9. Publish hardening
10. Golden Route Test

Po każdym etapie:

```bash
npm run check
npm test
git status
git diff --stat
```

---

## Najważniejsze antywzorce do usunięcia

1. Nie generuj przewodnika z placeholderami.
2. Nie twórz POI 0,0.
3. Nie traktuj mocków jako produkcji.
4. Nie publikuj automatycznie.
5. Nie pisz claimów o tym, że źródło „może zawierać informacje”. Claim ma być faktem o trasie.
6. Nie rozwijaj teraz aplikacji 3D. Najpierw silnik jakości.
7. Nie ukrywaj braków danych. Braki zapisuj do `missing_inputs.json`.

---

## Final Definition of Done dla całego zadania

System uznajemy za gotowy do kolejnego etapu, gdy:

- można stworzyć projekt,
- można dodać notatkę, link, GPX i zdjęcie,
- można zbudować `research_pack.json`,
- można przeanalizować GPX do `route_summary.json`,
- claimy są faktami o trasie,
- POI nie są hardcoded produkcyjnie,
- guide nie zawiera placeholderów,
- approval gates są zapisane i deterministyczne,
- quality gates blokują słabe projekty,
- `prepare-publish` tworzy draft payload bez automatycznej publikacji,
- jedna demo/golden route przechodzi cały pipeline,
- `npm run check` przechodzi,
- `npm test` przechodzi.
