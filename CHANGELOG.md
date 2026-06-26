# Changelog - Brand Intelligence OS

All notable changes to this project will be documented in this file.

---

## [0.1.0] - 2026-06-26
### Added (Milestone 1 Completed)
- **Universal SQLite Object Store**: Structured a single `objects` and `object_relations` (Node-Edge) graph database layout to store all 21 domain entities.
- **Agent Registry**: Created a database-backed Agent lookup mapping capabilities, speeds, and input/output formats dynamically from `capabilities.json`.
- **Task Classifier**: Implemented regex-based heuristic classification parsing prompts into capabilities, difficulties, and token requirements.
- **Model Router**: Built scoring routing sequence calculation and price saving justifications.
- **Dynamic CLI Runner**: Integrated E2E executions compiling mock outputs (FB posts, short scripts, CTAs, interactive quizzes, local code tests) and saving them as database node entities.
- **Closed-Loop Feedback**: Supported `--feedback` argument to simulate post-publish analytics back-propagation, learning updates, and decision adjustments.
- **Unit Tests Suite**: Created `test_orchestrator_core.py` covering all core components with 100% success.
