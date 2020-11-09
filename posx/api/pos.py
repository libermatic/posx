# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import json
import frappe
from toolz.curried import merge, compose, concatv, concat


@frappe.whitelist()
def get_modified_doctypes(entities):
    def get_count(doctype, last_updated, filters=None):
        return [
            merge(x, {"doctype": doctype})
            for x in frappe.db.get_all(
                doctype,
                fields=["count(*) as count"],
                filters=merge(filters or {}, {"modified": (">", last_updated)}),
            )
        ]

    return concat([get_count(**x) for x in json.loads(entities)])


@frappe.whitelist()
def get_stock_qtys(warehouse, last_updated, start=0, limit=100):
    page_length = frappe.utils.cint(limit)

    item_stock = frappe.db.get_all(
        "Bin",
        filters={"warehouse": warehouse, "modified": (">", last_updated)},
        fields=["item_code", "warehouse", "actual_qty as qty", "valuation_rate"],
        order_by="modified",
        limit_start=frappe.utils.cint(start),
        limit_page_length=page_length + 1,
    )
    batch_stock = (
        frappe.db.get_list(
            "Stock Ledger Entry",
            filters={
                "item_code": ("in", [x.get("item_code") for x in item_stock]),
                "warehouse": warehouse,
            },
            fields=["batch_no", "warehouse", "sum(actual_qty) as qty"],
            group_by="batch_no, warehouse",
        )
        if item_stock
        else []
    )

    has_more = len(item_stock) == page_length + 1

    return {
        "item_stock": item_stock[:page_length],
        "batch_stock": batch_stock,
        "has_more": has_more,
    }


@frappe.whitelist()
def get_settings(doctype, fields):
    _fields = json.loads(fields)
    return frappe.get_cached_value(doctype, None, fieldname=_fields, as_dict=1)
