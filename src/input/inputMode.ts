export enum InputMode {
  Keyboard = 'keyboard',
  Touch = 'touch',
}

export const COARSE_POINTER_QUERY = '(pointer: coarse)';

export function detectInputMode(matchesQuery: (query: string) => boolean): InputMode {
  return matchesQuery(COARSE_POINTER_QUERY) ? InputMode.Touch : InputMode.Keyboard;
}
