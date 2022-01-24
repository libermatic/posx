import { makeExtension, waitToChange } from '../utils';

/**
 * fix undefined being return from backend end for service items
 */
export default function fix_stock_check_fail_for_service_items(Controller) {
  return makeExtension(
    'fix_stock_check_fail_for_service_items',
    class ControllerFixStockCheckFailForServiceItems extends Controller {
      async get_available_stock(item_code, warehouse) {
        const { message = 0 } = await super.get_available_stock(
          item_code,
          warehouse
        );
        return { message };
      }
    }
  );
}
