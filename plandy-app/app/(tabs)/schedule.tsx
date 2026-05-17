import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  FlatList,
} from "react-native";

import {
  collection,
  addDoc,
  getDocs,
} from "firebase/firestore";

const firebase = require("../../src/firebase");
const db = firebase.db;

export default function ScheduleScreen() {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState("");

  const [schedules, setSchedules] = useState<any[]>([]);

  // 일정 조회 함수
  const fetchSchedules = async () => {
    try {
      const querySnapshot = await getDocs(
        collection(db, "schedules")
      );

      const data: any[] = [];

      querySnapshot.forEach((doc) => {
        data.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      data.sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
      
      setSchedules(data);
    } catch (error) {
      console.log(error);
    }
  };

  // 화면 실행 시 일정 불러오기
  useEffect(() => {
    fetchSchedules();
  }, []);

  // 일정 등록 함수
  const handleAddSchedule = async () => {
    if (!title || !date || !type) {
      Alert.alert("오류", "모든 항목을 입력해주세요.");
      return;
    }

    try {
      await addDoc(collection(db, "schedules"), {
        title,
        date,
        type,
        createdAt: new Date(),
      });

      Alert.alert("성공", "일정이 등록되었습니다.");

      // 입력창 초기화
      setTitle("");
      setDate("");
      setType("");

      // 등록 후 목록 새로고침
      fetchSchedules();

    } catch (error) {
      console.log(error);
      Alert.alert("오류", "일정 등록 실패");
    }
  };

  return (
    <View style={styles.container}>

      <Text style={styles.title}>일정 관리</Text>

      {/* 일정 등록 입력창 */}
      <TextInput
        style={styles.input}
        placeholder="일정 제목"
        value={title}
        onChangeText={setTitle}
      />

      <TextInput
        style={styles.input}
        placeholder="날짜 (2026-05-17)"
        value={date}
        onChangeText={setDate}
      />

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
        renderItem={({ item }) => (
          <View style={styles.card}>

            <Text style={styles.scheduleTitle}>
              {item.title}
            </Text>

            <Text style={styles.scheduleText}>
              날짜: {item.date}
            </Text>

            <Text style={styles.scheduleText}>
              유형: {item.type}
            </Text>

          </View>
        )}
      />

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

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
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
});