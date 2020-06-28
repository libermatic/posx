import { compose } from 'ramda';

import { pageOverrides } from '../pos';

const pos = compose(...pageOverrides);

export default pos;
