import { apply_price_list, get_item_details } from './get_item_details';

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
}) {
  const message = await get_item_details(
    args,
    doc,
    for_validate,
    overwrite_warehouse
  );
  if (message) {
    return { message };
  }
}

export async function erpnext__stock__get_item_details__get_item_tax_info({
  company,
  tax_category,
  item_codes,
}) {}
