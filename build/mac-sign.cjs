"use strict";
const { signAsync } = require("@electron/osx-sign");
// electron-builder 25 does not support the newer mac.sign.identity setting.
module.exports = async function sign(options) {
  await signAsync({
    ...options,
    identity: "-",
    identityValidation: false,
    preAutoEntitlements: false,
    preEmbedProvisioningProfile: false,
  });
};
