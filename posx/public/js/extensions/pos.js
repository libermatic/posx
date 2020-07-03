import { compose } from 'ramda';

import { pageOverrides, paymentOverrides } from '../pos';

const pos = {
  page: compose(...pageOverrides),
  payment: compose(...paymentOverrides),
};

export default pos;
