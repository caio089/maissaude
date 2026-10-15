"use client"

import { createAvatar } from "@dicebear/core"
import { lorelei } from "@dicebear/collection"

const cache = new Map<string, string>()

export function portraitUri(seed: string) {
  const cached = cache.get(seed)
  if (cached) return cached
  const uri = createAvatar(lorelei, {
    seed,
    backgroundColor: ["d7ebe8", "d5e4ef", "e7e4f2", "f3e6d8", "dceee4"],
  }).toDataUri()
  cache.set(seed, uri)
  return uri
}

export function Portrait({
  seed,
  name,
  className = "size-11",
}: {
  seed: string
  name: string
  className?: string
}) {
  return (
    <img
      src={portraitUri(seed)}
      alt={`Ilustração demonstrativa de ${name}`}
      className={`${className} rounded-full object-cover ring-1 ring-foreground/10`}
    />
  )
}
