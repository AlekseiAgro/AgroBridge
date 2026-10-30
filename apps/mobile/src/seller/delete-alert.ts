import { Alert } from 'react-native';

import type { DeleteChoice, DeletePrompt } from './delete';

/** Cancel is the default. Delete is the destructive button and is not selected for the seller. */
export function askToDeleteProduct(
  prompt: DeletePrompt,
  text: { title: string; body: string; cancel: string; confirm: string },
): Promise<DeleteChoice> {
  return new Promise((resolve) => {
    Alert.alert(text.title, text.body, [
      { text: text.cancel, style: prompt.cancelStyle, onPress: () => resolve('cancel') },
      { text: text.confirm, style: prompt.confirmStyle, onPress: () => resolve('confirm') },
    ]);
  });
}
