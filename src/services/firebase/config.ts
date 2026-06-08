import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  // @ts-expect-error - getReactNativePersistence existe no pacote mas
  // não é exportado nos tipos em algumas versões do firebase JS SDK.
  getReactNativePersistence,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Configuração do Firebase lida das variáveis de ambiente (.env).
 * Veja o arquivo .env.example para saber de onde tirar cada valor.
 */
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Evita reinicializar o app durante o "fast refresh" do Expo.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Auth precisa de persistência via AsyncStorage no React Native,
// senão o usuário é deslogado toda vez que fecha o app.
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // Se já foi inicializado (fast refresh), apenas recupera.
  auth = getAuth(app);
}

export const firebaseApp = app;
export const firebaseAuth = auth;
export const db = getFirestore(app);
export const storage = getStorage(app);

/**
 * Pequena checagem para avisar no console se o .env não foi
 * preenchido. Ajuda muito quem está começando.
 */
if (!firebaseConfig.apiKey) {
  console.warn(
    '[Bolão Flex] Firebase não configurado. Crie um arquivo .env a partir do .env.example.'
  );
}
