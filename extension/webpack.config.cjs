const path = require('path');
const webpack = require('webpack');
const { resolveApiOrigin } = require('../scripts/api-origin.cjs');

const { origin, production } = resolveApiOrigin();
console.log(
  production
    ? `extension API origin: ${origin} (production)`
    : `extension API origin: ${origin} (local development — set EXETAZO_API_ORIGIN for a production build)`,
);

module.exports = {
  mode: 'production',
  devtool: false,
  target: 'web',
  context: path.resolve(__dirname),
  entry: {
    background: './src/background.ts',
    contentScript: './src/content.ts',
    sidepanel: './src/sidepanel.ts',
    popup: './src/popup.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      __EXETAZO_API_BASE__: JSON.stringify(origin),
    }),
  ],
  optimization: {
    minimize: false,
  },
  performance: {
    hints: false,
  },
};
