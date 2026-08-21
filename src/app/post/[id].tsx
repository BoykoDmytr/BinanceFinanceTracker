import * as Clipboard from 'expo-clipboard';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Btn, Field, ToggleRow } from '../../components/ui';
import { useData } from '../../lib/data-context';
import { colors, radius, spacing } from '../../lib/theme';

export default function PostEditor() {
  const params = useLocalSearchParams<{ id: string }>();
  const isNew = params.id === 'new';
  const { posts, addPost, editPost, removePost } = useData();

  const existing = isNew ? null : (posts.find((p) => p.id === Number(params.id)) ?? null);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [content, setContent] = useState(existing?.content ?? '');
  const [published, setPublished] = useState(existing?.status === 'published');
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildPost = () => ({
    title: title.trim() || 'Без назви',
    content,
    status: (published ? 'published' : 'draft') as 'published' | 'draft',
  });

  const save = () => {
    const data = buildPost();
    if (existing) {
      editPost({ ...existing, ...data });
    } else {
      const p = addPost(data.title, data.content);
      if (data.status === 'published') editPost({ ...p, status: 'published' });
    }
    router.back();
  };

  const copy = async () => {
    await Clipboard.setStringAsync(content);
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1500);
  };

  const remind = () => {
    // щоб прив'язати нагадування, пост має існувати — зберігаємо його
    if (existing) {
      editPost({ ...existing, ...buildPost() });
      router.push(`/reminder/new?postId=${existing.id}`);
    } else {
      const data = buildPost();
      const p = addPost(data.title, data.content);
      router.replace(`/reminder/new?postId=${p.id}`);
    }
  };

  const confirmDelete = () => {
    if (!existing) return;
    Alert.alert('Видалити пост?', existing.title, [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: async () => {
          await removePost(existing.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: isNew ? 'Новий пост' : 'Пост' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field label="Назва" value={title} onChangeText={setTitle} placeholder="Пост про SPCXB" />

        <Text style={styles.label}>Текст поста</Text>
        <TextInput
          style={styles.textarea}
          value={content}
          onChangeText={setContent}
          placeholder="Пиши заготовку тут…"
          placeholderTextColor={colors.faint}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.actionsRow}>
          <Btn
            title={copied ? '✓ Скопійовано' : 'Скопіювати текст'}
            onPress={copy}
            tone="ghost"
            style={{ flex: 1 }}
          />
          <Btn title="🔔 Нагадати" onPress={remind} tone="ghost" style={{ flex: 1 }} />
        </View>

        <ToggleRow
          label="Опубліковано"
          hint="Познач, коли пост уже запощено"
          value={published}
          onChange={setPublished}
        />

        <Btn title="Зберегти" onPress={save} style={{ marginTop: spacing.s }} />
        {existing ? (
          <Btn
            title="Видалити пост"
            onPress={confirmDelete}
            tone="danger"
            style={{ marginTop: spacing.m }}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.l, paddingBottom: 60 },
  label: { color: colors.sub, fontSize: 13, marginBottom: 6 },
  textarea: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.m,
    color: colors.text,
    padding: spacing.m,
    fontSize: 15,
    minHeight: 180,
    lineHeight: 21,
    marginBottom: spacing.m,
  },
  actionsRow: { flexDirection: 'row', gap: spacing.m, marginBottom: spacing.m },
});
