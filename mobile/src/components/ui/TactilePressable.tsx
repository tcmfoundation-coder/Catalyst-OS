import { forwardRef, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeIn, useReducedMotion, useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useAppSettings } from "@/lib/settings-context";
import { colors } from "@/theme/tokens";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type TactilePressableProps = Omit<PressableProps, "children" | "style" | "onPressIn" | "onPressOut"> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPressIn?: PressableProps["onPressIn"];
  onPressOut?: PressableProps["onPressOut"];
};

export const TactilePressable = forwardRef<React.ElementRef<typeof Pressable>, TactilePressableProps>(
  function TactilePressable({ children, style, onPressIn, onPressOut, ...props }, ref) {
    const pressed = useSharedValue(0);
    const { settings } = useAppSettings();
    const reduceMotion = useReducedMotion() || settings.reduceMotion;
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateY: pressed.value * 2 },
        { scale: 1 - pressed.value * 0.025 },
      ],
    }));

    return (
      <AnimatedPressable
        {...props}
        ref={ref}
        onPressIn={(event) => {
          pressed.value = reduceMotion ? 1 : withSpring(1, { damping: 18, stiffness: 340 });
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          pressed.value = reduceMotion ? 0 : withSpring(0, { damping: 16, stiffness: 260 });
          onPressOut?.(event);
        }}
        style={[styles.surface, style, animatedStyle]}
      >
        <View pointerEvents="none" style={styles.glint} />
        {children}
      </AnimatedPressable>
    );
  },
);

export function TactileIconTile({
  children,
  color = colors.lime,
  size = 42,
  style,
}: {
  children: ReactNode;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { settings } = useAppSettings();
  const reduceMotion = useReducedMotion() || settings.reduceMotion;

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(260)}
      style={[
        styles.iconSeat,
        { width: size, height: size, borderRadius: size * 0.3, borderColor: `${color}55`, shadowColor: color },
        style,
      ]}
    >
      <View style={[styles.iconWell, { borderRadius: size * 0.24 }]}>
        <View pointerEvents="none" style={[styles.iconGlint, { backgroundColor: `${color}28` }]} />
        <View style={[styles.iconFace, { borderRadius: size * 0.2, borderColor: `${color}45`, backgroundColor: `${color}12` }]}>
          {children}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderTopWidth: 1,
    borderTopColor: "#5A6B74",
    borderLeftWidth: 1,
    borderLeftColor: "#34434D",
    borderRightWidth: 1,
    borderRightColor: "#1E2A33",
    borderBottomWidth: 1,
    borderBottomColor: "#172129",
    shadowColor: colors.black,
    shadowOpacity: 0.42,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  glint: { position: "absolute", top: 1, left: "18%", right: "18%", height: 1, borderRadius: 1, backgroundColor: "#FFFFFF24" },
  iconSeat: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: "#091117",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  iconWell: {
    width: "78%",
    height: "78%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderTopColor: "#080E12",
    borderLeftColor: "#0C141A",
    borderRightColor: "#26343B",
    borderBottomColor: "#354650",
    backgroundColor: "#080F14",
  },
  iconGlint: { position: "absolute", top: 2, left: 5, width: "46%", height: 1, borderRadius: 1 },
  iconFace: {
    width: "80%",
    height: "80%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: colors.lime,
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
