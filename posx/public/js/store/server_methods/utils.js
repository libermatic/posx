import * as R from 'ramda';

import db from '../db';

export function get_filters(filters) {
  try {
    return { filters: JSON.parse(filters) };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { name: filters };
    }
    throw error;
  }
}

export function get_fields(fieldname) {
  try {
    return JSON.parse(fieldname);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return [fieldname];
    }
    throw error;
  }
}

export async function getAncestors(doctype, name) {
  const { lft, rgt } = await db.table(doctype).get(name);
  return db
    .table(doctype)
    .filter((x) => x.lft <= lft && x.rgt >= rgt)
    .toArray()
    .then(R.map(R.prop('name')));
}

export async function getDescendents(doctype, name) {
  const { lft, rgt } = await db.table(doctype).get(name);
  return db
    .table(doctype)
    .filter((x) => x.lft >= lft && x.rgt <= rgt)
    .toArray()
    .then(R.map(R.prop('name')));
}
