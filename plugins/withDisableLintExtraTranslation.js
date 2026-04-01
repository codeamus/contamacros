// plugins/withDisableLintExtraTranslation.js
// Deshabilita el check de Lint "ExtraTranslation" en Android.
//
// ¿Por qué? Expo genera valores en values-b+es/strings.xml desde locales/es.json,
// incluyendo claves propias de iOS como CFBundleDisplayName, NSCameraUsageDescription, etc.
// El Lint de Android falla porque esas claves no existen en values/strings.xml (locale por defecto).
// Como son claves generadas por el build system de Expo y no representan un bug real,
// la solución correcta es deshabilitar ese check específico.

const { withAppBuildGradle } = require("expo/config-plugins");

function withDisableLintExtraTranslation(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    // Evitar duplicar si ya fue aplicado
    if (contents.includes("disable 'ExtraTranslation'")) {
      return config;
    }

    // Insertar bloque lint dentro del bloque android { ... }
    config.modResults.contents = contents.replace(
      /^android\s*\{/m,
      `android {\n    lint {\n        disable 'ExtraTranslation'\n    }`
    );

    return config;
  });
}

module.exports = withDisableLintExtraTranslation;
