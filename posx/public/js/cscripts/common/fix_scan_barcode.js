/**
 * prevent scan_barcode from tabbing into the items table and expanding the item row
 * @param {Frm} frm
 */

export default function fix_scan_barcode(frm) {
  frm.fields_dict.scan_barcode.$input.on('keydown', function (e) {
    if (e.keyCode === 9 || e.keyCode === 13) {
      frm
        .set_value('scan_barcode', e.target.value)
        .then(() => frm.trigger('scan_barcode'));
      e.preventDefault();
      return false;
    }
  });
}
