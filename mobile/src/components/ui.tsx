import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { mediaUri } from '@/lib/api';
import { font, radius, space, useColors } from '@/lib/theme';

type TVariant = 'body' | 'small' | 'dim' | 'title' | 'hero' | 'label' | 'bold' | 'link' | 'error';

export function T({ v = 'body', style, ...rest }: TextProps & { v?: TVariant }) {
  const c = useColors();
  const base: Record<TVariant, TextStyle> = {
    body: { fontSize: font.body, color: c.text, lineHeight: 21 },
    small: { fontSize: font.small, color: c.text, lineHeight: 18 },
    dim: { fontSize: font.small, color: c.textDim, lineHeight: 18 },
    title: { fontSize: font.title, color: c.text, fontWeight: '800', lineHeight: 28 },
    hero: { fontSize: font.hero, color: c.text, fontWeight: '800', lineHeight: 34 },
    label: { fontSize: font.small, color: c.textDim, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
    bold: { fontSize: font.body, color: c.text, fontWeight: '700', lineHeight: 21 },
    link: { fontSize: font.body, color: c.primary, fontWeight: '700' },
    error: { fontSize: font.small, color: c.danger, lineHeight: 18 },
  };
  return <Text style={[base[v], style]} {...rest} />;
}

/** A full screen with the app background. `scroll` for forms and long pages. */
export function Screen({
  children,
  scroll,
  padded = true,
  edges = ['bottom'],
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const pad = padded ? { padding: space.l } : null;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: c.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={[pad, { gap: space.l, paddingBottom: space.xxl * 2 }, style]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  kind = 'primary',
  loading,
  disabled,
  icon,
  small,
  style,
  testID,
}: {
  title: string;
  onPress?: () => void;
  kind?: ButtonKind;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const c = useColors();
  const bg = { primary: c.primary, secondary: c.cardAlt, ghost: 'transparent', danger: c.danger }[kind];
  const fg = { primary: c.primaryText, secondary: c.text, ghost: c.primary, danger: '#fff' }[kind];
  const off = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.pill,
          paddingVertical: small ? space.s : space.m + 2,
          paddingHorizontal: small ? space.m : space.xl,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: space.s,
          opacity: off ? 0.5 : pressed ? 0.85 : 1,
          borderWidth: kind === 'secondary' ? StyleSheet.hairlineWidth : 0,
          borderColor: c.line,
        },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Text style={{ fontSize: small ? 14 : 17 }}>{icon}</Text> : null}
      <Text style={{ color: fg, fontWeight: '800', fontSize: small ? font.small : font.body }}>{title}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: string;
  testID?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: space.s,
        paddingHorizontal: space.m,
        borderRadius: radius.pill,
        backgroundColor: selected ? c.text : c.card,
        borderWidth: 1,
        borderColor: selected ? c.text : c.line,
        opacity: pressed ? 0.8 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      })}>
      {icon ? <Text>{icon}</Text> : null}
      <Text style={{ color: selected ? c.bg : c.text, fontWeight: '600', fontSize: font.small }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children, scroll }: { children: ReactNode; scroll?: boolean }) {
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s, paddingRight: space.l }}>
        {children}
      </ScrollView>
    );
  }
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>{children}</View>;
}

export function Card({ children, style, onPress, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string }) {
  const c = useColors();
  const box: ViewStyle = { backgroundColor: c.card, borderRadius: radius.l, padding: space.l, gap: space.s, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line };
  if (!onPress) return <View testID={testID} style={[box, style]}>{children}</View>;
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [box, { opacity: pressed ? 0.9 : 1 }, style]}>
      {children}
    </Pressable>
  );
}

export function Field({ label, hint, error, style, ...props }: TextInputProps & { label?: string; hint?: string; error?: string | null }) {
  const c = useColors();
  return (
    <View style={{ gap: space.xs }}>
      {label ? <T v="label">{label}</T> : null}
      <TextInput
        placeholderTextColor={c.textDim}
        style={[
          {
            backgroundColor: c.card,
            color: c.text,
            borderRadius: radius.m,
            borderWidth: 1,
            borderColor: error ? c.danger : c.line,
            paddingHorizontal: space.m,
            paddingVertical: space.m,
            fontSize: font.body,
            minHeight: props.multiline ? 120 : undefined,
            textAlignVertical: props.multiline ? 'top' : 'center',
          },
          style,
        ]}
        {...props}
      />
      {error ? <T v="error">{error}</T> : hint ? <T v="dim">{hint}</T> : null}
    </View>
  );
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: space.m }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T v="label">{title}</T>
        {right}
      </View>
      {children}
    </View>
  );
}

export function Avatar({ url, name, size = 40 }: { url?: string | null; name?: string; size?: number }) {
  const c = useColors();
  const uri = mediaUri(url);
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.cardAlt }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.42, fontWeight: '800', color: c.textDim }}>{(name ?? '?').trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export function Row({ children, style, gap = space.s }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Divider() {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line }} />;
}

/** A tappable settings-style row. */
export function ListRow({ title, subtitle, onPress, right, danger, testID }: { title: string; subtitle?: string; onPress?: () => void; right?: ReactNode; danger?: boolean; testID?: string }) {
  const c = useColors();
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => ({ paddingVertical: space.m, flexDirection: 'row', alignItems: 'center', gap: space.m, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="bold" style={danger ? { color: c.danger } : undefined}>{title}</T>
        {subtitle ? <T v="dim">{subtitle}</T> : null}
      </View>
      {right ?? (onPress ? <T v="dim">›</T> : null)}
    </Pressable>
  );
}
