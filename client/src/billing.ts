/**
 * Google Play Billing bridge (client).
 *
 * In the web build these are graceful no-ops — purchases are only available in
 * the Android (Capacitor) build where @capacitor-community/react-native
 * billing plugins are present. Product IDs and prices come from the server
 * catalogue; the Play Store is the source of truth at checkout (PRD §12).
 */

export interface PlayPurchase {
  productId: string;
  purchaseToken: string;
  basePlanId?: string | null;
}

type BillingPlugin = {
  purchaseSubscription?: (opts: { productId: string; basePlanId?: string }) => Promise<PlayPurchase>;
  purchaseProduct?: (opts: { productId: string }) => Promise<PlayPurchase>;
  launchSubscriptionManagement?: () => Promise<void>;
};

function getPlugin(): BillingPlugin | null {
  const bridge = (window as unknown as {
    AndroidBilling?: BillingPlugin;
    Capacitor?: { Plugins?: { AndroidBilling?: BillingPlugin } };
  });
  return bridge.AndroidBilling || bridge.Capacitor?.Plugins?.AndroidBilling || null;
}

export function isPlayBillingAvailable(): boolean {
  return getPlugin() !== null;
}

export async function purchaseSubscription(
  productId: string,
  basePlanId?: string
): Promise<PlayPurchase> {
  const plugin = getPlugin();
  if (!plugin?.purchaseSubscription) {
    throw new Error('Google Play Billing is only available in the Android app.');
  }
  return plugin.purchaseSubscription({ productId, basePlanId });
}

export async function purchaseBoost(productId: string): Promise<PlayPurchase> {
  const plugin = getPlugin();
  if (!plugin?.purchaseProduct) {
    throw new Error('Google Play Billing is only available in the Android app.');
  }
  return plugin.purchaseProduct({ productId });
}

export async function openSubscriptionManagement(): Promise<void> {
  const plugin = getPlugin();
  if (plugin?.launchSubscriptionManagement) {
    await plugin.launchSubscriptionManagement();
  } else {
    window.open(
      'https://play.google.com/store/account/subscriptions?package=app.skillswap.mobile',
      '_blank',
      'noopener'
    );
  }
}
