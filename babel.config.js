module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Otros plugins si tienes...
      'react-native-reanimated/plugin', // SIEMPRE AL FINAL
    ],
  };
};