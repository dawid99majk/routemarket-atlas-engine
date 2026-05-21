import { type RouteProject, type Source, type Claim, type Poi, type ProjectRepository } from "../../../atlas-core/src/index.js";
import { GeminiDeepResearchProvider } from "../providers/gemini-deep-research-provider.js";

export async function generateAiConcept(input: {
  project: RouteProject;
  sources: Source[];
  claims: Claim[];
  pois: Poi[];
  apiKey: string;
  model?: string;
}): Promise<string> {
  const model = input.model ?? "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${input.apiKey}`;

  const prompt = `Jesteś RouteMaster AI, elitarnym architektem wypraw w systemie Atlas. 
Twoim zadaniem jest stworzenie "Route Master Blueprint" — ekstremalnie szczegółowego dokumentu koncepcyjnego, który posłuży jako fundament do budowy pliku GPX i pełnego przewodnika.

DANE PROJEKTU:
Tytuł: ${input.project.title}
Kategoria: ${input.project.category}
Region: ${input.project.region}

DANE BADAWCZE:
TWIERDZENIA (CLAIMS):
${input.claims.map(c => `- ${c.claim} (Pewność: ${c.confidence})`).join("\n")}

PUNKTY POI (ZNAJDŹ I WYKORZYSTAJ KOORDYNATY):
${input.pois.map(p => `- ${p.name} [LAT: ${p.lat}, LNG: ${p.lng}]: ${p.description || "brak opisu"}`).join("\n")}

ZASADY GENEROWANIA KONSPEKTU:
1. MASZ BYĆ GADATLIWY I PRECYZYJNY. Jeśli opis będzie krótki, projekt zostanie odrzucony.
2. KAŻDA sekcja musi zawierać listy punktowe.
3. OBOWIĄZKOWA SEKCJA: "Geographic Backbone" — wypisz w punktach sekwencję punktów (lat/lng), które muszą znaleźć się w GPX.
4. Język: Polski (profesjonalny, techniczny).

STRUKTURA DOKUMENTU (MARKDOWN):
# Route Master Blueprint: ${input.project.title}

## 1. Wizja i Charakterystyka Trasy
[Opis min. 500 znaków o tym, jak trasa "płynie", jaki ma klimat i co ją wyróżnia.]

## 2. Dlaczego warto? (USP)
* [Szczegółowa zaleta 1]
* [Szczegółowa zaleta 2]
* [Więcej punktów...]

## 3. Geographic Backbone (KRYTYCZNE DLA GPX)
* [START]: Nazwa punktu (Lat: X.XXXXX, Lng: Y.YYYYY) - opis dlaczego tu.
* [ETAP 1]: ...
* [NAJWYŻSZY PUNKT]: ...
* [KLUCZOWE POI]: ...
* [KONIEC]: ...
(Wypisz min. 10 punktów z koordynatami, jeśli są dostępne w POI).

## 4. Analiza Trudności i Bezpieczeństwa
* [Wymagania techniczne]
* [Punkty ucieczki / ewakuacji]
* [Dostęp do wody i paliwa]

## 5. Logistyka i Sprzęt
* [Lista sprzętu]
* [Zalecany sezon]

Zwróć TYLKO treść Markdown. Dokument musi być długi, mięsisty i pełen technicznych detali.`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    })
  });

  if (!response.ok) {
    throw new Error(`AI Concept generation failed: ${response.status} - ${await response.text()}`);
  }

  const data = await response.json() as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Błąd generowania konceptu AI.";
}

export async function generateAiGpx(input: {
  project: RouteProject;
  claims: Claim[];
  pois: Poi[];
  apiKey: string;
  model?: string;
}): Promise<string> {
  const model = input.model ?? "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${input.apiKey}`;

  const prompt = `Jesteś RouteMarket Atlas GIS Specialist. Twoim zadaniem jest wygenerowanie poprawnego pliku GPX XML dla trasy na podstawie danych badawczych.

DANE PROJEKTU:
Tytuł: ${input.project.title}
Region: ${input.project.region}

TWIERDZENIA (CLAIMS) DOTYCZĄCE TRASY:
${input.claims.filter(c => c.claimType === "route_segment" || c.claimType === "logistics").map(c => `- ${c.claim}`).join("\n")}

PUNKTY POI (Z WSPÓŁRZĘDNYMI):
${input.pois.map(p => `- ${p.name} (lat: ${p.lat}, lng: ${p.lng})`).join("\n")}

ZASADY:
- Wygeneruj poprawny technicznie XML GPX (<gpx ...><trk><trkseg><trkpt ...>).
- Jeśli POI mają współrzędne, użyj ich jako waypointów (<wpt>) i punktów trasy.
- Stwórz logiczny ciąg punktów (min. 15 punktów) łączący te lokalizacje, tworząc ślad trasy.
- Zwróć TYLKO surowy kod XML GPX. Bez markdown, bez komentarzy.`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048
      }
    })
  });

  if (!response.ok) {
    throw new Error(`AI GPX generation failed: ${response.status} - ${await response.text()}`);
  }

  const data = await response.json() as any;
  let xml = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  xml = xml.replace(/```xml\s?|```gpx\s?|```\s?/g, "").trim();
  if (!xml.startsWith("<?xml") && xml.includes("<gpx")) {
      xml = xml.substring(xml.indexOf("<gpx"));
  }
  return xml;
}
