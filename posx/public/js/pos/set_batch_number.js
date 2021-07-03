import { makeExtension } from '../utils';

export default function set_batch_number(Controller) {
  return makeExtension(
    'set_batch_number',
    class ControllerWithSetBatchNumber extends Controller {
      async trigger_new_item_events(item_row) {
        item_row.warehouse = this.frm.doc.set_warehouse;
        await super.trigger_new_item_events(item_row);
      }
    }
  );
}
