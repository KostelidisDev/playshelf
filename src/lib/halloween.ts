/* The Halloween easter egg: the site goes pumpkin orange with bats on
 * October 31, and typing "boo" anywhere outside a text field toggles it on
 * any other day. */

export const SPELL = "boo";

/** Whether `date` is October 31, in the visitor's own time zone. */
export function isHalloween(date: Date): boolean {
  return date.getMonth() === 9 && date.getDate() === 31;
}

/** The letters typed so far towards `spell`, after `key`: the longest end
 * of `typed + key` that starts the spell. It equals the spell once the
 * whole word has been typed. */
export function nextSpell(typed: string, key: string, spell: string = SPELL): string {
  const text = (typed + key.toLowerCase()).slice(-spell.length);
  for (let i = 0; i < text.length; i++) {
    if (spell.startsWith(text.slice(i))) return text.slice(i);
  }
  return "";
}
