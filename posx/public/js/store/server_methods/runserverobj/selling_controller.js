import * as R from 'ramda';

import db from '../../db';
import { get_party_details } from '../party/party';
import { get_taxes_and_charges } from '../taxes_and_charges';
import {
  set_missing_item_details,
  set_price_list_currency,
} from './accounts_controller';

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/controllers/selling_controller.py#L60
export async function set_missing_lead_customer_details(_doc, for_validate) {
  let doc = R.clone(_doc);
  if (doc.customer) {
    const party_details = await get_party_details({
      party: doc.customer,
      party_type: 'Customer',
      company: doc.company,
      posting_date: doc.posting_date,
      price_list: doc.selling_price_list,
      doctype: doc.doctype,
      party_address: doc.customer_address,
      shipping_address: doc.shipping_address_name,
      pos_profile: doc.pos_profile,
    });
    doc = R.mergeWith((x, y) => x || y, doc, party_details);
  }

  if (
    doc.taxes_and_charges &&
    (!doc.taxes || doc.taxes.length === 0) &&
    !for_validate
  ) {
    const taxes = await get_taxes_and_charges(
      'Sales Taxes and Charges Template',
      self.taxes_and_charges
    );
    doc.taxes = [...(doc.taxes || []), ...taxes];
  }

  return doc;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/controllers/selling_controller.py#L102
export async function set_price_list_and_item_details(_doc, for_validate) {
  let doc = R.clone(_doc);
  doc = await set_price_list_currency(doc, 'Selling');
  doc = await set_missing_item_details(doc, for_validate);
  return doc;
}
