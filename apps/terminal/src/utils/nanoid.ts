import { randomBytes } from "node:crypto"

const urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict"

export function nanoid(size = 21): string {
  const bytes = randomBytes(size)
  let id = ""
  for (let i = 0; i < size; i++) {
    id += urlAlphabet[bytes[i] & 63]
  }
  return id
}
