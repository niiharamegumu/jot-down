# Follow MDXEditor-native editing semantics

Jot Down will follow MDXEditor's native list and task editing semantics instead of preserving app-specific empty task states through custom Markdown rewrites. Markdown text remains the source of truth, but avoiding editor-behavior overrides keeps the Markdown live editing surface aligned with the chosen editor and reduces fragile coupling to MDXEditor internals.
