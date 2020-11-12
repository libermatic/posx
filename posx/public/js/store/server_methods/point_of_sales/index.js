import { get_items } from './point_of_sales';

export async function erpnext__selling__page__point_of_sale__point_of_sale__get_items(
  args
) {
  const message = await get_items(args);
  if (message) {
    return { message };
  }
}
