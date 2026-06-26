# Decision Engine V2 Scoring Formula

The V2 sorting algorithm ranks candidate topics dynamically using mathematical combinations of market signals and brand priorities.

## 1. The V2 Formula

\[
\text{Final Score} = \text{Trend} + \text{Opportunity} + \text{Gap} + \text{ROI} + \text{Brand Strategy Weight} + \text{Audience Match} + \text{Current Product Match}
\]

Where components are scaled:

| Variable | Max Score | Description |
| :--- | :---: | :--- |
| **Trend** | 20.0 | Heuristic market trend volume |
| **Opportunity** | 20.0 | Calculated opportunity indicator |
| **Gap** | 20.0 | Calculated competitor content space (niche gap) |
| **ROI** | 20.0 | Projected commercial yield |
| **Brand Strategy Weight** | 20.0 | Matches brand priority keywords (+5.0 each, max 20) |
| **Audience Match** | 10.0 | Matches target segments (+5.0 each, max 10) |
| **Current Product Match** | 20.0 | Matches active focus product keywords (+20.0 boost) |
| **Max Final Score** | **130.0** | Total possible score |

---

## 2. Dynamic Rank Shifts

Because the **Current Product Match** component represents a large boost (**+20.0 points**), modifying the active focus product shifts the rank sequence dynamically:

```
[Focus: Life Capacity (人生承接力)]
1. ABL-themed Topic (Score: 108.0) ➔ TOP TOPIC
2. I8-themed Topic (Score: 91.0)
3. NAS-themed Topic (Score: 80.0)

➔ Shift Focus to: Life Numbers (生命數字)

[Focus: Life Numbers (生命數字)]
1. NAS-themed Topic (Score: 95.0) ➔ TOP TOPIC
2. I8-themed Topic (Score: 91.0)
3. ABL-themed Topic (Score: 78.0)
```
This is verified by tests in the automated suite.
