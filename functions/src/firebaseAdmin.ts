import * as admin from 'firebase-admin';

// Inicializa o Admin SDK uma única vez e compartilha entre os módulos
// de functions (evita erro de "app already initialized").
if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const db = admin.firestore();
export { admin };
