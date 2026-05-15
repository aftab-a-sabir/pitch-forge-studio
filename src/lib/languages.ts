// Single source of truth for project language config.
//
// To expose more languages in the dropdown: append to SELECTABLE_LANGUAGES.
// To enable multi-select: set MULTI_SELECT_LANGUAGES = true.
// To restrict back to English-only: keep SELECTABLE_LANGUAGES = ["English"].

export const ALL_LANGUAGES = ["English", "Spanish", "French", "German"] as const;
export type Language = (typeof ALL_LANGUAGES)[number];

// Languages currently exposed in the UI.
export const SELECTABLE_LANGUAGES: Language[] = ["English"];

export const DEFAULT_LANGUAGE: Language = "English";

export const MULTI_SELECT_LANGUAGES = false;
