// Configuração do Metro (empacotador do Expo/React Native).
//
// Por que este arquivo existe: a partir do Expo SDK 53, o Metro passou a
// usar o campo "exports" do package.json por padrão. O Firebase JS SDK
// ainda não lida bem com isso e pode quebrar de formas estranhas (ex.:
// "Component auth has not been registered yet"). Desligar o
// `unstable_enablePackageExports` e registrar a extensão .cjs resolve.
//
// Referência: guia oficial "Use Firebase" do Expo.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
