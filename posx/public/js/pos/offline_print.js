import nunjucks from 'nunjucks/browser/nunjucks';
import * as R from 'ramda';

import db from '../store/db';
import makeExtension from '../utils/make-extension';

nunjucks.configure({ autoescape: true });

export default function offline_print(Pos) {
  return makeExtension(
    'offline_print',
    class PosWithOfflinePrint extends Pos {
      async make() {
        const result = await super.make();
        await this._setup_print_handler();
        return result;
      }
      async on_change_pos_profile() {
        const result = await super.on_change_pos_profile();
        await this._setup_print_handler();
        return result;
      }
      async set_pos_profile_data() {
        const result = await super.set_pos_profile_data();
        await this._setup_print_handler();
        return result;
      }
      async _setup_print_handler() {
        if (!this.frm.config.px_use_local_datastore) {
          return;
        }
        const pf_name =
          this.frm.print_preview.selected_format() ||
          (await db
            .table('POS Profile')
            .get(this.frm.doc.pos_profile)
            .then((x) => x && x.print_format_for_online));

        const pf = pf_name ? await db.table('Print Format').get(pf_name) : null;
        if (pf) {
          this.frm._print_template = nunjucks.compile(
            get_template({
              html: pf.html,
              print_css: frappe.boot.print_css,
              css: pf.css,
            })
          );
        }
        this.frm.print_preview.printit = this._print;
      }
      async _print() {
        const html =
          this.frm._print_template &&
          this.frm._print_template.render({
            doc: new MockDocument(this.frm.doc),
            _: __,
          });

        const w = window.open();
        w.document.write(html);
        w.document.close();
        setTimeout(function () {
          w.print();
          w.close();
        }, 1000);
      }
    }
  );
}

const get_template = ({ html, print_css, css }) => `
<DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ doc.customer_name }}</title>
    <link type="text/css" rel="stylesheet" href="/assets/css/printview.css">
    <style>
        ${print_css}
    </style>
    <style>
        ${css}
    </style>
</head>
<body>
    <div class="print-format-gutter">
        <div class="print-format">
            ${html}
        </div>
    </div>
</body>
</html>

`;

class MockDocument {
  constructor(doc) {
    this._doc = doc;
    this._setup();
  }
  _setup() {
    this.flags = {};
    for (const field in this._doc) {
      const value = this._doc[field];
      if (['String', 'Number'].includes(R.type(value))) {
        this[field] = value;
      } else if (value instanceof Array) {
        this[field] = value.map((x) =>
          R.type(x) === 'Object' ? new MockDocument(x) : x
        );
      }
    }
  }
  get_formatted(fieldname, _parent) {
    const { fieldtype } = frappe.meta.get_field(this.doctype, fieldname) || {};
    if (['Date', 'Datetime'].includes(fieldtype)) {
      return frappe.datetime.str_to_user(this[fieldname]);
    }
    if (fieldtype === 'Currency') {
      return format_currency(this[fieldname]);
    }
    if (fieldtype === 'Float') {
      return format_number(this[fieldname]);
    }
    if (fieldtype === 'Int') {
      return format_number(this[fieldname], undefined, 0);
    }
    return this[fieldname];
  }
}
