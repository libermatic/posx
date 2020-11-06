import { apply_price_list } from './get_item_details';

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/stock/get_item_details.py#L904
export async function erpnext__stock__get_item_details__apply_price_list({
  args,
  as_doc = false,
}) {
  const message = await apply_price_list(args, as_doc);
  if (message) {
    return { message };
  }
}

export async function erpnext__stock__get_item_details__get_item_details({
  args,
  doc = null,
  for_validate = false,
  overwrite_warehouse = true,
}) {}

export async function erpnext__stock__get_item_details__get_item_tax_info({
  company,
  tax_category,
  item_codes,
}) {}
