# -*- coding: utf-8 -*-
import re
import json
import frappe
from toolz.curried import compose, mapcat


@frappe.whitelist()
def list_asset_names():
    assets = frappe.db.get_all(
        "POS Asset",
        filters={"disabled": 0},
        fields=["name", "script", "style"],
        order_by="name asc",
    )
    return compose(
        list,
        mapcat(
            lambda x: [
                f'{x.name}.{"js" if asset_type == "script" else "css"}'
                for asset_type in ["script", "style"]
                if bool(x.get(asset_type))
            ]
        ),
    )(assets)


@frappe.whitelist()
def list_assets(sources=[]):
    filters = {"disabled": 0}
    if sources:
        if isinstance(sources, str):
            sources = json.loads(sources)
        print(sources)
        filters.update(
            {"name": ("in", list({re.sub(r"(\.js|\.css)$", "", x) for x in sources}))}
        )

    assets = frappe.db.get_all(
        "POS Asset",
        filters=filters,
        fields=["name", "script", "overriden_class", "style"],
    )
    return compose(
        list,
        mapcat(
            lambda asset: [
                {
                    "name": f'{asset.name}.{"js" if asset_type == "script" else "css"}',
                    "code": _get_code(asset, asset_type),
                }
                for asset_type in ["script", "style"]
                if bool(asset.get(asset_type))
            ]
        ),
    )(assets)


def _get_code(asset, asset_type):
    if asset_type == "script":
        return frappe.render_template(
            _script_template,
            {
                **asset,
                "name": frappe.utils.quote(asset.name),
                "extended_class_name": f'{asset.overriden_class}With{re.sub(r"[^a-zA-Z ]", " ", asset.name).title().replace(" ", "")}',
            },
        )

    if asset_type == "style":
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