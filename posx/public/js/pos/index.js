import fixed_batch_selection from './fixed_batch_selection';
import batch_price from './batch_price';
import xz_report from './xz_report';

// compose applies functions from right to left
// place extensions that need to run first in the end

export const pageOverrides = [xz_report, batch_price, fixed_batch_selection];
