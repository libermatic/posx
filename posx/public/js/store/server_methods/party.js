import * as R from 'ramda';
import db from '../db';

export async function erpnext__accounts__party__get_party_account(args) {
  const message = await get_party_account(args);
  if (message) {
    return { message };
  }
}

export async function erpnext__accounts__party__get_party_details(args) {
  const message = await get_party_details(args);
  if (message) {
    return { message };
  }
}

async function get_party_account({ party_type, party, company }) {
  if (party_type !== 'Customer') {
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

async function get_party_details({
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
    get_contact_details(party),
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

    // upstream: set by setup_taxes which in turn search in Tax Rule
    taxes_and_charges: null,

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
  if (!['is_shipping_address', 'is_primary_address'].includes(sort_key)) {
    return null;
  }

  const links = await db
    .table('Dynamic Link')
    .where('link_name')
    .equals(name)
    .and((x) => x.link_doctype === doctype)
    .toArray()
    .then((x) => x.map((y) => y.parent));
  if (links.length === 0) {
    return null;
  }

  const sort_addresses = R.compose(
    R.head,
    R.reverse,
    R.sortBy(R.prop(sort_key))
  );
  const address = await db
    .table('Address')
    .where('name')
    .anyOf(links)
    .toArray()
    .then(sort_addresses);
  if (address) {
    return address.name;
  }
  return null;
}

async function get_contact_details(party) {
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
    .and((x) => x.link_doctype === 'Customer')
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
    return {
      contact_person: contact.name,
      contact_display: [
        contact.salutation,
        contact.first_name,
        contact.last_name,
      ]
        .filter((x) => !!x)
        .join(' '),
      contact_email: contact.email_id,
      contact_mobile: contact.mobile_no,
      contact_phone: contact.phone,
      contact_designation: contact.designation,
      contact_department: contact.department,
    };
  }
  return null_contact;
}

function get_gstin(address) {
  return address
    ? db
        .table('Address')
        .get(address)
        .then((x) => x.gstin)
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
