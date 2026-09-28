'use client';

import { useEffect } from 'react';

type Props = {
  productId: string;
  isOwner?: boolean;
};

/**
 * Records a public product-detail view after hydrate.
 * Owner preview (including My Products → Preview) is skipped on the client
 * and again on the API so sellers cannot inflate their own count.
 */
export function RecordProductView({ productId, isOwner = false }: Props) {
  useEffect(() => {
    if (isOwner) {
      return;
    }
    void fetch(`/api/products/${productId}/views`, { method: 'POST' }).catch(() => undefined);
  }, [productId, isOwner]);

  return null;
}
