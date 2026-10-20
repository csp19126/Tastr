import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LIMITS, PRICE_BRACKETS, TAGS, type Tag } from '@shared';
import { categoryIcon } from '@/components/cards';
import { errorText } from '@/components/errors';
import { Loading } from '@/components/mascot';
import { PawsInput, SubRatingsInput } from '@/components/paws';
import { Button, Card, Chip, ChipRow, Field, Row, Screen, Section, T } from '@/components/ui';
import { ApiError, get, mediaUri, post, put, uploadPhoto } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { deleteDraft, getDraft, keepPhoto, listDrafts, newDraft, saveDraft, type Draft, type DraftDish, type DraftPhoto } from '@/lib/drafts';
import { formatPrice, parseAmount, priceBand } from '@/lib/format';
import { pickPhotos, takePhoto, type PickResult } from '@/lib/photos';
import { radius, space, useColors } from '@/lib/theme';
import type { PlaceCard, Review } from '@/lib/types';

const isoDay = (offset: number) => {
  const d = new Date(Date.now() - offset * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function confirmAsync(title: string, message: string, yes: string, no: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(!!globalThis.confirm?.(`${title}\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: no, style: 'cancel', onPress: () => resolve(false) },
      { text: yes, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

/** A published review turned back into an editable draft. */
function draftFromReview(r: Review): Draft {
  const asPhoto = (p: { id: number; url: string; width: number; height: number }): DraftPhoto => ({
    uri: mediaUri(p.url)!, width: p.width, height: p.height, serverId: p.id, serverUrl: p.url,
  });
  return {
    ...newDraft({ id: r.place.id, name: r.place.name }, r.currency),
    id: `edit-${r.id}`,
    reviewId: r.id,
    photos: r.photos.map(asPhoto),
    paws: r.paws,
    ratings: Object.fromEntries(Object.entries(r.ratings).filter(([, v]) => v != null)) as Draft['ratings'],
    body: r.body,
    pricePaid: r.pricePaid != null ? String(r.pricePaid) : '',
    priceBracket: r.priceBracket,
    tags: r.tags,
    dishes: r.dishes.map((d) => ({ key: String(d.id), name: d.name, thumbsUp: d.thumbsUp, note: d.note, photo: d.photo ? asPhoto(d.photo) : undefined })),
    sponsored: r.sponsored,
    visitedOn: r.visitedOn,
  };
}

function PlacePicker({ onPick }: { onPick: (p: { id: number; name: string }) => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const results = useQuery({
    queryKey: ['place-picker', q],
    queryFn: () => get<{ places: PlaceCard[] }>('/places', { q, limit: 12, sort: q ? 'popular' : 'newest' }),
  });
  return (
    <Section title={t('review.choosePlace')}>
      <Field testID="place-search" placeholder={t('review.searchPlace')} value={q} onChangeText={setQ} autoCorrect={false} />
      {(results.data?.places ?? []).map((p) => (
        <Card key={p.id} testID={`pick-${p.id}`} onPress={() => onPick({ id: p.id, name: p.name })} style={{ padding: space.m }}>
          <T v="bold">{categoryIcon(p.category)} {p.name}</T>
          {p.neighbourhood ? <T v="dim">{p.neighbourhood}</T> : null}
        </Card>
      ))}
      <Button kind="secondary" icon="📍" title={t('review.notListed')} onPress={() => router.push({ pathname: '/place/new', params: { forReview: '1', name: q } })} />
    </Section>
  );
}

function Thumb({ photo, onRemove }: { photo: DraftPhoto; onRemove: () => void }) {
  const { t } = useTranslation();
  return (
    <View>
      <Image source={{ uri: photo.uri }} style={{ width: 92, height: 92, borderRadius: radius.m }} contentFit="cover" />
      <Pressable accessibilityLabel={t('photo.remove')} onPress={onRemove} hitSlop={8} style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
        <T style={{ color: '#fff', fontSize: 13 }}>✕</T>
      </Pressable>
    </View>
  );
}

export default function Compose() {
  const { t } = useTranslation();
  const c = useColors();
  const qc = useQueryClient();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ draftId?: string; placeId?: string; placeName?: string; reviewId?: string }>();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const loaded = useRef(false);

  // Open the right draft: the one asked for, the review being edited, or this place's unfinished one.
  useEffect(() => {
    (async () => {
      let d: Draft | null = null;
      if (params.draftId) d = await getDraft(params.draftId);
      if (!d && params.reviewId) {
        d = (await getDraft(`edit-${params.reviewId}`)) ?? draftFromReview(await get<Review>(`/reviews/${params.reviewId}`));
      }
      if (!d && params.placeId) {
        d = (await listDrafts()).find((x) => !x.reviewId && x.place?.id === Number(params.placeId)) ?? null;
        d ??= newDraft({ id: Number(params.placeId), name: params.placeName ?? '' }, user?.currency ?? 'VND');
      }
      d ??= newDraft(null, user?.currency ?? 'VND');
      setDraft(d);
      loaded.current = true;
    })().catch((e) => setError(errorText(e)));
  }, [params.draftId, params.placeId, params.reviewId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save to the phone as you go.
  useEffect(() => {
    if (!draft || !loaded.current) return;
    const id = setTimeout(() => {
      saveDraft(draft).then(() => setSavedAt(Date.now()));
    }, 600);
    return () => clearTimeout(id);
  }, [draft]);

  if (!draft) return error ? <Screen><T v="error">{error}</T></Screen> : <Loading />;

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const photosLeft = LIMITS.photosPerReview - draft.photos.length;

  async function addPhotos(res: PickResult, target: 'review' | DraftDish) {
    if ('denied' in res) {
      Alert.alert('', t(res.denied === 'camera' ? 'photo.permissionCamera' : 'photo.permissionPhotos'));
      return;
    }
    const kept = await Promise.all(res.photos.map((p) => keepPhoto(draft!.id, p)));
    if (target === 'review') {
      setDraft((d) => (d ? { ...d, photos: [...d.photos, ...kept].slice(0, LIMITS.photosPerReview) } : d));
    } else if (kept[0]) {
      setDraft((d) => (d ? { ...d, dishes: d.dishes.map((x) => (x.key === target.key ? { ...x, photo: kept[0] } : x)) } : d));
    }
  }

  function setDish(key: string, patch: Partial<DraftDish>) {
    set({ dishes: draft!.dishes.map((d) => (d.key === key ? { ...d, ...patch } : d)) });
  }

  const bodyShort = draft.body.trim().length < LIMITS.reviewBodyMin;
  const dishesOk = draft.dishes.every((d) => !d.name.trim() || d.thumbsUp != null);
  const canPost = !!draft.place && !!draft.paws && !bodyShort && draft.sponsored != null && dishesOk && !busy;

  async function postReview() {
    if (!draft || !draft.place || !draft.paws) return;
    if (draft.sponsored == null) {
      setError(t('review.sponsoredRequired'));
      return;
    }
    setError(null);
    let d = draft;
    try {
      // 1. Photos, one by one. Each success is saved, so a retry carries on where it stopped.
      const pending = [...d.photos, ...d.dishes.flatMap((x) => (x.photo ? [x.photo] : []))].filter((p) => !p.serverId);
      let done = 0;
      for (const p of pending) {
        setBusy(t('review.posting', { done, total: pending.length }));
        const up = await uploadPhoto(p.uri);
        const mark = (x: DraftPhoto) => (x.uri === p.uri ? { ...x, serverId: up.id, serverUrl: up.url } : x);
        d = { ...d, photos: d.photos.map(mark), dishes: d.dishes.map((x) => (x.photo ? { ...x, photo: mark(x.photo) } : x)) };
        setDraft(d);
        await saveDraft(d);
        done += 1;
      }
      setBusy(t('review.posting', { done, total: pending.length }));
      // 2. The review itself.
      const body = {
        placeId: d.place!.id,
        paws: d.paws,
        ratings: d.ratings,
        body: d.body.trim(),
        pricePaid: parseAmount(d.pricePaid),
        currency: d.currency,
        priceBracket: d.priceBracket,
        tags: d.tags,
        sponsored: d.sponsored,
        visitedOn: d.visitedOn,
        photoIds: d.photos.map((p) => p.serverId!),
        dishes: d.dishes
          .filter((x) => x.name.trim() && x.thumbsUp != null)
          .map((x) => ({ name: x.name.trim(), thumbsUp: x.thumbsUp!, note: x.note.trim(), photoId: x.photo?.serverId ?? null })),
      };
      const review = d.reviewId ? await put<Review>(`/reviews/${d.reviewId}`, body) : await post<Review>('/reviews', body);
      await deleteDraft(d.id);
      qc.invalidateQueries({ queryKey: ['place', String(review.place.id)] });
      qc.invalidateQueries({ queryKey: ['place-reviews', String(review.place.id)] });
      qc.invalidateQueries({ queryKey: ['places'] });
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['review', String(review.id)] });
      router.replace(`/review/${review.id}?posted=1`);
    } catch (e) {
      await saveDraft(d);
      setError(e instanceof ApiError && e.code === 'network' ? t('review.offline') : errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: draft.reviewId ? t('review.editTitle') : t('review.newTitle') }} />
      {!draft.place ? (
        <PlacePicker onPick={(p) => set({ place: p })} />
      ) : (
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="title" style={{ flex: 1 }}>{draft.place.name}</T>
          {!draft.reviewId && !params.placeId ? <Button small kind="ghost" title={t('common.edit')} onPress={() => set({ place: null })} /> : null}
        </Row>
      )}

      <Section title={t('review.photos')}>
        <T v="dim">{t('review.photosHelp', { max: LIMITS.photosPerReview })}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {draft.photos.map((p, i) => (
            <Thumb key={`${p.uri}-${i}`} photo={p} onRemove={() => set({ photos: draft.photos.filter((_, j) => j !== i) })} />
          ))}
        </View>
        {photosLeft > 0 ? (
          <Row>
            {Platform.OS !== 'web' ? <Button small kind="secondary" icon="📷" title={t('review.takePhoto')} onPress={async () => addPhotos(await takePhoto(), 'review')} /> : null}
            <Button small kind="secondary" icon="🖼️" title={t('review.pickPhotos')} onPress={async () => addPhotos(await pickPhotos(photosLeft), 'review')} />
          </Row>
        ) : (
          <T v="dim">{t('photo.tooMany', { max: LIMITS.photosPerReview })}</T>
        )}
      </Section>

      <Section title={t('review.overall')}>
        <PawsInput value={draft.paws} onChange={(paws) => set({ paws })} />
      </Section>

      <Section title={t('review.quickRatings')}>
        <T v="dim">{t('review.quickRatingsHelp')}</T>
        <SubRatingsInput value={draft.ratings} onChange={(ratings) => set({ ratings })} />
      </Section>

      <Field
        testID="review-body"
        label={t('review.body')}
        placeholder={t('review.bodyPlaceholder')}
        value={draft.body}
        onChangeText={(body) => set({ body })}
        multiline
        maxLength={LIMITS.reviewBodyMax}
        hint={bodyShort && draft.body.length > 0 ? t('review.bodyTooShort', { min: LIMITS.reviewBodyMin }) : undefined}
      />

      <Section title={t('review.dishes')}>
        <T v="dim">{t('review.dishesHelp')}</T>
        {draft.dishes.map((dish) => (
          <Card key={dish.key} style={{ padding: space.m }}>
            <Field placeholder={t('review.dishName')} value={dish.name} onChangeText={(name) => setDish(dish.key, { name })} maxLength={80} />
            <Row>
              <Chip icon="👍" label="" selected={dish.thumbsUp === true} onPress={() => setDish(dish.key, { thumbsUp: true })} />
              <Chip icon="👎" label="" selected={dish.thumbsUp === false} onPress={() => setDish(dish.key, { thumbsUp: false })} />
              {dish.photo ? (
                <Thumb photo={dish.photo} onRemove={() => setDish(dish.key, { photo: undefined })} />
              ) : (
                <Button small kind="ghost" icon="📷" title={t('review.dishPhoto')} onPress={async () => addPhotos(Platform.OS === 'web' ? await pickPhotos(1) : await takePhoto(), dish)} />
              )}
              <View style={{ flex: 1 }} />
              <Button small kind="ghost" title="✕" onPress={() => set({ dishes: draft.dishes.filter((d) => d.key !== dish.key) })} />
            </Row>
            <Field placeholder={t('review.dishNote')} value={dish.note} onChangeText={(note) => setDish(dish.key, { note })} maxLength={300} />
          </Card>
        ))}
        {draft.dishes.length < LIMITS.dishesPerReview ? (
          <Button
            small
            kind="secondary"
            icon="🍜"
            title={t('review.addDish')}
            onPress={() => set({ dishes: [...draft.dishes, { key: `${Date.now()}`, name: '', thumbsUp: null, note: '' }] })}
          />
        ) : null}
      </Section>

      <Section title={t('price.title')}>
        <ChipRow>
          {PRICE_BRACKETS.map((b) => (
            <Chip key={b} label={priceBand(b)} selected={draft.priceBracket === b} onPress={() => set({ priceBracket: draft.priceBracket === b ? null : b })} />
          ))}
        </ChipRow>
        <Field
          label={`${t('price.paid')} (${draft.currency})`}
          hint={parseAmount(draft.pricePaid) != null ? formatPrice(parseAmount(draft.pricePaid)!, draft.currency) : t('price.paidHint')}
          value={draft.pricePaid}
          onChangeText={(pricePaid) => set({ pricePaid })}
          keyboardType="numbers-and-punctuation"
          placeholder={draft.currency === 'VND' ? '45k' : '12.50'}
        />
      </Section>

      <Section title={t('review.tags')}>
        <ChipRow>
          {TAGS.map((tag) => (
            <Chip
              key={tag}
              label={t(`tags.${tag}`)}
              selected={draft.tags.includes(tag)}
              onPress={() => set({ tags: draft.tags.includes(tag) ? draft.tags.filter((x: Tag) => x !== tag) : [...draft.tags, tag] })}
            />
          ))}
        </ChipRow>
      </Section>

      <Section title={t('review.visitedOn')}>
        <ChipRow>
          {[0, 1, 7].map((n) => {
            const day = isoDay(n);
            const label = n === 0 ? t('review.whenToday') : n === 1 ? t('review.whenYesterday') : t('review.whenLastWeek');
            return <Chip key={n} label={label} selected={draft.visitedOn === day} onPress={() => set({ visitedOn: draft.visitedOn === day ? null : day })} />;
          })}
        </ChipRow>
      </Section>

      <Card style={{ borderColor: draft.sponsored == null ? c.primary : c.line, borderWidth: 1.5 }}>
        <T v="bold">💸 {t('review.sponsoredTitle')}</T>
        <T v="dim">{t('review.sponsoredHelp')}</T>
        <Chip testID="sponsored-no" icon="🙅" label={t('review.sponsoredNo')} selected={draft.sponsored === false} onPress={() => set({ sponsored: false })} />
        <Chip testID="sponsored-yes" icon="🎁" label={t('review.sponsoredYes')} selected={draft.sponsored === true} onPress={() => set({ sponsored: true })} />
      </Card>

      {error ? <T v="error">{error}</T> : null}
      {busy ? <T v="dim">{busy}</T> : savedAt ? <T v="dim">✓ {t('review.draftSaved')}</T> : null}
      <Button testID="post-review" title={t('review.post')} icon="🐾" loading={!!busy} disabled={!canPost} onPress={postReview} />
      <Button
        kind="ghost"
        small
        title={t('review.discardDraft')}
        onPress={async () => {
          if (await confirmAsync(t('review.discardDraft'), t('review.discardConfirm'), t('common.delete'), t('common.cancel'))) {
            await deleteDraft(draft.id);
            router.back();
          }
        }}
      />
    </Screen>
  );
}
