# -*- coding: utf-8 -*-
# pylint:disable=no-member
# Copyright (c) 2020, Libermatic and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from toolz.curried import merge, keyfilter

from posx.api.label_printer import get_item_details


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
                    get_item_details(ref_item.item_code, price_list=self.price_list),
                ),
            )

