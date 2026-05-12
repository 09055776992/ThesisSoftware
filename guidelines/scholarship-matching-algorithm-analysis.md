# Scholarship Matching Algorithm Analysis

## Abstract

The scholarship recommendation subsystem applies a multi-criteria decision-making approach to rank scholarship opportunities according to a student profile. The implementation combines feature normalization, semantic text matching, TOPSIS-based ranking, and a Gale-Shapley stability check. This design allows the system to produce ordered recommendations while still preserving a deterministic and explainable scoring process.

## 1. Problem Statement

The scholarship platform must present opportunities that are relevant to a student’s academic background and financial situation. A simple keyword search is insufficient because scholarship eligibility is usually defined by multiple criteria, such as GPA, field of study, location, and financial need. The objective of the algorithm is therefore to compute a relevance score for every scholarship in the database and rank the results from most suitable to least suitable.

## 2. Inputs and Data Sources

The matching pipeline consumes two primary inputs:

1. **Student profile**
   - GPA
   - GPA scale
   - Field of study
   - Location
   - Education level
   - Financial need or income-related information

2. **Scholarship records**
   - Scholarship name
   - Provider
   - Type
   - Eligibility description
   - Location
   - Minimum GPA or similar requirement
   - Description and other textual metadata

The backend retrieves all scholarship records from MongoDB and evaluates them against the active student profile.

## 3. Preprocessing Stage

Before ranking begins, the algorithm standardizes the input values to make comparisons reliable:

- Text fields are normalized to lowercase and trimmed.
- GPA values are converted into numeric form.
- GPA scale values are validated and defaulted when missing.
- Financial need values are transformed into a bounded fit score in the range $[0,1]$.
- Text matching is performed using token overlap and substring checks.

This preprocessing step reduces noise caused by inconsistent formatting and allows the scoring model to compare fields on a common scale.

## 4. Matching Model

The algorithm uses a composite score built from several criteria. For a given scholarship $s_i$ and student profile $p$, the system computes intermediate feature scores:

- $gpaFit$ - how well the student GPA satisfies the scholarship requirement
- $financialNeedFit$ - how well the student’s financial profile matches a need-based scholarship
- $fieldFit$ - similarity between the student field of study and scholarship text/eligibility
- $locationFit$ - similarity between the student location and scholarship location
- $deadlineUrgencyDays$ - the remaining time until the application deadline

The feature scores are then passed into TOPSIS.

### 4.1 GPA Fit

The GPA fit is computed by scaling the student GPA against the declared GPA scale:

$$
 gpaFit = \frac{GPA}{GPA_{scale}}
$$

If the GPA is missing or invalid, the system assigns a neutral fallback score.

### 4.2 Financial Need Fit

The financial need score is mapped into a normalized interval $[0,1]$. Scholarships marked as need-based receive a stronger fit when the student profile indicates financial need. This makes need-sensitive scholarships rank higher for students who are more likely to qualify.

### 4.3 Field and Location Matching

For text-based fields, the implementation uses token overlap. If the scholarship text and student preference share terms, the similarity increases. If the source text fully contains the student term, the system applies a stronger partial match. This allows the system to match cases such as:

- "Computer Science" with "Computer Science and Information Technology"
- "Quezon City" with location text containing the same region name

### 4.4 Deadline Urgency

The number of days until the deadline is treated as a cost criterion. Scholarships with earlier deadlines are ranked more favorably when all else is similar, because the application window is more urgent.

## 5. TOPSIS Ranking

After feature construction, the algorithm applies the Technique for Order Preference by Similarity to Ideal Solution (TOPSIS). This method ranks alternatives by measuring their distance from an ideal best solution and an ideal worst solution.

For each scholarship, the following criteria and weights are used:

- $gpaFit$ - weight $0.25$ - benefit criterion
- $financialNeedFit$ - weight $0.25$ - benefit criterion
- $fieldFit$ - weight $0.25$ - benefit criterion
- $locationFit$ - weight $0.10$ - benefit criterion
- $deadlineUrgencyDays$ - weight $0.15$ - cost criterion

