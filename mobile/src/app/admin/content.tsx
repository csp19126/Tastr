import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorText } from '@/components/errors';
import { Loading } from '@/components/states';
import { Button, Card, Chip, Field, Row, Screen, T } from '@/components/ui';
import { get, put } from '@/lib/api';
import type { ContentKey } from '@/lib/content';
import type { ContentEntry } from '@/lib/types';

const KEYS: ContentKey[] = ['who_runs_this_app', 'partnerships', 'about_intro', 'terms', 'privacy'];

function Editor({ k, lang, entry }: { k: ContentKey; lang: 'en' | 'vi'; entry?: ContentEntry }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  // A missing translation falls back to English; start the Vietnamese editor empty in that case.
  const own = entry?.language === lang ? entry : undefined;
  const [title, setTitle] = useState(own?.title ?? '');
  const [body, setBody] = useState(own?.body ?? '');
  const [state, setState] = useState<string | null>(null);
  return (
    <Card testID={`content-${k}`}>
      <T v="label">{k}</T>
      <Field value={title} onChangeText={setTitle} maxLength={200} />
      <Field value={body} onChangeText={setBody} multiline style={{ minHeight: 140 }} />
      <Row>
        <Button
          small
          title={t('common.save')}
          disabled={!title.trim()}
          onPress={async () => {
            try {
              await put(`/admin/content/${k}/${lang}`, { title: title.trim(), body: body.trim() });
              setState(t('admin.saved'));
              qc.invalidateQueries({ queryKey: ['content'] });
              qc.invalidateQueries({ queryKey: ['admin-content'] });
            } catch (e) {
              setState(errorText(e));
            }
          }}
        />
        {state ? <T v="dim">{state}</T> : null}
      </Row>
    </Card>
  );
}

export default function ContentAdmin() {
  const { t } = useTranslation();
  const [lang, setLang] = useState<'en' | 'vi'>('en');
  const content = useQuery({
    queryKey: ['admin-content', lang],
    queryFn: () => get<{ content: Partial<Record<ContentKey, ContentEntry>> }>('/content', { lang }),
  });
  return (
    <Screen scroll>
      <T v="dim">{t('admin.contentHelp')}</T>
      <Row>
        <Chip label="English" selected={lang === 'en'} onPress={() => setLang('en')} />
        <Chip label="Tiếng Việt" selected={lang === 'vi'} onPress={() => setLang('vi')} />
      </Row>
      {content.isLoading ? <Loading /> : KEYS.map((k) => <Editor key={`${k}-${lang}`} k={k} lang={lang} entry={content.data?.content[k]} />)}
    </Screen>
  );
}
