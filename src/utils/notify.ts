import { Alert, Platform, ToastAndroid } from "react-native";

export const notify = (message: string, title = "Aviso") => {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
  Alert.alert(title, message);
};

export const notifyError = (message: string, title = "Error") => {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
  Alert.alert(title, message);
};
