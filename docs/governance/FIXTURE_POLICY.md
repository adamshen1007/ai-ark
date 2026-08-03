# Fixture policy

- Fixtures are fixed, reviewable, and contain no credentials or private participant data.
- Expected outcomes are independently known facts, never preferred AI prose.
- Required gates use fakes and local fixtures; live-provider tests are optional and disabled by default.
- Source fixtures remain untrusted and must not be executed.
- Fixture paths are resolved beneath an explicit root and traversal fails closed.
- Material fixture changes require an explicit corpus or schema version change in the milestone that owns them.
