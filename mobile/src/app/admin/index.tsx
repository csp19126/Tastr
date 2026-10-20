import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorText } from '@/components/errors';
import { EmptyState, Loading } from '@/components/states';
import { Button, Card, Chip, Field, ListRow, Row, Screen, Section, T } from '@/components/ui';
import { get, mediaUri, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { radius, space } from '@/lib/theme';
import type { AdminUser, ReportItem } from '@/lib/types';

function ReportCard({ item, onDone }: { item: ReportItem; onDone: () => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const resolve = useMutation({
    mutationFn: (b: { action: 'hide' | 'dismiss'; banAuthor?: boolean }) =>
      post('/admin/reports/resolve', { targetType: item.targetType, targetId: item.targetId, ...b }),
    onSuccess: onDone,
    onError: (e) => setError(errorText(e)),
  });
  const tg = item.target;
  const open = () => {
    if (item.targetType === 'review') router.push(`/review/${item.targetId}`);
    else if (item.targetType === 'place') router.push(`/place/${item.targetId}`);
    else if (item.targetType === 'user') router.push(`/user/${item.targetId}`);
    else if (tg?.reviewId) router.push(`/review/${tg.reviewId}`);
  };
  return (
    <Card testID={`report-${item.targetType}-${item.targetId}`}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="label">{item.targetType} #{item.targetId}</T>
        <T v="dim">{t('admin.reportedTimes', { count: item.reportCount })}</T>
      </Row>
      <T v="small">{item.reasons.map((r) => t(`report.${r}`)).join(' · ')}</T>
      {item.details.map((d, i) => (
        <T key={i} v="dim">“{d}”</T>
      ))}
      <Pressable onPress={open}>
        {tg?.url ? <Image source={{ uri: mediaUri(tg.url) }} style={{ width: 160, height: 120, borderRadius: radius.m }} /> : null}
        {tg?.text ? <T numberOfLines={5}>{tg.text}</T> : null}
        {tg?.authorName ? <T v="dim">— {tg.authorName}{tg.placeName ? ` @ ${tg.placeName}` : ''}</T> : null}
        {tg?.hidden ? <T v="dim">({t('admin.banned')})</T> : null}
      </Pressable>
      <Row style={{ flexWrap: 'wrap' }}>
        <Button small kind="danger" title={t('admin.hide')} loading={resolve.isPending} onPress={() => resolve.mutate({ action: 'hide' })} />
        {item.targetType !== 'user' ? <Button small kind="danger" title={t('admin.hideAndBan')} onPress={() => resolve.mutate({ action: 'hide', banAuthor: true })} /> : null}
        <Button small kind="secondary" title={t('admin.dismiss')} onPress={() => resolve.mutate({ action: 'dismiss' })} />
      </Row>
      {error ? <T v="error">{error}</T> : null}
    </Card>
  );
}

export default function Admin() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'reports' | 'users'>('reports');
  const [search, setSearch] = useState('');
  const isAdmin = user?.role === 'admin';

  const stats = useQuery({ queryKey: ['admin-stats'], queryFn: () => get('/admin/stats'), enabled: isAdmin });
  const reports = useQuery({ queryKey: ['admin-reports'], queryFn: () => get<{ items: ReportItem[] }>('/admin/reports'), enabled: isAdmin });
  const users = useQuery({ queryKey: ['admin-users', search], queryFn: () => get<{ users: AdminUser[] }>('/admin/users', { q: search }), enabled: isAdmin && tab === 'users' });
  const ban = useMutation({
    mutationFn: ({ id, banned }: { id: number; banned: boolean }) => post(`/admin/users/${id}/ban`, { banned }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  if (!isAdmin) return <EmptyState title={t('errors.not_found')} />;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-reports'] });
    qc.invalidateQueries({ queryKey: ['admin-stats'] });
  };

  return (
    <Screen scroll>
      {stats.data ? (
        <T v="dim">{t('admin.stats', { users: stats.data.users, places: stats.data.places, reviews: stats.data.reviews, today: stats.data.reviewsToday })}</T>
      ) : null}
      <ListRow testID="admin-content" title={`📝 ${t('admin.content')}`} subtitle={t('admin.contentHelp')} onPress={() => router.push('/admin/content')} />
      <Row>
        <Chip label={`${t('admin.reports')}${stats.data?.openReports ? ` · ${stats.data.openReports}` : ''}`} selected={tab === 'reports'} onPress={() => setTab('reports')} />
        <Chip label={t('admin.users')} selected={tab === 'users'} onPress={() => setTab('users')} />
      </Row>

      {tab === 'reports' ? (
        reports.isLoading ? (
          <Loading />
        ) : reports.data?.items.length ? (
          reports.data.items.map((item) => <ReportCard key={`${item.targetType}-${item.targetId}`} item={item} onDone={refresh} />)
        ) : (
          <EmptyState icon="🍜" title={t('admin.noReports')} />
        )
      ) : (
        <Section title={t('admin.users')}>
          <Field placeholder={t('admin.searchUsers')} value={search} onChangeText={setSearch} autoCapitalize="none" />
          {(users.data?.users ?? []).map((u) => (
            <Card key={u.id} style={{ padding: space.m }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <T v="bold">{u.displayName}{u.role === 'admin' ? ' 🛡️' : ''}{u.banned ? ` · ${t('admin.banned')}` : ''}</T>
                  <T v="dim">{u.email ?? '—'} · {formatDate(u.createdAt)} · ✍️ {u.reviewCount} · 🚩 {u.reportCount}</T>
                </View>
                {u.role !== 'admin' ? (
                  <Button small kind={u.banned ? 'secondary' : 'danger'} title={u.banned ? t('admin.unban') : t('admin.ban')} onPress={() => ban.mutate({ id: u.id, banned: !u.banned })} />
                ) : null}
              </Row>
            </Card>
          ))}
        </Section>
      )}
    </Screen>
  );
}
