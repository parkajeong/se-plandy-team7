import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  FlatList,
  Modal,
  Platform,
} from "react-native";

import { useFocusEffect } from "expo-router";
import * as Notifications from "expo-notifications";

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";
import { COLORS } from "@/constants/theme";
import { auth, db } from "@/src/firebase";
import { getAppUser, subscribeAppUserChange } from "../../src/appSession";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type ReminderType =
  | "none"
  | "at_time"
  | "ten_minutes_before"
  | "one_hour_before"
  | "one_day_before"
  | "custom";

type ReminderUnit = "minute" | "hour" | "day";

export default function ScheduleScreen() {
  const [userId, setUserId] = useState<string | null>(null);

  const [isAddScheduleModalVisible, setIsAddScheduleModalVisible] = useState(false);

  const [title, setTitle] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState(9);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [type, setType] = useState("");

  const [schedules, setSchedules] = useState<any[]>([]);

  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarTarget, setCalendarTarget] = useState<"add" | "edit">("add");

  const [isReminderModalVisible, setIsReminderModalVisible] = useState(false);
  const [reminderTarget, setReminderTarget] = useState<"add" | "edit">("add");

  const [reminderType, setReminderType] = useState<ReminderType>("none");
  const [customReminderValue, setCustomReminderValue] = useState("1");
  const [customReminderUnit, setCustomReminderUnit] =
    useState<ReminderUnit>("minute");

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(
    null
  );
  const [editingNotificationId, setEditingNotificationId] =
    useState<string | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [editHour, setEditHour] = useState(9);
  const [editMinute, setEditMinute] = useState(0);
  const [editType, setEditType] = useState("");

  const [editReminderType, setEditReminderType] =
    useState<ReminderType>("none");
  const [editCustomReminderValue, setEditCustomReminderValue] = useState("1");
  const [editCustomReminderUnit, setEditCustomReminderUnit] =
    useState<ReminderUnit>("minute");

  const [isDeleteScheduleModalVisible, setIsDeleteScheduleModalVisible] =
    useState(false);
  const [deletingSchedule, setDeletingSchedule] = useState<any | null>(null);

  const getAppUserIdOrNull = useCallback(() => {
    const appUser = getAppUser();

    if (appUser?.uid) {
      return String(appUser.uid);
    }

    if (appUser?.id) {
      return String(appUser.id);
    }

    if (appUser?.user_id) {
      return String(appUser.user_id);
    }

    if (appUser?.userId) {
      return String(appUser.userId);
    }

    return null;
  }, []);

  const syncUserId = useCallback(() => {
    const firebaseUser = auth.currentUser;

    if (firebaseUser) {
      setUserId(firebaseUser.uid);
      return;
    }

    const appUserId = getAppUserIdOrNull();

    if (appUserId) {
      setUserId(appUserId);
      return;
    }

    setUserId(null);
  }, [getAppUserIdOrNull]);

  useEffect(() => {
    const unsubscribeFirebase = onAuthStateChanged(auth, () => {
      syncUserId();
    });

    const unsubscribeAppUser = subscribeAppUserChange(() => {
      syncUserId();
    });

    syncUserId();

    return () => {
      unsubscribeFirebase();
      unsubscribeAppUser();
    };
  }, [syncUserId]);

  const formatDate = (targetDate: Date) => {
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, "0");
    const day = String(targetDate.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const formatTime = (hour: number, minute: number) => {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  const toDateObject = useCallback((value: any) => {
    if (!value) {
      return null;
    }

    if (value.toDate) {
      return value.toDate();
    }

    if (value instanceof Date) {
      return value;
    }

    const convertedDate = new Date(value);

    if (Number.isNaN(convertedDate.getTime())) {
      return null;
    }

    return convertedDate;
  }, []);

  const combineDateAndTime = (date: Date, hour: number, minute: number) => {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      hour,
      minute,
      0
    );
  };

  const formatScheduleDate = (value: any) => {
    const date = toDateObject(value);

    if (!date) {
      return "";
    }

    return `${formatDate(date)} ${formatTime(date.getHours(), date.getMinutes())}`;
  };

  const getTimeValue = useCallback((value: any) => {
    const date = toDateObject(value);

    if (!date) {
      return 0;
    }

    return date.getTime();
  }, [toDateObject]);

  const getDdayText = (value: any) => {
    const targetDate = toDateObject(value);

    if (!targetDate) {
      return "";
    }

    const today = new Date();

    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    const targetStart = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate()
    );

    const diffTime = targetStart.getTime() - todayStart.getTime();
    const diffDay = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDay > 0) {
      return `D-${diffDay}`;
    }

    if (diffDay === 0) {
      return "D-Day";
    }

    return `D+${Math.abs(diffDay)}`;
  };

  const getReminderLabel = (
    targetReminderType: ReminderType,
    targetCustomValue: string,
    targetCustomUnit: ReminderUnit
  ) => {
    if (targetReminderType === "none") {
      return "알림 없음";
    }

    if (targetReminderType === "at_time") {
      return "일정 시작시간";
    }

    if (targetReminderType === "ten_minutes_before") {
      return "10분 전";
    }

    if (targetReminderType === "one_hour_before") {
      return "1시간 전";
    }

    if (targetReminderType === "one_day_before") {
      return "1일 전";
    }

    const unitLabel =
      targetCustomUnit === "minute"
        ? "분"
        : targetCustomUnit === "hour"
          ? "시간"
          : "일";

    return `${targetCustomValue}${unitLabel} 전`;
  };

  const requestNotificationPermission = async () => {
    if (Platform.OS === "web") {
      return false;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("schedule-reminder", {
        name: "일정 알림",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === "granted";
  };

  const getReminderDate = (
    scheduleDateTime: Date,
    targetReminderType: ReminderType,
    targetCustomValue: string,
    targetCustomUnit: ReminderUnit
  ) => {
    if (targetReminderType === "none") {
      return null;
    }

    const reminderDate = new Date(scheduleDateTime);

    if (targetReminderType === "at_time") {
      return reminderDate;
    }

    if (targetReminderType === "ten_minutes_before") {
      reminderDate.setMinutes(reminderDate.getMinutes() - 10);
      return reminderDate;
    }

    if (targetReminderType === "one_hour_before") {
      reminderDate.setHours(reminderDate.getHours() - 1);
      return reminderDate;
    }

    if (targetReminderType === "one_day_before") {
      reminderDate.setDate(reminderDate.getDate() - 1);
      return reminderDate;
    }

    const customValue = Number(targetCustomValue);

    if (
      !Number.isInteger(customValue) ||
      customValue < 1 ||
      customValue > 365
    ) {
      return null;
    }

    if (targetCustomUnit === "minute") {
      reminderDate.setMinutes(reminderDate.getMinutes() - customValue);
    }

    if (targetCustomUnit === "hour") {
      reminderDate.setHours(reminderDate.getHours() - customValue);
    }

    if (targetCustomUnit === "day") {
      reminderDate.setDate(reminderDate.getDate() - customValue);
    }

    return reminderDate;
  };

  const scheduleReminderNotification = async (
    scheduleTitle: string,
    scheduleDateTime: Date,
    targetReminderType: ReminderType,
    targetCustomValue: string,
    targetCustomUnit: ReminderUnit
  ) => {
    if (Platform.OS === "web") {
      return null;
    }

    if (targetReminderType === "none") {
      return null;
    }

    const reminderDate = getReminderDate(
      scheduleDateTime,
      targetReminderType,
      targetCustomValue,
      targetCustomUnit
    );

    if (!reminderDate) {
      Alert.alert("오류", "알림 설정 값을 확인해주세요.");
      return null;
    }

    const secondsUntilReminder = Math.ceil(
      (reminderDate.getTime() - Date.now()) / 1000
    );

    if (secondsUntilReminder < 60) {
      Alert.alert(
        "알림 예약 불가",
        "알림 시간이 너무 가깝거나 이미 지났습니다. 최소 1분 이후로 설정해주세요."
      );
      return null;
    }

    const hasPermission = await requestNotificationPermission();

    if (!hasPermission) {
      Alert.alert(
        "알림 권한 필요",
        "일정 알림을 받으려면 알림 권한을 허용해주세요."
      );
      return null;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "일정 알림",
        body: `${scheduleTitle} 일정이 예정되어 있습니다.`,
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: {
          screen: "schedule",
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntilReminder,
        channelId: "schedule-reminder",
      } as any,
    });

    return notificationId;
  };

  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const firstDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: (number | null)[] = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }

    for (let day = 1; day <= totalDays; day++) {
      days.push(day);
    }

    while (days.length % 7 !== 0) {
      days.push(null);
    }

    return days;
  };

  const getCalendarWeeks = () => {
    const days = getCalendarDays();
    const weeks: (number | null)[][] = [];

    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return weeks;
  };

  const handlePrevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );
  };

  const handleSelectDate = (day: number) => {
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );

    if (calendarTarget === "add") {
      setSelectedDate(date);
    } else {
      setEditDate(date);
    }
  };

  const increaseHour = () => {
    if (calendarTarget === "add") {
      setSelectedHour((prev) => (prev + 1) % 24);
    } else {
      setEditHour((prev) => (prev + 1) % 24);
    }
  };

  const decreaseHour = () => {
    if (calendarTarget === "add") {
      setSelectedHour((prev) => (prev - 1 + 24) % 24);
    } else {
      setEditHour((prev) => (prev - 1 + 24) % 24);
    }
  };

  const increaseMinute = () => {
    if (calendarTarget === "add") {
      setSelectedMinute((prev) => (prev + 5) % 60);
    } else {
      setEditMinute((prev) => (prev + 5) % 60);
    }
  };

  const decreaseMinute = () => {
    if (calendarTarget === "add") {
      setSelectedMinute((prev) => (prev - 5 + 60) % 60);
    } else {
      setEditMinute((prev) => (prev - 5 + 60) % 60);
    }
  };

  const handleConfirmCalendar = () => {
    const targetDate = calendarTarget === "add" ? selectedDate : editDate;

    if (!targetDate) {
      Alert.alert("오류", "날짜를 선택해주세요.");
      return;
    }

    setIsCalendarVisible(false);
  };

  const fetchSchedules = useCallback(async () => {
    if (!userId) {
      setSchedules([]);
      return;
    }

    try {
      const q = query(
        collection(db, "schedules"),
        where("user_id", "==", userId)
      );

      const querySnapshot = await getDocs(q);

      const data: any[] = [];

      querySnapshot.forEach((doc) => {
        data.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      data.sort((a, b) => {
        return getTimeValue(a.start_time) - getTimeValue(b.start_time);
      });

      setSchedules(data);
    } catch (error) {
      void error;
      Alert.alert("오류", "일정 조회 실패");
    }
  }, [getTimeValue, userId]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  useFocusEffect(
    useCallback(() => {
      syncUserId();
      fetchSchedules();
    }, [fetchSchedules, syncUserId])
  );

  const validateCustomReminder = (
    targetReminderType: ReminderType,
    targetCustomValue: string
  ) => {
    if (targetReminderType !== "custom") {
      return true;
    }

    const value = Number(targetCustomValue);

    return Number.isInteger(value) && value >= 1 && value <= 365;
  };

  const handleAddSchedule = async () => {
    if (!userId) {
      Alert.alert("오류", "로그인 후 일정을 등록할 수 있습니다.");
      return;
    }

    if (!title || !selectedDate || !type) {
      Alert.alert("오류", "모든 항목을 입력해주세요.");
      return;
    }

    if (!validateCustomReminder(reminderType, customReminderValue)) {
      Alert.alert("오류", "직접 설정 숫자는 1부터 365까지 입력해주세요.");
      return;
    }

    try {
      const scheduleDateTime = combineDateAndTime(
        selectedDate,
        selectedHour,
        selectedMinute
      );

      const notificationId = await scheduleReminderNotification(
        title,
        scheduleDateTime,
        reminderType,
        customReminderValue,
        customReminderUnit
      );

      await addDoc(collection(db, "schedules"), {
        user_id: userId,
        title: title,
        start_time: scheduleDateTime,
        end_time: scheduleDateTime,
        description: type,
        created_at: new Date(),
        reminder_type: reminderType,
        custom_reminder_value:
          reminderType === "custom" ? Number(customReminderValue) : null,
        custom_reminder_unit:
          reminderType === "custom" ? customReminderUnit : null,
        notification_id: notificationId,
      });

      Alert.alert("성공", "일정이 등록되었습니다.");

      setTitle("");
      setSelectedDate(null);
      setSelectedHour(9);
      setSelectedMinute(0);
      setType("");
      setReminderType("none");
      setCustomReminderValue("1");
      setCustomReminderUnit("minute");
      setIsAddScheduleModalVisible(false);

      fetchSchedules();
    } catch (error) {
      void error;
      Alert.alert("오류", "일정 등록 실패");
    }
  };

  const openAddScheduleModal = () => {
    if (!userId) {
      Alert.alert("오류", "로그인 후 일정을 등록할 수 있습니다.");
      return;
    }

    setTitle("");
    setSelectedDate(null);
    setSelectedHour(9);
    setSelectedMinute(0);
    setType("");
    setReminderType("none");
    setCustomReminderValue("1");
    setCustomReminderUnit("minute");
    setIsAddScheduleModalVisible(true);
  };

  const handleOpenEditModal = (schedule: any) => {
    const scheduleDate = toDateObject(schedule.start_time) || new Date();

    setEditingScheduleId(schedule.id);
    setEditingNotificationId(schedule.notification_id || null);

    setEditTitle(schedule.title || "");
    setEditDate(scheduleDate);
    setEditHour(scheduleDate.getHours());
    setEditMinute(scheduleDate.getMinutes());
    setEditType(schedule.description || "");

    setEditReminderType(schedule.reminder_type || "none");
    setEditCustomReminderValue(
      schedule.custom_reminder_value
        ? String(schedule.custom_reminder_value)
        : "1"
    );
    setEditCustomReminderUnit(schedule.custom_reminder_unit || "minute");

    setIsEditModalVisible(true);
  };

  const handleUpdateSchedule = async () => {
    if (!userId) {
      Alert.alert("오류", "로그인 후 일정을 수정할 수 있습니다.");
      return;
    }

    if (!editingScheduleId || !editTitle || !editDate || !editType) {
      Alert.alert("오류", "모든 항목을 입력해주세요.");
      return;
    }

    if (!validateCustomReminder(editReminderType, editCustomReminderValue)) {
      Alert.alert("오류", "직접 설정 숫자는 1부터 365까지 입력해주세요.");
      return;
    }

    try {
      if (editingNotificationId && Platform.OS !== "web") {
        await Notifications.cancelScheduledNotificationAsync(
          editingNotificationId
        );
      }

      const scheduleDateTime = combineDateAndTime(
        editDate,
        editHour,
        editMinute
      );

      const notificationId = await scheduleReminderNotification(
        editTitle,
        scheduleDateTime,
        editReminderType,
        editCustomReminderValue,
        editCustomReminderUnit
      );

      const scheduleRef = doc(db, "schedules", editingScheduleId);

      await updateDoc(scheduleRef, {
        title: editTitle,
        start_time: scheduleDateTime,
        end_time: scheduleDateTime,
        description: editType,
        reminder_type: editReminderType,
        custom_reminder_value:
          editReminderType === "custom" ? Number(editCustomReminderValue) : null,
        custom_reminder_unit:
          editReminderType === "custom" ? editCustomReminderUnit : null,
        notification_id: notificationId,
      });

      Alert.alert("성공", "일정이 수정되었습니다.");

      setIsEditModalVisible(false);
      setEditingScheduleId(null);
      setEditingNotificationId(null);
      setEditTitle("");
      setEditDate(null);
      setEditHour(9);
      setEditMinute(0);
      setEditType("");
      setEditReminderType("none");
      setEditCustomReminderValue("1");
      setEditCustomReminderUnit("minute");

      fetchSchedules();
    } catch (error) {
      void error;
      Alert.alert("오류", "일정 수정 실패");
    }
  };

  const deleteSchedule = async (schedule: any) => {
    try {
      if (schedule.notification_id && Platform.OS !== "web") {
        await Notifications.cancelScheduledNotificationAsync(
          schedule.notification_id
        );
      }

      await deleteDoc(doc(db, "schedules", schedule.id));

      setIsDeleteScheduleModalVisible(false);
      setDeletingSchedule(null);

      Alert.alert("성공", "일정이 삭제되었습니다.");
      fetchSchedules();
    } catch (error) {
      void error;
      Alert.alert("오류", "일정 삭제 실패");
    }
  };

  const handleDeleteSchedule = (schedule: any) => {
    if (!userId) {
      Alert.alert("오류", "로그인 후 일정을 삭제할 수 있습니다.");
      return;
    }

    setDeletingSchedule(schedule);
    setIsDeleteScheduleModalVisible(true);
  };

  const currentSelectedDate =
    calendarTarget === "add" ? selectedDate : editDate;

  const currentSelectedHour =
    calendarTarget === "add" ? selectedHour : editHour;

  const currentSelectedMinute =
    calendarTarget === "add" ? selectedMinute : editMinute;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>일정</Text>
          <Text style={styles.screenSubtitle}>등록된 일정을 확인하세요</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={openAddScheduleModal}>
          <Text style={styles.addButtonText}>+ 일정 추가</Text>
        </TouchableOpacity>
      </View>

      {!userId && (
        <Text style={styles.loginNotice}>
          로그인 후 일정 등록 및 조회가 가능합니다.
        </Text>
      )}

      <Text style={styles.listTitle}>등록된 일정</Text>

      <FlatList
        data={schedules}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {userId
              ? "등록된 일정이 없어요. 일정을 추가해보세요!"
              : "로그인 후 등록된 일정을 확인할 수 있습니다."}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.scheduleTitle}>{item.title}</Text>
              <Text style={styles.ddayText}>{getDdayText(item.start_time)}</Text>
            </View>

            <Text style={styles.scheduleText}>
              날짜/시간: {formatScheduleDate(item.start_time)}
            </Text>

            <Text style={styles.scheduleText}>유형: {item.description}</Text>

            <Text style={styles.scheduleText}>
              알림:{" "}
              {getReminderLabel(
                item.reminder_type || "none",
                item.custom_reminder_value
                  ? String(item.custom_reminder_value)
                  : "1",
                item.custom_reminder_unit || "minute"
              )}
            </Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => handleOpenEditModal(item)}
              >
                <Text style={styles.editButtonText}>수정</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteSchedule(item)}
              >
                <Text style={styles.deleteButtonText}>삭제</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* 일정 등록 모달 */}
      <Modal
        visible={isAddScheduleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddScheduleModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.addModalContainer}>
            <Text style={styles.modalTitle}>일정 등록</Text>

            <TextInput
              style={styles.input}
              placeholder="일정 제목"
              value={title}
              onChangeText={setTitle}
            />

            <TouchableOpacity
              style={styles.input}
              onPress={() => {
                setCalendarTarget("add");
                setIsCalendarVisible(true);
              }}
            >
              <Text style={selectedDate ? styles.dateText : styles.placeholderText}>
                {selectedDate
                  ? `${formatDate(selectedDate)} ${formatTime(
                      selectedHour,
                      selectedMinute
                    )}`
                  : "날짜 및 시간 선택"}
              </Text>
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="유형 (시험 / 과제 / 공부)"
              value={type}
              onChangeText={setType}
            />

            <TouchableOpacity
              style={styles.input}
              onPress={() => {
                setReminderTarget("add");
                setIsReminderModalVisible(true);
              }}
            >
              <Text style={styles.dateText}>
                알림:{" "}
                {getReminderLabel(
                  reminderType,
                  customReminderValue,
                  customReminderUnit
                )}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={handleAddSchedule}>
              <Text style={styles.buttonText}>등록하기</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setIsAddScheduleModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 일정 수정 모달 */}
      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.editModalContainer}>
            <Text style={styles.modalTitle}>일정 수정</Text>

            <TextInput
              style={styles.input}
              placeholder="일정 제목"
              value={editTitle}
              onChangeText={setEditTitle}
            />

            <TouchableOpacity
              style={styles.input}
              onPress={() => {
                setCalendarTarget("edit");
                setIsCalendarVisible(true);
              }}
            >
              <Text style={editDate ? styles.dateText : styles.placeholderText}>
                {editDate
                  ? `${formatDate(editDate)} ${formatTime(editHour, editMinute)}`
                  : "날짜 및 시간 선택"}
              </Text>
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="유형 (시험 / 과제 / 공부)"
              value={editType}
              onChangeText={setEditType}
            />

            <TouchableOpacity
              style={styles.input}
              onPress={() => {
                setReminderTarget("edit");
                setIsReminderModalVisible(true);
              }}
            >
              <Text style={styles.dateText}>
                알림:{" "}
                {getReminderLabel(
                  editReminderType,
                  editCustomReminderValue,
                  editCustomReminderUnit
                )}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.button}
              onPress={handleUpdateSchedule}
            >
              <Text style={styles.buttonText}>수정 완료</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setIsEditModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 알림 설정 모달 */}
      <Modal
        visible={isReminderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsReminderModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.reminderModalContainer}>
            <Text style={styles.modalTitle}>알림 설정</Text>

            {[
              { label: "알림 없음", value: "none" },
              { label: "일정 시작시간", value: "at_time" },
              { label: "10분 전", value: "ten_minutes_before" },
              { label: "1시간 전", value: "one_hour_before" },
              { label: "1일 전", value: "one_day_before" },
              { label: "직접 설정", value: "custom" },
            ].map((item) => {
              const currentValue =
                reminderTarget === "add" ? reminderType : editReminderType;

              const isSelected = currentValue === item.value;

              return (
                <TouchableOpacity
                  key={item.value}
                  style={styles.reminderOption}
                  onPress={() => {
                    if (reminderTarget === "add") {
                      setReminderType(item.value as ReminderType);
                    } else {
                      setEditReminderType(item.value as ReminderType);
                    }
                  }}
                >
                  <Text style={styles.reminderOptionText}>
                    {isSelected ? "●" : "○"} {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {(reminderTarget === "add"
              ? reminderType === "custom"
              : editReminderType === "custom") && (
              <View style={styles.customReminderBox}>
                <Text style={styles.customReminderTitle}>직접 설정</Text>

                <TextInput
                  style={styles.customNumberInput}
                  keyboardType="number-pad"
                  placeholder="1~365"
                  value={
                    reminderTarget === "add"
                      ? customReminderValue
                      : editCustomReminderValue
                  }
                  onChangeText={(text) => {
                    const onlyNumber = text.replace(/[^0-9]/g, "");

                    if (reminderTarget === "add") {
                      setCustomReminderValue(onlyNumber);
                    } else {
                      setEditCustomReminderValue(onlyNumber);
                    }
                  }}
                />

                <View style={styles.unitRow}>
                  {[
                    { label: "분", value: "minute" },
                    { label: "시간", value: "hour" },
                    { label: "일", value: "day" },
                  ].map((unit) => {
                    const currentUnit =
                      reminderTarget === "add"
                        ? customReminderUnit
                        : editCustomReminderUnit;

                    const isSelected = currentUnit === unit.value;

                    return (
                      <TouchableOpacity
                        key={unit.value}
                        style={[
                          styles.unitButton,
                          isSelected && styles.selectedUnitButton,
                        ]}
                        onPress={() => {
                          if (reminderTarget === "add") {
                            setCustomReminderUnit(unit.value as ReminderUnit);
                          } else {
                            setEditCustomReminderUnit(unit.value as ReminderUnit);
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.unitButtonText,
                            isSelected && styles.selectedUnitButtonText,
                          ]}
                        >
                          {unit.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.customReminderGuide}>
                  1부터 365까지 입력할 수 있습니다.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsReminderModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 달력 + 시간 선택 모달 */}
      <Modal
        visible={isCalendarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCalendarVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={handlePrevMonth}>
                <Text style={styles.monthButton}>‹</Text>
              </TouchableOpacity>

              <Text style={styles.monthTitle}>
                {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
              </Text>

              <TouchableOpacity onPress={handleNextMonth}>
                <Text style={styles.monthButton}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {["일", "월", "화", "수", "목", "금", "토"].map((weekDay) => (
                <Text key={weekDay} style={styles.weekText}>
                  {weekDay}
                </Text>
              ))}
            </View>

            <View style={styles.daysContainer}>
              {getCalendarWeeks().map((week, weekIndex) => (
                <View key={weekIndex} style={styles.dayRow}>
                  {week.map((day, dayIndex) => {
                    const isSelected =
                      currentSelectedDate &&
                      currentSelectedDate.getFullYear() ===
                        currentMonth.getFullYear() &&
                      currentSelectedDate.getMonth() ===
                        currentMonth.getMonth() &&
                      currentSelectedDate.getDate() === day;

                    return (
                      <TouchableOpacity
                        key={dayIndex}
                        style={[
                          styles.dayBox,
                          isSelected && styles.selectedDayBox,
                        ]}
                        disabled={day === null}
                        onPress={() => day && handleSelectDate(day)}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            isSelected && styles.selectedDayText,
                          ]}
                        >
                          {day || ""}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>

            <View style={styles.timeSelector}>
              <Text style={styles.timeSelectorTitle}>시간 선택</Text>

              <View style={styles.timeRow}>
                <View style={styles.timeControl}>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={increaseHour}
                  >
                    <Text style={styles.timeButtonText}>＋</Text>
                  </TouchableOpacity>

                  <Text style={styles.timeValue}>
                    {String(currentSelectedHour).padStart(2, "0")}시
                  </Text>

                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={decreaseHour}
                  >
                    <Text style={styles.timeButtonText}>－</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.timeControl}>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={increaseMinute}
                  >
                    <Text style={styles.timeButtonText}>＋</Text>
                  </TouchableOpacity>

                  <Text style={styles.timeValue}>
                    {String(currentSelectedMinute).padStart(2, "0")}분
                  </Text>

                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={decreaseMinute}
                  >
                    <Text style={styles.timeButtonText}>－</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleConfirmCalendar}
            >
              <Text style={styles.closeButtonText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 일정 삭제 확인 모달 */}
      <Modal
        visible={isDeleteScheduleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsDeleteScheduleModalVisible(false);
          setDeletingSchedule(null);
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.deleteModalContainer}>
            <Text style={styles.modalTitle}>일정 삭제</Text>

            <Text style={styles.deleteModalText}>
              이 일정을 삭제하시겠습니까?
            </Text>

            <View style={styles.deleteModalButtonRow}>
              <TouchableOpacity
                style={styles.deleteCancelButton}
                onPress={() => {
                  setIsDeleteScheduleModalVisible(false);
                  setDeletingSchedule(null);
                }}
              >
                <Text style={styles.deleteCancelButtonText}>취소</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteConfirmButton}
                onPress={() => {
                  if (deletingSchedule) {
                    deleteSchedule(deletingSchedule);
                  }
                }}
              >
                <Text style={styles.deleteConfirmButtonText}>삭제</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  screenTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
  },

  screenSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.subText,
  },

  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  addButtonText: {
    color: COLORS.buttonText,
    fontSize: 14,
    fontWeight: "600",
  },

  loginNotice: { color: "#EF4444", marginBottom: 15, fontSize: 15 },

  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    justifyContent: "center",
  },

  dateText: { fontSize: 16, color: "#000" },
  placeholderText: { fontSize: 16, color: "#9CA3AF" },

  button: {
    backgroundColor: "#ff6a92",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 15,
  },

  buttonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  listTitle: { fontSize: 22, fontWeight: "bold", marginBottom: 15 },
  listContent: { paddingBottom: 100 },
  emptyText: { color: "#6B7280", marginTop: 10 },

  card: {
    backgroundColor: "#F8F8FA",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  scheduleTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
    flex: 1,
  },

  ddayText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#EF4444",
    marginLeft: 10,
  },

  scheduleText: { fontSize: 16, marginTop: 2 },
  actionRow: { flexDirection: "row", marginTop: 12, gap: 8 },

  editButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#F2C75C",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  editButtonText: { color: "#F2C75C", fontWeight: "bold" },

  deleteButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#EF4444",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  deleteButtonText: { color: "#EF4444", fontWeight: "bold" },

  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  addModalContainer: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
  },

  editModalContainer: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
  },

  reminderModalContainer: {
    width: "100%",
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
  },

  modalTitle: { fontSize: 22, fontWeight: "bold", marginBottom: 15 },

  reminderOption: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  reminderOptionText: { fontSize: 16 },

  customReminderBox: {
    marginTop: 15,
    padding: 15,
    backgroundColor: "#F8F8FA",
    borderRadius: 10,
  },

  customReminderTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 10 },

  customNumberInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },

  unitRow: { flexDirection: "row", gap: 8 },

  unitButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ff6a92",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },

  selectedUnitButton: { backgroundColor: "#ff6a92" },
  unitButtonText: { color: "#ff6a92", fontWeight: "bold" },
  selectedUnitButtonText: { color: "#fff" },

  customReminderGuide: { marginTop: 10, color: "#6B7280", fontSize: 13 },

  cancelButton: {
    backgroundColor: "#F8F8FA",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },

  cancelButtonText: { color: "#6B7280", fontSize: 16, fontWeight: "bold" },

  calendarContainer: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
  },

  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  monthButton: { fontSize: 32, fontWeight: "bold", paddingHorizontal: 15 },
  monthTitle: { fontSize: 20, fontWeight: "bold" },
  weekRow: { flexDirection: "row", marginBottom: 10 },

  weekText: {
    flex: 1,
    textAlign: "center",
    fontWeight: "bold",
    color: "#6B7280",
  },

  daysContainer: { width: "100%" },
  dayRow: { flexDirection: "row" },

  dayBox: {
    flex: 1,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },

  selectedDayBox: { backgroundColor: "#ff6a92" },
  dayText: { fontSize: 16 },
  selectedDayText: { color: "#fff", fontWeight: "bold" },

  timeSelector: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#F8F8FA",
    borderRadius: 10,
  },

  timeSelectorTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },

  timeRow: { flexDirection: "row", gap: 12 },
  timeControl: { flex: 1, alignItems: "center" },

  timeButton: {
    width: "100%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ff6a92",
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
  },

  timeButtonText: { color: "#ff6a92", fontSize: 18, fontWeight: "bold" },
  timeValue: { fontSize: 18, fontWeight: "bold", marginVertical: 8 },

  closeButton: {
    marginTop: 20,
    backgroundColor: "#ff6a92",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  closeButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

  deleteModalContainer: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
  },

  deleteModalText: {
    fontSize: 16,
    marginBottom: 20,
    color: "#2B2B2B",
  },

  deleteModalButtonRow: {
    flexDirection: "row",
    gap: 10,
  },

  deleteCancelButton: {
    flex: 1,
    backgroundColor: "#F8F8FA",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },

  deleteCancelButtonText: {
    color: "#6B7280",
    fontSize: 16,
    fontWeight: "bold",
  },

  deleteConfirmButton: {
    flex: 1,
    backgroundColor: "#EF4444",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },

  deleteConfirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
