import { customAlphabet } from "nanoid";

const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Jeton public du livret : 48 caractères aléatoires (~285 bits), impossible à deviner. */
export const generateLivretToken = customAlphabet(alphabet, 48);
