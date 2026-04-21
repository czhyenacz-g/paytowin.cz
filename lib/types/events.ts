/**
 * Center Event view model — datová vrstva pro CenterEventModal.
 *
 * Pravidla:
 * - žádné React importy
 * - žádné callbacky — ty patří do props komponenty
 * - jen data potřebná pro render modálu
 */

/**
 * Flash Event — krátký auto-dismiss spotlight pro výrazné herní momenty.
 * Nezastaví hru (non-blocking), zmizí po 2–3 s.
 */
export type FlashEvent =
  | {
      type: "legendary_gone";
      emoji: string;
      playerName: string;
      racerName: string;
    }
  | {
      type: "coins_penalty";
      emoji: string;
      playerName: string;
      /** Záporná hodnota, např. -60 */
      amount: number;
      fieldLabel: string;
    }
  | {
      type: "coins_gain";
      emoji: string;
      playerName: string;
      /** Kladná hodnota, např. +80 */
      amount: number;
      fieldLabel: string;
    };

export type CenterEvent =
  | {
      type: "card";
      /** "chance" | "finance" | "mafia" — pro výběr barev v komponentě */
      cardType: "chance" | "finance" | "mafia";
      /** Zobrazovaný název kategorie: "Náhoda" / "Finance" */
      category: string;
      emoji: string;
      playerName: string;
      text: string;
      effectLabel: string;
      /** Volitelný art obrázek zobrazený při reveal. Pokud chybí, render beze změny. */
      imagePath?: string;
      /** True pro klienta hráče, jehož karta je — může kliknout Pokračovat pro dřívější zavření */
      isActivePlayer: boolean;
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
