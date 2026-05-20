import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  FlatList,
  Modal,
} from "react-native";

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { getCurrentAppUserIdOrNull } from "@/src/appSession";

const firebase = require("../../src/firebase");
const db = firebase.db;

export default function ScheduleScreen() {
  const [title, setTitle] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [type, setType] = useState("");

  const [schedules, setSchedules] = useState<any[]>([]);

  // 현재 로그인 사용자 ID
  const userId = getCurrentAppUserIdOrNull();

  // 달력 팝업 상태
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // 날짜를 YYYY-MM-DD 형식으로 변환
  const formatDate = (targetDate: Date) => {
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, "0");
    const day = String(targetDate.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // Firestore Timestamp / Date / 문자열 날짜를 화면 표시용으로 변환
  const formatScheduleDate = (value: any) => {
    if (!value) {
      return "";
    }

    if (value.toDate) {
      return formatDate(value.toDate());
    }

    if (value instanceof Date) {
      return formatDate(value);
    }

    return value;
  };

  // 정렬용 시간 값 변환
  const getTimeValue = (value: any) => {
    if (!value) {
      return 0;
    }

    if (value.toDate) {
      return value.toDate().getTime();
    }

    if (value instanceof Date) {
      return value.getTime();
    }

    return new Date(value).getTime();
  };

  // 현재 달의 날짜 배열 생성
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

  // 날짜 배열을 7개씩 나누어 주 단위 배열로 변환
  const getCalendarWeeks = () => {
    const days = getCalendarDays();
    const weeks: (number | null)[][] = [];

    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return weeks;
  };

  // 이전 달 이동
  const handlePrevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );
  };

  // 다음 달 이동
  const handleNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );
  };

  // 날짜 선택
  const handleSelectDate = (day: number) => {
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );

    setSelectedDate(date);
    setIsCalendarVisible(false);
  };

  // 일정 조회 함수
  const fetchSchedules = async () => {
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

      // start_time 기준 날짜 빠른 순 정렬
      data.sort((a, b) => {
        return getTimeValue(a.start_time) - getTimeValue(b.start_time);
      });

      setSchedules(data);
    } catch (error) {
      console.log(error);
      Alert.alert("오류", "일정 조회 실패");
    }
  };

  // 화면 실행 시 일정 불러오기
  useEffect(() => {
    fetchSchedules();
  }, [userId]);

  // 일정 등록 함수
  const handleAddSchedule = async () => {
    if (!userId) {
      Alert.alert("오류", "로그인 후 일정을 등록할 수 있습니다.");
      return;
    }

    if (!title || !selectedDate || !type) {
      Alert.alert("오류", "모든 항목을 입력해주세요.");
      return;
    }

    try {
      await addDoc(collection(db, "schedules"), {
        user_id: userId,
        title: title,
        start_time: selectedDate,
        end_time: selectedDate,
        description: type,
        created_at: new Date(),
      });

      Alert.alert("성공", "일정이 등록되었습니다.");

      setTitle("");
      setSelectedDate(null);
      setType("");

      fetchSchedules();

    } catch (error) {
      console.log(error);
      Alert.alert("오류", "일정 등록 실패");
    }
  };

  const calendarWeeks = getCalendarWeeks();

  return (
    <View style={styles.container}>

      <Text style={styles.title}>일정 관리</Text>

      {!userId && (
        <Text style={styles.loginNotice}>
          로그인 후 일정 등록 및 조회가 가능합니다.
        </Text>
      )}

      {/* 일정 제목 입력 */}
      <TextInput
        style={styles.input}
        placeholder="일정 제목"
        value={title}
        onChangeText={setTitle}
      />

      {/* 날짜 선택 */}
      <TouchableOpacity
        style={styles.input}
        onPress={() => {
          if (!userId) {
            Alert.alert("오류", "로그인 후 날짜를 선택할 수 있습니다.");
            return;
          }

          setIsCalendarVisible(true);
        }}
      >
        <Text style={selectedDate ? styles.dateText : styles.placeholderText}>
          {selectedDate ? formatDate(selectedDate) : "날짜 선택"}
        </Text>
      </TouchableOpacity>

      {/* 일정 유형 입력 */}
      <TextInput
        style={styles.input}
        placeholder="유형 (시험 / 과제 / 공부)"
        value={type}
        onChangeText={setType}
      />

      {/* 등록 버튼 */}
      <TouchableOpacity
        style={styles.button}
        onPress={handleAddSchedule}
      >
        <Text style={styles.buttonText}>등록하기</Text>
      </TouchableOpacity>

      {/* 일정 목록 */}
      <Text style={styles.listTitle}>등록된 일정</Text>

      <FlatList
        data={schedules}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {userId
              ? "등록된 일정이 없습니다."
              : "로그인 후 등록된 일정을 확인할 수 있습니다."}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>

            <Text style={styles.scheduleTitle}>
              {item.title}
            </Text>

            <Text style={styles.scheduleText}>
              날짜: {formatScheduleDate(item.start_time)}
            </Text>

            <Text style={styles.scheduleText}>
              유형: {item.description}
            </Text>

          </View>
        )}
      />

      {/* 달력 팝업 */}
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
              {calendarWeeks.map((week, weekIndex) => (
                <View key={weekIndex} style={styles.dayRow}>
                  {week.map((day, dayIndex) => (
                    <TouchableOpacity
                      key={dayIndex}
                      style={styles.dayBox}
                      disabled={day === null}
                      onPress={() => day && handleSelectDate(day)}
                    >
                      <Text style={styles.dayText}>
                        {day || ""}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsCalendarVisible(false)}
            >
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
  },

  loginNotice: {
    color: "#e53e3e",
    marginBottom: 15,
    fontSize: 15,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    justifyContent: "center",
  },

  dateText: {
    fontSize: 16,
    color: "#000",
  },

  placeholderText: {
    fontSize: 16,
    color: "#999",
  },

  button: {
    backgroundColor: "#4A90E2",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 30,
  },

  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },

  listTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 15,
  },

  listContent: {
    paddingBottom: 100,
  },

  emptyText: {
    color: "#777",
    marginTop: 10,
  },

  card: {
    backgroundColor: "#F2F2F2",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },

  scheduleTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },

  scheduleText: {
    fontSize: 16,
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
    color: "#555",
  },

  daysContainer: {
    width: "100%",
  },

  dayRow: {
    flexDirection: "row",
  },

  dayBox: {
    flex: 1,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
  },

  dayText: {
    fontSize: 16,
  },

  closeButton: {
    marginTop: 20,
    backgroundColor: "#4A90E2",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  closeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});