import db from '../db';

export async function frappe__desk__form__utils__validate_link({
  value,
  options,
  fetch,
}) {
  if (!db.tables.map((x) => x.name).includes(options)) {
    return;
  }
  const entity = await db.table(options).get(value);
  if (entity) {
    return {
      message: 'Ok',
      valid_value: value,
      ...(fetch && {
        fetch: fetch.split(', ').map((x) => entity[x] || null),
      }),
    };
  }
}
