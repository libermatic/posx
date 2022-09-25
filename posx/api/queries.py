# -*- coding: utf-8 -*-
import frappe
from toolz.curried import compose, groupby, valmap


@frappe.whitelist()
def get_batch_no(doctype, txt, searchfield, start, page_len, filters):
    from erpnext.controllers.queries import get_batch_no

    result = get_batch_no(doctype, txt, searchfield, start, page_len, filters)
    price_list = frappe.get_cached_value("Selling Settings", None, "selling_price_list")

    get_batch_prices = compose(
        valmap(lambda x: x[0].get("price_list_rate")),
        groupby("batch_no"),
        lambda batches: frappe.get_all(
            "Item Price",
            filters={
                "price_list": price_list,
                "batch_no": ("in", [x[0] for x in batches]),
            },
            fields=["batch_no", "price_list_rate"],
        )
        if batches
        else {},
    )

    batch_prices = get_batch_prices(result)

    def set_price(batch):
        price = batch_prices.get(batch[0])
        if not price:
            return batch
        return batch + tuple(["PRICE-{}".format(price)])

    return [set_price(x) for x in result]
