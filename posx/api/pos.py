# -*- coding: utf-8 -*-
import re
import json
import frappe


@frappe.whitelist()
def list_asset_names():
    return frappe.db.get_all(
        "POS Asset",
        filters={"disabled": 0},
        fields=["name", "asset_type"],
        order_by="name asc",
    )


@frappe.whitelist()
def list_assets(sources=[]):
    filters = {"disabled": 0}
    if sources:
        if isinstance(sources, str):
            sources = json.loads(sources)
        filters.update({"name": ("in", sources)})

    assets = frappe.db.get_all(
        "POS Asset",
        filters=filters,
        fields=["name", "asset_type", "script", "overriden_class", "style"],
    )
    return [
        {"name": x.name, "asset_type": x.asset_type, "code": _get_code(x)}
        for x in assets
    ]


def _get_code(asset):
    if asset.asset_type == "JS":
        return frappe.render_template(
            _script_template,
            {
                **asset,
                "name": frappe.utils.quote(asset.name),
                "extended_class_name": f'{asset.overriden_class}With{re.sub(r"[^a-zA-Z ]", " ", asset.name).title().replace(" ", "")}',
            },
        )

    if asset.asset_type == "CSS":
        return frappe.render_template(_style_template, asset)

    frappe.throw(f"Invalid asset type: {asset.name}")


_script_template = """
if (erpnext.PointOfSale.hasOwnProperty('{{ overriden_class }}')) {
    erpnext.PointOfSale.{{ overriden_class }} = (function (Parent) {
        return posx.utils.makeExtension(
            '{{ name }}',
            class {{ extended_class_name }} extends Parent {
                {{ script }}
            },
            'site'
        );
    })(erpnext.PointOfSale.{{ overriden_class }});
}
"""

_style_template = """
{{ style }}
"""