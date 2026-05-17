import type { ScenarioDefinition } from "./types";

export const horseNightScenario: ScenarioDefinition = {
  id: "horse-night-1921",
  themeId: "horse-night",
  title: "New Orleans, 1921",
  place: "New Orleans",
  year: 1921,
  subtitle: "Celou cestu si říkáš, kdo proboha pořádá dostihy v noci.",
  introText:
    "Stáj je drahá, koně žerou každý den a tvoje výhry po zaplacení bance mizí rychleji než potlesk na tribunách.\n\n" +
    "Pak přijde dopis:\n\"Skutečné peníze neběhají na slunci.\"\n\n" +
    "Pod větou je jen adresa a čas po půlnoci.\n\n" +
    "Celou cestu si říkáš, kdo proboha pořádá dostihy v noci.\n" +
    "Kdo sází na koně, které skoro nevidí?\n\n" +
    "U starého oválu čekají lampy, déšť, doutníky a muži v dlouhých pláštích.\n\n" +
    "Když se za tebou zavře brána, pochopíš:\n" +
    "tady se nehraje jen o vítězství, ale o to, komu budeš patřit, když prohraješ.",
  publicObjectiveTitle: "Cíl hry",
  publicObjectiveText:
    "V noci nestačí vyhrát jeden závod. Musíš ovládnout celý ovál.\n\n" +
    "Skupuj koně, rozšiřuj stáj a nech rostoucí náklady zlomit ty, kdo nestíhají.\n" +
    "Vyhráváš, pokud jako první získáš všechny dostupné koně.\n\n" +
    "Když zkrachuješ, končíš.\n" +
    "Pokud ostatní padnou dřív, ovál patří tobě.",
  winConditionSummary: "Výhra: jako první získej všechny dostupné koně na oválu.",
  winCondition: { type: "collect_all_available_racers" },
};
