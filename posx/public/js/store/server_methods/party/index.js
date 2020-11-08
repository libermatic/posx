import {
  get_party_account,
  get_party_details,
  get_address_tax_category,
  get_contact_details,
} from './party';

export async function erpnext__accounts__party__get_party_account(args) {
  const message = await get_party_account(args);
  if (message) {
    return { message };
  }
}

export async function erpnext__accounts__party__get_party_details(args) {
  const message = await get_party_details(args);
  if (message) {
    return { message };
  }
}

export async function erpnext__accounts__party__get_address_tax_category(args) {
  const message = await get_address_tax_category(args);
  return { message };
}

export async function frappe__contacts__doctype__contact__contact__get_contact_details(
  args
) {
  const message = await get_contact_details(args);
  if (message) {
    return { message };
  }
}
