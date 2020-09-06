import fix_scan_barcode from './common/fix_scan_barcode';

export function purchase_order() {
  return {
    onload: fix_scan_barcode,
  };
}
