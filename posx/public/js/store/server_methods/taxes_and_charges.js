import * as R from 'ramda';

import db from '../db';
import { MandatoryEntityNotFound } from '../../utils/exceptions.js';

export async function erpnext__controllers__accounts_controller__get_default_taxes_and_charges(
  args
) {
  const message = await get_default_taxes_and_charges(args);
  if (message) {
    return { message };
  }
}

export async function erpnext__controllers__accounts_controller__get_taxes_and_charges(
  args
) {
  const message = await get_taxes_and_charges(args);
  if (message) {
    return { message };
  }
}

export async function erpnext__accounts__party__set_taxes(args) {
  const message = await set_taxes(args);
  if (message) {
    return { message };
  }
}

async function get_default_taxes_and_charges({
  master_doctype,
  tax_template = null,
  company = null,
}) {
  if (master_doctype !== 'Sales Taxes and Charges Template') {
    return;
  }

  if (!company) {
    return {};
  }

  const get_prop = (x) => R.ifElse(R.identity, R.prop(x), () => null);

  if (tax_template) {
    const template_company = await db
      .table(master_doctype)
      .get(tax_template)
      .then(get_prop('company'));
    if (template_company === company) {
      return {};
    }
  }

  const taxes_and_charges = await db
    .table(master_doctype)
    .filter((x) => x.company === company && x.is_default === 1)
    .first()
    .then(get_prop('name'));

  const taxes = await get_taxes_and_charges({
    master_doctype,
    master_name: taxes_and_charges,
  });

  return { taxes_and_charges, taxes };
}

export async function get_taxes_and_charges({ master_doctype, master_name }) {
  if (master_doctype !== 'Sales Taxes and Charges Template') {
    return;
  }

  if (!master_name) {
    return;
  }

  const whitelisted_fields = [
    'account_head',
    'base_tax_amount',
    'base_tax_amount_after_discount_amount',
    'base_total',
    'branch',
    'charge_type',
    'cost_center',
    'description',
    'included_in_print_rate',
    'item_wise_tax_detail',
    'rate',
    'row_id',
    'tax_amount',
    'tax_amount_after_discount_amount',
    'total',
  ];

  return db
    .table('Sales Taxes and Charges')
    .where('parent')
    .equals(master_name)
    .toArray()
    .then(R.map(R.pick(whitelisted_fields)));
}

// always return the tax template set in the POS Profile
export async function set_taxes({
  party,
  party_type,
  posting_date,
  company,
  customer_group = null,
  supplier_group = null,
  tax_category = null,
  billing_address = null,
  shipping_address = null,
  use_for_shopping_cart = null,
}) {
  const { value: pos_profile } =
    (await db.session_state.get('pos_profile')) || {};
  if (!pos_profile) {
    return;
  }

  const { taxes_and_charges } =
    (await db.table('POS Profile').get(pos_profile)) || {};
  if (!taxes_and_charges) {
    throw new MandatoryEntityNotFound(
      `Please select Taxes and Charges in POS Profile ${pos_profile}`
    );
  }

  return taxes_and_charges;
}
