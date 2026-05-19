import { doc, getDoc } from "firebase/firestore";
import { getAppUser } from "./appSession";
import { auth, db } from "./firebase";

const getDisplayNameFromEmail = (email) => {
  if (!email) return "";
  return email.split("@")[0] || "";
};

export const normalizeUserProfile = (user) => {
  if (!user) return null;

  const email = user.email || "";
  const loginId = user.loginId || user.userId || user.uid || "";
  const nickname =
    user.nickname ||
    user.displayName ||
    user.name ||
    getDisplayNameFromEmail(email) ||
    loginId ||
    "User";

  return {
    uid: user.uid || "",
    email,
    loginId,
    nickname,
    photoURL:
      user.photoURL ||
      user.profileImageUrl ||
      user.profileImage ||
      user.avatarUrl ||
      "",
  };
};

export const getUserProfileByUid = async (uid) => {
  if (!uid) return null;

  const userSnap = await getDoc(doc(db, "users", uid));

  if (!userSnap.exists()) {
    return null;
  }

  return normalizeUserProfile({
    uid,
    ...userSnap.data(),
  });
};

export const getCurrentUserProfile = async () => {
  const firebaseUser = auth.currentUser;

  if (firebaseUser) {
    const storedProfile = await getUserProfileByUid(firebaseUser.uid);

    return normalizeUserProfile({
      uid: firebaseUser.uid,
      email: firebaseUser.email || "",
      displayName: firebaseUser.displayName || "",
      ...storedProfile,
      photoURL: storedProfile?.photoURL || firebaseUser.photoURL || "",
    });
  }

  return normalizeUserProfile(getAppUser());
};
