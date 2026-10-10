# Сторонние материалы / Third-party notices

| Материал | Где | Лицензия | Авторы / источник |
|---|---|---|---|
| Музейные сканы ковров (Met Museum Open Access) | `assets-src/carpets/*.jpg`, обработанные копии в `public/carpets/` | CC0 1.0 | The Metropolitan Museum of Art — список файлов и ссылок в `assets-src/carpets/SOURCES.md` |
| Текстуры, HDRI неба, модель дерева | `public/yard/*` (кроме `photos/`) | CC0 1.0 | Poly Haven и авторы — таблица в `public/yard/SOURCES.md` |
| Частицы дыма | `public/fx/dust-flipbook.webp` | CC0 1.0 | Kenney — `public/fx/SOURCES.md` |
| Фото ВАЗ-2101/2106 и фасадов панельных домов | `public/yard/photos/` | CC0 / общественное достояние / **CC BY 3.0 / CC BY-SA 3.0 и 4.0** | Wikimedia Commons; авторы и ссылки на каждый файл — `public/yard/photos/credits.json`, а также в игре: меню «Об игре» |
| Ammo.js (порт Bullet Physics) | `public/vendor/ammo/` | zlib | Ammo.js contributors — `public/vendor/ammo/LICENSE.txt` |
| three.js, postprocessing, N8AO, GSAP | npm-зависимости | MIT / Zlib / ISC / «no-charge» GSAP | см. `package.json` |

## CC BY-SA

Файлы в `public/yard/photos/` получены обработкой (выпрямление перспективы, обрезка, выравнивание цвета,
сборка ячеек) фотографий под лицензиями CC BY 3.0 / CC BY-SA 3.0 / 4.0 и распространяются на тех же условиях
(https://creativecommons.org/licenses/by-sa/4.0/). Указание авторов — в `public/yard/photos/credits.json` и в игре.

## Не входит в репозиторий

Модели и фотографии Envato Elements (личная лицензия) используются автором только локально:
`assets-src/**/envato/`, `public/carpets/envato-*`, `public/yard/stock/` исключены из git и из сборки
(`scripts/stock-build.mjs`). Без них игра работает на музейных сканах и процедурных объектах.

## Details for the facade and car derivatives

The facades3 frontal composites and flat car atlas retain their original source licences. Manual wall/window/pane rectification, fixed grid frames, silhouette alpha and civilian cleanup are derivatives; see `public/yard/photos/manifest.json` and `public/yard/SOURCES.md` for the source of each delivered file. Stock-blocked QA captures in `docs/qa/facades3/` contain these attributed derivatives; stock-bearing colour captures remain ignored.

The active Valday (panel335) derivative is CC BY 3.0, with credit to Дмитрий Cкляренко / panoramio as recorded in the manifest. Its BY licence does not impose ShareAlike. PD/CC0 source files remain PD/CC0; mixed car derivatives containing Fiver's BY-SA 4.0 photographs are distributed under BY-SA 4.0.

<!-- natural-photo-sections -->
Whole facade/car photographs in `public/yard/photos/`: Klumava Street social housing.jpg — Homoatrox (CC BY-SA 4.0; https://commons.wikimedia.org/wiki/File:Klumava_Street_social_housing.jpg); Фото Озёрска 03.06.2022.jpg — Artyom Vasilyev (CC0; https://commons.wikimedia.org/wiki/File:%D0%A4%D0%BE%D1%82%D0%BE_%D0%9E%D0%B7%D1%91%D1%80%D1%81%D0%BA%D0%B0_03.06.2022.jpg); Arzamas, Nizhny Novgorod Oblast, Russia - panoramio (341).jpg — Arzamassky (CC BY 3.0; https://commons.wikimedia.org/wiki/File:Arzamas,_Nizhny_Novgorod_Oblast,_Russia_-_panoramio_(341).jpg); Moscow car show 2025-08-03 VAZ-2101 red 02.jpg — Retired electrician (CC0; https://commons.wikimedia.org/wiki/File:Moscow_car_show_2025-08-03_VAZ-2101_red_02.jpg); Lada 1600 -- Front.JPG — Bull-Doser (Public domain; https://commons.wikimedia.org/wiki/File:Lada_1600_--_Front.JPG). The facade derivatives preserve photographic panes, curtains and balcony fittings; alpha car derivatives preserve paint and trim. BY-SA derivatives are CC BY-SA 4.0; BY derivatives remain CC BY 3.0. The concrete atlas strip uses Amal Kumar / Poly Haven concrete_slab_wall_02 (CC0). Full per-file attribution: public/yard/SOURCES.md and public/yard/photos/credits.json.
