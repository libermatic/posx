import * as R from 'ramda';

import db from '../db';

export async function erpnext__regional__india__utils__get_regional_address_details() {}

export async function erpnext__setup__doctype__company__company__get_default_company_address({
  name,
  sort_key = 'is_primary_address',
  existing_address = null,
}) {
  const addresses = await get_addresses({
    doctype: 'Company',
    name,
    sort_key,
  }).then(R.map(R.prop('name')));
  if (existing_address && addresses.includes(existing_address)) {
    return { message: existing_address };
  }
  return { message: R.head(addresses) };
}

export async function get_addresses({
  doctype,
  name,
  sort_key = 'is_primary_address',
}) {
  if (!['is_shipping_address', 'is_primary_address'].includes(sort_key)) {
    return [];
  }

  const links = await db
    .table('Dynamic Link')
    .where('link_name')
    .equals(name)
    .and((x) => x.link_doctype === doctype && x.parenttype === 'Address')
    .toArray()
    .then((x) => x.map((y) => y.parent));
  if (links.length === 0) {
    return [];
  }

  const sort_addresses = R.compose(R.reverse, R.sortBy(R.prop(sort_key)));
  return db
    .table('Address')
    .where('name')
    .anyOf(links)
    .toArray()
    .then(sort_addresses);
}
