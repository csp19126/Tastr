import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CATEGORIES, PRICE_BRACKETS, TAGS } from '@shared';
import { categoryIcon } from '@/components/cards';
import { Button, Chip, ChipRow, Row, Screen, Section, T } from '@/components/ui';
import { DEFAULT_FILTERS, useFilters, type Filters } from '@/lib/filters';
import { priceBand } from '@/lib/format';
import { space, useColors } from '@/lib/theme';

const RADII = [1, 3, 10, 25, 50];

function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export default function FiltersScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const { filters, setFilters } = useFilters();
  const [f, setF] = useState<Filters>(filters);

  return (
    <Screen scroll>
      <Section title={t('discover.sort')}>
        <ChipRow>
          {(['distance', 'paws', 'popular', 'newest'] as const).map((s) => (
            <Chip key={s} label={t(`discover.sort${s[0].toUpperCase()}${s.slice(1)}` as 'discover.sortDistance')} selected={f.sort === s} onPress={() => setF({ ...f, sort: s })} />
          ))}
        </ChipRow>
      </Section>

      <Row style={{ justifyContent: 'space-between' }}>
        <T v="bold">🕒 {t('discover.openNow')}</T>
        <Switch value={f.openNow} onValueChange={(v) => setF({ ...f, openNow: v })} trackColor={{ true: c.primary }} />
      </Row>

      <Section title={t('discover.categoryTitle')}>
        <ChipRow>
          {CATEGORIES.map((cat) => (
            <Chip key={cat} icon={categoryIcon(cat)} label={t(`categories.${cat}`)} selected={f.categories.includes(cat)} onPress={() => setF({ ...f, categories: toggle(f.categories, cat) })} />
          ))}
        </ChipRow>
      </Section>

      <Section title={t('discover.priceTitle')}>
        <ChipRow>
          {PRICE_BRACKETS.map((p) => (
            <Chip key={p} label={priceBand(p)} selected={f.price.includes(p)} onPress={() => setF({ ...f, price: toggle(f.price, p) })} />
          ))}
        </ChipRow>
      </Section>

      <Section title={`${t('paws.label')} · ${t('discover.minPaws')}`}>
        <ChipRow>
          <Chip label={t('discover.anyPaws')} selected={!f.minPaws} onPress={() => setF({ ...f, minPaws: null })} />
          {[3, 4, 4.5].map((n) => (
            <Chip key={n} label={`${n}+ 🐾`} selected={f.minPaws === n} onPress={() => setF({ ...f, minPaws: n })} />
          ))}
        </ChipRow>
      </Section>

      <Section title={t('discover.radius')}>
        <ChipRow>
          {RADII.map((r) => (
            <Chip key={r} label={t('discover.distance', { km: r })} selected={f.radiusKm === r} onPress={() => setF({ ...f, radiusKm: r })} />
          ))}
        </ChipRow>
      </Section>

      <Section title={t('discover.tagsTitle')}>
        <ChipRow>
          {TAGS.map((tag) => (
            <Chip key={tag} label={t(`tags.${tag}`)} selected={f.tags.includes(tag)} onPress={() => setF({ ...f, tags: toggle(f.tags, tag) })} />
          ))}
        </ChipRow>
      </Section>

      <View style={{ gap: space.s }}>
        <Button
          testID="apply-filters"
          title={t('discover.showResults')}
          onPress={() => {
            setFilters(f);
            router.back();
          }}
        />
        <Button kind="ghost" title={t('discover.clearFilters')} onPress={() => setF({ ...DEFAULT_FILTERS, q: f.q })} />
      </View>
    </Screen>
  );
}
