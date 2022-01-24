import { makeExtension } from '../utils';

/**
 * fixes qty rendered as 'null' for service items
 */
export default function fix_null_qty_for_service_items(ItemSelector) {
  return makeExtension(
    'fix_null_qty_for_service_items',
    class ItemSelectorFixNullQtyForServiceItems extends ItemSelector {
      get_item_html(item) {
        const result = super.get_item_html(item);
        if (item.is_stock_item === 1) {
          return result;
        }

        const $result = $(result);
        $result.find('.indicator-pill').remove();
        return $result[0];
      }
    }
  );
}
