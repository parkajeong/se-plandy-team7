import { useState } from "react";
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
  query,
  where,
} from "firebase/firestore";

const firebase = require("../../src/firebase");
const db = firebase.db;

export default function NoteScreen() {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");

  const [searchSubject, setSearchSubject] = useState("");
  const [notes, setNotes] = useState<any[]>([]);

  // 노트 작성
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

  // 과목별 노트 조회
  const handleSearchNotes = async () => {
    if (!searchSubject) {
      Alert.alert("오류", "조회할 과목명을 입력해주세요.");
      return;
    }

    try {
      const q = query(
        collection(db, "notes"),
        where("subject", "==", searchSubject)
      );

      const querySnapshot = await getDocs(q);

      const data: any[] = [];

      querySnapshot.forEach((doc) => {
        data.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      setNotes(data);
    } catch (error) {
      console.log(error);
      Alert.alert("오류", "노트 조회 실패");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>노트 관리</Text>

      <Text style={styles.sectionTitle}>노트 작성</Text>

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

      <Text style={styles.sectionTitle}>과목별 노트 조회</Text>

      <TextInput
        style={styles.input}
        placeholder="조회할 과목명"
        value={searchSubject}
        onChangeText={setSearchSubject}
      />

      <TouchableOpacity style={styles.searchButton} onPress={handleSearchNotes}>
        <Text style={styles.buttonText}>조회하기</Text>
      </TouchableOpacity>

      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>조회된 노트가 없습니다.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.subject}>{item.subject}</Text>
            <Text style={styles.noteText}>{item.content}</Text>
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

  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    marginTop: 10,
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
    marginBottom: 25,
  },

  searchButton: {
    backgroundColor: "#4A90E2",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },

  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },

  card: {
    backgroundColor: "#F2F2F2",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },

  subject: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },

  noteText: {
    fontSize: 16,
    lineHeight: 22,
  },

  emptyText: {
    color: "#777",
    marginTop: 10,
  },
});