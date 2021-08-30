import { makeExtension } from '../utils';

/**
 * defined props to be used by child classes
 */
export default function base(Controller) {
  return makeExtension(
    'base',
    class ControllerWithBase extends Controller {
        init_item_cart() {
        super.init_item_cart();
        this.cart._settings = this.settings;
      }
    }
  );
}