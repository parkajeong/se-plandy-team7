import {
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  arrayRemove,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  beginAppLogout,
  clearAppUser,
  finishAppLogout,
  getCurrentAppUserIdOrNull,
} from "./appSession";
import { auth, db } from "./firebase";

const USER_SCOPED_COLLECTIONS = [
  "subjects",
  "todos",
  "schedules",
  "notes",
  "quizzes",
  "quiz_results",
];

export const getWithdrawAccountErrorMessage = (error) => {
  const code = error?.code || "";

  if (code === "auth/requires-recent-login") {
    return "보안을 위해 다시 인증한 후 회원 탈퇴를 진행해주세요.";
  }

  if (
    code === "auth/invalid-credential" ||
    code === "auth/wrong-password" ||
    code === "auth/user-not-found" ||
    code === "auth/invalid-email"
  ) {
    return "계정 인증에 실패했습니다. 아이디 또는 이메일과 비밀번호를 확인해주세요.";
  }

  return "회원 탈퇴 처리 중 오류가 발생했습니다.";
};

const deleteDocsByQuery = async (targetQuery) => {
  const snapshot = await getDocs(targetQuery);

  await Promise.all(
    snapshot.docs.map((snapshotDoc) => deleteDoc(snapshotDoc.ref))
  );
};

const resolveLoginEmail = async (idOrEmail) => {
  const trimmedIdOrEmail = idOrEmail.trim();

  if (!trimmedIdOrEmail) {
    throw new Error("아이디 또는 이메일을 입력해주세요.");
  }

  if (trimmedIdOrEmail.includes("@")) {
    return trimmedIdOrEmail;
  }

  const usernameSnap = await getDoc(doc(db, "usernames", trimmedIdOrEmail));

  if (!usernameSnap.exists()) {
    throw new Error("계정 인증에 실패했습니다. 아이디 또는 이메일과 비밀번호를 확인해주세요.");
  }

  return usernameSnap.data()?.email || "";
};

const deleteUserScopedDocuments = async (uid) => {
  await Promise.all(
    USER_SCOPED_COLLECTIONS.map((collectionName) =>
      deleteDocsByQuery(
        query(collection(db, collectionName), where("user_id", "==", uid))
      )
    )
  );

  await Promise.all([
    deleteDocsByQuery(
      query(collection(db, "schedules"), where("created_by", "==", uid))
    ),
    deleteDocsByQuery(
      query(collection(db, "notes"), where("created_by", "==", uid))
    ),
    deleteDocsByQuery(query(collection(db, "notes"), where("uid", "==", uid))),
  ]);
};

const deleteUsernameDocuments = async (uid, userInfo = {}) => {
  const userSnap = await getDoc(doc(db, "users", uid));
  const userData = userSnap.exists() ? userSnap.data() : {};
  const email = userInfo.email || userData.email || auth.currentUser?.email || "";
  const possibleDocIds = [
    userInfo.loginId,
    userInfo.username,
    userInfo.nickname,
    userData.loginId,
    userData.username,
    userData.nickname,
  ].filter(Boolean);

  await Promise.all(
    [...new Set(possibleDocIds)].map((docId) =>
      deleteDoc(doc(db, "usernames", String(docId)))
    )
  );

  await deleteDocsByQuery(
    query(collection(db, "usernames"), where("uid", "==", uid))
  );

  if (email) {
    await deleteDocsByQuery(
      query(collection(db, "usernames"), where("email", "==", email))
    );
  }
};

const deleteUserDocuments = async (uid, userInfo = {}) => {
  await deleteDoc(doc(db, "users", uid));

  const email = userInfo.email || auth.currentUser?.email || "";
  const kakaoId = userInfo.kakaoId || "";

  if (email) {
    await deleteDocsByQuery(
      query(collection(db, "users"), where("email", "==", email))
    );
  }

  if (kakaoId) {
    await deleteDocsByQuery(
      query(collection(db, "users"), where("kakaoId", "==", kakaoId))
    );
  }
};

