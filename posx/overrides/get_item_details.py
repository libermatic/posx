# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe
import json
from six import string_types
from toolz.curried import merge, excepts, first, compose, filter, map


@frappe.whitelist()
def apply_price_list(args, as_doc=False):
    from erpnext.stock.get_item_details import apply_price_list

    def get_item_price(item, args):
        batch_no = compose(
            lambda x: x.get("batch_no"),
            excepts(StopIteration, first, lambda _: {}),
            filter(lambda x: x.get("child_docname") == item.get("child_docname")),
            lambda x: x.get("items"),
        )(args)

        if batch_no:
            price = frappe.get_cached_value("Batch", batch_no, "px_price_list_rate")
            if price:
                return price

        return item.get("price_list_rate")

    def proc_result(result, args):
        if args.get("is_return"):
            return merge(
                result,
                {
                    "children": [
                        merge(x, {"price_list_rate": get_item_price(x, args)},)
                        for x in result.get("children")
                    ]
                },
            )
        return result

    _args = json.loads(args) if isinstance(args, string_types) else args
    return proc_result(apply_price_list(_args, as_doc), _args)
