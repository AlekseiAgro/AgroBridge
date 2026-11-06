import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { productsAfterDelete } from './delete';
import {
  keepMyProductsAfterError,
  myProductsLoadMode,
  productsAfterHarvestUpdate,
  shouldLoadMyProducts,
  type SellerProduct,
} from './products';
import { listMyProducts } from './products-api';

export function useMyProducts() {
  const { api, status, user, profileUnavailable } = useAuth();
  const [reloadToken, setReloadToken] = useState(0);
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const hasLoadedRef = useRef(false);
  const canLoad = shouldLoadMyProducts({ user, profileUnavailable });

  useFocusEffect(
    useCallback(() => {
      if (!canLoad) {
        setProducts([]);
        setLoadStatus('idle');
        setRefreshing(false);
        hasLoadedRef.current = false;
        return;
      }
      let cancelled = false;
      const request = reloadToken;
      const mode = myProductsLoadMode(hasLoadedRef.current);
      if (mode === 'initial') {
        setLoadStatus('loading');
      } else {
        setRefreshing(true);
      }
      listMyProducts(api)
        .then((next) => {
          if (!cancelled && request === reloadToken) {
            setProducts(next);
            hasLoadedRef.current = true;
            setLoadStatus('ready');
          }
        })
        .catch(() => {
          if (!cancelled && request === reloadToken && !keepMyProductsAfterError(hasLoadedRef.current)) {
            setLoadStatus('error');
          }
        })
        .finally(() => {
          if (!cancelled && request === reloadToken) {
            setRefreshing(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }, [api, canLoad, reloadToken]),
  );

  const reload = useCallback(() => setReloadToken((current) => current + 1), []);
  const removeProduct = useCallback((productId: string) => {
    setProducts((current) => productsAfterDelete(current, productId));
  }, []);
  const replaceProduct = useCallback((product: SellerProduct) => {
    setProducts((current) => productsAfterHarvestUpdate(current, product));
  }, []);

  return {
    authStatus: status,
    user,
    profileUnavailable,
    loadStatus,
    refreshing,
    products,
    reload,
    removeProduct,
    replaceProduct,
  };
}
