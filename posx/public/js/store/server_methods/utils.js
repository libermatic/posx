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

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L843
export async function get_conversion_factor(item_code, uom) {
  const { variant_of } = (await db.table('Item').get(item_code)) || {};
  const parents = variant_of ? [item_code, variant_of] : [item_code];
  const { conversion_factor = 1 } =
    (await db
      .table('UOM Conversion Detail')
      .where('parent')
      .anyOf(parents)
      .and((x) => x.uom === uom)
      .first()) || {};

  // get_uom_conv_factor is not implemented
  return { conversion_factor };
}
