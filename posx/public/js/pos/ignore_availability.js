import { makeExtension, waitToChange } from '../utils';

/**
 * ignore availability check to allow unavailable items to be sold
 */
export default function ignore_availability(Controller) {
  return makeExtension(
    'ignore_availability',
    class ControllerIgnoreAvailability extends Controller {
        async check_stock_availability(item_row, qty_needed, warehouse) {}
    }
  );
}
