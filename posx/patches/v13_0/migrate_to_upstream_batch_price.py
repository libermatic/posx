import frappe
from posx.doc_events.purchase_receipt import _create_batch_price


def execute():
    batches_with_price = frappe.get_all(
        "Batch",
        filters={"px_price_list_rate": (">", 0)},
        fields=["name", "item", "px_price_list_rate"],
        as_list=1,
    )

    price_list = frappe.db.get_single_value(
        "Selling Settings", "selling_price_list"
    ) or frappe.db.get_value("Price List", frappe._("Standard Selling"))
    posting_date = frappe.utils.today()

    for batch_no, item_code, price_list_rate in batches_with_price:
        _create_batch_price(
            price_list, posting_date, item_code, price_list_rate, batch_no
        )

    frappe.delete_doc_if_exists("Custom Field", "Batch-px_price_list_rate")
