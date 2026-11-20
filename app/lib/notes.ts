import { z } from "zod";

export const MAX_NOTE_LENGTH = 2000;

/** A Note body: plain text, trimmed, refused when empty or over the cap. */
export const noteBodySchema = z
  .string()
  .trim()
  .min(1, "Write something before saving your note.")
  .max(
    MAX_NOTE_LENGTH,
    `Your note is over ${MAX_NOTE_LENGTH.toLocaleString("en")} characters, so it was not saved.`
  );
