const webpack = require('webpack');

const IS_PRODUCTION = process.env.PRODUCTION === 'true';

const exportedPlugins = [
  new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/)
];

if (IS_PRODUCTION) {
  exportedPlugins.push(
    new webpack.optimize.ModuleConcatenationPlugin()
  );
}

module.exports = exportedPlugins;
