const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

// The example consumes the library FROM THE REPO ROOT — no copy, no nested
// node_modules. Metro watches the root so edits to ../src and the native
// sources hot-reload; react/react-native must resolve to the EXAMPLE's copies
// (the root's devDependency copies are blocked) or hooks break with two
// Reacts.
const root = path.resolve(__dirname, '..');

const config = {
  watchFolders: [root],
  resolver: {
    extraNodeModules: {
      'react-native-collapsible-tabs-native': root,
      react: path.join(__dirname, 'node_modules', 'react'),
      'react-native': path.join(__dirname, 'node_modules', 'react-native'),
    },
    blockList: [
      new RegExp(path.join(root, 'node_modules', 'react') + '/.*'),
      new RegExp(path.join(root, 'node_modules', 'react-native') + '/.*'),
      new RegExp(path.join(root, 'example', 'node_modules', 'react-native-collapsible-tabs-native') + '/.*'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
