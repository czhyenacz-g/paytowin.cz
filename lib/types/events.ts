/**
 * Center Event view model — datová vrstva pro CenterEventModal.
 *
 * Pravidla:
 * - žádné React importy
 * - žádné callbacky — ty patří do props komponenty
 * - jen data potřebná pro render modálu
 */

export type CenterEvent =
  | {
      type: "card";
      /** "chance" | "finance" — pro výběr barev v komponentě */
      cardType: "chance" | "finance";
      /** Zobrazovaný název kategorie: "Náhoda" / "Finance" */
      category: string;
      emoji: string;
      playerName: string;
      text: string;
      effectLabel: string;
    }
  | {
      type: "offer";
      playerName: string;
      playerCoins: number;
      cost: number;
      /** Hráč má dost coinů na přijetí nabídky */
      canConfirm: boolean;
      /** True pro klienta hráče, jehož nabídka je — ostatní vidí pasivní text */
      isActivePlayer: boolean;
    };
