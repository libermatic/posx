import { compose } from 'ramda';

import { controllerOverrides, cartOverrides, detailsOverrides } from '../pos';

frappe.provide('posx.pos');

posx.pos.override = function (ns) {
  if (ns.Controller) {
    ns.Controller = compose(...controllerOverrides)(ns.Controller);
  }
  if (ns.ItemCart) {
    ns.ItemCart = compose(...cartOverrides)(ns.ItemCart);
  }
  if (ns.ItemDetails) {
    ns.ItemDetails = compose(...detailsOverrides)(ns.ItemDetails);
  }
};
