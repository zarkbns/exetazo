const path = require('path');

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
  optimization: {
    minimize: false,
  },
  performance: {
    hints: false,
  },
};
