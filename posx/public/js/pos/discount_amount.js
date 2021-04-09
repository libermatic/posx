import { makeExtension } from '../utils';

export default function discount_amount(ItemCart) {
  return makeExtension(
    'discount_amount',
    class ItemCartWithDiscountAmount extends ItemCart {
      show_discount_control() {
        this.$add_discount_elem.css({ padding: '0px', border: 'none' });
        this.$add_discount_elem.html(`
          <div class="switch-control">
            <input type="checkbox" id="discount_type" />
            <label for="discount_type" />
          </div>
          <div>
            <div class="discount_by">%</div>
          </div>
          <div class="add-discount-field" />
        `);
        const $discount_type = this.$add_discount_elem.find('#discount_type');
        const $discount_by = this.$add_discount_elem.find('.discount_by');

        const get_placeholder_text = () =>
          __(
            `Enter discount ${
              $discount_type.is(':checked') ? 'amount' : 'percentage'
            }.`
          );
        const get_label_text = () =>
          $discount_type.is(':checked') ? get_currency_symbol() : '%';
        const get_discount_fieldname = (v) =>
          $discount_type.is(':checked') || !v
            ? 'discount_amount'
            : 'additional_discount_percentage';

        this.discount_field = frappe.ui.form.make_control({
          df: {
            label: __('Discount'),
            fieldtype: 'Float',
            placeholder: get_placeholder_text(),
            input_class: 'input-sm',
            onchange: async function () {
              const value = this.discount_field.get_value();
              if (value === null) {
                return;
              }

              const frm = this.events.get_frm();
              await frappe.model.set_value(
                frm.doc.doctype,
                frm.doc.name,
                get_discount_fieldname(value),
                flt(value)
              );
              this.hide_discount_control();
              this.discount_field = undefined;
            }.bind(this),
          },
          parent: this.$add_discount_elem.find('.add-discount-field'),
          render_input: true,
        });
        this.discount_field.toggle_label(false);
        this.discount_field.set_focus();
        $discount_type.change(() => {
          this.discount_field.input.placeholder = get_placeholder_text();
          $discount_by.text(get_label_text());
        });
      }
      hide_discount_control() {
        const {
          additional_discount_percentage,
          discount_amount,
        } = this.events.get_frm().doc;
        if (discount_amount) {
          this.$add_discount_elem.css({
            border: '1px dashed var(--dark-green-500)',
            padding: 'var(--padding-sm) var(--padding-md)',
          });
          this.$add_discount_elem.html(
            `<div class="edit-discount-btn">
              ${this.get_discount_icon()} Additional ${format_currency(
              discount_amount
            )} ${
              additional_discount_percentage
                ? `(${String(additional_discount_percentage)}%)`
                : ''
            } discount applied
            </div>`
          );
        } else {
          this.$add_discount_elem.css({
            border: '1px dashed var(--gray-500)',
            padding: 'var(--padding-sm) var(--padding-md)',
          });
          this.$add_discount_elem.html(
            `${this.get_discount_icon()} Add Discount`
          );
        }
      }
    }
  );
}
