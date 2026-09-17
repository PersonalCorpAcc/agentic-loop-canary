---
# Managed by @plainconceptsplatform/workflows@0.5.1. Source: loops/stacks/go/pack.yml. Profile digest: 2a25c134fca6. Update with `workflows update --force`; consumer edits may be overwritten.
network:
  allowed:
    - defaults
    - go
pre-agent-steps:
  - name: Set up the Go toolchain
    uses: actions/setup-go@d35c59abb061a4a6fb18e82ac0862c26744d6ab5
    with:
      cache: "true"
      go-version: 1.26.0
---

Setup for the go toolchain. Ecosystem facts only: this file carries no
architectural rule, no house style and no document naming convention, and none of
the frontmatter keys that do not merge from an import.