### 5.1 Normalization

Each criterion is normalized so that differing scales do not dominate the decision. For a criterion value $x_{ij}$, the normalized value is:

$$
 r_{ij} = \frac{x_{ij}}{\sqrt{\sum_{i=1}^{n} x_{ij}^{2}}}
$$

### 5.2 Weighted Normalized Matrix

The normalized values are multiplied by their criterion weights:

$$
 v_{ij} = w_j r_{ij}
$$

### 5.3 Ideal Best and Ideal Worst

For each criterion, the algorithm determines an ideal best and ideal worst solution. Benefit criteria use the maximum as the best value and minimum as the worst value. Cost criteria reverse this logic.

### 5.4 Distance Measures

The separation from the ideal best and ideal worst is computed as:

$$
 S_i^+ = \sqrt{\sum_j (v_{ij} - A_j^+)^2}
$$

$$
 S_i^- = \sqrt{\sum_j (v_{ij} - A_j^-)^2}
$$

### 5.5 Closeness Coefficient

The final TOPSIS score is the closeness coefficient:

$$
 C_i = \frac{S_i^-}{S_i^+ + S_i^-}
$$

A higher closeness coefficient indicates that a scholarship is closer to the ideal recommendation profile. The backend converts this coefficient into a percentage-based match score.

## 6. Stable Match Marker

After ranking, the system uses a Gale-Shapley stable matching step to mark scholarships as stable matches. In the current implementation, the student acts as the proposer and the ranked scholarships act as the receivers. This does not replace the TOPSIS ranking; rather, it provides an additional stability indicator.

The final output includes:

- `matchScore` - the percentage score derived from TOPSIS closeness
- `isStableMatch` - a boolean flag indicating whether the scholarship appears in the stable match result

## 7. Algorithmic Flow

The overall process can be summarized as follows:

1. Fetch all scholarships from MongoDB.
2. Read the current student profile.
3. Normalize the profile and scholarship fields.
4. Compute criterion scores for each scholarship.
5. Apply TOPSIS to obtain closeness coefficients.
6. Convert the coefficients into ranked match scores.
7. Apply Gale-Shapley to flag stable matches.
8. Return the ranked scholarship list to the frontend.

## 8. Computational Complexity

Let $n$ be the number of scholarships and $m$ the number of scoring criteria.

The TOPSIS portion runs in approximately $O(nm)$ time because it performs normalization, weighting, and distance computation across all alternatives and criteria. Since $m$ is fixed and small in this application, the practical runtime is linear in the number of scholarships.

The Gale-Shapley step is also linear with respect to the number of ranked scholarships in the current one-student implementation. Therefore, the overall matching process remains efficient enough for interactive use.

Space complexity is also $O(nm)$ due to the normalized and weighted matrices maintained during ranking.

## 9. Strengths of the Approach

This algorithm offers several advantages:

- **Multi-factor evaluation**: It combines academic, geographic, and financial criteria instead of relying on a single field.
- **Explainability**: Each score is derived from visible sub-scores and weights.
- **Ranking quality**: TOPSIS provides a principled way to compare alternatives against ideal and worst reference points.
- **Stability support**: Gale-Shapley adds a secondary stability interpretation.
- **Scalability**: The method is efficient enough for a scholarship database of moderate or large size.

## 10. Limitations

The current approach also has limitations:

- Text matching is heuristic and may not fully capture semantic meaning.
- The quality of results depends on the completeness of the student profile.
- Deadline urgency may favor imminent scholarships even when other opportunities are more suitable.
- The algorithm assumes that scholarship records are reasonably structured and consistently labeled.
- Financial need scoring is only as accurate as the underlying user profile data.

## 11. Conclusion

The scholarship matching algorithm is a hybrid decision-support method that combines feature normalization, semantic matching, TOPSIS ranking, and stable matching analysis. Its design is appropriate for a scholarship recommendation platform because it handles multiple eligibility factors at once, produces a clear ranking order, and remains computationally efficient. In practice, the method helps students discover opportunities that better align with their academic profile and financial circumstances.
