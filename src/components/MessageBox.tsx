import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { ThemeColors, useTheme } from "../theme/theme";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
};

export default function MessageBox({
  visible,
  title,
  message,
  type = "success",
  onClose,
  onConfirm,
  onCancel,
  confirmText = "Tamam",
  cancelText = "Vazgeç",
}: Props) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isSuccess = type === "success";
  const isError = type === "error";
  const showConfirm = typeof onConfirm === "function";
  const statusColor = isSuccess ? colors.success : isError ? colors.danger : colors.accent;
  const overlayColor = mode === "light" ? "rgba(10,20,35,0.45)" : "rgba(0,0,0,0.7)";
  const badgeLabel = isSuccess ? "Başarılı" : isError ? "Hata" : "Bilgi";

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: overlayColor }]}>
        <View style={styles.box}>
          <View style={styles.badgeRow}>
            <View style={[styles.badgeDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.badgeText, { color: statusColor }]}>{badgeLabel}</Text>
          </View>

          <Text style={styles.title}>{title}</Text>

          <Text style={styles.message}>{message}</Text>

          {showConfirm ? (
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel || onClose}>
                <Text style={styles.cancelButtonText}>{cancelText}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: statusColor }]}
                onPress={onConfirm}
              >
                <Text style={styles.buttonText}>{confirmText}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.singleButton, { backgroundColor: statusColor }]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>{confirmText}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    box: {
      width: "86%",
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
    },
    badgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
    },
    badgeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0.2,
    },
    title: {
      fontSize: 18,
      fontWeight: "900",
      color: colors.text,
      textAlign: "left",
      marginBottom: 6,
    },
    message: {
      fontSize: 14,
      color: colors.text,
      textAlign: "left",
      marginBottom: 16,
      lineHeight: 20,
    },
    actions: {
      flexDirection: "row",
      gap: 10,
    },
    button: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 36,
    },
    singleButton: {
      marginTop: 8,
      marginBottom: 6,
      alignSelf: "center",
      minWidth: 140,
      flexGrow: 0,
      flexBasis: "auto",
      paddingHorizontal: 20,
    },
    buttonText: {
      color: colors.onAccent,
      fontWeight: "800",
      fontSize: 13,
      textAlign: "center",
      includeFontPadding: false,
      textAlignVertical: "center",
    },
    cancelButton: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    cancelButtonText: {
      color: colors.text,
      fontWeight: "800",
      fontSize: 13,
    },
  });
