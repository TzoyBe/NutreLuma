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

/**
 * RevenueCat integration για τις native συνδρομές (In-App Purchases).
 *
 * ΣΗΜΑΝΤΙΚΟ: το react-native-purchases είναι native module — ΔΕΝ υπάρχει στο
 * Expo Go και ρίχνει την app αν φορτωθεί/κληθεί εκεί. Γι' αυτό το φορτώνουμε
 * με lazy require μέσα σε try/catch και ΚΑΘΕ κλήση είναι guarded: αν το module
 * λείπει ή το κλειδί είναι λάθος, η app συνεχίζει κανονικά σε «free» κατάσταση.
 */

// Το entitlement identifier όπως ορίστηκε στο RevenueCat dashboard.
export const ENTITLEMENT_ID = 'NutreLume Pro';

// Public SDK keys ανά πλατφόρμα (RevenueCat → Project → API keys):
// iOS ξεκινά με `appl_`, Android με `goog_`. Το RevenueCat ενεργοποιείται ΜΟΝΟ
// όταν υπάρχει έγκυρο platform key εδώ — αλλιώς μένει ανενεργό (καμία κλήση,
// κανένα crash). Βάλε τα πραγματικά keys για να δουλέψει.
const IOS_KEY = '';
const ANDROID_KEY = '';
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
  customerInfo: CustomerInfo | null;
  offering: PurchasesOffering | null;
  refresh: () => Promise<void>;
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
  const configured = useRef(false);

  const refresh = useCallback(async () => {
    if (!nativeReady || !Purchases) return;
    try {
      const [info, offerings] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);
      setCustomerInfo(info);
      setOffering(offerings.current ?? null);
    } catch {
      // Χωρίς σύνδεση/ρυθμισμένα offerings δεν μπλοκάρουμε την app.
    }
  }, []);

  // Configure μία φορά + listener για ενημερώσεις συνδρομής.
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

    const listener = (info: CustomerInfo) => setCustomerInfo(info);
    try {
      Purchases.addCustomerInfoUpdateListener(listener);
    } catch {
      /* no-op */
    }
    void refresh().finally(() => setReady(true));
    return () => {
      try {
        Purchases?.removeCustomerInfoUpdateListener(listener);
      } catch {
        /* no-op */
      }
    };
  }, [refresh]);

  // Ταυτοποίηση του χρήστη στο RevenueCat με το backend user id.
  useEffect(() => {
    if (!nativeReady || !Purchases || !configured.current) return;
    let cancelled = false;
    (async () => {
      try {
        if (appUserID) {
          const { customerInfo: info } = await Purchases!.logIn(appUserID);
          if (!cancelled) setCustomerInfo(info);
        } else {
          const anonymous = await Purchases!.isAnonymous();
          if (!anonymous) {
            const info = await Purchases!.logOut();
            if (!cancelled) setCustomerInfo(info);
          }
        }
        await refresh();
      } catch {
        // αγνόησε — δεν πρέπει να ρίχνει την app
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appUserID, refresh]);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage) => {
    if (!nativeReady || !Purchases) return false;
    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      return hasPro(info);
    } catch (error) {
      if ((error as { userCancelled?: boolean })?.userCancelled) return false;
      throw error;
    }
  }, []);

  const restore = useCallback(async () => {
    if (!nativeReady || !Purchases) return false;
    const info = await Purchases.restorePurchases();
    setCustomerInfo(info);
    return hasPro(info);
  }, []);

  const presentPaywall = useCallback(async () => {
    if (!nativeReady || !RevenueCatUI || !PaywallResult) return false;
    const result = await RevenueCatUI.presentPaywall();
    if (result === PaywallResult.PURCHASED || result === PaywallResult.RESTORED) {
      await refresh();
      return true;
    }
    return false;
  }, [refresh]);

  const presentCustomerCenter = useCallback(async () => {
    if (!nativeReady || !RevenueCatUI) return;
    await RevenueCatUI.presentCustomerCenter();
    await refresh();
  }, [refresh]);

  const value = useMemo<RevenueCatContextValue>(
    () => ({
      ready,
      available: nativeReady,
      isPro: hasPro(customerInfo),
      customerInfo,
      offering,
      refresh,
      purchasePackage,
      restore,
      presentPaywall,
      presentCustomerCenter,
    }),
    [ready, customerInfo, offering, refresh, purchasePackage, restore, presentPaywall, presentCustomerCenter],
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
