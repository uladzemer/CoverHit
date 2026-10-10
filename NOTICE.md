# Сторонние материалы / Third-party notices

| Материал | Где | Лицензия | Авторы / источник |
|---|---|---|---|
| Музейные сканы ковров (Met Museum Open Access) | `assets-src/carpets/*.jpg`, обработанные копии в `public/carpets/` | CC0 1.0 | The Metropolitan Museum of Art — список файлов и ссылок в `assets-src/carpets/SOURCES.md` |
| Текстуры, HDRI неба, модель дерева | `public/yard/*` (кроме `photos/`) | CC0 1.0 | Poly Haven и авторы — таблица в `public/yard/SOURCES.md` |
| Частицы дыма | `public/fx/dust-flipbook.webp` | CC0 1.0 | Kenney — `public/fx/SOURCES.md` |
| Фото ВАЗ-2101/2106 и фасадов панельных домов | `public/yard/photos/` | CC0 / общественное достояние / **CC BY-SA 3.0 и 4.0** | Wikimedia Commons; авторы и ссылки на каждый файл — `public/yard/photos/credits.json`, а также в игре: меню «Об игре» |
| Ammo.js (порт Bullet Physics) | `public/vendor/ammo/` | zlib | Ammo.js contributors — `public/vendor/ammo/LICENSE.txt` |
| three.js, postprocessing, N8AO, GSAP | npm-зависимости | MIT / Zlib / ISC / «no-charge» GSAP | см. `package.json` |

## CC BY-SA

Файлы в `public/yard/photos/` получены обработкой (выпрямление перспективы, обрезка, выравнивание цвета,
сборка модулей) фотографий под лицензией CC BY-SA 3.0 / 4.0 и распространяются на тех же условиях
(https://creativecommons.org/licenses/by-sa/4.0/). Указание авторов — в `public/yard/photos/credits.json` и в игре.

## Не входит в репозиторий

Модели и фотографии Envato Elements (личная лицензия) используются автором только локально:
`assets-src/**/envato/`, `public/carpets/envato-*`, `public/yard/stock/` исключены из git и из сборки
(`scripts/stock-build.mjs`). Без них игра работает на музейных сканах и процедурных объектах.
