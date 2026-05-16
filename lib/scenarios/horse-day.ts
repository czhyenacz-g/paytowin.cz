import type { ScenarioDefinition } from "./types";

export const horseDayScenario: ScenarioDefinition = {
  id: "horse-day-1921",
  themeId: "horse-day",
  title: "Connecticut, 1921",
  place: "Connecticut",
  year: 1921,
  subtitle: "Dostihová sezóna začíná.",
  introText:
    "Závodiště je plné dluhů, sázek a slibů, které nikdo nemyslel vážně. " +
    "Každý hráč dostal poslední šanci vydělat dost na to, aby přežil další den.",
  publicObjectiveTitle: "Cíl hry",
  publicObjectiveText:
    "Banka ti půjčila {startingMoney} 💰. Ne proto, že ti věří — protože někdo udělal chybu.\n\n" +
    "Kupuj racery dřív než ostatní, vybírej poplatky a nenech soupeře vydělat na tobě.\n" +
    "Banka už v tobě má peníze. Teď potřebuje, aby z její chyby vznikl titulní příběh.\n\n" +
    "Pozor: na titulní stranu se dostane jen jeden z vás.",
  winConditionSummary: "Základní výhra: poslední hráč ve hře.",
  sharedObjectives: [
    {
      id: "first-stable-collector",
      title: "Mimořádná odměna",
      story:
        "Místní sázkař vypsal odměnu pro prvního majitele plné stáje. " +
        "Connecticut nikdy nebylo místo pro osamělé vlky.",
      task: "Jako první vlastni 2 racery současně.",
      rewardLabel: "Bonusový cíl: první stáj s plnou stájí získá pozornost novin.",
      rewardCoins: 5000,
      completionMode: "first_player_only",
      condition: { type: "owns_at_least_racers", count: 2 },
    },
  ],
  personalObjectives: [
    {
      id: "mafia-debt",
      title: "Dluh u mafie",
      story:
        "Místní boss ti půjčil na posledního koně. Řekl, že se nemusíš bát — pokud vyhraješ.",
      task: "Během hry aktivuj alespoň 3 mafia karty.",
      rewardLabel: "Bonusový cíl: výsledek se ukáže po hře.",
    },
    {
      id: "quiet-favorite",
      title: "Tichý favorit",
      story: "Nikdo si tě nevšímá. Přesně tak to chceš.",
      task: "Vyhraj alespoň jeden závod a nezbankrotuj.",
      rewardLabel: "Bonusový cíl: výsledek se ukáže po hře.",
    },
    {
      id: "stable-collector",
      title: "Sběratel stáje",
      story: "V Connecticutu se nevyhrává jedním koněm. Vyhrává se stájí.",
      task: "Vlastni v jednu chvíli alespoň 3 racery.",
      rewardLabel: "Bonusový cíl: výsledek se ukáže po hře.",
      condition: { type: "owns_at_least_racers", count: 3 },
    },
    {
      id: "last-dollar",
      title: "Poslední dolar",
      story: "Na začátku sezóny ti zbyla jen odvaha a špatná pověst.",
      task: "Přežij hru bez toho, abys přišel o posledního racera.",
      rewardLabel: "Bonusový cíl: výsledek se ukáže po hře.",
    },
    {
      id: "dirty-money",
      title: "Špinavé peníze",
      story:
        "Někdo tě sleduje z tribuny. Nevíš kdo. Víš jen, že čeká výsledek.",
      task: "Měj v jednu chvíli alespoň 20 000 💰.",
      rewardLabel: "Bonusový cíl: výsledek se ukáže po hře.",
    },
  ],
};
