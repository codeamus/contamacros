// plugins/withHealthConnect.js
// Expo Config Plugin que agrega las declaraciones necesarias en AndroidManifest.xml
// para que Health Connect reconozca la app y la muestre en "Permisos de apps".

const { withAndroidManifest } = require("expo/config-plugins");

function withHealthConnect(config, { permissions = [] } = {}) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    // 1. Agregar <uses-permission> de salud
    if (!manifest.manifest["uses-permission"]) {
      manifest.manifest["uses-permission"] = [];
    }
    const existingPerms = new Set(
      manifest.manifest["uses-permission"].map(
        (p) => p.$?.["android:name"]
      )
    );
    for (const perm of permissions) {
      if (!existingPerms.has(perm)) {
        manifest.manifest["uses-permission"].push({
          $: { "android:name": perm },
        });
      }
    }

    // 2. Agregar <queries> para detectar Health Connect
    if (!manifest.manifest.queries) {
      manifest.manifest.queries = [];
    }
    // Verificar si ya existe el package query
    const hasHealthDataQuery = manifest.manifest.queries.some(
      (q) =>
        q.package &&
        q.package.some(
          (p) =>
            p.$?.["android:name"] ===
            "com.google.android.apps.healthdata"
        )
    );
    if (!hasHealthDataQuery) {
      manifest.manifest.queries.push({
        package: [
          {
            $: {
              "android:name": "com.google.android.apps.healthdata",
            },
          },
        ],
      });
    }

    // 3. Agregar intent-filter ACTION_SHOW_PERMISSIONS_RATIONALE a MainActivity
    const application = manifest.manifest.application[0];
    const mainActivity = application.activity.find(
      (a) => a.$?.["android:name"] === ".MainActivity"
    );

    if (mainActivity) {
      if (!mainActivity["intent-filter"]) {
        mainActivity["intent-filter"] = [];
      }

      const hasRationale = mainActivity["intent-filter"].some(
        (f) =>
          f.action &&
          f.action.some(
            (a) =>
              a.$?.["android:name"] ===
              "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE"
          )
      );

      if (!hasRationale) {
        mainActivity["intent-filter"].push({
          action: [
            {
              $: {
                "android:name":
                  "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE",
              },
            },
          ],
        });
      }
    }

    // 4. Agregar activity-alias para Android 14+ (VIEW_PERMISSION_USAGE)
    if (!application["activity-alias"]) {
      application["activity-alias"] = [];
    }

    const hasAlias = application["activity-alias"].some(
      (a) =>
        a.$?.["android:name"] ===
        "ViewPermissionUsageActivity"
    );

    if (!hasAlias) {
      application["activity-alias"].push({
        $: {
          "android:name": "ViewPermissionUsageActivity",
          "android:exported": "true",
          "android:targetActivity": ".MainActivity",
          "android:permission": "android.permission.START_VIEW_PERMISSION_USAGE",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name":
                    "android.intent.action.VIEW_PERMISSION_USAGE",
                },
              },
            ],
            category: [
              {
                $: {
                  "android:name": "android.intent.category.HEALTH_PERMISSIONS",
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
}

module.exports = withHealthConnect;
