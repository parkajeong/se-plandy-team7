import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ScrollView,
  Modal,
  Platform,
} from "react-native";

import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  arrayUnion,
  onSnapshot,
  deleteDoc,
} from "firebase/firestore";

import { getAppUser, subscribeAppUserChange } from "../../src/appSession";

const firebase = require("../../src/firebase");
const db = firebase.db;
const auth = firebase.auth;

type Mode = "group" | "available" | "recommend";
type DateTimeTarget = "availableStart" | "availableEnd";

type StudySchedule = {
  id: string;
  title: string;
  start_time: any;
  end_time: any;
  created_by?: string;
  created_by_name?: string;
  created_at?: any;
  updated_at?: any;
  participant_count?: number;
  participants?: string[];
  source?: string;
};

type AvailableTime = {
  id: string;
  user_id: string;
  user_name: string;
  start_time: any;
  end_time: any;
  created_at: any;
  updated_at?: any;
};

type StudyGroup = {
  id: string;
  name: string;
  host_id: string;
  members: string[];
  schedules: StudySchedule[];
  available_times: Record<string, any>;
  invite_code: string;
  created_at: any;
};

type Recommendation = {
  id: string;
  start_time: Date;
  end_time: Date;
  participant_count: number;
  participants: string[];
};

export default function StudyGroupScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("사용자");

  const [mode, setMode] = useState<Mode>("group");

  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null);

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");

  const [availableStartDate, setAvailableStartDate] = useState<Date | null>(
    null
  );
  const [availableEndDate, setAvailableEndDate] = useState<Date | null>(null);
  const [editingAvailableTimeId, setEditingAvailableTimeId] = useState<
    string | null
  >(null);

  const [scheduleTitle, setScheduleTitle] = useState("");
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(
    null
  );
  const [editingScheduleTitle, setEditingScheduleTitle] = useState("");

  const [isGroupModalVisible, setIsGroupModalVisible] = useState(false);

  const [isDateTimeModalVisible, setIsDateTimeModalVisible] = useState(false);
  const [dateTimeTarget, setDateTimeTarget] =
    useState<DateTimeTarget>("availableStart");

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tempSelectedDate, setTempSelectedDate] = useState<Date | null>(null);
  const [tempSelectedHour, setTempSelectedHour] = useState(9);
  const [tempSelectedMinute, setTempSelectedMinute] = useState(0);

  const confirmAction = (
    title: string,
    message: string,
    onConfirm: () => void
  ) => {
    if (Platform.OS === "web") {
      const confirmed =
        typeof window !== "undefined" ? window.confirm(message) : false;

      if (confirmed) {
        onConfirm();
      }

      return;
    }

    Alert.alert(title, message, [
      { text: "취소", style: "cancel" },
      {
        text: "확인",
        style: "destructive",
        onPress: onConfirm,
      },
    ]);
  };

  const getAppUserIdOrNull = useCallback(() => {
    const appUser = getAppUser();

    if (appUser?.uid) return String(appUser.uid);
    if (appUser?.id) return String(appUser.id);
    if (appUser?.user_id) return String(appUser.user_id);
    if (appUser?.userId) return String(appUser.userId);

    return null;
  }, []);

  const getAppUserNameOrDefault = useCallback(() => {
    const firebaseUser = auth.currentUser;

    if (firebaseUser?.displayName) return firebaseUser.displayName;
    if (firebaseUser?.email) return firebaseUser.email;

    const appUser = getAppUser();

    if (appUser?.displayName) return String(appUser.displayName);
    if (appUser?.name) return String(appUser.name);
    if (appUser?.nickname) return String(appUser.nickname);
    if (appUser?.email) return String(appUser.email);

    return "사용자";
  }, []);

  const syncUserId = useCallback(() => {
    const firebaseUser = auth.currentUser;

    if (firebaseUser) {
      setUserId(firebaseUser.uid);
      setUserName(getAppUserNameOrDefault());
      return;
    }

    const appUserId = getAppUserIdOrNull();

    if (appUserId) {
      setUserId(appUserId);
      setUserName(getAppUserNameOrDefault());
      return;
    }

    setUserId(null);
    setUserName("사용자");
    setGroups([]);
    setSelectedGroup(null);
  }, [getAppUserIdOrNull, getAppUserNameOrDefault]);

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

  const convertDocToStudyGroup = (docItem: any): StudyGroup => {
    const groupData = docItem.data();

    return {
      id: docItem.id,
      name: groupData.name,
      host_id: groupData.host_id,
      members: groupData.members || [],
      schedules: groupData.schedules || [],
      available_times: groupData.available_times || {},
      invite_code: groupData.invite_code,
      created_at: groupData.created_at,
    };
  };

  const applyGroupsToState = useCallback((data: StudyGroup[]) => {
    setGroups(data);

    setSelectedGroup((prevSelectedGroup) => {
      if (!prevSelectedGroup) return null;

      const updatedSelectedGroup = data.find(
        (group) => group.id === prevSelectedGroup.id
      );

      return updatedSelectedGroup || null;
    });
  }, []);

  const fetchGroups = useCallback(async () => {
    if (!userId) {
      setGroups([]);
      setSelectedGroup(null);
      return;
    }

    try {
      const q = query(
        collection(db, "study_groups"),
        where("members", "array-contains", userId)
      );

      const querySnapshot = await getDocs(q);
      const data: StudyGroup[] = [];

      querySnapshot.forEach((docItem) => {
        data.push(convertDocToStudyGroup(docItem));
      });

      applyGroupsToState(data);
    } catch (error) {
      console.log(error);
      Alert.alert("오류", "스터디 그룹 목록 조회 실패");
    }
  }, [userId, applyGroupsToState]);

  useEffect(() => {
    if (!userId) {
      setGroups([]);
      setSelectedGroup(null);
      return;
    }

    const q = query(
      collection(db, "study_groups"),
      where("members", "array-contains", userId)
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const data: StudyGroup[] = [];

        querySnapshot.forEach((docItem) => {
          data.push(convertDocToStudyGroup(docItem));
        });

        applyGroupsToState(data);
      },
      (error) => {
        console.log(error);
        Alert.alert("오류", "스터디 그룹 실시간 조회 실패");
      }
    );

    return unsubscribe;
  }, [userId, applyGroupsToState]);

  const generateInviteCode = () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";

    for (let i = 0; i < 6; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      code += characters[randomIndex];
    }

    return code;
  };

  const toDateObject = (value: any) => {
    if (!value) return null;
    if (value?.toDate) return value.toDate();
    if (value instanceof Date) return value;

    const convertedDate = new Date(value);

    if (Number.isNaN(convertedDate.getTime())) return null;

    return convertedDate;
  };

  const getRoundedTime = (date: Date) => {
    const roundedMinute = Math.round(date.getMinutes() / 5) * 5;
    const result = new Date(date);

    if (roundedMinute === 60) {
      result.setHours(result.getHours() + 1);
      result.setMinutes(0);
    } else {
      result.setMinutes(roundedMinute);
    }

    result.setSeconds(0);
    result.setMilliseconds(0);

    return result;
  };

  const formatDate = (targetDate: Date) => {
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, "0");
    const day = String(targetDate.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const formatTime = (hour: number, minute: number) => {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  const formatDateTime = (value: any) => {
    const date = toDateObject(value);

    if (!date) return "";

    return `${formatDate(date)} ${formatTime(
      date.getHours(),
      date.getMinutes()
    )}`;
  };

  const getSortedSchedules = () => {
    if (!selectedGroup) return [];

    return [...selectedGroup.schedules].sort((a, b) => {
      const aDate = toDateObject(a.start_time);
      const bDate = toDateObject(b.start_time);

      return (aDate?.getTime() || 0) - (bDate?.getTime() || 0);
    });
  };

  const getAvailableTimeList = () => {
    if (!selectedGroup) return [];

    const availableTimes = selectedGroup.available_times || {};
    const result: AvailableTime[] = [];

    Object.values(availableTimes).forEach((value: any) => {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          result.push(item as AvailableTime);
        });
      }
    });

    return result.sort((a, b) => {
      const aDate = toDateObject(a.start_time);
      const bDate = toDateObject(b.start_time);

      return (aDate?.getTime() || 0) - (bDate?.getTime() || 0);
    });
  };

  const getRecommendedTimes = () => {
    const availableTimeList = getAvailableTimeList();

    if (availableTimeList.length < 2) {
      return [];
    }

    const validTimes = availableTimeList
      .map((time) => {
        const startDate = toDateObject(time.start_time);
        const endDate = toDateObject(time.end_time);

        if (!startDate || !endDate) return null;
        if (endDate.getTime() <= startDate.getTime()) return null;

        return {
          ...time,
          startDate,
          endDate,
        };
      })
      .filter(Boolean) as Array<
      AvailableTime & { startDate: Date; endDate: Date }
    >;

    const boundaries = Array.from(
      new Set(
        validTimes
          .flatMap((time) => [time.startDate.getTime(), time.endDate.getTime()])
          .sort((a, b) => a - b)
      )
    );

    const recommendations: Recommendation[] = [];

    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i];
      const end = boundaries[i + 1];

      if (end <= start) continue;

      const coveringTimes = validTimes.filter(
        (time) =>
          time.startDate.getTime() <= start && time.endDate.getTime() >= end
      );

      const participantMap = new Map<string, string>();

      coveringTimes.forEach((time) => {
        participantMap.set(time.user_id, time.user_name);
      });

      const participants = Array.from(participantMap.values());

      if (participants.length < 2) continue;

      recommendations.push({
        id: `${start}-${end}`,
        start_time: new Date(start),
        end_time: new Date(end),
        participant_count: participants.length,
        participants,
      });
    }

    return recommendations
      .sort((a, b) => {
        if (b.participant_count !== a.participant_count) {
          return b.participant_count - a.participant_count;
        }

        return a.start_time.getTime() - b.start_time.getTime();
      })
      .slice(0, 5);
  };

  const handleCreateGroup = async () => {
    if (!userId) {
      Alert.alert("오류", "로그인 후 스터디 그룹을 생성할 수 있습니다.");
      return;
    }

    const trimmedGroupName = groupName.trim();

    if (!trimmedGroupName) {
      Alert.alert("오류", "스터디 그룹 이름을 입력해주세요.");
      return;
    }

    try {
      const newInviteCode = generateInviteCode();

      const groupData = {
        name: trimmedGroupName,
        host_id: userId,
        members: [userId],
        schedules: [],
        available_times: {},
        invite_code: newInviteCode,
        created_at: new Date(),
      };

      await addDoc(collection(db, "study_groups"), groupData);

      setGroupName("");

      Alert.alert(
        "성공",
        `스터디 그룹이 생성되었습니다.\n초대코드: ${newInviteCode}`
      );

      await fetchGroups();
    } catch (error) {
      console.log(error);
      Alert.alert("오류", "스터디 그룹 생성 실패");
    }
  };

  const handleJoinGroup = async () => {
    if (!userId) {
      Alert.alert("오류", "로그인 후 스터디 그룹에 참여할 수 있습니다.");
      return;
    }

    const trimmedInviteCode = inviteCode.trim().toUpperCase();

    if (!trimmedInviteCode) {
      Alert.alert("오류", "초대코드를 입력해주세요.");
      return;
    }

    try {
      const q = query(
        collection(db, "study_groups"),
        where("invite_code", "==", trimmedInviteCode)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Alert.alert("오류", "해당 초대코드의 스터디 그룹을 찾을 수 없습니다.");
        return;
      }

      const targetDoc = querySnapshot.docs[0];
      const targetGroupData = targetDoc.data();

      const members = Array.isArray(targetGroupData.members)
        ? targetGroupData.members
        : [];

      if (members.includes(userId)) {
        Alert.alert("안내", "이미 참여 중인 스터디 그룹입니다.");
        setInviteCode("");
        await fetchGroups();
        return;
      }

      const groupRef = doc(db, "study_groups", targetDoc.id);

      await updateDoc(groupRef, {
        members: arrayUnion(userId),
      });

      setInviteCode("");

      Alert.alert("성공", "스터디 그룹에 참여했습니다.");

      await fetchGroups();
    } catch (error) {
      console.log(error);
      Alert.alert("오류", "스터디 그룹 참여 실패");
    }
  };

  const handleSelectGroup = (group: StudyGroup) => {
    setSelectedGroup(group);
  };

  const handleStartEditGroup = (group: StudyGroup) => {
    if (group.host_id !== userId) {
      Alert.alert("안내", "그룹장만 그룹명을 수정할 수 있습니다.");
      return;
    }

    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
  };

  const handleCancelEditGroup = () => {
    setEditingGroupId(null);
    setEditingGroupName("");
  };

  const handleUpdateGroupName = async (group: StudyGroup) => {
    const trimmedName = editingGroupName.trim();

    if (!trimmedName) {
      Alert.alert("오류", "그룹 이름을 입력해주세요.");
      return;
    }

    try {
      const groupRef = doc(db, "study_groups", group.id);

      await updateDoc(groupRef, {
        name: trimmedName,
        updated_at: new Date(),
      });

      const scheduleQuery = query(
        collection(db, "schedules"),
        where("study_group_id", "==", group.id)
      );

      const scheduleSnapshot = await getDocs(scheduleQuery);

      await Promise.all(
        scheduleSnapshot.docs.map((scheduleDoc) =>
          updateDoc(doc(db, "schedules", scheduleDoc.id), {
            study_group_name: trimmedName,
            description: `스터디: ${trimmedName}`,
            updated_at: new Date(),
          })
        )
      );

      setEditingGroupId(null);
      setEditingGroupName("");

      Alert.alert("성공", "스터디 그룹명이 수정되었습니다.");

      await fetchGroups();
    } catch (error) {
      console.log(error);
      Alert.alert("오류", "스터디 그룹명 수정 실패");
    }
  };

  const deleteGroup = async (group: StudyGroup) => {
    try {
      const scheduleQuery = query(
        collection(db, "schedules"),
        where("study_group_id", "==", group.id)
      );

      const scheduleSnapshot = await getDocs(scheduleQuery);

      await Promise.all(
        scheduleSnapshot.docs.map((scheduleDoc) =>
          deleteDoc(doc(db, "schedules", scheduleDoc.id))
        )
      );

      await deleteDoc(doc(db, "study_groups", group.id));

      if (selectedGroup?.id === group.id) {
        setSelectedGroup(null);
        setMode("group");
      }

      if (editingGroupId === group.id) {
        handleCancelEditGroup();
      }

      Alert.alert("성공", "스터디 그룹이 삭제되었습니다.");

      await fetchGroups();
    } catch (error) {
      console.log(error);
      Alert.alert("오류", "스터디 그룹 삭제 실패");
    }
  };

  const handleDeleteGroup = (group: StudyGroup) => {
    if (group.host_id !== userId) {
      Alert.alert("안내", "그룹장만 그룹을 삭제할 수 있습니다.");
      return;
    }

    confirmAction(
      "삭제 확인",
      "스터디 그룹을 삭제하면 그룹의 가능 시간, 추천 일정, 일정 탭의 스터디 일정이 함께 삭제됩니다. 삭제할까요?",
      () => deleteGroup(group)
    );
  };

  const leaveGroup = async (group: StudyGroup) => {
    if (!userId) return;

    try {
      const groupRef = doc(db, "study_groups", group.id);

      const updatedMembers = group.members.filter(
        (memberId) => memberId !== userId
      );

      const updatedAvailableTimes = {
        ...(group.available_times || {}),
      };

      delete updatedAvailableTimes[userId];

      await updateDoc(groupRef, {
        members: updatedMembers,
        available_times: updatedAvailableTimes,
        updated_at: new Date(),
      });

      const scheduleQuery = query(
        collection(db, "schedules"),
        where("study_group_id", "==", group.id),
        where("user_id", "==", userId)
      );

      const scheduleSnapshot = await getDocs(scheduleQuery);

      await Promise.all(
        scheduleSnapshot.docs.map((scheduleDoc) =>
          deleteDoc(doc(db, "schedules", scheduleDoc.id))
        )
      );

      if (selectedGroup?.id === group.id) {
        setSelectedGroup(null);
        setMode("group");
      }

      Alert.alert("성공", "스터디 그룹에서 탈퇴했습니다.");

      await fetchGroups();
    } catch (error) {
      console.log(error);
      Alert.alert("오류", "스터디 그룹 탈퇴 실패");
    }
  };

  const handleLeaveGroup = (group: StudyGroup) => {
    if (group.host_id === userId) {
      Alert.alert("안내", "그룹장은 탈퇴 대신 그룹 삭제를 사용할 수 있습니다.");
      return;
    }

    confirmAction(
      "탈퇴 확인",
      "스터디 그룹에서 탈퇴하면 내 가능 시간과 내 일정 탭의 해당 그룹 일정이 삭제됩니다. 탈퇴할까요?",
      () => leaveGroup(group)
    );
  };

  const openDateTimeModal = (target: DateTimeTarget) => {
    setDateTimeTarget(target);

    let existingDate: Date | null = null;

    if (target === "availableStart") {
      existingDate = availableStartDate;
    }

    if (target === "availableEnd") {
      existingDate = availableEndDate;
    }

    const baseDate = getRoundedTime(existingDate || new Date());

    setCurrentMonth(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
    setTempSelectedDate(baseDate);
    setTempSelectedHour(baseDate.getHours());
    setTempSelectedMinute(baseDate.getMinutes());

    setIsDateTimeModalVisible(true);
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

  const handleSelectCalendarDay = (day: number) => {
    const selectedDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
      tempSelectedHour,
      tempSelectedMinute,
      0
    );

    setTempSelectedDate(selectedDate);
  };

  const increaseHour = () => {
    setTempSelectedHour((prev) => (prev + 1) % 24);
  };

  const decreaseHour = () => {
    setTempSelectedHour((prev) => (prev - 1 + 24) % 24);
  };

  const increaseMinute = () => {
    setTempSelectedMinute((prev) => (prev + 5) % 60);
  };

  const decreaseMinute = () => {
    setTempSelectedMinute((prev) => (prev - 5 + 60) % 60);
  };

  const handleConfirmDateTime = () => {
    if (!tempSelectedDate) {
      Alert.alert("오류", "날짜를 선택해주세요.");
      return;
    }

    const confirmedDate = new Date(
      tempSelectedDate.getFullYear(),
      tempSelectedDate.getMonth(),
      tempSelectedDate.getDate(),
      tempSelectedHour,
      tempSelectedMinute,
      0
    );

    if (dateTimeTarget === "availableStart") {
      setAvailableStartDate(confirmedDate);
    }

    if (dateTimeTarget === "availableEnd") {
      setAvailableEndDate(confirmedDate);
    }

    setIsDateTimeModalVisible(false);
  };

  const handleSaveAvailableTime = async () => {
    if (!userId) {
      Alert.alert("오류", "로그인 후 가능 시간을 입력할 수 있습니다.");
      return;
    }

    if (!selectedGroup) {
      Alert.alert("오류", "스터디 그룹을 선택해주세요.");
      return;
    }

    if (!selectedGroup.members.includes(userId)) {
      Alert.alert("오류", "스터디 그룹 멤버만 가능 시간을 입력할 수 있습니다.");
      return;
    }

    if (!availableStartDate || !availableEndDate) {
      Alert.alert("오류", "가능한 시작 일시와 종료 일시를 모두 선택해주세요.");
      return;
    }

    if (availableEndDate.getTime() <= availableStartDate.getTime()) {
      Alert.alert("오류", "종료 일시는 시작 일시보다 늦어야 합니다.");
      return;
    }

    try {
      const groupRef = doc(db, "study_groups", selectedGroup.id);
      const currentUserTimes = Array.isArray(
        selectedGroup.available_times?.[userId]
      )
        ? selectedGroup.available_times[userId]
        : [];

      if (editingAvailableTimeId) {
        const updatedTimes = currentUserTimes.map((time: AvailableTime) => {
          if (time.id !== editingAvailableTimeId) {
            return time;
          }

          return {
            ...time,
            start_time: availableStartDate,
            end_time: availableEndDate,
            updated_at: new Date(),
          };
        });

        await updateDoc(groupRef, {
          [`available_times.${userId}`]: updatedTimes,
        });

        Alert.alert("성공", "가능 시간이 수정되었습니다.");
      } else {
        const newAvailableTime: AvailableTime = {
          id: Date.now().toString(),
          user_id: userId,
          user_name: userName,
          start_time: availableStartDate,
          end_time: availableEndDate,
          created_at: new Date(),
        };

        await updateDoc(groupRef, {
          [`available_times.${userId}`]: arrayUnion(newAvailableTime),
        });

        Alert.alert("성공", "가능 시간이 등록되었습니다.");
      }

      setAvailableStartDate(null);
      setAvailableEndDate(null);
      setEditingAvailableTimeId(null);

      await fetchGroups();
    } catch (error) {
      console.log(error);
      Alert.alert("오류", "가능 시간 저장 실패");
    }
  };

  const handleStartEditAvailableTime = (time: AvailableTime) => {
    if (time.user_id !== userId) {
      Alert.alert("안내", "본인이 등록한 가능 시간만 수정할 수 있습니다.");
      return;
    }

    const startDate = toDateObject(time.start_time);
    const endDate = toDateObject(time.end_time);

    if (!startDate || !endDate) {
      Alert.alert("오류", "시간 정보를 불러올 수 없습니다.");
      return;
    }

    setEditingAvailableTimeId(time.id);
    setAvailableStartDate(startDate);
    setAvailableEndDate(endDate);
  };

  const handleCancelEditAvailableTime = () => {
    setEditingAvailableTimeId(null);
    setAvailableStartDate(null);
    setAvailableEndDate(null);
  };

  const deleteAvailableTime = async (time: AvailableTime) => {
    if (!userId || !selectedGroup) {
      return;
    }

    try {
      const groupRef = doc(db, "study_groups", selectedGroup.id);

      const currentUserTimes = Array.isArray(
        selectedGroup.available_times?.[userId]
      )
        ? selectedGroup.available_times[userId]
        : [];

      const updatedTimes = currentUserTimes.filter(
        (item: AvailableTime) => item.id !== time.id
      );

      await updateDoc(groupRef, {
        [`available_times.${userId}`]: updatedTimes,
      });

      if (editingAvailableTimeId === time.id) {
        handleCancelEditAvailableTime();
      }

      Alert.alert("성공", "가능 시간이 삭제되었습니다.");

      await fetchGroups();
    } catch (error) {
      console.log(error);
      Alert.alert("오류", "가능 시간 삭제 실패");
    }
  };

  const handleDeleteAvailableTime = (time: AvailableTime) => {
    if (!userId || !selectedGroup) {
      return;
    }

    if (time.user_id !== userId) {
      Alert.alert("안내", "본인이 등록한 가능 시간만 삭제할 수 있습니다.");
      return;
    }

    confirmAction("삭제 확인", "이 가능 시간을 삭제할까요?", () =>
      deleteAvailableTime(time)
    );
  };

  const handleRegisterRecommendedSchedule = async (
    recommendation: Recommendation
  ) => {
    if (!userId) {
      Alert.alert("오류", "로그인 후 스터디 일정을 등록할 수 있습니다.");
      return;
    }

    if (!selectedGroup) {
      Alert.alert("오류", "스터디 그룹을 선택해주세요.");
      return;
    }

    const trimmedTitle = scheduleTitle.trim();

    if (!trimmedTitle) {
      Alert.alert("오류", "등록할 스터디 일정명을 입력해주세요.");
      return;
    }

    try {
      const scheduleId = Date.now().toString();

      const newSchedule: StudySchedule = {
        id: scheduleId,
        title: trimmedTitle,
        start_time: recommendation.start_time,
        end_time: recommendation.end_time,
        created_by: userId,
        created_by_name: userName,
        created_at: new Date(),
        participant_count: recommendation.participant_count,
        participants: recommendation.participants,
        source: "recommended",
      };

      const groupRef = doc(db, "study_groups", selectedGroup.id);

      await updateDoc(groupRef, {
        schedules: arrayUnion(newSchedule),
      });

      await Promise.all(
        selectedGroup.members.map((memberId) =>
          addDoc(collection(db, "schedules"), {
            user_id: memberId,
            title: `[스터디] ${trimmedTitle}`,
            start_time: recommendation.start_time,
            end_time: recommendation.end_time,
            description: `스터디: ${selectedGroup.name}`,
            created_at: new Date(),
            study_group_id: selectedGroup.id,
            study_group_name: selectedGroup.name,
            study_schedule_id: scheduleId,
            source: "study_group",
            created_by: userId,
            created_by_name: userName,
            participant_count: recommendation.participant_count,
            participants: recommendation.participants,
          })
        )
      );

      setScheduleTitle("");

      Alert.alert("성공", "추천 시간으로 스터디 일정이 등록되었습니다.");

      await fetchGroups();
    } catch (error) {
      console.log(error);
      Alert.alert("오류", "스터디 일정 등록 실패");
    }
  };

  const handleStartEditSchedule = (schedule: StudySchedule) => {
    if (schedule.created_by !== userId) {
      Alert.alert("안내", "일정을 등록한 사용자만 수정할 수 있습니다.");
      return;
    }

    setEditingScheduleId(schedule.id);
    setEditingScheduleTitle(schedule.title);
  };

  const handleCancelEditSchedule = () => {
    setEditingScheduleId(null);
    setEditingScheduleTitle("");
  };

  const handleUpdateScheduleTitle = async (schedule: StudySchedule) => {
    if (!selectedGroup) {
      return;
    }

    const trimmedTitle = editingScheduleTitle.trim();

    if (!trimmedTitle) {
      Alert.alert("오류", "일정명을 입력해주세요.");
      return;
    }

    try {
      const groupRef = doc(db, "study_groups", selectedGroup.id);

      const updatedSchedules = selectedGroup.schedules.map((item) => {
        if (item.id !== schedule.id) {
          return item;
        }

        return {
          ...item,
          title: trimmedTitle,
          updated_at: new Date(),
        };
      });

      await updateDoc(groupRef, {
        schedules: updatedSchedules,
      });

      const scheduleQuery = query(
        collection(db, "schedules"),
        where("study_group_id", "==", selectedGroup.id),
        where("study_schedule_id", "==", schedule.id)
      );

      const scheduleSnapshot = await getDocs(scheduleQuery);

      await Promise.all(
        scheduleSnapshot.docs.map((scheduleDoc) =>
          updateDoc(doc(db, "schedules", scheduleDoc.id), {
            title: `[스터디] ${trimmedTitle}`,
            updated_at: new Date(),
          })
        )
      );

      setEditingScheduleId(null);
      setEditingScheduleTitle("");

      Alert.alert("성공", "스터디 일정이 수정되었습니다.");

      await fetchGroups();
    } catch (error) {
      console.log(error);
      Alert.alert("오류", "스터디 일정 수정 실패");
    }
  };

  const deleteSchedule = async (schedule: StudySchedule) => {
    if (!selectedGroup) {
      return;
    }

    try {
      const groupRef = doc(db, "study_groups", selectedGroup.id);

      const updatedSchedules = selectedGroup.schedules.filter(
        (item) => item.id !== schedule.id
      );

      await updateDoc(groupRef, {
        schedules: updatedSchedules,
      });

      const scheduleQuery = query(
        collection(db, "schedules"),
        where("study_group_id", "==", selectedGroup.id),
        where("study_schedule_id", "==", schedule.id)
      );

      const scheduleSnapshot = await getDocs(scheduleQuery);

      await Promise.all(
        scheduleSnapshot.docs.map((scheduleDoc) =>
          deleteDoc(doc(db, "schedules", scheduleDoc.id))
        )
      );

      if (editingScheduleId === schedule.id) {
        handleCancelEditSchedule();
      }

      Alert.alert("성공", "스터디 일정이 삭제되었습니다.");

      await fetchGroups();
    } catch (error) {
      console.log(error);
      Alert.alert("오류", "스터디 일정 삭제 실패");
    }
  };

  const handleDeleteSchedule = (schedule: StudySchedule) => {
    if (!selectedGroup) {
      return;
    }

    if (schedule.created_by !== userId) {
      Alert.alert("안내", "일정을 등록한 사용자만 삭제할 수 있습니다.");
      return;
    }

    confirmAction("삭제 확인", "이 스터디 일정을 삭제할까요?", () =>
      deleteSchedule(schedule)
    );
  };

  const renderGroupSelector = () => {
    return (
      <View style={styles.groupSelectorBox}>
        <Text style={styles.groupSelectorLabel}>스터디 그룹 선택</Text>

        <TouchableOpacity
          style={styles.groupSelectButton}
          onPress={() => setIsGroupModalVisible(true)}
        >
          <Text
            style={
              selectedGroup
                ? styles.groupSelectButtonText
                : styles.groupSelectPlaceholder
            }
          >
            {selectedGroup
              ? `선택한 그룹 : ${selectedGroup.name}`
              : "스터디 그룹을 선택해주세요"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderGroupManagement = () => (
    <View>
      <Text style={styles.sectionTitle}>스터디 그룹 생성</Text>

      <TextInput
        style={styles.input}
        placeholder="스터디 그룹 이름"
        value={groupName}
        onChangeText={setGroupName}
      />

      <TouchableOpacity style={styles.button} onPress={handleCreateGroup}>
        <Text style={styles.buttonText}>그룹 생성하기</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>초대코드로 그룹 참여</Text>

      <TextInput
        style={styles.input}
        placeholder="초대코드 입력"
        value={inviteCode}
        onChangeText={(text) => setInviteCode(text.toUpperCase())}
        autoCapitalize="characters"
      />

      <TouchableOpacity style={styles.outlineButton} onPress={handleJoinGroup}>
        <Text style={styles.outlineButtonText}>그룹 참여하기</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>내 스터디 그룹</Text>

      <FlatList
        data={groups}
        scrollEnabled={false}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>참여 중인 스터디 그룹이 없습니다.</Text>
        }
        renderItem={({ item }) => {
          const isSelected = selectedGroup?.id === item.id;
          const isHost = item.host_id === userId;
          const isEditingGroup = editingGroupId === item.id;

          return (
            <View style={[styles.card, isSelected && styles.selectedCard]}>
              {isEditingGroup ? (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="스터디 그룹 이름"
                    value={editingGroupName}
                    onChangeText={setEditingGroupName}
                  />

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.smallOutlineButton}
                      onPress={() => handleUpdateGroupName(item)}
                    >
                      <Text style={styles.smallOutlineButtonText}>저장</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.smallDangerButton}
                      onPress={handleCancelEditGroup}
                    >
                      <Text style={styles.smallDangerButtonText}>취소</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <TouchableOpacity onPress={() => handleSelectGroup(item)}>
                    <Text style={styles.groupName}>{item.name}</Text>

                    <Text style={styles.groupInfo}>
                      초대코드: {item.invite_code}
                    </Text>

                    <Text style={styles.groupInfo}>
                      참여 인원: {item.members.length}명
                    </Text>

                    {isHost && <Text style={styles.hostText}>내가 만든 그룹</Text>}

                    {isSelected && (
                      <Text style={styles.selectedText}>현재 선택된 그룹</Text>
                    )}
                  </TouchableOpacity>

                  <View style={styles.actionRow}>
                    {isHost ? (
                      <>
                        <TouchableOpacity
                          style={[styles.smallOutlineButton, styles.smallEditButton]}
                          onPress={() => handleStartEditGroup(item)}
                        >
                          <Text style={[styles.smallOutlineButtonText, styles.smallEditButtonText]}>수정</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.smallDangerButton}
                          onPress={() => handleDeleteGroup(item)}
                        >
                          <Text style={styles.smallDangerButtonText}>삭제</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        style={styles.smallDangerButton}
                        onPress={() => handleLeaveGroup(item)}
                      >
                        <Text style={styles.smallDangerButtonText}>탈퇴</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </View>
          );
        }}
      />
    </View>
  );

  const renderAvailableTimeManagement = () => {
    const availableTimeList = getAvailableTimeList();

    return (
      <View>
        {renderGroupSelector()}

        {!selectedGroup ? (
          <Text style={styles.emptyText}>
            가능 시간을 입력할 스터디 그룹을 선택해주세요.
          </Text>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              {editingAvailableTimeId ? "가능 시간 수정" : "내 가능 시간 입력"}
            </Text>

            <TouchableOpacity
              style={styles.input}
              onPress={() => openDateTimeModal("availableStart")}
            >
              <Text
                style={
                  availableStartDate
                    ? styles.selectedInputText
                    : styles.placeholderText
                }
              >
                {availableStartDate
                  ? `시작: ${formatDateTime(availableStartDate)}`
                  : "가능한 시작 일시 선택"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.input}
              onPress={() => openDateTimeModal("availableEnd")}
            >
              <Text
                style={
                  availableEndDate
                    ? styles.selectedInputText
                    : styles.placeholderText
                }
              >
                {availableEndDate
                  ? `종료: ${formatDateTime(availableEndDate)}`
                  : "가능한 종료 일시 선택"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.button}
              onPress={handleSaveAvailableTime}
            >
              <Text style={styles.buttonText}>
                {editingAvailableTimeId
                  ? "가능 시간 수정하기"
                  : "가능 시간 등록하기"}
              </Text>
            </TouchableOpacity>

            {editingAvailableTimeId && (
              <TouchableOpacity
                style={styles.grayButton}
                onPress={handleCancelEditAvailableTime}
              >
                <Text style={styles.grayButtonText}>수정 취소</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.sectionTitle}>멤버 가능 시간 목록</Text>

            {availableTimeList.length === 0 ? (
              <Text style={styles.emptyText}>등록된 가능 시간이 없습니다.</Text>
            ) : (
              availableTimeList.map((time) => (
                <View key={time.id} style={styles.scheduleCard}>
                  <Text style={styles.scheduleTitle}>{time.user_name}</Text>

                  <Text style={styles.groupInfo}>
                    시작: {formatDateTime(time.start_time)}
                  </Text>

                  <Text style={styles.groupInfo}>
                    종료: {formatDateTime(time.end_time)}
                  </Text>

                  {time.user_id === userId && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.smallOutlineButton, styles.smallEditButton]}
                        onPress={() => handleStartEditAvailableTime(time)}
                      >
                        <Text style={[styles.smallOutlineButtonText, styles.smallEditButtonText]}>수정</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.smallDangerButton}
                        onPress={() => handleDeleteAvailableTime(time)}
                      >
                        <Text style={styles.smallDangerButtonText}>삭제</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </>
        )}
      </View>
    );
  };

  const renderRecommendManagement = () => {
    const recommendations = getRecommendedTimes();
    const sortedSchedules = getSortedSchedules();

    return (
      <View>
        {renderGroupSelector()}

        {!selectedGroup ? (
          <Text style={styles.emptyText}>
            일정을 추천받을 스터디 그룹을 선택해주세요.
          </Text>
        ) : (
          <>
            <Text style={styles.sectionTitle}>스터디 일정명</Text>

            <TextInput
              style={styles.input}
              placeholder="예: 알고리즘 스터디 1회차"
              value={scheduleTitle}
              onChangeText={setScheduleTitle}
            />

            <Text style={styles.sectionTitle}>추천 시간</Text>

            {recommendations.length === 0 ? (
              <Text style={styles.emptyText}>
                아직 2명 이상 겹치는 가능 시간이 없습니다.
              </Text>
            ) : (
              recommendations.map((recommendation, index) => (
                <View key={recommendation.id} style={styles.recommendCard}>
                  <Text style={styles.recommendTitle}>추천 시간 {index + 1}</Text>

                  <Text style={styles.groupInfo}>
                    시작: {formatDateTime(recommendation.start_time)}
                  </Text>

                  <Text style={styles.groupInfo}>
                    종료: {formatDateTime(recommendation.end_time)}
                  </Text>

                  <Text style={styles.groupInfo}>
                    가능 인원: {recommendation.participant_count}명
                  </Text>

                  <Text style={styles.groupInfo}>
                    가능 멤버: {recommendation.participants.join(", ")}
                  </Text>

                  <TouchableOpacity
                    style={styles.button}
                    onPress={() =>
                      handleRegisterRecommendedSchedule(recommendation)
                    }
                  >
                    <Text style={styles.buttonText}>이 시간으로 일정 등록</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}

            <Text style={styles.sectionTitle}>등록된 스터디 일정</Text>

            {sortedSchedules.length === 0 ? (
              <Text style={styles.emptyText}>등록된 스터디 일정이 없습니다.</Text>
            ) : (
              sortedSchedules.map((schedule) => (
                <View key={schedule.id} style={styles.scheduleCard}>
                  {editingScheduleId === schedule.id ? (
                    <>
                      <TextInput
                        style={styles.input}
                        placeholder="스터디 일정명"
                        value={editingScheduleTitle}
                        onChangeText={setEditingScheduleTitle}
                      />

                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={styles.smallOutlineButton}
                          onPress={() => handleUpdateScheduleTitle(schedule)}
                        >
                          <Text style={styles.smallOutlineButtonText}>저장</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.smallDangerButton}
                          onPress={handleCancelEditSchedule}
                        >
                          <Text style={styles.smallDangerButtonText}>취소</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.scheduleTitle}>{schedule.title}</Text>

                      <Text style={styles.groupInfo}>
                        등록자: {schedule.created_by_name || "알 수 없음"}
                      </Text>

                      <Text style={styles.groupInfo}>
                        시작: {formatDateTime(schedule.start_time)}
                      </Text>

                      <Text style={styles.groupInfo}>
                        종료: {formatDateTime(schedule.end_time)}
                      </Text>

                      {schedule.participant_count && (
                        <Text style={styles.groupInfo}>
                          추천 가능 인원: {schedule.participant_count}명
                        </Text>
                      )}

                      {schedule.created_by === userId && (
                        <View style={styles.actionRow}>
                          <TouchableOpacity
                            style={[styles.smallOutlineButton, styles.smallEditButton]}
                            onPress={() => handleStartEditSchedule(schedule)}
                          >
                            <Text style={[styles.smallOutlineButtonText, styles.smallEditButtonText]}>수정</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.smallDangerButton}
                            onPress={() => handleDeleteSchedule(schedule)}
                          >
                            <Text style={styles.smallDangerButtonText}>삭제</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  )}
                </View>
              ))
            )}
          </>
        )}
      </View>
    );
  };

  const getModalTitle = () => {
    if (dateTimeTarget === "availableStart") {
      return "가능 시간 시작 일시 선택";
    }

    return "가능 시간 종료 일시 선택";
  };

  return (
    <View style={styles.root}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>스터디 그룹</Text>

        {!userId && (
          <Text style={styles.loginNotice}>
            로그인 후 스터디 그룹을 생성하고 참여할 수 있습니다.
          </Text>
        )}

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, mode === "group" && styles.activeTabButton]}
            onPress={() => setMode("group")}
          >
            <Text
              style={[
                styles.tabButtonText,
                mode === "group" && styles.activeTabButtonText,
              ]}
            >
              그룹 관리
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              mode === "available" && styles.activeTabButton,
            ]}
            onPress={() => setMode("available")}
          >
            <Text
              style={[
                styles.tabButtonText,
                mode === "available" && styles.activeTabButtonText,
              ]}
            >
              가능 시간
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              mode === "recommend" && styles.activeTabButton,
            ]}
            onPress={() => setMode("recommend")}
          >
            <Text
              style={[
                styles.tabButtonText,
                mode === "recommend" && styles.activeTabButtonText,
              ]}
            >
              일정 추천
            </Text>
          </TouchableOpacity>
        </View>

        {mode === "group" && renderGroupManagement()}
        {mode === "available" && renderAvailableTimeManagement()}
        {mode === "recommend" && renderRecommendManagement()}
      </ScrollView>

      <Modal
        visible={isGroupModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsGroupModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.groupModalContainer}>
            <Text style={styles.modalTitle}>스터디 그룹 선택</Text>

            {groups.length === 0 ? (
              <Text style={styles.emptyText}>
                참여 중인 스터디 그룹이 없습니다.
              </Text>
            ) : (
              groups.map((group) => {
                const isSelected = selectedGroup?.id === group.id;

                return (
                  <TouchableOpacity
                    key={group.id}
                    style={styles.groupModalItem}
                    onPress={() => {
                      setSelectedGroup(group);
                      setIsGroupModalVisible(false);
                    }}
                  >
                    <Text style={styles.groupModalItemText}>{group.name}</Text>

                    {isSelected && (
                      <Text style={styles.groupModalSelectedText}>선택됨</Text>
                    )}
                  </TouchableOpacity>
                );
              })
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsGroupModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isDateTimeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDateTimeModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.calendarContainer}>
            <Text style={styles.modalTitle}>{getModalTitle()}</Text>

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

            <View>
              {getCalendarWeeks().map((week, weekIndex) => (
                <View key={weekIndex} style={styles.dayRow}>
                  {week.map((day, dayIndex) => {
                    const isSelected =
                      tempSelectedDate &&
                      day !== null &&
                      tempSelectedDate.getFullYear() ===
                        currentMonth.getFullYear() &&
                      tempSelectedDate.getMonth() === currentMonth.getMonth() &&
                      tempSelectedDate.getDate() === day;

                    return (
                      <TouchableOpacity
                        key={dayIndex}
                        style={[
                          styles.dayBox,
                          isSelected && styles.selectedDayBox,
                        ]}
                        disabled={day === null}
                        onPress={() => {
                          if (day !== null) {
                            handleSelectCalendarDay(day);
                          }
                        }}
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
                    {String(tempSelectedHour).padStart(2, "0")}시
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
                    {String(tempSelectedMinute).padStart(2, "0")}분
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
              onPress={handleConfirmDateTime}
            >
              <Text style={styles.closeButtonText}>확인</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setIsDateTimeModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fff",
  },

  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  content: {
    padding: 20,
    paddingBottom: 120,
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
  },

  loginNotice: {
    color: "#EF4444",
    marginBottom: 15,
    fontSize: 15,
  },

  tabContainer: {
    flexDirection: "row",
    marginBottom: 20,
    backgroundColor: "#F8F8FA",
    borderRadius: 10,
    padding: 4,
  },

  tabButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },

  activeTabButton: {
    backgroundColor: "#ff6a92",
  },

  tabButtonText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#6B7280",
  },

  activeTabButtonText: {
    color: "#fff",
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 10,
  },

  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    fontSize: 16,
    justifyContent: "center",
  },

  selectedInputText: {
    fontSize: 16,
    color: "#000",
  },

  placeholderText: {
    fontSize: 16,
    color: "#9CA3AF",
  },

  button: {
    backgroundColor: "#ff6a92",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 10,
  },

  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
  },

  outlineButton: {
    borderWidth: 1,
    borderColor: "#ff6a92",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },

  outlineButtonText: {
    color: "#ff6a92",
    fontSize: 17,
    fontWeight: "bold",
  },

  grayButton: {
    backgroundColor: "#F8F8FA",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },

  grayButtonText: {
    color: "#6B7280",
    fontSize: 16,
    fontWeight: "bold",
  },

  emptyText: {
    color: "#6B7280",
    marginTop: 10,
    fontSize: 15,
  },

  card: {
    backgroundColor: "#F8F8FA",
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F8F8FA",
  },

  selectedCard: {
    borderColor: "#ff6a92",
    backgroundColor: "#F8F8FA",
  },

  groupName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 6,
  },

  groupInfo: {
    fontSize: 15,
    color: "#6B7280",
    marginTop: 2,
  },

  hostText: {
    marginTop: 8,
    color: "#ff6a92",
    fontWeight: "bold",
  },

  selectedText: {
    marginTop: 8,
    color: "#22C55E",
    fontWeight: "bold",
  },

  groupSelectorBox: {
    marginBottom: 16,
  },

  groupSelectorLabel: {
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 10,
  },

  groupSelectButton: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 15,
    backgroundColor: "#fff",
  },

  groupSelectButtonText: {
    fontSize: 16,
    color: "#000",
  },

  groupSelectPlaceholder: {
    fontSize: 16,
    color: "#9CA3AF",
  },

  groupModalContainer: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
  },

  groupModalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  groupModalItemText: {
    fontSize: 16,
    color: "#2B2B2B",
  },

  groupModalSelectedText: {
    fontSize: 13,
    color: "#ff6a92",
    fontWeight: "bold",
  },

  scheduleCard: {
    backgroundColor: "#F8F8FA",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  scheduleTitle: {
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 6,
  },

  recommendCard: {
    backgroundColor: "#F8F8FA",
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ff6a92",
  },

  recommendTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#ff6a92",
    marginBottom: 6,
  },

  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },

  smallOutlineButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ff6a92",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  smallOutlineButtonText: {
    color: "#ff6a92",
    fontWeight: "bold",
  },

  smallEditButton: {
    borderColor: "#F2C75C",
  },

  smallEditButtonText: {
    color: "#F2C75C",
  },

  smallDangerButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#EF4444",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  smallDangerButtonText: {
    color: "#EF4444",
    fontWeight: "bold",
  },

  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  calendarContainer: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 15,
  },

  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  monthButton: {
    fontSize: 32,
    fontWeight: "bold",
    paddingHorizontal: 15,
  },

  monthTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },

  weekRow: {
    flexDirection: "row",
    marginBottom: 10,
  },

  weekText: {
    flex: 1,
    textAlign: "center",
    fontWeight: "bold",
    color: "#6B7280",
  },

  dayRow: {
    flexDirection: "row",
  },

  dayBox: {
    flex: 1,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },

  selectedDayBox: {
    backgroundColor: "#ff6a92",
  },

  dayText: {
    fontSize: 16,
  },

  selectedDayText: {
    color: "#fff",
    fontWeight: "bold",
  },

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

  timeRow: {
    flexDirection: "row",
    gap: 12,
  },

  timeControl: {
    flex: 1,
    alignItems: "center",
  },

  timeButton: {
    width: "100%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ff6a92",
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
  },

  timeButtonText: {
    color: "#ff6a92",
    fontSize: 18,
    fontWeight: "bold",
  },

  timeValue: {
    fontSize: 18,
    fontWeight: "bold",
    marginVertical: 8,
  },

  closeButton: {
    marginTop: 20,
    backgroundColor: "#ff6a92",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  closeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },

  cancelButton: {
    marginTop: 10,
    backgroundColor: "#F8F8FA",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  cancelButtonText: {
    color: "#6B7280",
    fontSize: 16,
    fontWeight: "bold",
  },
});
