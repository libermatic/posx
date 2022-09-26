import { makeExtension } from '../utils';

export default function discount_amount(ItemCart) {
  return makeExtension(
    'discount_amount',
    class ItemCartWithDiscountAmount extends ItemCart {
      constructor(args) {
        super(args);
        this._default_discount_type =
          args.settings && args.settings.px_default_discount_type;
      }

      load_invoice() {
        const { discount_amount } = this.events.get_frm().doc;
        if (discount_amount) {
          this._discount_type = 'discount_amount';
          this._discount_value = discount_amount;
        } else {
          this._discount_type =
            this._default_discount_type === 'Amount'
              ? 'discount_amount'
              : 'additional_discount_percentage';
          this._discount_value = undefined;
        }
        super.load_invoice();
        this.hide_discount_control();
      }

      show_discount_control() {
        const get_label_text = () =>
          this._discount_type === 'discount_amount'
            ? get_currency_symbol()
            : '%';

        const get_placeholder_text = () =>
          __(
            `Enter discount ${
              this._discount_type === 'discount_amount'
                ? 'amount'
                : 'percentage'
            }.`
          );

        const set_discount_in_frm = (value, fieldname) => {
          const frm = this.events.get_frm();
          return frappe.model.set_value(
            frm.doc.doctype,
            frm.doc.name,
            fieldname,
            value
          );
        };

        this.$add_discount_elem.css({ padding: '0px', border: 'none' });
        this.$add_discount_elem.html(`
          <div class="backdrop" />
          <div class="switch-control">
            <input type="checkbox" id="discount_type" />
            <label for="discount_type" />
          </div>
          <div>
            <div class="discount_by">${get_label_text()}</div>
          </div>
          <div class="add-discount-field" />
        `);
        const $discount_type = this.$add_discount_elem.find('#discount_type');
        const $discount_by = this.$add_discount_elem.find('.discount_by');

        this.discount_field = frappe.ui.form.make_control({
          df: {
            label: __('Discount'),
            fieldtype:
              this._discount_type === 'discount_amount'
                ? 'Currency'
                : 'Percent',
            placeholder: get_placeholder_text(),
            input_class: 'input-sm',
            onchange: async  () => {
              const value = this.discount_field.get_value();
              if (value === null) {
                return;
              }

              this._discount_value = flt(value);
              await set_discount_in_frm(
                this._discount_value,
                this._discount_type || 'additional_discount_percentage'
              );
            },
          },
          parent: this.$add_discount_elem.find('.add-discount-field'),
          render_input: true,
        });

        this.discount_field.set_input(this._discount_value);
        $discount_type.prop(
          'checked',
          this._discount_type === 'discount_amount'
        );

        this.discount_field.toggle_label(false);
        this.discount_field.set_focus();

        $discount_type.on(
          'change',
          async () => {
            this._discount_type = $discount_type.is(':checked')
              ? 'discount_amount'
              : 'additional_discount_percentage';
            $discount_by.text(get_label_text());
            this.discount_field.input.placeholder = get_placeholder_text();

            this._discount_value = undefined;
            this.discount_field.set_input();

            await set_discount_in_frm(0, 'discount_amount');
          }
        );
        this.$add_discount_elem
          .find('.backdrop')
          .css({
            'background-color': 'var(--bg-color)',
            opacity: 0.5,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          })
          .on('click', () => this.hide_discount_control());
      }
      hide_discount_control() {
        const { additional_discount_percentage, discount_amount } =
          this.events.get_frm().doc;
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

        this.discount_field = undefined;
      }
    }
  );
}
