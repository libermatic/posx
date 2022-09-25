# -*- coding: utf-8 -*-
from posx.doc_events.purchase_receipt import set_or_create_batch


def before_validate(doc, method):
    if doc.update_stock == 1 and doc._action == "submit":
        set_or_create_batch(doc, method)
