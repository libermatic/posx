import { MandatoryEntityNotFound } from '../../../utils/exceptions';
import set_missing_values from './set_missing_values';

export async function runserverobj({
  method,
  docs = null,
  dt = null,
  dn = null,
  arg = null,
  args = null,
}) {
  if (method !== 'set_missing_values') {
    return;
  }

  try {
    const [doc, message] = await set_missing_values(docs);
    if (doc) {
      return { docs: [doc], message };
    }
  } catch (error) {
    if (error instanceof MandatoryEntityNotFound) {
      return;
    }

    throw error;
  }
}
