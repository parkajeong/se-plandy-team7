import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";

import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "./firebase";

export async function signUpWithEmail(email, password, nickname) {
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  const user = userCredential.user;

  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    email: user.email,
    provider: "password",
    nickname,
    created_at: serverTimestamp(),
  });

  return user;
}

export async function loginWithEmail(email, password) {
  const userCredential = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );

  return userCredential.user;
}