import { makeExtension, waitToChange } from '../utils';

/**
 *
 */
export default function fix_cart_renders(ItemCart) {
  return makeExtension(
    'fix_cart_renders',
    class ItemCartFixCartRenders extends ItemCart {}
  );
}
