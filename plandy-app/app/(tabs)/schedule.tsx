import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";

import { collection, addDoc } from "firebase/firestore";

const firebase = require("../../src/firebase");
const db = firebase.db;

export default function ScheduleScreen() {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState("");

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

      setTitle("");
      setDate("");
      setType("");
    } catch (error) {
      console.log(error);
      Alert.alert("오류", "일정 등록 실패");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>일정 등록</Text>

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

      <TouchableOpacity
        style={styles.button}
        onPress={handleAddSchedule}
      >
        <Text style={styles.buttonText}>등록하기</Text>
      </TouchableOpacity>
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
    marginBottom: 30,
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
  },

  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});