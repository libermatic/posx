import * as R from 'ramda';
import nunjucks from 'nunjucks/browser/nunjucks';

import db from '../db';
import { get_taxes_and_charges } from './taxes_and_charges';

export async function erpnext__regional__india__utils__get_regional_address_details(
  args
) {
  const message = await get_regional_address_details(args);
  if (message) {
    return { message };
  }
}

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

export async function frappe__contacts__doctype__address__address__get_address_display({
  address_dict,
}) {
  if (!address_dict) {
    return { message: null };
  }

  const [{ template } = {}, address] = await Promise.all([
    db
      .table('Address Template')
      .filter((x) => x.is_default === 1)
      .first(),
    db.table('Address').get(address_dict),
  ]);
  if (template && address) {
    const message = nunjucks.renderString(template, address);
    return { message };
  }
}

async function get_regional_address_details({
  party_details: _party_details,
  doctype,
  company,
  return_taxes: _return_taxes = null,
}) {
  const party_details = JSON.parse(_party_details);
  const return_taxes = Boolean(Number(_return_taxes));
  const place_of_supply = await get_place_of_supply(party_details, doctype);

  // get_tax_template_for_sez is not used
  const category_details = await get_tax_template_based_on_category(
    'Sales Taxes and Charges Template',
    company,
    party_details
  );

  if (category_details.taxes_and_charges && return_taxes) {
    return { ...party_details, place_of_supply, ...category_details };
  }

  const { company_gstin } = party_details;

  if (!company_gstin || !place_of_supply) {
    return {};
  }

  if (
    company_gstin &&
    company_gstin.slice(0, 2) === (place_of_supply || '').slice(0, 2)
  ) {
    const { value: pos_profile } =
      (await db.session_state.get('pos_profile')) || {};
    if (!pos_profile) {
      return {};
    }

    const { taxes_and_charges } =
      (await db.table('POS Profile').get(pos_profile)) || {};

    const taxes = await get_taxes_and_charges({
      master_doctype,
      master_name: taxes_and_charges,
    });
    return { party_details, place_of_supply, taxes_and_charges, taxes };
  }
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

async function get_place_of_supply(
  { shipping_address, customer_address },
  doctype
) {
  if (doctype !== 'Sales Invoice') {
    return;
  }
  const address_name = shipping_address || customer_address;
  if (!address_name) {
    return null;
  }

  const { gst_state, gst_state_number } =
    (await db.table('Address').get(address_name)) || {};
  if (!gst_state || !gst_state_number) {
    return null;
  }

  return `${gst_state_number}-${gst_state}`;
}

async function get_tax_template_based_on_category(
  master_doctype,
  company,
  { tax_category }
) {
  if (!tax_category) {
    return {};
  }
  const taxes_and_charges = await db
    .table(master_doctype)
    .filter((x) => x.company === company && x.tax_category === tax_category)
    .first()
    .then(R.prop('name'));
  if (!taxes_and_charges) {
    return {};
  }

  const taxes = await get_taxes_and_charges({
    master_doctype,
    master_name: taxes_and_charges,
  });
  return { taxes_and_charges, taxes };
}
