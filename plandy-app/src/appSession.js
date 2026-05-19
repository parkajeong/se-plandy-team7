import { auth } from "./firebase";

const APP_USER_STORAGE_KEY = "plandy.appUser";
export const APP_USER_CHANGED_EVENT = "plandy.appUserChanged";

let memoryAppUser = null;
const appUserListeners = new Set();

const notifyAppUserChanged = (user) => {
  appUserListeners.forEach((listener) => listener(user));

  if (
    typeof globalThis.dispatchEvent === "function" &&
    typeof CustomEvent === "function"
  ) {
    globalThis.dispatchEvent(
      new CustomEvent(APP_USER_CHANGED_EVENT, { detail: user })
    );
  }
};

const getLocalStorage = () => {
  if (typeof globalThis === "undefined") return null;
  return globalThis.localStorage || null;
};

export const setAppUser = async (user) => {
  memoryAppUser = user;

  const storage = getLocalStorage();
  if (storage) {
    storage.setItem(APP_USER_STORAGE_KEY, JSON.stringify(user));
  }

  notifyAppUserChanged(user);
};

export const getAppUser = () => {
  if (memoryAppUser) return memoryAppUser;

  const storage = getLocalStorage();
  const storedUser = storage?.getItem(APP_USER_STORAGE_KEY);

  if (!storedUser) return null;

  try {
    memoryAppUser = JSON.parse(storedUser);
    return memoryAppUser;
  } catch {
    storage?.removeItem(APP_USER_STORAGE_KEY);
    return null;
  }
};

export const clearAppUser = async () => {
  memoryAppUser = null;
  getLocalStorage()?.removeItem(APP_USER_STORAGE_KEY);
  notifyAppUserChanged(null);
};

export const subscribeAppUserChange = (listener) => {
  appUserListeners.add(listener);

  return () => {
    appUserListeners.delete(listener);
  };
};

export const getCurrentAppUserIdOrNull = () => {
  return auth.currentUser?.uid || getAppUser()?.uid || null;
};

export const getCurrentAppUserId = () => {
  const userId = getCurrentAppUserIdOrNull();

  if (!userId) {
    throw new Error("로그인이 필요합니다.");
  }

  return userId;
};
