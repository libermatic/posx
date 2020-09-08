import makeExtension from '../utils/make-extension';

export default function fixed_renders(Cart) {
  return makeExtension(
    'fixed_renders',
    class CartWithFixedRenders extends Cart {
      get_item_html(item) {
        const html = super.get_item_html(item);
        const $html = $(html);
        $html.find('.discount').text(`${flt(item.discount_percentage, 2)}%`);
        return $('<div />').append($html).html();
      }
    }
  );
}
