import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from "react-native";

export default function StudyGroupScreen() {
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const groups: any[] = [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>스터디 그룹</Text>

      <Text style={styles.sectionTitle}>스터디 그룹 생성</Text>

      <TextInput
        style={styles.input}
        placeholder="스터디 그룹 이름"
        value={groupName}
        onChangeText={setGroupName}
      />

      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>그룹 생성하기</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>초대코드로 그룹 참여</Text>

      <TextInput
        style={styles.input}
        placeholder="초대코드 입력"
        value={inviteCode}
        onChangeText={setInviteCode}
        autoCapitalize="characters"
      />

      <TouchableOpacity style={styles.outlineButton}>
        <Text style={styles.outlineButtonText}>그룹 참여하기</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>내 스터디 그룹</Text>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>참여 중인 스터디 그룹이 없습니다.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.groupName}>{item.name}</Text>
            <Text style={styles.groupInfo}>초대코드: {item.invite_code}</Text>
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
    marginTop: 16,
    marginBottom: 10,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    fontSize: 16,
  },

  button: {
    backgroundColor: "#4A90E2",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },

  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
  },

  outlineButton: {
    borderWidth: 1,
    borderColor: "#4A90E2",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },

  outlineButtonText: {
    color: "#4A90E2",
    fontSize: 17,
    fontWeight: "bold",
  },

  emptyText: {
    color: "#777",
    marginTop: 10,
    fontSize: 15,
  },

  card: {
    backgroundColor: "#F2F2F2",
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
  },

  groupName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 6,
  },

  groupInfo: {
    fontSize: 15,
    color: "#555",
  },
});