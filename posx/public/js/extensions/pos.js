import { compose } from 'ramda';

import { controllerOverrides, cartOverrides, paymentOverrides } from '../pos';

frappe.provide('posx.pos');

posx.pos.override = function (ns) {
  if (ns.Controller) {
    ns.Controller = compose(...controllerOverrides)(ns.Controller);
  }
  if (ns.ItemCart) {
    ns.ItemCart = compose(...cartOverrides)(ns.ItemCart);
  }
  if (ns.Payment) {
    ns.Payment = compose(...paymentOverrides)(ns.Payment);
  }
};
