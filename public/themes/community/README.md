# Community Maps — Assets

Každá komunitní mapa má vlastní podsložku:

```
community/
  {map-id}/
    board-bg.webp
    center-bg.webp
    preview.webp
    field-start.webp
    field-gain.webp
    field-loss.webp
    field-gamble.webp
    field-racer.webp
    field-chance.webp
    field-finance.webp
    field-neutral.webp
    racer-{id}.webp
```

Viz naming convention v `public/themes/README.md`.

Pomocný helper:
```ts
themeAssetPath("community/sea-world", THEME_ASSETS.boardBg)
// → "/themes/community/sea-world/board-bg.webp"
```
