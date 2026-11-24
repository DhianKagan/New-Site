import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

function getFirebaseAuth() {
  if (!firebaseConfig?.apiKey || !firebaseConfig?.projectId) {
    return null;
  }
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getAuth(app);
}

export function getFirebaseProjectId(): string {
  return firebaseConfig?.projectId || '';
}

export async function signInWithGooglePopup(): Promise<{
  idToken: string;
  email: string;
  displayName: string;
}> {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase Auth не налаштовано');
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();
  return {
    idToken,
    email: result.user.email || '',
    displayName: result.user.displayName || result.user.email || 'Admin',
  };
}

export async function signOutFirebase(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  try {
    await signOut(auth);
  } catch {
    // non-blocking cleanup
  }
}