const cleanupStudyGroups = async (uid) => {
  const groupsQuery = query(
    collection(db, "study_groups"),
    where("members", "array-contains", uid)
  );
  const groupsSnapshot = await getDocs(groupsQuery);

  await Promise.all(
    groupsSnapshot.docs.map(async (groupDoc) => {
      const groupData = groupDoc.data();

      if (groupData.host_id === uid) {
        await deleteDocsByQuery(
          query(
            collection(db, "schedules"),
            where("study_group_id", "==", groupDoc.id)
          )
        );
        await deleteDoc(groupDoc.ref);
        return;
      }

      const schedules = Array.isArray(groupData.schedules)
        ? groupData.schedules.filter((schedule) => schedule.created_by !== uid)
        : [];

      await updateDoc(groupDoc.ref, {
        members: arrayRemove(uid),
        [`available_times.${uid}`]: deleteField(),
        schedules,
        updated_at: new Date(),
      });
    })
  );
};

export const cleanupUserData = async (uid, userInfo = {}) => {
  if (!uid) {
    throw new Error("사용자 정보가 없습니다.");
  }

  await deleteUsernameDocuments(uid, userInfo);
  await cleanupStudyGroups(uid);
  await deleteUserScopedDocuments(uid);
  await deleteUserDocuments(uid, userInfo);
};

export const clearLocalSession = async () => {
  await signOut(auth).catch((error) => {
    console.log("[accountService] signOut during local session cleanup failed", error);
  });
  clearAppUser();
  finishAppLogout();
};

export const deleteAuthUserIfAvailable = async (user = auth.currentUser) => {
  if (!user) {
    return;
  }

  await deleteUser(user);
};

export const withdrawCurrentAccount = async () => {
  const currentUser = auth.currentUser;
  const uid = currentUser?.uid || getCurrentAppUserIdOrNull();

  beginAppLogout();

  try {
    await cleanupUserData(uid, currentUser || {});
    await deleteAuthUserIfAvailable(currentUser);
    clearAppUser();
    finishAppLogout();
  } catch (error) {
    console.log("[accountService] withdrawCurrentAccount failed", error);
    await clearLocalSession();
    throw error;
  }
};

export const withdrawAccountWithPassword = async ({ idOrEmail, password }) => {
  if (!password) {
    throw new Error("비밀번호를 입력해주세요.");
  }

  beginAppLogout();

  try {
    const email = await resolveLoginEmail(idOrEmail);

    if (!email) {
      throw new Error("계정 인증에 실패했습니다. 아이디 또는 이메일과 비밀번호를 확인해주세요.");
    }

    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    await cleanupUserData(user.uid, user);
    await deleteAuthUserIfAvailable(user);
    clearAppUser();
    finishAppLogout();
  } catch (error) {
    console.log("[accountService] withdrawAccountWithPassword failed", error);
    await clearLocalSession();
    throw error;
  }
};

export const authenticateWithPasswordForWithdraw = async ({
  idOrEmail,
  password,
}) => {
  if (!password) {
    throw new Error("비밀번호를 입력해주세요.");
  }

  beginAppLogout();

  try {
    const email = await resolveLoginEmail(idOrEmail);

    if (!email) {
      throw new Error("계정 인증에 실패했습니다. 아이디 또는 이메일과 비밀번호를 확인해주세요.");
    }

    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    return userCredential.user;
  } catch (error) {
    console.log("[accountService] authenticateWithPasswordForWithdraw failed", error);
    await clearLocalSession();
    throw error;
  }
};

export const withdrawFirebaseAuthAccount = async (user) => {
  beginAppLogout();

  try {
    await cleanupUserData(user?.uid, user || {});
    await deleteAuthUserIfAvailable(user);
    clearAppUser();
    finishAppLogout();
  } catch (error) {
    console.log("[accountService] withdrawFirebaseAuthAccount failed", error);
    await clearLocalSession();
    throw error;
  }
};

export const withdrawExternalAppAccount = async (appUser) => {
  beginAppLogout();

  try {
    const uid =
      appUser?.uid || appUser?.id || appUser?.user_id || appUser?.userId || "";

    await cleanupUserData(String(uid), appUser || {});

    if (auth.currentUser?.uid === uid) {
      await deleteAuthUserIfAvailable(auth.currentUser);
    }

    clearAppUser();
    finishAppLogout();
  } catch (error) {
    console.log("[accountService] withdrawExternalAppAccount failed", error);
    await clearLocalSession();
    throw error;
  }
};
