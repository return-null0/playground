const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    name: 'AI Playground',
    executableName: 'ai-playground',
    icon: './imgs/icon',

  asar: {


      unpack: "**/node_modules/@tensorflow/tfjs-node/**/*"
    },
extraResource: [
      "./scripts/objDetectionWorker.js",
      "./models/image"
    ],

    extendInfo: {
      NSCameraUsageDescription: "This app requires camera access for AI vision."
    },
  },
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      // Disable these so the ad-hoc signed worker can talk to the main app
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
    }),
  ],
};