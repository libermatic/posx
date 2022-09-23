export * from './make-extension';

/**
 * @param {string} field watch for change on this
 * @param {object} dict object on which to watch changes
 * @param {number} millis until this lapses
 */
export async function waitToChange(field, dict, millis) {
  const prev = dict[field];
  const limit = millis / 60;
  let count = 0;
  while (prev === dict[field] && count < limit) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    count++;
  }
}
