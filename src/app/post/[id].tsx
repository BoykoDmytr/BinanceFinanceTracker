import * as Clipboard from 'expo-clipboard';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Btn, Field, ToggleRow } from '../../components/ui';
import { useData } from '../../lib/data-context';
import { deleteImages, pickImages } from '../../lib/images';
import { colors, radius, spacing } from '../../lib/theme';

export default function PostEditor() {
  const params = useLocalSearchParams<{ id: string }>();
  const isNew = params.id === 'new';
  const { posts, addPost, editPost, removePost } = useData();

  const existing = isNew ? null : (posts.find((p) => p.id === Number(params.id)) ?? null);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [content, setContent] = useState(existing?.content ?? '');
  const [published, setPublished] = useState(existing?.status === 'published');
  const [images, setImages] = useState<string[]>(existing?.images ?? []);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildPost = () => ({
    title: title.trim() || 'Без назви',
    content,
    status: (published ? 'published' : 'draft') as 'published' | 'draft',
    images,
  });

  const save = () => {
    const data = buildPost();
    if (existing) {
      editPost({ ...existing, ...data });
    } else {
      const p = addPost(data.title, data.content, data.images);
      if (data.status === 'published') editPost({ ...p, ...data });
    }
    router.back();
  };

  const copy = async () => {
    await Clipboard.setStringAsync(content);
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1500);
  };

  const addImages = async () => {
    try {
      const picked = await pickImages();
      if (picked.length) setImages((prev) => [...prev, ...picked]);
    } catch {
      Alert.alert('Не вдалося додати картинку', 'Спробуй ще раз.');
    }
  };

  const removeImage = (uri: string) => {
    Alert.alert('Прибрати картинку?', '', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Прибрати',
        style: 'destructive',
        onPress: () => {
          deleteImages([uri]);
          setImages((prev) => prev.filter((u) => u !== uri));
        },
      },
    ]);
  };

  const shareImage = async (uri: string) => {
    try {
      await Sharing.shareAsync(uri);
    } catch {
      // користувач закрив шіт — нічого
    }
  };

  const remind = () => {
    // щоб прив'язати нагадування, пост має існувати — зберігаємо його
    if (existing) {
      editPost({ ...existing, ...buildPost() });
      router.push(`/reminder/new?postId=${existing.id}`);
    } else {
      const data = buildPost();
      const p = addPost(data.title, data.content, data.images);
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

        <Text style={styles.label}>Картинки</Text>
        <View style={styles.imagesRow}>
          {images.map((uri) => (
            <TouchableOpacity
              key={uri}
              onPress={() => shareImage(uri)}
              onLongPress={() => removeImage(uri)}
              activeOpacity={0.8}
            >
              <Image source={{ uri }} style={styles.thumb} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.addThumb} onPress={addImages} activeOpacity={0.7}>
            <Text style={styles.addThumbText}>＋</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.imagesHint}>
          Тап по картинці — поділитись (щоб вставити в пост), довгий тап — прибрати.
        </Text>

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
  imagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: radius.s,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
  },
  addThumb: {
    width: 84,
    height: 84,
    borderRadius: radius.s,
    borderWidth: 1,
    borderColor: colors.gold,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardAlt,
  },
  addThumbText: { color: colors.gold, fontSize: 28, fontWeight: '300' },
  imagesHint: { color: colors.faint, fontSize: 11, marginTop: 6, marginBottom: spacing.m },
  actionsRow: { flexDirection: 'row', gap: spacing.m, marginBottom: spacing.m },
});
