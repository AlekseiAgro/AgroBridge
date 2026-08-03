export type PlaceSuggestion = {
  placeId: string;
  /** Full suggestion label shown in the dropdown. */
  label: string;
  /** Settlement / locality name stored in originPlace. */
  mainText: string;
  secondaryText: string | null;
};

export type PlacesAutocompleteResponse = {
  /** False when Google Maps is not configured on the server. */
  enabled: boolean;
  suggestions: PlaceSuggestion[];
};

/** Minimum characters before querying Places Autocomplete. */
export const PLACE_AUTOCOMPLETE_MIN_CHARS = 2;
