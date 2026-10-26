# @chai-ui/shared

Never published. The files every binding (`@chai-ui/react`, `@chai-ui/vue`,
`@chai-ui/svelte`) is built and tested from, so no binding is another's
source:

- `src/style.css`: the components' one stylesheet. Each binding copies it
  into its build at build time, where apps import it as
  `@chai-ui/<binding>/style.css`.
- `DESIGN.md`: the usage rules. Each binding copies it to its package root at
  build, and npm ships it.
- `contracts/`: each component's browser tests, written once against a
  `render(props)` that every binding supplies, plus `axe.ts`, the WCAG check
  they use.

Edit these files here. The copies in the bindings are build output and are
ignored by git.
