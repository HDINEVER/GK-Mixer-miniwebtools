/**
 * Metro configuration for the pnpm (hoisted) monorepo.
 * - watchFolders: watch the whole monorepo so symlinked workspace
 *   packages (@gk-mixer/core) resolve and hot-reload.
 * - nodeModulesPaths: with node-linker=hoisted all JS deps live in the
 *   monorepo root node_modules.
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const workspaceRoot = path.resolve(__dirname, '../..');

const config = {
  projectRoot: __dirname,
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(workspaceRoot, 'node_modules'),
      path.resolve(__dirname, 'node_modules'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
