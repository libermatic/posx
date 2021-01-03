import * as R from 'ramda';

import db from '../db';
import { getDescendents } from './utils';

export async function erpnext__selling__page__point_of_sale__point_of_sale__get_items(
  args
) {
  const message = await get_items(args);
  if (message) {
    return { message };
  }
}

async function get_items({
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

// import * as R from 'ramda';

// import db from '../../db';
// import { getDescendents } from '../utils';

// export async function get_items(
//   start,
//   page_length,
//   price_list,
//   item_group,
//   search_value = '',
//   pos_profile = null
// ) {
//   let data = {};

//   const { warehouse = '', display_items_in_stock = 0 } = pos_profile
//     ? await db.table('POS Profile').get(pos_profile)
//     : {};

//   if (search_value) {
//     data = await search_serial_or_batch_or_barcode_number({ search_value });
//   }
//   let item_code = data.item_code ? data.item_code : search_value;
//   let serial_no = data.serial_no ? data.serial_no : '';
//   let batch_no = data.batch_no ? data.batch_no : '';
//   let barcode = data.barcode ? data.barcode : '';

//   const item_groups = await getItemGroups(item_group, pos_profile);

//   const items_data = await db
//     .table('Item')
//     .where('item_group')
//     .anyOf(item_groups)
//     .and(
//       (x) => x.disabled === 0 && x.has_variants === 0 && x.is_sales_item === 1
//     )
//     .offset(start || 0)
//     .limit(page_length)
//     .reverse()
//     .sortBy('idx')
//     .then(
//       R.map((x) => ({
//         ...R.pick(['item_name', 'stock_uom', 'idx', 'is_stock_item'], x),
//         item_code: x.name,
//         item_image: x.image,
//       }))
//     );

//   if (items_data.length > 0) {
//     const items = items_data.map(R.prop('item_code'));
//     const item_prices_data = await db
//       .table('Item Price')
//       .where('item_code')
//       .anyOf(items)
//       .and((x) => x.price_list === price_list)
//       .toArray(R.map(R.pick(['item_code', 'price_list_rate', 'currency'])));

//     console.log(item_prices_data);
//     const item_prices = item_prices_data.reduce(
//       (a, x) => ({ ...a, [x.item_code]: x }, {})
//     );
//     const bin_data = await db.item_stock
//       .where('item_code')
//       .anyOf(items)
//       .toArray();
//     console.log(bin_data);
//   }

//   //   async function makeFilterByInStock() {
//   //     if (!display_items_in_stock) {
//   //       return (x) => true;
//   //     }

//   //     const items_in_stock = await db.item_stock
//   //       .filter((x) => x.qty > 0)
//   //       .and((x) => !warehouse || x.warehouse === warehouse)
//   //       .toArray(R.pluck('item_code'))
//   //       .then((x) => Array.from(new Set(x)));

//   //     return (x) => items_in_stock.includes(x.name);
//   //   }

//   //   async function transformToResult(item) {
//   //     const { name: item_code, image: item_image } = item;
//   //     const [{ price_list_rate, currency } = {}, actual_qty] = await Promise.all([
//   //       db
//   //         .table('Item Price')
//   //         .where('item_code')
//   //         .equals(item_code)
//   //         .and((x) => x.price_list === price_list)
//   //         .first(),
//   //       db.item_stock
//   //         .where('item_code')
//   //         .equals(item_code)
//   //         .and((x) => !warehouse || x.warehouse === warehouse)
//   //         .toArray(R.pluck('qty'))
//   //         .then(R.sum),
//   //     ]);
//   //     return {
//   //       item_code,
//   //       item_image,
//   //       price_list_rate,
//   //       currency,
//   //       actual_qty,
//   //       ...R.pick(['item_name', 'stock_uom', 'idx', 'is_stock_item'], item),
//   //     };
//   //   }

//   //   const filterByFlags = ({ disabled, has_variants, is_sales_item }) =>
//   //     !disabled && !has_variants && is_sales_item;
//   //   const filterByInStock = await makeFilterByInStock();

//   //   if (search_result.item_code) {
//   //     const items = await db
//   //       .table('Item')
//   //       .where('name')
//   //       .equals(search_result.item_code)
//   //       .and(filterByFlags)
//   //       .and(filterByInStock)
//   //       .toArray((x) => Promise.all(x.map(transformToResult)));
//   //     return {
//   //       items,
//   //       ...R.pick(['barcode', 'serial_no', 'batch_no'], search_result),
//   //     };
//   //   }
//   //   const item_groups = await getItemGroups(item_group);

//   //   const items = await db
//   //     .table('Item')
//   //     .where('item_group')
//   //     .anyOf(item_groups)
//   //     .and((x) => !x.disabled && !x.has_variants && x.is_sales_item)
//   //     .and(
//   //       (x) =>
//   //         !search_value ||
//   //         x.name.toLowerCase().includes(search_value.toLowerCase()) ||
//   //         x.item_name.toLowerCase().includes(search_value.toLowerCase())
//   //     )
//   //     .and(filterByFlags)
//   //     .and(filterByInStock)
//   //     .offset(start || 0)
//   //     .limit(page_length)
//   //     .toArray((x) => Promise.all(x.map(transformToResult)));
//   //   return { items };
// }

// // https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/selling/page/point_of_sale/point_of_sale.py#L137
// async function search_serial_or_batch_or_barcode_number(search_value) {
//   const barcode_data = await db
//     .table('Item Barcode')
//     .where('barcode')
//     .equals(search_value)
//     .first();
//   if (barcode_data) {
//     return { barcode_data: barcode.barcode, item_code: barcode_data.parent };
//   }

//   // not searching by serial_no

//   const batch_no_data = await db.table('Batch').get(search_value);
//   if (batch_no_data) {
//     return { batch_no: batch_no_data.name, item_code: batch_no_data.item };
//   }

//   return {};
// }

// async function getItemGroups(item_group, pos_profile) {
//   const group = item_group
//     ? await db.table('Item Group').get(item_group)
//     : await get_root_of('Item Group');
//   if (!group) {
//     return [];
//   }

//   const groups = await getDescendents('Item Group', group.name);
//   const profileGroups = pos_profile ? await get_item_groups(pos_profile) : [];

//   if (profileGroups.length === 0) {
//     return groups;
//   }

//   return groups.filter((x) => profileGroups.includes(x));
// }

// // https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/setup/utils.py#L11
// async function get_root_of(doctype) {
//   return db
//     .table(doctype)
//     .filter((x) => x.is_group === 1)
//     .toArray((list) => {
//       const min = Math.min(...list.map((x) => x.lft));
//       const max = Math.max(...list.map((x) => x.rgt));
//       return list.find((x) => x.lft === min && x.rgt === max);
//     });
// }

// // https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/pos_profile/pos_profile.py#L103
// async function get_item_groups(pos_profile) {
//   const groups = await db
//     .table('POS Item Group')
//     .where({ parent: pos_profile })
//     .toArray(R.map(R.prop('item_group')));

//   const descendents = await Promise.all(
//     groups.map((x) => getDescendents('Item Group', x))
//   );

//   return Array.from(new Set(descendents.flat()));
// }
