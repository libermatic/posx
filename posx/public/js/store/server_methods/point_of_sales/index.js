import { get_items } from './point_of_sales';

export async function erpnext__selling__page__point_of_sale__point_of_sale__get_items({
  start,
  page_length,
  price_list,
  item_group,
  search_value = '',
  pos_profile = null,
}) {
  const message = await get_items(
    Number(start),
    Number(page_length),
    price_list,
    item_group,
    search_value,
    pos_profile
  );
  if (message) {
    return { message };
  }
}
