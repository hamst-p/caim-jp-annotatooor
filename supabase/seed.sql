-- ============================================================================
-- Translation Audio Manager — demo data
--
-- Run AFTER schema.sql. Safe to re-run: it clears and re-creates the demo
-- project only.
--
-- No audio paths are seeded on purpose — a row that points at a file which is
-- not in Storage would show a broken player. Every seeded row shows the
-- "Upload MP3" button instead.
-- ============================================================================

begin;

-- Remove a previous run of this seed (translation_rows cascade automatically).
delete from public.projects where name = 'CAIM1 Translation Project';

with new_project as (
  insert into public.projects (name, description)
  values (
    'CAIM1 Translation Project',
    'Narration script for CAIM1 — English source, Japanese translation, romaji reading, and MP3 audio.'
  )
  returning id
)
insert into public.translation_rows (project_id, original, japanese, reading, position)
select
  new_project.id,
  seed.original,
  seed.japanese,
  seed.reading,
  seed.position
from new_project,
(values
  (
    'Today, artificial intelligence can generate almost anything.',
    '現在、人工知能はほとんどあらゆるものを作り出すことができます。',
    'Genzai, jinkou chinou wa hotondo arayuru mono o tsukuridasu koto ga dekimasu.',
    0
  ),
  (
    'How do we know what is actually real?',
    '私たちは、何が本物なのかをどうやって判断すればよいのでしょうか？',
    'Watashitachi wa, nani ga honmono nano ka o dou yatte handan sureba yoi no deshou ka?',
    1
  ),
  (
    'We look at our screens every day.',
    '私たちは毎日、画面を見ています。',
    'Watashitachi wa mainichi, gamen o miteimasu.',
    2
  ),
  (
    'Images, voices, and even entire videos can be created in seconds.',
    '画像も、音声も、動画全体でさえ、数秒で作り出せます。',
    'Gazou mo, onsei mo, douga zentai de sae, suubyou de tsukuridasemasu.',
    3
  ),
  (
    'That is why we need a way to check where information comes from.',
    'だからこそ、情報がどこから来たのかを確認する方法が必要です。',
    'Dakara koso, jouhou ga doko kara kita no ka o kakunin suru houhou ga hitsuyou desu.',
    4
  ),
  (
    'Understanding the source is the first step to trusting what you see.',
    '出どころを理解することが、目にしたものを信頼するための第一歩です。',
    'Dedokoro o rikai suru koto ga, me ni shita mono o shinrai suru tame no daiippo desu.',
    5
  )
) as seed(original, japanese, reading, position);

commit;
