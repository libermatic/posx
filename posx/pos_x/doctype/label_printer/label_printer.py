# -*- coding: utf-8 -*-
# pylint:disable=no-member
# Copyright (c) 2020, Libermatic and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from toolz.curried import merge, keyfilter

from posx.api.label_printer import get_price


class LabelPrinter(Document):
    def set_items_from_reference(self):
        ref_doc = frappe.get_doc(self.print_dt, self.print_dn)
        self.items = []
        for ref_item in ref_doc.items:
            print(ref_item.item_code)
            self.append(
                "items",
                merge(
                    keyfilter(
                        lambda x: x in ["item_code", "item_name", "qty"],
                        ref_item.as_dict(),
                    ),
                    _get_barcode(ref_item),
                    {
                        "price": get_price(
                            ref_item.item_code, price_list=self.price_list
                        )
                    },
                ),
            )


def _get_barcode(item):
    if item.get("barcode"):
        return {
            "barcode": item.barcode,
            "barcode_type": frappe.get_cached_value(
                "Item Barcode", item.barcode, fieldname="barcode_type"
            ),
        }
    doc = frappe.get_cached_doc("Item", item.item_code)
    if doc.barcodes:
        return keyfilter(
            lambda x: x in ["barcode", "barcode_type"], doc.barcodes[0].as_dict()
        )
    return {}

