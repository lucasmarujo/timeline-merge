export function showFatalError(title: string, detail: string): void {
  const panel = document.getElementById('fatal');
  if (!panel) {
    console.error(`[Timeline Merge] ${title}: ${detail}`);
    return;
  }
  const heading = panel.querySelector('h1');
  const body = panel.querySelector('p');
  if (heading) heading.textContent = title;
  if (body) body.textContent = detail;
  panel.hidden = false;
}
