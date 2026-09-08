import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';
import { refreshRevenueCatData } from './revenuecat-refresh';
import { createRevenueCatIdentity } from './revenuecat-identity';

/**
 * RevenueCat integration για τις native συνδρομές (In-App Purchases).
 *
 * ΣΗΜΑΝΤΙΚΟ: το react-native-purchases είναι native module — ΔΕΝ υπάρχει στο
 * Expo Go και ρίχνει την app αν φορτωθεί/κληθεί εκεί. Γι' αυτό το φορτώνουμε
 * με lazy require μέσα σε try/catch και ΚΑΘΕ κλήση είναι guarded: αν το module
 * λείπει ή το κλειδί είναι λάθος, η app συνεχίζει κανονικά σε «free» κατάσταση.
 */

// Το entitlement identifier όπως ορίστηκε στο RevenueCat dashboard.
export const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || 'pro';

// Public SDK keys ανά πλατφόρμα (RevenueCat → Project → API keys):
// iOS ξεκινά με `appl_`, Android με `goog_`. Το RevenueCat ενεργοποιείται ΜΟΝΟ
// όταν υπάρχει έγκυρο platform key εδώ — αλλιώς μένει ανενεργό (καμία κλήση,
// κανένα crash). Ορίζονται ως EXPO_PUBLIC_* build environment variables.
const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || '';
const API_KEY = Platform.select({ ios: IOS_KEY, android: ANDROID_KEY, default: '' }) ?? '';

function keyLooksValid(key: string): boolean {
  return /^(appl_|goog_)[A-Za-z0-9]+$/.test(key);
}

// Lazy, guarded φόρτωση των native modules.
type PurchasesModule = typeof import('react-native-purchases').default;
type UIModule = typeof import('react-native-purchases-ui').default;

let Purchases: PurchasesModule | null = null;
let RevenueCatUI: UIModule | null = null;
let PaywallResult: { PURCHASED: string; RESTORED: string } | null = null;

const nativeReady = (() => {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  if (!keyLooksValid(API_KEY)) return false;
  try {
    Purchases = require('react-native-purchases').default;
    const ui = require('react-native-purchases-ui');
    RevenueCatUI = ui.default;
    PaywallResult = ui.PAYWALL_RESULT;
    return Boolean(Purchases && RevenueCatUI);
  } catch {
    // Native module μη διαθέσιμο (π.χ. Expo Go) — RevenueCat ανενεργό.
    return false;
  }
})();

type RevenueCatContextValue = {
  ready: boolean;
  available: boolean;
  isPro: boolean;
  pendingBackendVerification: boolean;
  customerInfo: CustomerInfo | null;
  offering: PurchasesOffering | null;
  refresh: () => Promise<void>;
  clearPendingBackendVerification: () => void;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
  presentPaywall: () => Promise<boolean>;
  presentCustomerCenter: () => Promise<void>;
};

const RevenueCatContext = createContext<RevenueCatContextValue | null>(null);

function hasPro(info: CustomerInfo | null): boolean {
  return Boolean(info?.entitlements.active[ENTITLEMENT_ID]);
}

