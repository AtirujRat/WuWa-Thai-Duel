export type DeckEntries = Record<string, number>;

export interface SavedDeck {
  id: string;
  name: string;
  entries: DeckEntries;
}

export interface DeckValidationResult {
  valid: boolean;
  errors: string[];
  characters: number;
  actions: number;
}

export interface PresetDeckResult {
  name: string;
  entries: DeckEntries;
}
