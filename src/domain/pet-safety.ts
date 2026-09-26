/**
 * What the app says beside any statement about whether a plant is safe.
 *
 * The care guide's toxicity line is written by the AI, and on 26 Sep 2026 an
 * Easter cactus's read "Non-toxic to cats, dogs, and children, making it a
 * safe choice for households with pets or curious kids" -- with nothing
 * underneath it. That is the one sentence in the app a keeper might act on
 * with an animal's or a child's health, and the AI is not the authority for
 * it. So the app never shows it without saying who is: the ASPCA's plant
 * list for pets, a poison line if something has been eaten.
 *
 * The website says the same (scripts/pet-safety.mjs); a test holds the two
 * to one phone number and one ASPCA address.
 */

/** The ASPCA's toxic and non-toxic plant list: the authority we point to. */
export const ASPCA_PLANT_LIST = "https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants";

/** ASPCA Animal Poison Control Center, around the clock; may charge a fee. */
export const APCC = { phone: "(888) 426-4435", tel: "tel:+18884264435" };

/** Poison Help, the US poison control line for people, around the clock and free. */
export const POISON_HELP = { phone: "(800) 222-1222", tel: "tel:+18002221222" };

/** The notice under the care guide's toxicity line. */
export const AI_TOXICITY_NOTICE =
  "Written by AI, and it can be wrong. Always check a plant on the ASPCA's plant list before trusting it around a pet — " +
  `and if a pet has eaten part of a plant, call your vet or ASPCA Animal Poison Control on ${APCC.phone}. ` +
  `If a child has, call Poison Help on ${POISON_HELP.phone}.`;
