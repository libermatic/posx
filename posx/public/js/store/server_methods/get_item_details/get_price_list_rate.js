import * as R from 'ramda';

import db from '../../db';
import {
  UnsupportedFeatureError,
  ValidationError,
} from '../../../utils/exceptions.js';
import { get_price_list_details, get_company_currency } from '../utils';

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L554
export default async function get_price_list_rate(_args, item_doc, _out) {
  const pl_details = await get_price_list_currency_and_exchange_rate(_args);

  let args = { ...R.clone(_args), ...pl_details };
  args = await validate_conversion_rate(args);
  let price_list_rate = await get_price_list_rate_for(args, item_doc.name);

  if (!price_list_rate && item_doc.variant_of) {
    price_list_rate = await get_price_list_rate_for(args, item_doc.variant_of);
  }

  return {
    ...R.clone(_out),
    price_list_rate:
      ((price_list_rate || 0) * args.plc_conversion_rate) /
      args.conversion_rate,
  };

  // do not handle buying transactions
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L970
export async function get_price_list_currency_and_exchange_rate(_args) {
  if (!_args.price_list) {
    return {};
  }

  const args = { ..._args, exchange_rate: 'for_selling' };
  const price_list_details = await get_price_list_details(args.price_list);

  const price_list_currency = price_list_details.currency;
  const price_list_uom_dependant = price_list_details.price_not_uom_dependant
    ? 0
    : 1;
  const plc_conversion_rate = args.plc_conversion_rate || 1;

  if (
    !plc_conversion_rate ||
    (price_list_currency &&
      args.price_list_currency &&
      price_list_currency != args.price_list_currency)
  ) {
    // get_exchange_rate not implemented
    throw new UnsupportedFeatureError(
      'get_price_list_currency_and_exchange_rate: Multiple currencies not supported'
    );
  }

  return {
    price_list_currency,
    price_list_uom_dependant,
    plc_conversion_rate,
  };
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L707
export async function validate_conversion_rate(_args, meta) {
  let args = R.clone(_args);
  const default_currency = await get_company_currency(args.company);
  if (!args.conversion_rate && args.currency === default_currency) {
    args.conversion_rate = 1;
  }
  if (args.price_list) {
    const { price_list_currency } = await db
      .table('Price List')
      .get(args.price_list);
    if (
      !args.plc_conversion_rate &&
      args.price_list_currency === price_list_currency
    ) {
      args.plc_conversion_rate = 1.0;
    }

    if (!args.price_list_currency) {
      throw new ValidationError('Price List Currency not selected');
    }
  }

  return args;
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L642
async function get_price_list_rate_for(args, item_code) {
  let item_price_args = {
    ...R.pick(
      ['price_list', 'customer', 'supplier', 'uom', 'transaction_date'],
      args
    ),
    item_code,
  };

  let item_price_data = [];
  const price_list_rate = await get_item_price(item_price_args, item_code);
  if (price_list_rate.length > 0) {
    if (args.qty) {
      const valid_packing = await check_packing_list(
        price_list_rate[0][0],
        args.qty,
        item_code
      );
      if (valid_packing) {
        item_price_data = price_list_rate;
      }
    }
  } else {
    item_price_args = R.omit(['customer', 'supplier'], item_price_args);
    let general_price_list_rate = await get_item_price(
      item_price_args,
      item_code,
      args.ignore_party
    );
    if (general_price_list_rate.length === 0 && args.uom !== args.stock_uom) {
      item_price_args.uom = args.stock_uom;
      general_price_list_rate = await get_item_price(
        item_price_args,
        item_code,
        args.ignore_party
      );
      if (general_price_list_rate.length > 0) {
        item_price_data = general_price_list_rate;
      }
    }
  }

  if (item_price_data.length > 0) {
    if (item_price_data[0][2] === args.uom) {
      return item_price_data[0][1];
    } else if (args.price_list_uom_dependant) {
      return item_price_data[0][1] * (args.conversion_factor || 1);
    } else {
      return item_price_data[0][1];
    }
  }
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L611
async function get_item_price(args, item_code, ignore_party = false) {
  return db
    .table('Item Price')
    .where('item_code')
    .equals(item_code)
    .and((x) => x.price_list === args.price_list)
    .and((x) => !x.uom || x.uom === args.uom)
    .and((x) => (ignore_party ? x.customer === args.customer : !x.customer))
    .and(
      (x) =>
        !args.transaction_date ||
        (new Date(x.valid_from || '2000-01-01') <=
          new Date(args.transaction_date) &&
          new Date(args.transaction_date) <=
            new Date(x.valid_upto || '2500-12-31'))
    )
    .toArray(
      R.map(({ name, price_list_rate, uom }) => [name, price_list_rate, uom])
    );
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L688
async function check_packing_list(
  price_list_rate_name,
  desired_qty,
  _item_code
) {
  const { packing_unit } =
    (await db.table('Item Price').get(price_list_rate_name)) || {};
  if (packing_unit) {
    return desired_qty % packing_unit === 0;
  }
  return true;
}
