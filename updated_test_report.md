# Updated Test Report: V3 Decision System

This report verifies and documents the test results for the Decision System V3 filtering pipeline, format adaptation, and daily decision output structures.

---

## 1. Test Suite Summary

* **Testing Framework**: Python `unittest`
* **Test File**: [test_source_os.py](file:///Users/erickair/.gemini/antigravity/scratch/ai_content_factory/tests/test_source_os.py)
* **Execution Command**: `python3 -m unittest tests/test_source_os.py`
* **Outcome**: **ALL 16 TESTS PASSED**
* **Duration**: 0.036 seconds

---

## 2. V3 Core Test Cases

### 1. Test: `test_v3_filter_engine_facebook_posts_recommend_reels`
* **Objective**: Verify that if a topic has 30 or more Facebook posts logged in the Asset Registry, the engine automatically recommends the format **Reels** instead of **Facebook**.
* **Method**: Created 30 mock Facebook posts in the Asset Registry database under the same topic and executed recommendations.
* **Outcome**: **PASS**. The output format shifted to `Reels`.

### 2. Test: `test_v3_filter_engine_campaign_mismatch_rejection`
* **Objective**: Verify that topics not matching the currently active campaign theme are rejected sequentially.
* **Method**: Submitted a topic related to corporate decision-making when the active campaign focus was set to ABL state-adjustment.
* **Outcome**: **PASS**. The topic was rejected and routed to `rejected_topics` with the reason `"不符合目前活動 (Campaign Mismatch)"`.

### 3. Test: `test_v3_filter_engine_oversaturated_competition_rejection`
* **Objective**: Confirm that a high-competition topic with low brand differentiation is immediately filtered out.
* **Method**: Evaluated a candidate topic tagged with high competition level and brand differentiation score < 60.0.
* **Outcome**: **PASS**. The topic was correctly rejected with `"市場過度飽和，且品牌差異不足"`.

### 4. Test: `test_v3_filter_engine_pass_all_filters_to_ranking`
* **Objective**: Ensure that only topics passing all 7 filters proceed to score calculation and final ranking.
* **Method**: Compared the set of rejected topics against the set of recommended topics.
* **Outcome**: **PASS**. The intersection of the two sets was empty (0 overlapping items).

### 5. Test: `test_v3_decision_outputs_recommended_and_rejected_topics`
* **Objective**: Verify that the daily decision dictionary contains both `recommended_topics` and `rejected_topics` lists, each containing its respective metrics and reasons.
* **Outcome**: **PASS**. Both lists exist, contain populated items, and have descriptive rejection explanations.
