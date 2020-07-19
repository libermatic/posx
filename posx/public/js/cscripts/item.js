export function item() {
  return {
    refresh: function (frm) {
      if (!frm.doc.__islocal) {
        function hash(str) {
          const hashint =
            str
              .split('')
              .reduce((a, x) => ((a << 5) - a + x.charCodeAt(0)) | 0, 0) >>> 0;
          const hashstr = hashint.toString();
          return `02${hashstr.slice(0, 10).padStart(10, '0')}`;
        }
        function checkdigit(code) {
          const mod = code
            .split('')
            .reverse()
            .reduce(
              (a, x, i) => (i % 2 ? parseInt(x) + a : parseInt(x) * 3 + a) % 10,
              0
            );
          return ((10 - mod) % 10).toString();
        }
        frm.page.add_menu_item('Generate New Barcode', async function () {
          const code = hash(frm.doc['item_code']);
          const check = checkdigit(code);
          await frm.add_child('barcodes', {
            barcode: code + check,
            barcode_type: 'EAN',
          });
          frm.refresh();
        });
      }
    },
  };
}
