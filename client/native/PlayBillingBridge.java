package com.skillswap.billing;

import android.app.Activity;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.AcknowledgePurchaseResponseListener;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.ProductDetailsResponseListener;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.NativePlugin;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;

import java.util.ArrayList;
import java.util.List;

/**
 * SkillSwap Google Play Billing bridge (Capacitor plugin).
 *
 * SECURITY MODEL: this plugin NEVER grants entitlements itself. It only
 * returns purchase tokens to the web layer, which submits them to the
 * SkillSwap backend. Only the backend — after verifying with the Google Play
 * Developer API — grants Gold/Elite/boosts (PRD §13).
 */
@NativePlugin(name = "AndroidBilling")
public class PlayBillingBridge extends Plugin implements PurchasesUpdatedListener {

    private BillingClient billingClient;
    private PluginCall pendingCall;

    @Override
    protected void handleOnStart() {
        super.handleOnStart();
        if (billingClient == null) {
            billingClient = BillingClient.newBuilder(getContext())
                    .setListener(this)
                    .enablePendingPurchases()
                    .build();
            billingClient.startConnection(new BillingClientStateListener() {
                @Override
                public void onBillingSetupFinished(BillingResult result) {
                    // Connection state is checked lazily in each method.
                }

                @Override
                public void onBillingServiceDisconnected() {
                    // Play will retry; next call re-establishes.
                }
            });
        }
    }

    @PluginMethod
    public void purchaseSubscription(PluginCall call) {
        purchase(call, BillingClient.ProductType.SUBS, call.getString("productId"), call.getString("basePlanId"));
    }

    @PluginMethod
    public void purchaseProduct(PluginCall call) {
        purchase(call, BillingClient.ProductType.INAPP, call.getString("productId"), null);
    }

    private void purchase(final PluginCall call, final String productType, final String productId, final String basePlanId) {
        if (productId == null) {
            call.reject("productId is required");
            return;
        }
        if (billingClient == null || !billingClient.isReady()) {
            call.reject("Billing is not ready yet. Try again in a moment.");
            return;
        }

        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        products.add(QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(productType)
                .build());
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(products)
                .build();

        billingClient.queryProductDetailsAsync(params, new ProductDetailsResponseListener() {
            @Override
            public void onProductDetailsResponse(BillingResult result, List<ProductDetails> detailsList) {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || detailsList.isEmpty()) {
                    call.reject("Product not available: " + productId);
                    return;
                }
                ProductDetails details = detailsList.get(0);

                BillingFlowParams.Builder flowBuilder = BillingFlowParams.newBuilder();
                if (BillingClient.ProductType.SUBS.equals(productType)) {
                    List<BillingFlowParams.ProductDetailsParams> subsParams = new ArrayList<>();
                    BillingFlowParams.ProductDetailsParams.Builder pdBuilder =
                            BillingFlowParams.ProductDetailsParams.newBuilder()
                                    .setProductDetails(details);
                    if (basePlanId != null) {
                        pdBuilder.setOfferToken(basePlanId);
                    } else if (details.getSubscriptionOfferDetails() != null
                            && !details.getSubscriptionOfferDetails().isEmpty()) {
                        pdBuilder.setOfferToken(details.getSubscriptionOfferDetails().get(0).getOfferToken());
                    }
                    subsParams.add(pdBuilder.build());
                    flowBuilder.setProductDetailsParamsList(subsParams);
                } else {
                    List<BillingFlowParams.ProductDetailsParams> inappParams = new ArrayList<>();
                    inappParams.add(BillingFlowParams.ProductDetailsParams.newBuilder()
                            .setProductDetails(details)
                            .build());
                    flowBuilder.setProductDetailsParamsList(inappParams);
                }

                pendingCall = call;
                BillingResult launch = billingClient.launchBillingFlow(getBridge().getActivity(), flowBuilder.build());
                if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    pendingCall = null;
                    call.reject("Billing flow failed: " + launch.getDebugMessage());
                }
            }
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        PluginCall call = pendingCall;
        pendingCall = null;
        if (call == null) return;

        if (result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            call.reject("Purchase cancelled");
            return;
        }
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || purchases == null || purchases.isEmpty()) {
            call.reject("Purchase failed: " + result.getDebugMessage());
            return;
        }

        // Return token to the web layer; the SERVER verifies before granting.
        Purchase purchase = purchases.get(0);
        if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED && !purchase.isAcknowledged()) {
            acknowledge(purchase);
        }

        JSObject data = new JSObject();
        data.put("productId", purchase.getProducts().isEmpty() ? null : purchase.getProducts().get(0));
        data.put("purchaseToken", purchase.getPurchaseToken());
        call.resolve(data);
    }

    private void acknowledge(Purchase purchase) {
        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(purchase.getPurchaseToken())
                .build();
        billingClient.acknowledgePurchase(params, new AcknowledgePurchaseResponseListener() {
            @Override
            public void onAcknowledgePurchaseResponse(BillingResult result) {
                // Acknowledged; entitlement still requires server verification.
            }
        });
    }

    @PluginMethod
    public void launchSubscriptionManagement(PluginCall call) {
        Activity activity = getBridge().getActivity();
        android.net.Uri uri = android.net.Uri.parse(
                "https://play.google.com/store/account/subscriptions?package=app.skillswap.mobile");
        android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_VIEW, uri);
        intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            activity.startActivity(intent);
            call.resolve();
        } catch (android.content.ActivityNotFoundException e) {
            call.reject("Could not open Google Play subscriptions");
        }
    }
}
