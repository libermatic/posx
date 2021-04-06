# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe
import erpnext
from erpnext.stock.get_item_details import get_item_price
from toolz.curried import compose, excepts, first, map, filter


def before_validate(doc, method):
    if doc._action == "submit":
        set_or_create_batch(doc, method)


def set_or_create_batch(doc, method):
    price_list = frappe.db.get_single_value("Selling Settings", "selling_price_list")

    def set_existing_batch(item):
        has_batch_no = frappe.get_cached_value("Item", item.item_code, "has_batch_no")
        if not has_batch_no:
            return

        item.batch_no = _get_existing(
            item.item_code,
            price_list,
            item.px_mfg_date,
            item.px_exp_date,
            item.px_batch_price_list_rate,
        )

    get_batch_in_previous_items = compose(
        lambda x: x.get("batch_no"),
        excepts(StopIteration, first, lambda _: {}),
        lambda x: filter(
            lambda item: item.idx < x.idx
            and item.item_code == x.item_code
            and (item.px_mfg_date == x.px_mfg_date or item.px_exp_date == x.px_exp_date)
            and item.px_batch_price_list_rate == x.px_batch_price_list_rate,
            doc.items,
        ),
    )

    def create_new_batch(item):
        warehouse = "t_warehouse" if doc.doctype == "Stock Entry" else "warehouse"
        if not item.get(warehouse) or item.batch_no:
            return
        has_batch_no, create_new_batch = frappe.get_cached_value(
            "Item",
            item.item_code,
            ["has_batch_no", "create_new_batch"],
        )
        if not has_batch_no or not create_new_batch:
            return

        batch_in_items = get_batch_in_previous_items(item)
        if batch_in_items:
            item.batch_no = batch_in_items
        else:
            shelf_life_in_days = frappe.get_cached_value(
                "Item",
                item.item_code,
                "shelf_life_in_days",
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
            if item.px_batch_price_list_rate:
                _create_batch_price(
                    price_list,
                    doc.posting_date,
                    item.item_code,
                    item.px_batch_price_list_rate,
                    batch.name,
                )

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


def _get_existing(
    item_code, price_list, manufacturing_date, expiry_date, px_price_list_rate
):
    if manufacturing_date:
        return frappe.db.exists(
            "Batch",
            {
                "item": item_code,
                "manufacturing_date": manufacturing_date,
                "px_price_list_rate": px_price_list_rate,
            },
        )
    elif expiry_date:
        return frappe.db.exists(
            "Batch",
            {
                "item": item_code,
                "expiry_date": expiry_date,
                "px_price_list_rate": px_price_list_rate,
            },
        )
    elif px_price_list_rate:
        item_prices = frappe.get_all(
            "Item Price",
            filters={
                "item_code": item_code,
                "price_list": price_list,
                "price_list_rate": px_price_list_rate,
                "batch_no": ("is", "set"),
            },
            fields=["batch_no"],
            as_list=1,
        )
        if item_prices:
            return item_prices[0][0]

    return None


def _create_batch_price(price_list, posting_date, item_code, price_list_rate, batch_no):
    existing_price = get_item_price(
        {
            "posting_date": posting_date,
            "price_list": price_list,
            "uom": "",
            "batch_no": "",
        },
        item_code,
    )
    if existing_price and existing_price[0][1] == price_list_rate:
        return

    frappe.get_doc(
        {
            "doctype": "Item Price",
            "price_list": price_list,
            "item_code": item_code,
            "currency": erpnext.get_default_currency(),
            "price_list_rate": price_list_rate,
            "batch_no": batch_no,
        }
    ).insert()