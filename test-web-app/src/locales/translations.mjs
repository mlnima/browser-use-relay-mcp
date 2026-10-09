import catalog from './catalog.json';
import { languages } from '../settings.mjs';

export const dictionaries = Object.fromEntries(languages.map((language, index) => [language.id,
  Object.fromEntries(Object.entries(catalog).map(([key, values]) => [key, values[index]])),
]));
