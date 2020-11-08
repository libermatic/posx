import * as R from 'ramda';

import { MandatoryEntityNotFound } from '../../../utils/exceptions';
import db from '../../db';
import { get_pos_profile } from '../get_item_details/get_item_details';
import { get_party_account } from '../party/party';
import { set_taxes } from './accounts_controller';
import {
  set_missing_lead_customer_details,
  set_price_list_and_item_details,
} from './selling_controller';

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/sales_invoice/sales_invoice.py#L393
export default async function set_missing_values(_self, for_validate = false) {
  let doc = JSON.parse(_self);
  if (doc.doctype !== 'Sales Invoice') {
    return;
  }

  const [_doc, pos] = await set_pos_fields(doc, for_validate);
  doc = _doc;

  if (!doc.debit_to) {
    doc.debit_to = await get_party_account({
      party_type: 'Customer',
      party: doc.customer,
      company: doc.company,
    });
    if (!doc.debit_to) {
      throw new MandatoryEntityNotFound(
        'set_missing_values: debit_to is empty'
      );
    }
    doc.party_account_currency = await db
      .table('Account')
      .get(doc.debit_to)
      .then((x) => x && x.account_currency);
  }
  if (!doc.due_date && doc.customer) {
    doc.due_date = doc.posting_date;
  }

  doc = await set_missing_lead_customer_details(doc, for_validate);
  doc = await set_price_list_and_item_details(doc, for_validate);

  const print_format = (pos && pos.print_format_for_online) || 'POS Invoice';

  return [
    doc,
    pos && {
      print_format,
      allow_edit_rate: pos.allow_user_to_edit_rate,
      allow_edit_discount: pos.allow_user_to_edit_discount,
      campaign: pos.campaign,
    },
  ];
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/sales_invoice/sales_invoice.py#L393
async function set_pos_fields(self, for_validate = false) {
  if (!self.is_pos) {
    return;
  }

  let doc = R.clone(self);
  if (!doc.pos_profile) {
    const pos_profile = (await get_pos_profile(doc.company)) || {};
    doc.pos_profile = pos_profile.name;
  }

  let pos = {};
  if (doc.pos_profile) {
    pos = await db
      .table('POS Profile')
      .get(doc.pos_profile)
      .then(async function (x) {
        if (x) {
          const payments = await db
            .table('Sales Invoice Payment')
            .where({ parent: x.name, parenttype: 'POS Profile' })
            .toArray();
          return { ...x, payments };
        }
      });
  }

  if (!doc.payments || doc.payments.length === 0 || !for_validate) {
    doc.payments = [];
    doc = await update_multi_mode_option(doc, pos);
  }
  if (!doc.account_for_change_amount) {
    doc.account_for_change_amount = await db
      .table('Company')
      .get(doc.company)
      .then((x) => x && x.default_cash_account);
  }
  if (pos && !R.isEmpty(pos)) {
    doc.allow_print_before_pay = pos.allow_print_before_pay;
    if (!for_validate) {
      doc.tax_category = pos.tax_category;
    }
    if (!for_validate && !doc.customer) {
      doc.customer = pos.customer;
    }
    doc.ignore_pricing_rule = pos.ignore_pricing_rule;
    if (pos.account_for_change_amount) {
      doc.account_for_change_amount = pos.account_for_change_amount;
    }

    for (const fieldname of [
      'territory',
      'naming_series',
      'currency',
      'letter_head',
      'tc_name',
      'company',
      'select_print_heading',
      'cash_bank_account',
      'write_off_account',
      'taxes_and_charges',
      'write_off_cost_center',
      'apply_discount_on',
      'cost_center',
    ]) {
      if (!for_validate || (for_validate && !doc[fieldname])) {
        doc[fieldname] = pos[fieldname];
      }
    }
    if (pos.company_address) {
      doc.company_address = pos.company_address;
    }

    const selling_price_list = await get_selling_price_list(doc.customer, pos);
    if (selling_price_list) {
      doc.selling_price_list = selling_price_list;
    }

    if (!for_validate) {
      doc.update_stock = pos.update_stock;
    }

    for (const item of doc.items) {
      if (item.item_code) {
        const profile_details = await get_pos_profile_item_details(
          doc.company,
          item,
          pos
        );
        for (const fname in profile_details) {
          if (!for_validate || (!for_validate && !item[fname])) {
            item[fname] = profile_details[fname];
          }
        }
      }
    }

    if (doc.tc_name && !doc.terms) {
      doc.terms = await db
        .table('Terms and Conditions')
        .get(doc.tc_name)
        .then((x) => x && x.terms);
    }
    if (doc.taxes_and_charges && (!doc.taxes || doc.taxes.length === 0)) {
      doc.taxes = [];
      doc = await set_taxes(doc);
    }
  }
  return [doc, pos];
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/sales_invoice/pos.py#L132
async function update_multi_mode_option(_doc, pos_profile) {
  const doc = R.clone(_doc);

  const makePaymentRow = R.compose(
    R.mergeLeft({
      parent: doc.name,
      parentfield: 'payments',
      parenttype: doc.doctype,
    }),
    R.omit(['name'])
  );

  if (
    !pos_profile ||
    !pos_profile.payments ||
    pos_profile.payments.length === 0
  ) {
    const mopas = await db
      .table('Mode of Payment Account')
      .filter((x) => x.company === doc.company)
      .toArray();
    const mops =
      mopas.length > 0
        ? await db
            .table('Mode of Payment')
            .filter(
              (x) => mopas.map(R.prop('parent')).includes(x.name) && x.enabled
            )
            .toArray()
        : [];

    for (const payment of mopas) {
      const mop = mops.find((x) => x.name === payment.parent);
      if (mop) {
        const payment_mode = {
          mode_of_payment: payment.parent,
          account: payment.default_account,
          type: mop.type,
        };
        doc.payments = [...doc.payments, makePaymentRow(payment_mode)];
      }
    }
    return doc;
  }

  for (const payment_mode of pos_profile.payments) {
    doc.payments = [...doc.payments, makePaymentRow(payment_mode)];
  }
  return doc;
}

async function get_selling_price_list(customer, pos_profile) {
  if (!customer) {
    return pos_profile.selling_price_list;
  }

  const { default_price_list: customer_pl, customer_group } =
    (await db.table('Customer').get(customer)) || {};
  if (customer_pl) {
    return customer_pl;
  }

  if (customer_group) {
    const { default_price_list: group_pl } =
      (await db.table('Customer Group').get(customer_group)) || {};
    if (group_pl) {
      return group_pl;
    }
  }

  return pos_profile.selling_price_list;
}
