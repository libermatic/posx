import * as R from 'ramda';

import db from '../../db';
import { getDescendents } from '../utils';

export async function get_items({
  start,
  page_length,
  price_list,
  item_group,
  search_value = '',
  pos_profile = null,
}) {
  const [
    { warehouse = '', display_items_in_stock = 0 } = {},
    search_result,
  ] = await Promise.all([
    pos_profile ? db.table('POS Profile').get(pos_profile) : {},
    search_serial_or_batch_or_barcode_number({ search_value }),
  ]);

  async function makeFilterByInStock() {
    if (!display_items_in_stock) {
      return (x) => true;
    }

    const items_in_stock = await db.item_stock
      .filter((x) => x.qty > 0)
      .and((x) => !warehouse || x.warehouse === warehouse)
      .toArray(R.pluck('item_code'))
      .then((x) => Array.from(new Set(x)));

    return (x) => items_in_stock.includes(x.name);
  }

  async function transformToResult(item) {
    const { name: item_code, image: item_image } = item;
    const [{ price_list_rate, currency } = {}, actual_qty] = await Promise.all([
      db
        .table('Item Price')
        .where('item_code')
        .equals(item_code)
        .and((x) => x.price_list === price_list)
        .first(),
      db.item_stock
        .where('item_code')
        .equals(item_code)
        .and((x) => !warehouse || x.warehouse === warehouse)
        .toArray(R.pluck('qty'))
        .then(R.sum),
    ]);
    return {
      item_code,
      item_image,
      price_list_rate,
      currency,
      actual_qty,
      ...R.pick(['item_name', 'stock_uom', 'idx', 'is_stock_item'], item),
    };
  }

  const filterByFlags = ({ disabled, has_variants, is_sales_item }) =>
    !disabled && !has_variants && is_sales_item;
  const filterByInStock = await makeFilterByInStock();

  if (search_result.item_code) {
    const items = await db
      .table('Item')
      .where('name')
      .equals(search_result.item_code)
      .and(filterByFlags)
      .and(filterByInStock)
      .toArray((x) => Promise.all(x.map(transformToResult)));
    return {
      items,
      ...R.pick(['barcode', 'serial_no', 'batch_no'], search_result),
    };
  }
  const item_groups = await getItemGroups(item_group);

  const items = await db
    .table('Item')
    .where('item_group')
    .anyOf(item_groups)
    .and((x) => !x.disabled && !x.has_variants && x.is_sales_item)
    .and(
      (x) =>
        !search_value ||
        x.name.toLowerCase().includes(search_value.toLowerCase()) ||
        x.item_name.toLowerCase().includes(search_value.toLowerCase())
    )
    .and(filterByFlags)
    .and(filterByInStock)
    .offset(start || 0)
    .limit(page_length)
    .toArray((x) => Promise.all(x.map(transformToResult)));
  return { items };
}

async function search_serial_or_batch_or_barcode_number({ search_value }) {
  const barcode = await db
    .table('Item Barcode')
    .where('barcode')
    .equals(search_value)
    .first();
  if (barcode) {
    return { barcode: barcode.barcode, item_code: barcode.parent };
  }

  // not searching by serial_no

  const batch = await db.table('Batch').get(search_value);
  if (batch) {
    return { batch_no: batch.name, item_code: batch.item };
  }

  return {};
}

async function getItemGroups(item_group) {
  const { name } =
    (await db.table('Item Group').get(item_group)) ||
    (await db
      .table('Item Group')
      .filter((x) => x.is_group === 1)
      .toArray((list) => {
        const min = Math.min(...list.map((x) => x.lft));
        const max = Math.max(...list.map((x) => x.rgt));
        return list.find((x) => x.lft === min && x.rgt === max);
      })) ||
    {};
  if (!name) {
    return [];
  }
  return getDescendents('Item Group', name);
}
