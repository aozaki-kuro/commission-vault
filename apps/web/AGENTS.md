# AGENTS

This directory will hold the Astro public web app.

## Responsibilities

- Render public content as static assets.
- Keep public routes independent from admin runtime concerns.
- Consume shared domain data and generated static payloads.

## Guardrails

- Do not host admin pages or admin write APIs in this app.
- Keep output static-first for public traffic.
