import makeExtension from '../utils/make-extension';

export default function editable_description(Pos) {
  return makeExtension(
    'editable_description',
    class PosWithEditableDescription extends Pos {
      make_cart() {
        super.make_cart();
        if (
          this.frm.config.px_can_edit_desc &&
          !this.frm.config.px_use_cart_ext
        ) {
          this._make_editable_description_action();
        }
      }
      _make_editable_description_action() {
        this.$px_actions.append(`
          <button class="btn btn-xs px-edit-desc">Edit Description</buton>
        `);
        this.$px_actions.find('.px-edit-desc').on('click', () => {
          const $selected = this.cart.wrapper.find('.list-item.current-item');
          const item_code =
            $selected.attr('data-item-code') &&
            unescape($selected.attr('data-item-code'));
          const batch_no = $selected.attr('data-batch-no');
          if (!item_code) {
            return;
          }
          const item = this.frm.doc.items.find(
            (x) =>
              x.item_code === item_code &&
              (x.batch_no || null) === (batch_no || null)
          );
          this.edit_description(item);
        });
      }
      edit_description(item) {
        const dialog = new frappe.ui.Dialog({
          title: `Updating Description for row # ${item.idx}`,
          fields: [
            {
              fieldtype: 'Data',
              label: 'Item Code',
              default: item.item_code,
              read_only: 1,
            },
            { fieldtype: 'Column Break' },
            {
              fieldtype: 'Data',
              label: 'Item Name',
              default: item.item_name,
              read_only: 1,
            },
            { fieldtype: 'Section Break', label: 'Description' },
            {
              fieldtype: 'Text Editor',
              fieldname: 'description',
              default: item.description,
            },
          ],
        });
        dialog.set_primary_action('OK', async function () {
          item.description = dialog.get_value('description');
          dialog.hide();
        });
        dialog.onhide = () => dialog.$wrapper.remove();
        dialog.show();
      }
    }
  );
}
