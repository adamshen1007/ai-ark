# Testing policy

Tests prove behavior and invariants, including negative cases. Required CI is deterministic and offline after installation.

Test classes are unit, contract, integration, fixture, adversarial, end-to-end, performance, and recovery. M00 supplies unit and contract coverage plus shared infrastructure; later classes are added when their behavior exists. No empty passing suite may be presented as feature evidence.

Security and governance rules require negative tests. Skips, missing external services, and pending real-world measurements must be visible in reports.
