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

export default function NoteScreen() {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");

  const handleAddNote = async () => {
    if (!subject || !content) {
      Alert.alert("오류", "모든 항목을 입력해주세요.");
      return;
    }

    try {
      await addDoc(collection(db, "notes"), {
        subject,
        content,
        createdAt: new Date(),
      });

      Alert.alert("성공", "노트가 저장되었습니다.");

      setSubject("");
      setContent("");
    } catch (error) {
      console.log(error);
      Alert.alert("오류", "노트 저장 실패");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>노트 작성</Text>

      <TextInput
        style={styles.input}
        placeholder="과목명"
        value={subject}
        onChangeText={setSubject}
      />

      <TextInput
        style={styles.noteInput}
        placeholder="학습 노트 내용을 입력하세요"
        value={content}
        onChangeText={setContent}
        multiline
      />

      <TouchableOpacity style={styles.button} onPress={handleAddNote}>
        <Text style={styles.buttonText}>저장하기</Text>
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
    marginBottom: 20,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },

  noteInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    height: 120,
    textAlignVertical: "top",
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