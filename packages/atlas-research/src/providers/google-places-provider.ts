import type { PoiCandidate } from "./interfaces.js";

export class GooglePlacesProvider {
  constructor(private readonly apiKey: string) {}

  async enrichPoi(poi: PoiCandidate): Promise<PoiCandidate> {
    if (!this.apiKey) return poi;

    const query = poi.name + (poi.lat && poi.lng ? "" : ""); // simple query
    try {
      // Find Place from Text or Text Search (New API)
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.websiteUri,places.nationalPhoneNumber,places.regularOpeningHours,places.rating,places.userRatingCount,places.types"
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: 1,
          locationBias: (poi.lat && poi.lng) ? {
            circle: {
              center: { latitude: poi.lat, longitude: poi.lng },
              radius: 50000.0 // 50km bias
            }
          } : undefined
        })
      });

      if (!res.ok) {
        console.warn("Google Places API error:", res.statusText);
        return poi;
      }

      const data = await res.json();
      const place = data.places?.[0];

      if (place) {
        return {
          ...poi,
          lat: place.location?.latitude ?? poi.lat,
          lng: place.location?.longitude ?? poi.lng,
          website: place.websiteUri ?? poi.website,
          contactPhone: place.nationalPhoneNumber ?? poi.contactPhone,
          openingHours: place.regularOpeningHours?.descriptions?.join(", ") ?? poi.openingHours,
          isVerifiedByDeepResearch: true,
          // We attach extra fields, which might not be in PoiCandidate but will be mapped to Poi
          ...({
            placeId: place.id,
            rating: place.rating,
            userRatingCount: place.userRatingCount,
            types: place.types,
            verificationSource: "google_places"
          } as any)
        };
      }
    } catch (e) {
      console.warn("Failed to enrich POI with Google Places:", e);
    }
    return poi;
  }
}
