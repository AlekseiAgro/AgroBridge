import { useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { listCategories, listProducts, listPurchaseRequests } from './api';
import type { CatalogCategory, CatalogProduct, CatalogRequest } from './model';
import { normalizeQueryParam } from './query';

const SEARCH_DEBOUNCE_MS = 300;

export type FeedStatus = 'loading' | 'ready' | 'error';

type ServerMatches = {
  key: string;
  products: CatalogProduct[];
  requests: CatalogRequest[];
  error: boolean;
};

export function useHomeFeed(categoryId: string | null, query: string) {
  const { api } = useAuth();
  const { locale } = useI18n();
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${categoryId ?? ''}:${locale}:${reloadToken}`;
  const [seenKey, setSeenKey] = useState(requestKey);
  const [status, setStatus] = useState<FeedStatus>('loading');
  const [bootstrapped, setBootstrapped] = useState(false);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [requests, setRequests] = useState<CatalogRequest[]>([]);
  const [serverMatches, setServerMatches] = useState<ServerMatches | null>(null);

  if (seenKey !== requestKey) {
    setSeenKey(requestKey);
    setStatus('loading');
    setServerMatches(null);
  }

  const queryParam = normalizeQueryParam(query);
  const serverKey = `${categoryId ?? ''}\n${locale}\n${queryParam}`;
  const serverReady = serverMatches?.key === serverKey;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listCategories(api),
      listProducts(api, { categoryId, locale }),
      listPurchaseRequests(api, { categoryId, locale }),
    ])
      .then(([nextCategories, nextProducts, nextRequests]) => {
        if (cancelled) {
          return;
        }
        setCategories(nextCategories);
        setProducts(nextProducts);
        setRequests(nextRequests);
        setBootstrapped(true);
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [api, categoryId, locale, reloadToken]);

  useEffect(() => {
    if (status !== 'ready' || !queryParam) {
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      Promise.all([
        listProducts(api, { categoryId, query: queryParam, locale }),
        listPurchaseRequests(api, { categoryId, query: queryParam, locale }),
      ])
        .then(([nextProducts, nextRequests]) => {
          if (cancelled) {
            return;
          }
          setServerMatches({
            key: serverKey,
            products: nextProducts,
            requests: nextRequests,
            error: false,
          });
        })
        .catch(() => {
          if (cancelled) {
            return;
          }
          setServerMatches({
            key: serverKey,
            products: [],
            requests: [],
            error: true,
          });
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [api, categoryId, locale, queryParam, reloadToken, serverKey, status]);

  return {
    status,
    bootstrapped,
    categories,
    products,
    requests,
    serverProducts: serverReady && !serverMatches?.error ? serverMatches.products : [],
    serverRequests: serverReady && !serverMatches?.error ? serverMatches.requests : [],
    searchPending: Boolean(queryParam) && status === 'ready' && !serverReady,
    searchError: Boolean(queryParam) && status === 'ready' && serverReady && serverMatches.error,
    reload: () => setReloadToken((current) => current + 1),
  };
}

export function useOpenPurchaseRequests() {
  const { api } = useAuth();
  const { locale } = useI18n();
  const [reloadToken, setReloadToken] = useState(0);
  const [seenToken, setSeenToken] = useState(reloadToken);
  const [status, setStatus] = useState<FeedStatus>('loading');
  const [requests, setRequests] = useState<CatalogRequest[]>([]);

  if (seenToken !== reloadToken) {
    setSeenToken(reloadToken);
    setStatus('loading');
  }

  useEffect(() => {
    let cancelled = false;
    listPurchaseRequests(api, { locale })
      .then((next) => {
        if (cancelled) {
          return;
        }
        setRequests(next);
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [api, locale, reloadToken]);

  return {
    status,
    requests,
    reload: () => setReloadToken((current) => current + 1),
  };
}
