import * as scripts from './scripts';
import * as cscripts from './cscripts';
import * as utils from './utils';
import { __version__ } from './version';

function get_doctype(import_name) {
  return import_name
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

frappe.provide('posx');
posx = { __version__, scripts, utils };

Object.keys(cscripts).forEach((import_name) => {
  const get_handler = cscripts[import_name];
  frappe.ui.form.on(get_doctype(import_name), get_handler());
});
