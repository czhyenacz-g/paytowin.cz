import type { ScenarioDefinition } from "./types";

export const horseNightScenario: ScenarioDefinition = {
  id: "horse-night-1925",
  themeId: "horse-night",
  title: "New Orleans, 1925",
  place: "New Orleans",
  year: 1925,
  subtitle: "Celou cestu si říkáš, kdo proboha pořádá dostihy v noci.",
  introText:
    "Stáj je drahá, koně žerou každý den a tvoje výhry po zaplacení bance mizí rychleji než potlesk na tribunách.\n\n" +
    "Pak přijde dopis:\n„Skutečné peníze neběhají na slunci.“\n\n" +
    "Pod větou je jen adresa a čas po půlnoci.\n\n" +
    "Celou cestu si říkáš, kdo proboha pořádá dostihy v noci?\n\n" +
    "Když se za tebou zavře brána, pochopíš:\n" +
    "tady se nehraje jen o vítězství.",
  publicObjectiveTitle: "Cíl hry",
  publicObjectiveText:
    "Vyhráváš, pokud získáš všechny dostupné koně.\n\n" +
    "Získej koně, rozšiřuj stáj a nech rostoucí náklady zlomit ty, kdo nestíhají.\n\n" +
    "Když zkrachuješ, končíš.",
  winConditionSummary: "Výhra: jako první získej všechny dostupné koně na oválu.",
  winCondition: { type: "collect_all_available_racers" },
};
