# Directory Federation Orchestrator

This application automates the integration between **Google Workspace** and **Microsoft Entra ID** (Azure AD) by orchestrating the API calls necessary to create and configure provisioning and SAML operations.

## Setup

Node.js and [PNPM](https://pnpm.io/) must be installed. Run `pnpm install` once before executing `pnpm check`, `pnpm dev`, or `pnpm lint` so that all dependencies are available.

## Architecture

This project defines a series of discrete, type-safe `step` files. Each step:

- Encapsulates one unit of setup (e.g. create service user, configure SAML)
- Implements `check()` to detect current state
- Implements `execute()` to perform a mutation (if needed)
- Declares which variables it `requires` and what it `provides`
- Contributes to global state (`vars`) in a type-safe way

The runtime engine orchestrates execution across steps using these declarations.

## Steps

Steps are evaluated and rendered by a runtime engine, which assembles a workflow dynamically (and will be implemented after all steps are complete.)

Steps can be composed and executed sequentially or selectively. The engine is responsible for:

- Maintaining and validating `vars`
- Enforcing `requires`/`provides`
- Logging outputs and summaries

This system uses type-safe building blocks. Each `step` file contributes a unit of orchestration.

## Notes

Use `pnpm` for package management and execution.
