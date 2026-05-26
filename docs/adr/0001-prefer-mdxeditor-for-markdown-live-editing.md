# Prefer MDXEditor for Markdown live editing

We will use MDXEditor as the first editor candidate because SimpleTasks treats Markdown text as the source of truth while still needing in-place structure for headings and checkable task items. TipTap remains a viable fallback, but its rich document model would make Markdown round-tripping a more central implementation concern than the product needs at this stage.
