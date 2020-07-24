import * as R from 'ramda';

import db from '../db';
import { get_filters } from './utils';

export async function frappe__desk__search__search_link({
  doctype,
  txt,
  query = null,
  filters = null,
  page_length = 20,
  searchfield = null,
  reference_doctype = null,
  ignore_user_permissions = false,
}) {
  if (
    doctype === 'Customer' &&
    query === 'erpnext.controllers.queries.customer_query'
  ) {
    return customer_query({ txt, page_length, filters });
  }
  if (
    doctype === 'Item Group' &&
    query ===
      'erpnext.selling.page.point_of_sale.point_of_sale.item_group_query'
  ) {
    return item_group_query({ txt, page_length, filters });
  }
  if (
    doctype === 'Batch' &&
    [
      'erpnext.controllers.queries.get_batch_no',
      'posx.api.queries.get_batch_no',
    ].includes(query)
  ) {
    return batch_query({ txt, page_length, filters });
  }
}

async function customer_query({ txt = '', page_length, filters }) {
  const fields = [
    'customer_name',
    'customer_group',
    'territory',
    'mobile_no',
    'primary_address',
  ];
  const _txt = txt.toLowerCase();
  const results = await db
    .table('Customer')
    .filter(
      (x) =>
        !_txt ||
        ['name', ...fields].some(
          (field) => x[field] && x[field].toLowerCase().includes(_txt)
        )
    )
    .limit(page_length)
    .toArray();
  if (results.length > 0) {
    return {
      results: results.map((x) => ({
        value: x.name,
        description: fields
          .map((f) => x[f])
          .filter((f) => !!f)
          .join(', '),
      })),
    };
  }
}

async function item_group_query({ txt = '', page_length, filters: _filters }) {
  const { filters: { pos_profile } = {} } = get_filters(_filters);
  const _txt = txt.toLowerCase();

  function make_result(results) {
    return {
      results: results.map((x) => ({
        value: x.name,
        description: '',
      })),
    };
  }

  function search_txt(item) {
    return !txt || item.name.toLowerCase().includes(_txt);
  }

  if (pos_profile) {
    const item_groups = await db
      .table('POS Item Group')
      .where('parent')
      .equals(pos_profile)
      .toArray()
      .then((a) => a.map((x) => x.item_group));
    if (item_groups.length > 0) {
      const results = await db
        .table('Item Group')
        .where('name')
        .anyOf(item_groups)
        .and(search_txt)
        .limit(page_length)
        .toArray();
      return make_result(results);
    }
  }

  const results = await db
    .table('Item Group')
    .filter(search_txt)
    .limit(page_length)
    .toArray();
  return make_result(results);
}

async function batch_query({ txt = '', page_length, filters: _filters }) {
  const { filters: { item_code, warehouse, posting_date } = {} } = get_filters(
    _filters
  );

  function search_txt(item) {
    const fields = [
      'name',
      'manufacturing_date',
      'expiry_date',
      'px_price_list_rate',
    ];
    const _txt = txt.toLowerCase();
    return (
      !_txt ||
      ['name', ...fields].some(
        (field) => item[field] && item[field].toLowerCase().includes(_txt)
      )
    );
  }

  function make_result(results) {
    const get_description = R.compose(R.join(', '), R.filter(R.identity));
    return {
      results: results.map((x) => ({
        value: x.name,
        description: get_description([
          x.qty,
          x.stock_uom,
          x.manufacturing_date && `MFG-${x.manufacturing_date}`,
          x.expiry_date && `EXP-${x.expiry_date}`,
          x.px_price_list_rate && `PRICE-${x.px_price_list_rate}`,
        ]),
      })),
    };
  }

  const collection = db
    .table('Batch')
    .where('item')
    .equals(item_code)
    .and((x) => !x.disabled)
    .and(search_txt)
    .and(
      (x) =>
        !posting_date ||
        !x.expiry_date ||
        new Date(x.expiry_date) >= new Date(posting_date)
    );

  if (!warehouse) {
    return collection
      .limit(page_length)
      .sortBy('expiry_date')
      .then(make_result);
  }

  return collection
    .sortBy('expiry_date')
    .then((x) =>
      Promise.all(
        x.map(async function (batch) {
          const { qty = 0 } = await db.batch_stock
            .where({
              batch_no: batch.name,
              warehouse,
            })
            .first();
          return { ...batch, qty };
        })
      )
    )
    .then(
      R.compose(
        R.slice(0, page_length),
        R.filter((x) => x.qty > 0)
      )
    )
    .then(make_result);
}