export function RevenueCatProvider({
  appUserID,
  children,
}: {
  appUserID?: string | null;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [pendingBackendVerification, setPendingBackendVerification] = useState(false);
  const configured = useRef(false);
  const identity = useRef(createRevenueCatIdentity()).current;
  const currentUserId = useRef(appUserID);
  currentUserId.current = appUserID;

  const isCurrentUser = useCallback(
    () => currentUserId.current === appUserID && identity.isReady(appUserID),
    [appUserID, identity],
  );

  const refresh = useCallback(async () => {
    if (!nativeReady || !Purchases) return;
    try {
      await identity.run(appUserID, async (isCurrent) => {
        if (!isCurrentUser()) return;
        await refreshRevenueCatData({
          getCustomerInfo: () => Purchases!.getCustomerInfo(),
          getOffering: async () => (await Purchases!.getOfferings()).current ?? null,
          setCustomerInfo: (info) => { if (isCurrent() && isCurrentUser()) setCustomerInfo(info); },
          setOffering: (nextOffering) => { if (isCurrent() && isCurrentUser()) setOffering(nextOffering); },
        });
      });
    } catch {
      // Χωρίς σύνδεση/ρυθμισμένα offerings δεν μπλοκάρουμε την app.
    }
  }, [appUserID, identity, isCurrentUser]);

  const clearPendingBackendVerification = useCallback(() => {
    if (isCurrentUser()) setPendingBackendVerification(false);
  }, [isCurrentUser]);

  // Configure once; store operations stay disabled until account identification.
  useEffect(() => {
    if (!nativeReady || !Purchases || configured.current) {
      setReady(true);
      return;
    }
    try {
      Purchases.configure({ apiKey: API_KEY });
      configured.current = true;
    } catch {
      setReady(true);
      return;
    }

  }, []);

  // Ταυτοποίηση του χρήστη στο RevenueCat με το backend user id.
  useEffect(() => {
    setReady(false);
    setCustomerInfo(null);
    setOffering(null);
    setPendingBackendVerification(false);
    if (!nativeReady || !Purchases || !configured.current) {
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const info = await identity.identify(appUserID, async () => {
          if (appUserID) return (await Purchases!.logIn(appUserID)).customerInfo;
          const anonymous = await Purchases!.isAnonymous();
          if (!anonymous) await Purchases!.logOut();
          return null;
        });
        if (!cancelled && isCurrentUser()) {
          setCustomerInfo(info ?? null);
          await refresh();
        }
      } catch {
        // Failed identification leaves all store actions disabled.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    // Ignore unsolicited payloads; fetch for the identified account instead.
    const listener = () => { void refresh(); };
    try { Purchases.addCustomerInfoUpdateListener(listener); } catch { /* no-op */ }
    return () => {
      cancelled = true;
      void identity.identify(null, async () => undefined);
      try { Purchases?.removeCustomerInfoUpdateListener(listener); } catch { /* no-op */ }
    };
  }, [appUserID, identity, isCurrentUser, refresh]);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage) => {
    if (!nativeReady || !Purchases || !isCurrentUser()) return false;
    try {
      const result = await identity.run(appUserID, async () =>
        isCurrentUser() ? Purchases!.purchasePackage(pkg) : undefined);
      if (!result || !isCurrentUser()) return false;
      const { customerInfo: info } = result;
      setPendingBackendVerification(true);
      setCustomerInfo(info);
      return hasPro(info);
    } catch (error) {
      if ((error as { userCancelled?: boolean })?.userCancelled) return false;
      throw error;
    }
  }, [appUserID, identity, isCurrentUser]);

  const restore = useCallback(async () => {
    if (!nativeReady || !Purchases || !isCurrentUser()) return false;
    const info = await identity.run(appUserID, async () =>
      isCurrentUser() ? Purchases!.restorePurchases() : undefined);
    if (!info || !isCurrentUser()) return false;
    setCustomerInfo(info);
    const restored = hasPro(info);
    if (restored) setPendingBackendVerification(true);
    return restored;
  }, [appUserID, identity, isCurrentUser]);

  const presentPaywall = useCallback(async () => {
    if (!nativeReady || !RevenueCatUI || !PaywallResult || !isCurrentUser()) return false;
    const result = await identity.run(appUserID, async () =>
      isCurrentUser() ? RevenueCatUI!.presentPaywall() : undefined);
    if (!isCurrentUser()) return false;
    if (result === PaywallResult.PURCHASED || result === PaywallResult.RESTORED) {
      setPendingBackendVerification(true);
      await refresh();
      return isCurrentUser();
    }
    return false;
  }, [appUserID, identity, isCurrentUser, refresh]);

  const presentCustomerCenter = useCallback(async () => {
    if (!nativeReady || !RevenueCatUI || !isCurrentUser()) return;
    await identity.run(appUserID, async () => {
      if (isCurrentUser()) await RevenueCatUI!.presentCustomerCenter();
    });
    await refresh();
  }, [appUserID, identity, isCurrentUser, refresh]);

  const identified = isCurrentUser();

  const value = useMemo<RevenueCatContextValue>(
    () => ({
      ready,
      available: nativeReady && identified,
      isPro: identified && hasPro(customerInfo),
      pendingBackendVerification: identified && pendingBackendVerification,
      customerInfo: identified ? customerInfo : null,
      offering: identified ? offering : null,
      refresh,
      clearPendingBackendVerification,
      purchasePackage,
      restore,
      presentPaywall,
      presentCustomerCenter,
    }),
    [ready, identified, customerInfo, offering, pendingBackendVerification, refresh, clearPendingBackendVerification, purchasePackage, restore, presentPaywall, presentCustomerCenter],
  );

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
}

export function useRevenueCat(): RevenueCatContextValue {
  const context = useContext(RevenueCatContext);
  if (!context) {
    throw new Error('useRevenueCat must be used within a RevenueCatProvider.');
  }
  return context;
}
