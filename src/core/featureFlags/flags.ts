// src/core/featureFlags/flags.ts
export type FeatureFlags = {
  barcodeScanUnlimited: boolean;
  advancedHistory: boolean;
  advancedCharts: boolean;
  healthIntegrations: boolean;
  multiDeviceSync: boolean;
  dataExport: boolean;
  insights: boolean;
};

export const FREE_FLAGS: FeatureFlags = {
  barcodeScanUnlimited: false,
  advancedHistory: false,
  advancedCharts: false,
  healthIntegrations: false,
  multiDeviceSync: false,
  dataExport: false,
  insights: false,
};

export const PREMIUM_FLAGS: FeatureFlags = {
  barcodeScanUnlimited: true,
  advancedHistory: true,
  advancedCharts: true,
  healthIntegrations: true,
  multiDeviceSync: true,
  dataExport: true,
  insights: true,
};
