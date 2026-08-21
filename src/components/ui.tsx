import React from 'react';
import {
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, radius, spacing } from '../lib/theme';

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Chip({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color }]}>{text}</Text>
    </View>
  );
}

export function Btn({
  title,
  onPress,
  tone = 'primary',
  style,
}: {
  title: string;
  onPress: () => void;
  tone?: 'primary' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const toneStyle =
    tone === 'primary'
      ? { backgroundColor: colors.gold }
      : tone === 'danger'
        ? { backgroundColor: colors.redDim, borderWidth: 1, borderColor: colors.red }
        : { backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border };
  const textColor = tone === 'primary' ? '#1a1500' : tone === 'danger' ? colors.red : colors.text;
  return (
    <TouchableOpacity onPress={onPress} style={[styles.btn, toneStyle, style]} activeOpacity={0.8}>
      <Text style={[styles.btnText, { color: textColor }]}>{title}</Text>
    </TouchableOpacity>
  );
}

export function Field({
  label,
  ...props
}: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.faint}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

export function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, paddingRight: spacing.m }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.toggleHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.goldDim }}
        thumbColor={value ? colors.gold : colors.sub}
      />
    </View>
  );
}

/** Поле часу «19:30» зі степперами по 30 хв. */
export function TimeStepper({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [h, m] = value.split(':').map(Number);
  const total = (Number.isFinite(h) ? h : 20) * 60 + (Number.isFinite(m) ? m : 0);
  const shift = (delta: number) => {
    const t = (total + delta + 24 * 60) % (24 * 60);
    const hh = String(Math.floor(t / 60)).padStart(2, '0');
    const mm = String(t % 60).padStart(2, '0');
    onChange(`${hh}:${mm}`);
  };
  return (
    <View style={styles.stepperRow}>
      <TouchableOpacity style={styles.stepperBtn} onPress={() => shift(-30)}>
        <Text style={styles.stepperBtnText}>−30</Text>
      </TouchableOpacity>
      <Text style={styles.stepperValue}>{value}</Text>
      <TouchableOpacity style={styles.stepperBtn} onPress={() => shift(30)}>
        <Text style={styles.stepperBtnText}>+30</Text>
      </TouchableOpacity>
    </View>
  );
}

export function EmptyState({ emoji, text }: { emoji: string; text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 40 }}>{emoji}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.l,
    marginBottom: spacing.m,
  },
  sectionTitle: {
    color: colors.sub,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.s,
    marginTop: spacing.m,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  btn: {
    borderRadius: radius.m,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 15, fontWeight: '700' },
  field: { marginBottom: spacing.m },
  fieldLabel: { color: colors.sub, fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.m,
    color: colors.text,
    paddingHorizontal: spacing.m,
    paddingVertical: 10,
    fontSize: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.s,
  },
  toggleLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  toggleHint: { color: colors.sub, fontSize: 12, marginTop: 2 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  stepperBtn: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.s,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  stepperBtnText: { color: colors.gold, fontWeight: '700', fontSize: 14 },
  stepperValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    minWidth: 70,
    textAlign: 'center',
  },
  empty: { alignItems: 'center', paddingVertical: 40, gap: spacing.m },
  emptyText: { color: colors.sub, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
