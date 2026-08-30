/**
 * Google Play Billing bridge for the SkillSwap Android app (Capacitor).
 *
 * Loaded only inside the native Android shell. In the plain web build the
 * script is never injected, so the client gracefully falls back to
 * "purchase in the app" messaging.
 *
 * Product IDs are injected at build time via NativeVariables; the Play Store
 * remains the source of truth for prices.
 *
 * Flow (PRD §12–13):
 *   1. queryProductDetails / querySubscriptionOffers → local details
 *   2. launchBillingFlow → purchase
 *   3. purchase includes purchaseToken
 *   4. the app POSTs {productId, purchaseToken} to the SkillSwap server
 *   5. the SERVER verifies with Google Play Developer API → entitlements
 */
(function () {
  'use strict';

  var PLUGIN_CLASS = 'com.skillswap.billing.PlayBillingBridge';

  function exec(action, params, callback) {
    var bridge = window.capacitor || window.Capacitor;
    if (bridge && bridge.Plugin && bridge.Plugin[PLUGIN_CLASS]) {
      bridge.Plugin[PLUGIN_CLASS][action](params || {}).then(
        function (r) { callback(null, r); },
        function (e) { callback(e); }
      );
    } else if (window.AndroidBillingNative) {
      try {
        var result = window.AndroidBillingNative[action](JSON.stringify(params || {}));
        callback(null, JSON.parse(result));
      } catch (e) {
        callback(e);
      }
    } else {
      callback(new Error('Play Billing unavailable outside the Android app'));
    }
  }

  window.AndroidBilling = {
    /** Purchase a subscription plan (e.g. skillswap_gold_monthly). */
    purchaseSubscription: function (opts) {
      return new Promise(function (resolve, reject) {
        exec('purchaseSubscription', opts, function (err, result) {
          if (err) return reject(err);
          // The backend re-verifies this token with Google before granting.
          resolve({
            productId: result.productId || opts.productId,
            purchaseToken: result.purchaseToken || result.purchase_token,
            basePlanId: result.basePlanId || result.base_plan_id || null,
          });
        });
      });
    },

    /** Purchase a one-time boost product. */
    purchaseProduct: function (opts) {
      return new Promise(function (resolve, reject) {
        exec('purchaseProduct', opts, function (err, result) {
          if (err) return reject(err);
          resolve({
            productId: result.productId || opts.productId,
            purchaseToken: result.purchaseToken || result.purchase_token,
          });
        });
      });
    },

    /** Open the Play Store subscription management screen. */
    launchSubscriptionManagement: function () {
      return new Promise(function (resolve, reject) {
        exec('launchSubscriptionManagement', {}, function (err) {
          if (err) return reject(err);
          resolve();
        });
      });
    },
  };
})();
