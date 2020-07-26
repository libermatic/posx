import { compose } from 'ramda';

import { pageOverrides, cartOverrides, paymentOverrides } from '../pos';

const pos = {
  page: compose(...pageOverrides),
  cart: compose(...cartOverrides),
  payment: compose(...paymentOverrides),
};

export default pos;
