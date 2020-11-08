import * as R from 'ramda';

import db from '../../db';
import { set_taxes } from '../taxes_and_charges';
import { get_addresses } from '../address';

export async function get_party_account({ party_type, party, company }) {
  if (party_type !== 'Customer' || !party) {
    return;
  }

  const customer_account = await get_account(party_type, company);
  if (customer_account) {
    return customer_account.account;
  }
  const { customer_group } = (await db.table('Customer').get(party)) || {};
  if (customer_group) {
    const group_account = await get_account(customer_group, company);
    if (group_account) {
      return group_account;
    }
  }
  const { default_receivable_account } =
    (await db.table('Company').get(company)) || {};
  return default_receivable_account;
}

export async function get_party_details({
  party = null,
  account = null,
  party_type = 'Customer',
  company = null,
  posting_date = null,
  bill_date = null,
  price_list = null,
  currency: _currency = null,
  doctype = null,
  ignore_permissions = false,
  fetch_payment_terms_template = true,
  party_address = null,
  company_address: _company_address = null,
  shipping_address = null,
  pos_profile = null,
}) {
  if (party_type !== 'Customer' || doctype !== 'Sales Invoice') {
    return;
  }

  const customer = await db.table('Customer').get(party);
  if (!customer) {
    return;
  }

  const [
    debit_to,
    currency,
    customer_address,
    company_address,
    contact_details,
    price_list_details,
    sales_team,
  ] = await Promise.all([
    get_party_account({ party_type, party, company }),
    get_currency(party, company),
    party_address || get_default_address({ doctype: party_type, name: party }),
    _company_address ||
      get_default_address({ doctype: 'Company', name: company }),
    get_party_contact_details(party),
    get_price_list_details(party, price_list, pos_profile),
    db
      .table('Sales Team')
      .where('parent')
      .equals(customer.name)
      .toArray()
      .then((x) => x.map(R.pick(['sales_person', 'allocated_percentage']))),
  ]);

  const [
    billing_address_gstin,
    company_gstin,
    tax_category,
  ] = await Promise.all([
    get_gstin(customer_address),
    get_gstin(company_address),
    get_tax_category(customer_address),
  ]);

  const taxes_and_charges = await set_taxes({
    party,
    party_type,
    posting_date,
    company,
    // customer_group = null,
    tax_category,
    billing_address: customer_address,
    shipping_address,
  });

  return {
    customer: party,
    debit_to,

    // upstream: uses Payment Terms Template to get due_date
    due_date: posting_date,

    customer_address,
    billing_address_gstin,

    // upstream: uses Address Template to generate text
    address_display: null,

    // do not use shipping address
    shipping_address_name: null,

    // upstream: uses Address Template to generate text
    shipping_address: null,

    company_address,
    company_gstin,
    tax_category,

    // upstream: uses Address Template to generate text
    company_address_display: null,

    ...contact_details,
    ...price_list_details,

    ...R.pick(
      ['customer_name', 'customer_group', 'territory', 'language'],
      customer
    ),
    ...['sales_partner', 'commission_rate'].reduce(
      (a, x) => ({ ...a, [x]: customer[`default_${x}`] }),
      {}
    ),

    taxes_and_charges,

    // upstream: set by get_pyt_term_template
    // here: assume payment is not deferred
    payment_terms_template: null,

    currency,
    sales_team,

    // upstream: where did this get injected?
    place_of_supply: null,
  };
}

async function get_account(parent, company) {
  const { account } =
    (await db
      .table('Party Account')
      .where('parent')
      .equals(parent)
      .and((x) => x.company === company)
      .first()) || {};

  return account;
}

async function get_currency(party, company) {
  const { default_currency: party_currency } =
    (await db.table('Customer').get(party)) || {};
  if (party_currency) {
    return party_currency;
  }
  const { default_currency: company_currency } =
    (await db.table('Company').get(company)) || {};

  return company_currency;
}

async function get_default_address({
  doctype,
  name,
  sort_key = 'is_primary_address',
}) {
  return get_addresses({ doctype, name, sort_key })
    .then(R.map(R.prop('name')))
    .then(R.head);
}

export async function get_address_tax_category({
  tax_category = null,
  billing_address = null,
  shipping_address = null,
}) {
  const { determine_address_tax_category_from } =
    (await db.settings.get('Accounts Settings')) || {};

  function get_category(address) {
    return db
      .table('Address')
      .get(address)
      .then(R.propOr(tax_category, 'tax_category'));
  }

  if (
    determine_address_tax_category_from === 'Shipping Address' &&
    shipping_address
  ) {
    return get_category(shipping_address);
  }
  if (billing_address) {
    return get_category(billing_address);
  }

  return _tax_category;
}

export async function get_contact_details({ contact }) {
  const doc = (await db.table('Contact').get(contact)) || {};
  if (doc) {
    return {
      contact_person: doc.name,
      contact_display: [doc.salutation, doc.first_name, doc.last_name]
        .filter((x) => !!x)
        .join(' '),
      contact_email: doc.email_id,
      contact_mobile: doc.mobile_no,
      contact_phone: doc.phone,
      contact_designation: doc.designation,
      contact_department: doc.department,
    };
  }
  return null;
}

async function get_party_contact_details(party) {
  const null_contact = {
    contact_person: null,
    contact_display: null,
    contact_email: null,
    contact_mobile: null,
    contact_phone: null,
    contact_designation: null,
    contact_department: null,
  };
  const links = await db
    .table('Dynamic Link')
    .where('link_name')
    .equals(party)
    .and((x) => x.link_doctype === 'Customer' && x.parenttype === 'Contact')
    .toArray()
    .then((x) => x.map((y) => y.parent));
  if (links.length === 0) {
    return null_contact;
  }

  const sort_contacts = R.compose(
    R.head,
    R.reverse,
    R.sortBy(R.prop('is_primary_contact'))
  );
  const contact = await db
    .table('Contact')
    .where('name')
    .anyOf(links)
    .toArray()
    .then(sort_contacts);
  if (contact) {
    return get_contact_details({ contact: contact.name });
  }
  return null_contact;
}

function get_gstin(address) {
  return address
    ? db
        .table('Address')
        .get(address)
        .then((x) => x && x.gstin)
    : null;
}
function get_tax_category(address) {
  return address
    ? db
        .table('Address')
        .get(address)
        .then((x) => x.tax_category)
    : null;
}

async function get_price_list_details(party, price_list, pos_profile) {
  const get_details = (pl) =>
    db
      .table('Price List')
      .get(pl)
      .then((x) => ({
        price_list_currency: x.currency,
        selling_price_list: x.name,
      }));
  const { default_price_list: customer_price_list, customer_group } =
    (await db.table('Customer').get(party)) || {};
  if (customer_price_list) {
    return get_details(customer_price_list);
  }
  const { selling_price_list: pos_price_list } =
    (await db.table('POS Profile').get(pos_profile)) || {};
  return get_details(pos_price_list || price_list);
}
