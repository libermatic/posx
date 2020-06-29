# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe
from toolz.curried import compose, excepts, first, map, filter


def before_validate(doc, method):
    if doc._action == "submit":
        set_or_create_batch(doc, method)


def set_or_create_batch(doc, method):
    def set_existing_batch(item):
        has_batch_no, has_expiry_date = frappe.get_cached_value(
            "Item", item.item_code, ["has_batch_no", "has_expiry_date"]
        )
        if not has_batch_no or not has_expiry_date:
            return

        if item.px_mfg_date:
            item.batch_no = frappe.db.exists(
                "Batch",
                {"item": item.item_code, "manufacturing_date": item.px_mfg_date},
            )
        elif item.px_exp_date:
            item.batch_no = frappe.db.exists(
                "Batch", {"item": item.item_code, "expiry_date": item.px_exp_date},
            )

    get_batch_in_previous_items = compose(
        lambda x: x.get("batch_no"),
        excepts(StopIteration, first, lambda _: {}),
        lambda x: filter(
            lambda item: item.idx < x.idx
            and item.item_code == x.item_code
            and (
                item.px_mfg_date == x.px_mfg_date or item.px_exp_date == x.px_exp_date
            ),
            doc.items,
        ),
    )

    def create_new_batch(item):
        warehouse = "t_warehouse" if doc.doctype == "Stock Entry" else "warehouse"
        if not item.get(warehouse) or item.batch_no:
            return
        has_batch_no, create_new_batch, has_expiry_date = frappe.get_cached_value(
            "Item",
            item.item_code,
            ["has_batch_no", "create_new_batch", "has_expiry_date"],
        )
        if not has_batch_no or not create_new_batch or not has_expiry_date:
            return

        batch_in_items = get_batch_in_previous_items(item)
        if batch_in_items:
            item.batch_no = batch_in_items
        else:
            shelf_life_in_days = frappe.get_cached_value(
                "Item", item.item_code, "shelf_life_in_days",
            )
            batch = frappe.get_doc(
                {
                    "doctype": "Batch",
                    "item": item.item_code,
                    "manufacturing_date": _get_mfg_date(
                        item.px_mfg_date, item.px_exp_date, shelf_life_in_days
                    ),
                    "expiry_date": item.px_exp_date,
                    "supplier": doc.supplier,
                    "reference_doctype": doc.doctype,
                    "reference_name": doc.name,
                }
            ).insert()
            item.batch_no = batch.name

    for item in doc.items:
        if not item.batch_no:
            set_existing_batch(item)
    for item in doc.items:
        warehouse = "t_warehouse" if doc.doctype == "Stock Entry" else "warehouse"
        if item.get(warehouse) and not item.batch_no:
            create_new_batch(item)


def _get_mfg_date(mfg_date, exp_date, shelf_life):
    if not mfg_date and exp_date and shelf_life:
        return frappe.utils.add_days(exp_date, -shelf_life)
    return mfg_date
