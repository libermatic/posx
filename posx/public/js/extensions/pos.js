import { compose } from 'ramda';

import { cartOverrides } from '../pos';

frappe.provide('posx.pos');

posx.pos.override = function (ns) {
  if (ns.ItemCart) {
    ns.ItemCart = compose(...cartOverrides)(ns.ItemCart);
  }
};
