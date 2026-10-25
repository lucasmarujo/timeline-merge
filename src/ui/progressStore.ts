import { createProgress, parseProgress, type Progress } from '../levels/progress';

const PROGRESS_STORAGE_KEY = 'timeline-merge:progress:v1';

export function loadProgress(): Progress {
  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    return raw ? parseProgress(JSON.parse(raw)) : createProgress();
  } catch (error) {
    console.warn('[Timeline Merge] Saved progress could not be read, starting fresh.', error);
    return createProgress();
  }
}

export function saveProgress(progress: Progress): void {
  try {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    console.warn('[Timeline Merge] Progress could not be saved.', error);
  }
}
