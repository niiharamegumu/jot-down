# Use Biome, ESLint, and pre-push checks for code quality

Jot Down will use Biome for formatting, keep ESLint for React Hooks and React Refresh lint coverage, and run `format:check`, `lint`, and `typecheck` from a `pre-push` hook. The hook is installed with `simple-git-hooks` because the project is currently a single npm/Vite app and does not need lefthook's broader multi-hook and multi-language orchestration.
