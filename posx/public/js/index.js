import * as scripts from './scripts';
import * as extensions from './extensions';
import * as cscripts from './cscripts';

function get_doctype(import_name) {
  return import_name
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

const __version__ = '0.4.5';

frappe.provide('posx');
posx = { __version__, scripts, extensions };

Object.keys(cscripts).forEach((import_name) => {
  const get_handler = cscripts[import_name];
  frappe.ui.form.on(get_doctype(import_name), get_handler());
});
