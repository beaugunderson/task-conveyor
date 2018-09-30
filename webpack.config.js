const path = require('path');
const webpackPlugins = require('./webpack-plugins');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const webpackOptions = {
  context: path.resolve(__dirname, './static'),

  mode: IS_PRODUCTION ? 'production' : 'development',

  // relative to js, thanks to resolve.modules config
  entry: {
    index: './task-conveyor.js'
  },

  resolve: {
    modules: [
      'node_modules'
    ],

    extensions: ['.js', '.scss']
  },

  plugins: webpackPlugins,

  module: {
    rules: [
      {
        test: [/\.js$/],
        exclude: /node_modules/,
        loader: 'babel-loader'
      },
      {
        test: /\.css$/,
        loader: ['style-loader', 'css-loader']
      },
      {
        test: /\.scss$/,
        loader: ['style-loader', 'css-loader', 'sass-loader']
      },
      {
        test: /\.jpe?g$|\.gif$|\.png$|\.ttf$|\.eot$|\.svg$/,
        use: 'file-loader?name=[name].[ext]?[hash]'
      },
      {
        test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        loader: 'url-loader?limit=10000&mimetype=application/fontwoff'
      }
    ]
  },

  output: {
    path: path.join(__dirname, 'dist'),
    filename: IS_PRODUCTION ? '[name].[chunkHash].js' : '[name].bundle.js',
    // publicPath
  }
};

if (!IS_PRODUCTION) {
  webpackOptions.devtool =
    process.env.WEBPACK_DEVTOOL !== undefined ? process.env.WEBPACK_DEVTOOL : 'eval-source-map';
}

module.exports = webpackOptions;
