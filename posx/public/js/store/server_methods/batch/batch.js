import * as R from 'ramda';

import db from '../../db';
import logger from '../../../utils/logger';
import { UnableToSelectBatchError } from '../../../utils/exceptions.js';
import get_price_list_rate from '../get_item_details/get_price_list_rate';
import { get_company_currency, get_conversion_factor } from '../utils';

export async function get_batch_no(
  item_code,
  warehouse,
  qty = 1,
  _throw = false,
  serial_no = null
) {
  if (serial_no) {
    logger('get_batch_no: delegate queries with serial_no to network');
    return;
  }

  const batch_no = await db
    .table('Batch')
    .where('item')
    .equals(item_code)
    .and((x) => !x.expiry_date || new Date(x.expiry_date) >= new Date())
    .sortBy('expiry_date')
    .then((x) =>
      Promise.all(
        x.map(({ name: batch_no }) =>
          db.batch_stock
            .where({ batch_no, warehouse })
            .and((x) => x.qty >= qty)
            .first()
        )
      )
    )
    .then(R.compose(R.prop('batch_no'), R.head, R.filter(R.identity)));

  if (!batch_no) {
    throw new UnableToSelectBatchError(
      `Please select a Batch for Item ${item_code}. ` +
        `Unable to find a single batch that fulfills this requirement`
    );
  }

  return batch_no;
}

export async function get_batch_qty(
  batch_no,
  warehouse,
  item_code,
  customer,
  price_list,
  transaction_date,
  company
) {
  const [
    { qty: available_qty = 0 } = {},
    batch_price_list_rate,
  ] = await Promise.all([
    db.batch_stock.where({ batch_no, warehouse }).first(),
    get_batch_price({
      batch_no,
      item_code,
      customer,
      price_list,
      transaction_date,
      company,
    }),
  ]);
  return { available_qty, batch_price_list_rate };
}

export async function get_batch_qty_and_serial_no(
  batch_no,
  stock_qty,
  warehouse,
  item_code,
  has_serial_no
) {
  if (Boolean(Number(has_serial_no))) {
    logger(
      'get_batch_qty_and_serial_no: delegate queries with serial_no to network'
    );
    return;
  }
  const { qty: actual_batch_qty } = await db.batch_stock
    .where({
      batch_no,
      warehouse,
    })
    .first();
  return { actual_batch_qty };
}

export async function get_batch_price({
  batch_no,
  item_code,
  customer,
  price_list,
  qty = 1,
  transaction_date,
  uom: _uom,
  company,
}) {
  const { px_price_list_rate } = (await db.table('Batch').get(batch_no)) || {};
  if (px_price_list_rate) {
    return px_price_list_rate;
  }

  const [item, currency] = await Promise.all([
    db.table('Item').get(item_code),
    get_company_currency(company),
  ]);
  const uom = _uom || item.stock_uom;

  const [
    { conversion_factor },

    // price_not_uom_dependent: used in get_item_details
    // price_list_uom_dependant: is the field in Price List
    { price_not_uom_dependent: price_list_uom_dependant } = {},
  ] = await Promise.all([
    get_conversion_factor(item_code, uom),
    db.table('Price List').get(price_list),
  ]);

  const { price_list_rate } = await get_price_list_rate(
    {
      item_code,
      customer,
      price_list,
      price_list_uom_dependant,
      transaction_date,
      qty,
      uom,
      stock_uom: item.stock_uom,
      conversion_factor,
      company,
      currency,
    },
    item
  );
  return price_list_rate;
}
