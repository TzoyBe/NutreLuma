import { useRef, type ReactNode } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from './theme';

/**
 * Bottom-sheet modal με native iOS αίσθηση: swipe-down από τη λαβή (grabber)
 * για κλείσιμο, πέρα από το tap-έξω που υπήρχε ήδη. Drop-in αντικαταστάτης
 * του επαναλαμβανόμενου `<Modal><Pressable modalBackdrop><Pressable calendarCard>`
 * pattern.
 *
 * Σημαντικό layout detail: το `gap` πρέπει να εφαρμόζεται στον ΆΜΕΣΟ γονέα της
 * λαβής + του περιεχομένου (`cardInner`), όχι στο εξωτερικό Animated.View —
 * αλλιώς όλα τα children του καλούντος (τίτλος, fields, κουμπιά) κολλάνε
 * χωρίς κενό μεταξύ τους, αφού θα ήταν όλα μέσα σε ΕΝΑ μοναδικό Pressable
 * child. Επίσης το PanResponder μένει ΜΟΝΟ στη λαβή — δεν αναμειγνύεται ποτέ
 * με το Pressable που καταπίνει τα taps, γιατί ο συνδυασμός PanResponder +
 * Pressable στο ΙΔΙΟ node είναι εύθραυστος.
 */
export function GlassSheet({
  visible,
  onClose,
  children,
  cardStyle,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  cardStyle?: StyleProp<ViewStyle>;
}) {
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5,
      onPanResponderMove: (_evt, gesture) => {
        if (gesture.dy > 0) translateY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dy > 90 || gesture.vy > 0.9) {
          Animated.timing(translateY, {
            toValue: 700,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            onClose();
          });
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
    }),
  ).current;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={[styles.cardOuter, cardStyle, { transform: [{ translateY }] }]}>
          <Pressable onPress={() => {}}>
            <View style={styles.cardInner}>
              <View style={styles.grabberZone} {...panResponder.panHandlers}>
                <View style={styles.grabber} />
              </View>
              {children}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 7, 15, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  cardOuter: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  cardInner: {
    padding: 20,
    paddingTop: 6,
    gap: 12,
  },
  grabberZone: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.glassBorder,
  },
});
