# Component Guidelines

- Export all React components using **named exports**. No `default` exports.
- Add `"use client"` at the top of components that use state or effects.
- Use `cn()` from `@/lib/utils` to compose Tailwind class names.
- Prefer primitives from `components/ui/` over custom styling.
- Keep component props typed and avoid `any`.
