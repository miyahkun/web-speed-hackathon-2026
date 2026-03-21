const path = require("path");
const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");
const { LimitChunkCountPlugin } = webpack.optimize;

const SRC_PATH = path.resolve(__dirname, "./src");
const DIST_PATH = path.resolve(__dirname, "../dist");

/** @type {import('webpack').Configuration} */
const config = {
  target: "node",
  entry: path.resolve(SRC_PATH, "./entry-server.tsx"),
  mode: "production",
  output: {
    filename: "ssr.cjs",
    path: DIST_PATH,
    library: {
      type: "commonjs2",
    },
  },
  // 全ての依存をバンドルに含める（dist/ からの実行でもモジュール解決可能にする）
  externals: [],
  module: {
    rules: [
      {
        exclude: /node_modules/,
        test: /\.(jsx?|tsx?|mjs|cjs)$/,
        use: [
          {
            loader: "babel-loader",
            options: {
              presets: [
                ["@babel/preset-typescript"],
                ["@babel/preset-env", { targets: { node: "current" }, modules: false }],
                ["@babel/preset-react", { runtime: "automatic" }],
              ],
              // SSR ビルドでは react-compiler を無効化
              plugins: [],
            },
          },
        ],
      },
      {
        test: /\.css$/i,
        use: "null-loader",
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".mjs", ".cjs", ".jsx", ".js"],
    alias: {},
    fallback: {
      fs: false,
      path: false,
      url: false,
    },
  },
  plugins: [
    new LimitChunkCountPlugin({ maxChunks: 1 }),
  ],
  optimization: {
    minimize: false,
  },
};

module.exports = config;
