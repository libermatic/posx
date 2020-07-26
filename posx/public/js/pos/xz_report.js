import makeExtension from '../utils/make-extension';

export async function get_xz_report(pos_profile, company) {
  const { message: { px_enable_xz_report: enable_xz_report } = {} } =
    (await frappe.db.get_value(
      'POS Profile',
      pos_profile,
      'px_enable_xz_report'
    )) || {};

  if (!enable_xz_report) {
    return null;
  }

  const { message: xz_report } = await frappe.call({
    method: 'posx.api.xz_report.get_unclosed',
    args: { user: frappe.session.user, pos_profile, company },
  });
  if (xz_report) {
    return xz_report;
  }

  const dialog = new frappe.ui.Dialog({
    title: __('Enter Opening Cash'),
    fields: [
      {
        fieldtype: 'Datetime',
        fieldname: 'start_datetime',
        label: __('Start Datetime'),
        default: frappe.datetime.now_datetime(),
      },
      { fieldtype: 'Column Break' },
      {
        fieldtype: 'Currency',
        fieldname: 'opening_cash',
        label: __('Amount'),
      },
    ],
  });
  dialog.get_close_btn().hide();
  dialog.show();

  return new Promise((resolve, reject) => {
    dialog.set_primary_action('Enter', async function () {
      try {
        const { start_datetime, opening_cash } = dialog.get_values();
        const { message: xz_report } = await frappe.call({
          method: 'posx.api.xz_report.create_opening',
          args: { start_datetime, opening_cash, company, pos_profile },
        });
        if (!xz_report) {
          throw new Error(__('Unable to create XZ Report opening entry.'));
        }
        resolve(xz_report);
      } catch (e) {
        frappe.msgprint({
          message: e.message,
          title: __('Warning'),
          indicator: 'orange',
        });
        reject(e);
      } finally {
        dialog.hide();
        dialog.$wrapper.remove();
      }
    });
  });
}

export default function xz_report(Pos) {
  return makeExtension(
    'xz_report',
    class PosWithXzReport extends Pos {
      async set_pos_profile_data() {
        const result = await super.set_pos_profile_data();
        if (this.frm.config.px_enable_xz_report) {
          this._update_menu();
        }
        return result;
      }
      _update_menu() {
        this.page.menu
          .find(`a.grey-link:contains("${__('Close the POS')}")`)
          .parent()
          .hide();
        this.page.add_menu_item(
          'XZ Report',
          async function () {
            const { pos_profile, company } = this.frm.doc;
            const xz_report = await get_xz_report(pos_profile, company);
            frappe.set_route('Form', 'XZ Report', xz_report);
          }.bind(this)
        );
      }
    }
  );
}
