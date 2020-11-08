import { apply_pricing_rule } from './pricing_rule';

export async function erpnext__accounts__doctype__pricing_rule__pricing_rule__apply_pricing_rule({
  args,
  doc = null,
}) {
  const message = await apply_pricing_rule(args, doc);
  if (message) {
    return { message };
  }
}
