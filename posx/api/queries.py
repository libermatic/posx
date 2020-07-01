# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import frappe
from toolz.curried import compose, groupby, valmap, first


def get_batch_no(doctype, txt, searchfield, start, page_len, filters):
    from erpnext.controllers.queries import get_batch_no

    result = get_batch_no(doctype, txt, searchfield, start, page_len, filters)

    get_batch_prices = compose(
        valmap(lambda x: x[0].get("px_price_list_rate")),
        groupby("name"),
        lambda batches: frappe.db.sql(
            """
                SELECT name, px_price_list_rate FROM `tabBatch`
                WHERE name IN %(batches)s
            """,
            values={"batches": [x[0] for x in batches]},
            as_dict=1,
        )
        if batches
        else {},
    )

    batch_prices = get_batch_prices(result)

    def set_price(batch):
        price = batch_prices.get(batch[0])
        if not price:
            return batch
        return batch + tuple(["MRP-{}".format(price)])

    return [set_price(x) for x in result]
