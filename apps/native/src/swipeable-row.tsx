import { useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { colors } from './theme';

const ACTION_WIDTH = 84;

/** iOS-style swipe-to-delete: swipe left αποκαλύπτει ένα κόκκινο Delete πλήκτρο. */
export function SwipeableRow({
  children,
  onDelete,
}: {
  children: ReactNode;
  onDelete: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);
  const [open, setOpen] = useState(false);

  function snapTo(next: boolean) {
    openRef.current = next;
    setOpen(next);
    Animated.spring(translateX, {
      toValue: next ? -ACTION_WIDTH : 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderMove: (_evt, gesture) => {
        const base = openRef.current ? -ACTION_WIDTH : 0;
        const next = Math.min(0, Math.max(-ACTION_WIDTH - 24, base + gesture.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_evt, gesture) => {
        const base = openRef.current ? -ACTION_WIDTH : 0;
        const projected = base + gesture.dx;
        snapTo(projected < -ACTION_WIDTH / 2);
      },
      onPanResponderTerminate: () => snapTo(openRef.current),
    }),
  ).current;

  return (
    <View style={styles.wrap}>
      <View style={styles.actionLayer} pointerEvents={open ? 'auto' : 'none'}>
        <Pressable
          style={styles.deleteButton}
          onPress={() => {
            snapTo(false);
            onDelete();
          }}
        >
          <Trash2 size={18} color={colors.white} />
        </Pressable>
      </View>

      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
        {open ? (
          <Pressable style={StyleSheet.absoluteFill} onPress={() => snapTo(false)} />
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  actionLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    width: ACTION_WIDTH - 14,
    height: '82%',
    borderRadius: 18,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
