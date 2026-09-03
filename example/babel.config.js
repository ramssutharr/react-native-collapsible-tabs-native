module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Reanimated 4 worklets — must stay last.
  plugins: ['react-native-worklets/plugin'],
};
