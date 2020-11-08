import * as R from 'ramda';

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/pricing_rule/utils.py#L528
export function apply_pricing_rule_for_free_items(
  _doc,
  pricing_rule_args,
  _set_missing_values = false
) {
  const doc = R.clone(_doc);
  if (pricing_rule_args.item_doc) {
    const items = doc.items
      .filter(
        (d) => d.item_code === pricing_rule_args.item_code && d.is_free_item
      )
      .map((d) => d.item_code);
    if (items.length === 0) {
      doc.items = [...doc.items, pricing_rule_args];
    }
  }
  return doc;
}
