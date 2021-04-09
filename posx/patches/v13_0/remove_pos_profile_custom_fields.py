from __future__ import unicode_literals
import frappe


def execute():
    custom_fields = [
        "POS Profile-px_use_batch_price",
        "POS Profile-px_use_cart_ext",
        "POS Profile-px_hide_modal",
        "POS Profile-px_use_local_draft",
        "POS Profile-px_hide_numpads",
        "POS Profile-px_can_edit_desc",
        "POS Profile-px_use_local_datastore",
        "POS Profile-px_theme",
        "POS Profile-px_disabled_write_off",
        "POS Profile-px_enable_xz_report",
    ]

    for fieldname in custom_fields:
        frappe.delete_doc_if_exists("Custom Field", fieldname)
