const path = require('path');

// Autolink the library from the repo root (it is not installed into this
// app's node_modules at all).
module.exports = {
  dependencies: {
    'react-native-collapsible-tabs-native': {
      root: path.join(__dirname, '..'),
    },
  },
};
