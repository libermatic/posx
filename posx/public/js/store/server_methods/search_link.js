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

  console.log('doctype: ', typeof doctype, '>', doctype);
  console.log('txt: ', typeof txt, '>', txt);
  console.log('query: ', typeof query, '>', query);
  console.log('filters: ', typeof filters, '>', filters);
  console.log('page_length: ', typeof page_length, '>', page_length);
  console.log('searchfield: ', typeof searchfield, '>', searchfield);
  console.log(
    'reference_doctype: ',
    typeof reference_doctype,
    '>',
    reference_doctype
  );
  console.log(
    'ignore_user_permissions: ',
    typeof ignore_user_permissions,
    '>',
    ignore_user_permissions
  );
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
