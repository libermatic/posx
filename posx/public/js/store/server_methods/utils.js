import * as R from 'ramda';

import db from '../db';
import { PriceListNotFound } from '../../utils/exceptions';

export function snakeCase(text) {
  return text.toLowerCase().replace(' ', '_');
}

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

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/doctype/price_list/price_list.py#L53
export async function get_price_list_details(price_list) {
  const price_list_details = await db
    .table('Price List')
    .get(price_list)
    .then(
      (x) => x && R.pick(['currency', 'price_not_uom_dependent', 'enabled'], x)
    );
  if (!price_list_details || !price_list_details.enabled) {
    throw new PriceListNotFound(
      `Price List ${price_list} is disabled or does not exist`
    );
  }
  return price_list_details;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/__init__.py#L43
export async function get_company_currency(company) {
  const { default_currency } = (await db.table('Company').get(company)) || {};
  return default_currency;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/doctype/item/item.py#L1171
export async function get_item_defaults(item_code, company) {
  return get_defaults('Item', item_code, company);
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/setup/doctype/item_group/item_group.py#L232
export async function get_item_group_defaults(item_code, company) {
  const { item_group } = await db.table('Item').get(item_code);
  return get_defaults('Item Group', item_group, company);
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/setup/doctype/brand/brand.py#L13
export async function get_brand_defaults(item_code, company) {
  const { brand } = await db.table('Item').get(item_code);
  if (!brand) {
    return {};
  }
  return get_defaults('Brand', brand, company);
}

async function get_defaults(doctype, name, company) {
  const [doc, def] = await Promise.all([
    db.table(doctype).get(name),
    db
      .table('Item Default')
      .where('parent')
      .equals(name)
      .and((x) => x.parenttype === doctype && x.company === company)
      .first()
      .then(R.omit(['name'])),
  ]);
  return { ...doc, ...def };
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

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/doctype/serial_no/serial_no.py#L422
export function get_serial_no(serial_no) {
  if (serial_no instanceof Array) {
    return serial_no;
  }
  return (serial_no || '')
    .toUpperCase()
    .replace(',', '/n')
    .split('/n')
    .map((x) => x.trim())
    .filter((x) => !!x);
}
