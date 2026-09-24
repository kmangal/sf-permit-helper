import type { Navigator } from "../../hooks/useNavigator.ts";

export const EXAMPLE =
  "Block party on the 400 block of Bocana St, Saturday Oct 24, noon to 6pm, about 80 people. A neighbor band plays for an hour, a taco stand cooking on site, a bounce house in the street, no alcohol, nothing sold.";

const OPENING_PLACEHOLDER =
  "Block party on the 400 block of Bocana St, Oct 24, noon to 6, about 80 people, a band, a taco stand";

export function placeholderFor(nav: Pick<Navigator, "question" | "ended">): string {
  if (nav.question) {
    const numeric = nav.question.type === "int" || nav.question.type === "number";
    return numeric ? "Type a number, or pick a range" : "Type your answer";
  }
  return nav.ended ? "Start over to try again" : OPENING_PLACEHOLDER;
}
