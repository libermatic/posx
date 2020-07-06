import * as R from 'ramda';
import db from '../db';
import { get_filters, get_fields } from './utils';

export async function frappe__client__get_value({
  doctype,
  fieldname,
  filters: _filters = null,

  as_dict = true,
  debug = false,
  parent = null,
}) {
  if (!db.tables.map((x) => x.name).includes(doctype)) {
    return;
  }

  const { name, filters } = get_filters(_filters);
  const fields = get_fields(fieldname);
  const getResult = R.ifElse(R.isNil, R.identity, R.pick(fields));
  if (name) {
    const message = await db.table(doctype).get(name).then(getResult);
    return message && { message };
  }
  if (filters) {
    const message = await db
      .table(doctype)
      .filter((x) =>
        Object.keys(filters).every((field) => x[field] === filters[field])
      )
      .first()
      .then(getResult);
    return message && { message };
  }
}
