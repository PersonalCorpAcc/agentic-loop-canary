# Managed by @plainconceptsplatform/workflows@0.5.1. Source: loops/templates/opencode/opencode.ci.json. Profile digest: 477494a3b05c. Update with `workflows update --force --template opencode.ci.json`; consumer edits may be overwritten.

# Ownership: opencode.ci.json

JSON (RFC 8259) does not permit comments, so the line above is the ownership
header of `opencode.ci.json`: the package that wrote it, the package version,
and the digest of the profile it was projected from. `workflows status` reads
that digest to report drift, exactly as it does for every other managed file.

## What the configuration carries

`opencode.ci.json` is the standalone OpenCode configuration the CI agent runs
under. Everything in it that differs between adopters comes from the profile
this repository declares in its profile, and is rewritten by
`workflows update`:

- **Provider** `forge`, OpenAI-compatible, reading its endpoint
  from `OPENAI_BASE_URL` and its key from `OPENAI_API_KEY` at run time. Every
  worker's agent job sets both, so the file works with no consumer wiring.
- **Model** `glm-5-3`, the one model the profile names, registered
  with attachment support. A second model is a profile change, not an edit here.
- **Agent** `ci-workflow-agent` in `primary` mode, with the output discipline
  directive: no narration, no prose between tool calls, stop after the final
  Safe Outputs command. It reads `AGENTS.md` before any
  non-trivial change, and carries the profile's `constitution.rules.agent` and the
  declared packs' own rules under `# Repository rules`.
- **Language servers** from the declared stack packs, and none from anywhere
  else. A repository that declares no pack with a language server gets no `lsp`
  block.
- **Memory** paragraph present only when the profile enables memory.

## Editing

Do not edit `opencode.ci.json` by hand for anything the profile decides: the next
`workflows update` writes the profile's value back. Change the profile instead.
Consumer-owned additions — MCP servers, plugins, permission changes — belong in
the repository's own `opencode.jsonc`, which the shared CI setup merges this file
into.
