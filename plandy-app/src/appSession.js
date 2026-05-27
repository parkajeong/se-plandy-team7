import { auth } from "./firebase";

const APP_USER_STORAGE_KEY = "plandy.appUser";
const APP_LOGOUT_STORAGE_KEY = "plandy.logoutInProgress";
export const APP_USER_CHANGED_EVENT = "plandy.appUserChanged";

let memoryAppUser = null;
let appLogoutInProgress = false;
const appUserListeners = new Set();
const appLogoutListeners = new Set();

const getLocalStorage = () => {
  if (typeof globalThis === "undefined") return null;
  return globalThis.localStorage || null;
};

const getStoredLogoutInProgress = () =>
  getLocalStorage()?.getItem(APP_LOGOUT_STORAGE_KEY) === "true";

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

const notifyAppLogoutChanged = () => {
  appLogoutListeners.forEach((listener) => listener(isAppLogoutInProgress()));
};

export const setAppUser = async (user) => {
  appLogoutInProgress = false;
  getLocalStorage()?.removeItem(APP_LOGOUT_STORAGE_KEY);
  notifyAppLogoutChanged();

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

export const clearAppUser = () => {
  memoryAppUser = null;
  getLocalStorage()?.removeItem(APP_USER_STORAGE_KEY);
  notifyAppUserChanged(null);
};

export const beginAppLogout = () => {
  appLogoutInProgress = true;
  getLocalStorage()?.setItem(APP_LOGOUT_STORAGE_KEY, "true");
  clearAppUser();
  notifyAppLogoutChanged();
};

export const cancelAppLogout = () => {
  appLogoutInProgress = false;
  getLocalStorage()?.removeItem(APP_LOGOUT_STORAGE_KEY);
  notifyAppLogoutChanged();
};

export const finishAppLogout = () => {
  appLogoutInProgress = false;
  getLocalStorage()?.removeItem(APP_LOGOUT_STORAGE_KEY);
  notifyAppLogoutChanged();
  notifyAppUserChanged(getAppUser());
};

export const isAppLogoutInProgress = () =>
  appLogoutInProgress || getStoredLogoutInProgress();

export const hasActiveSession = () => {
  if (isAppLogoutInProgress()) return false;
  return Boolean(auth.currentUser || getAppUser());
};

export const subscribeAppUserChange = (listener) => {
  appUserListeners.add(listener);

  return () => {
    appUserListeners.delete(listener);
  };
};

export const subscribeAppLogoutChange = (listener) => {
  appLogoutListeners.add(listener);

  return () => {
    appLogoutListeners.delete(listener);
  };
};

export const getCurrentAppUserIdOrNull = () => {
  if (isAppLogoutInProgress()) return null;

  const appUser = getAppUser();
  const userId =
    auth.currentUser?.uid ||
    appUser?.uid ||
    appUser?.id ||
    appUser?.user_id ||
    appUser?.userId;

  return userId ? String(userId) : null;
};

export const getCurrentAppUserId = () => {
  const userId = getCurrentAppUserIdOrNull();

  if (!userId) {
    throw new Error("로그인이 필요합니다.");
  }

  return userId;
};
