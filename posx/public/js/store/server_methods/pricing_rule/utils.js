import db from '../../db';

export function snakeCase(text) {
  return text.toLowerCase().replace(' ', '_');
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/pricing_rule/utils.py#L480
export async function get_applied_pricing_rules({ pricing_rules }) {
  if (!pricing_rules) {
    return [];
  }
  if (pricing_rules.startsWith('[')) {
    return JSON.parse(pricing_rules);
  }
  return pricing_rules.split(',');
}

// https://github.com/frappe/erpnext/blob/f7f8f5c305aa9481c9b142245eadb1b67eaebb9a/erpnext/accounts/doctype/pricing_rule/utils.py#L536
export async function get_pricing_rule_items(pr_doc) {
  let apply_on_data = [];
  const apply_on = snakeCase(pr_doc.apply_on);

  const children = await db
    .table(`Pricing Rule ${pr_doc.apply_on}`)
    .where('parent')
    .equals(pr_doc.name)
    .toArray();

  for (let row of children) {
    if (apply_on === 'item_group') {
      const descendents = await getDescendents('Item Group', row[apply_on]);
      apply_on_data = [...apply_on_data, ...descendents];
    } else {
      apply_on_data = [...apply_on_data, row[apply_on]];
    }
  }

  if (pr_doc.apply_rule_on_other) {
    const other_apply_on = snakeCase(pr_doc.apply_rule_on_other);
    apply_on_data = [...apply_on_data, pr_doc[`other_${other_apply_on}`]];
  }

  return Array.from(new Set(apply_on_data));
}

async function getDescendents(doctype, name) {
  const { lft, rgt } = await db.table(doctype).get(name);
  return db
    .table(doctype)
    .filter((x) => x.lft >= lft && x.rgt <= rgt)
    .toArray()
    .then(R.map(R.prop('name')));
}
