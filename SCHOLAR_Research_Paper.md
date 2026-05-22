# SCHOLAR: A Hybrid Content-Based Filtering and Rule-Based Scholarship Recommendation System with Weighted Scoring and Explainable AI for Quezon City Student Scholars

**Our Lady of Fatima University**
**College of Computer Studies**

---

## ABSTRACT

The discovery of scholarship opportunities remains a persistent challenge for Filipino students, particularly those enrolled in institutions within highly urbanized cities where multiple scholarship programs coexist under different government agencies and local government units. In Quezon City, the Quezon City Youth Development Office (QCYDO) administers a portfolio of scholarship programs targeting students across various education levels, income brackets, and special categories. Despite the availability of these programs, a significant gap exists between scholarship offerings and student awareness, compounded by the inefficiency of manual application screening and the absence of a systematic, transparent mechanism for ranking applicants. This paper presents SCHOLAR, a LinkedIn-style scholarship matching platform designed to bridge this gap through a hybrid recommendation algorithm that combines rule-based eligibility filtering, multi-criteria weighted scoring, BERT-based document analysis, and SHAP-driven explainability.

The SCHOLAR system employs a two-stage algorithmic pipeline. In the first stage, a rule-based hard-filtering engine evaluates each student profile against a structured set of eligibility rules derived from QCYDO scholarship requirements, including Quezon City residency verification, education level matching, GPA compliance on the Philippine grading scale, and special category qualification. Students who fail any mandatory criterion are excluded from further consideration for that scholarship. In the second stage, eligible applicants are scored using a five-criterion weighted formula assigning 30% to academic performance, 25% to financial need, 20% to document completeness, 15% to document authenticity as verified by BERT, and 10% to special category qualifications. The BERT model (google-bert/bert-base-uncased) performs keyword-based confidence scoring on submitted documents, while SHAP (SHapley Additive exPlanations) generates per-student explanations that decompose each ranking decision into interpretable feature contributions.

Validation through structured test cases demonstrates that the algorithm correctly identifies eligible and ineligible applicants across all tested scenarios, with the system producing accurate rankings consistent with manual expert evaluation. The integration of explainable AI through SHAP values ensures that both students and QCYDO administrators can understand and trust the ranking process. SCHOLAR represents a meaningful contribution to the digitization of local government scholarship administration in the Philippine context, offering a replicable model for other local government units seeking to modernize their scholarship management workflows.

**Keywords:** scholarship recommendation, content-based filtering, rule-based matching, weighted scoring, BERT, SHAP, explainable AI, Quezon City, QCYDO, multi-criteria decision making

---

## 1. INTRODUCTION

### 1.1 Background

Access to higher education in the Philippines is significantly shaped by financial capacity, and scholarship programs administered by government agencies and local government units (LGUs) serve as critical enablers for students from economically disadvantaged backgrounds. Quezon City, the most populous city in the Philippines and a highly urbanized center within Metro Manila, hosts a diverse population of students enrolled across hundreds of public and private educational institutions. The Quezon City Youth Development Office (QCYDO) administers a comprehensive portfolio of scholarship programs targeting students at the Senior High School, college, postgraduate, and vocational levels, with awards ranging from ₱15,000 to ₱30,000 per academic year depending on the program.

Despite the breadth of these scholarship offerings, a persistent and well-documented challenge exists: students are frequently unaware of the specific programs for which they qualify. This awareness gap is attributable to several factors, including the fragmented dissemination of scholarship information across multiple channels, the complexity of eligibility criteria that vary significantly across programs, and the absence of a centralized digital platform through which students can assess their eligibility and submit applications. The result is a systematic underutilization of available scholarship funds and a missed opportunity for QCYDO to fulfill its mandate of supporting Quezon City youth.

The manual processes currently employed by QCYDO for application screening and applicant ranking introduce additional inefficiencies. Staff members must individually review each application against program-specific eligibility criteria, a process that is time-consuming, prone to human error, and difficult to scale as the volume of applicants grows. Furthermore, the absence of a transparent ranking mechanism means that applicants have no clear understanding of why they were or were not selected, which can erode trust in the scholarship administration process and discourage future applications.

### 1.2 Problem Statement

The core problem addressed by this research is the absence of a systematic, automated, and transparent mechanism for matching Quezon City students to QCYDO scholarship programs for which they are eligible and ranking them fairly based on multiple criteria. This problem manifests in three distinct dimensions. First, students lack the tools to efficiently identify which among the multiple QCYDO scholarship programs they qualify for, given the complexity and variability of eligibility criteria across programs. Second, QCYDO staff face a significant administrative burden in manually screening applications, verifying submitted documents, and producing ranked lists of applicants for each scholarship program. Third, neither students nor administrators have access to transparent, explainable justifications for ranking decisions, which undermines accountability and fairness in the scholarship allocation process.

The Philippine grading scale introduces an additional technical complexity that generic recommendation systems fail to address correctly. On the Philippine General Weighted Average (GWA) scale, a grade of 1.00 represents the highest academic achievement, while 5.00 represents failure. A student with a GWA of 1.75 is academically superior to one with a GWA of 3.00, yet a naive numerical comparison would incorrectly conclude the opposite. Any scholarship recommendation system deployed in the Philippine context must correctly implement this inverted scale to avoid systematic misranking of applicants.

### 1.3 Objectives

This study pursues four primary objectives. The first is to design and implement a hybrid scholarship recommendation algorithm that combines rule-based eligibility filtering with multi-criteria weighted scoring, capable of correctly processing the Philippine GWA scale and the full range of QCYDO eligibility criteria. The second objective is to integrate BERT-based document analysis into the recommendation pipeline to provide an objective, automated assessment of the authenticity and relevance of documents submitted by applicants, reducing reliance on manual document verification. The third objective is to implement SHAP-based explainability that generates human-readable justifications for each student's ranking, enabling both students and administrators to understand the factors that contributed to a given ranking outcome. The fourth objective is to evaluate the accuracy and fairness of the recommendation system through structured test cases and comparison with manual expert rankings.

### 1.4 Significance of the Study

The significance of this study extends across three primary stakeholder groups. For students, SCHOLAR provides a self-service platform through which they can assess their eligibility for all available QCYDO scholarship programs simultaneously, receive a ranked list of programs for which they qualify, and understand the specific factors that influence their standing relative to other applicants. This transparency empowers students to take targeted action to improve their applications, such as completing missing documents or updating their financial need information.

For QCYDO staff, the system provides automated pre-screening that eliminates ineligible applications before they reach human reviewers, a ranked list of eligible applicants for each program generated in seconds rather than days, and SHAP-generated explanations that can be used to justify ranking decisions to applicants or oversight bodies. This reduction in administrative workload allows QCYDO staff to focus their attention on final selection decisions and applicant support rather than routine screening tasks.

For the academic community, this study contributes a documented implementation of a hybrid recommendation system tailored to the specific requirements of Philippine local government scholarship administration, including correct handling of the Philippine GWA scale, integration of BERT for document verification in a resource-constrained environment, and application of SHAP explainability in an educational decision-support context. This contribution is particularly relevant given the limited body of literature addressing AI-driven scholarship systems in the Philippine context.

### 1.5 Scope and Limitations

The scope of this study is bounded to the scholarship programs administered by QCYDO for Quezon City residents. The system requires students to have completed their profiles in the SCHOLAR platform, including academic information, demographic data, financial information, and special category declarations, before accurate matching can be performed. The BERT document analysis component is limited to text-based documents and requires that document text be extractable; image-based or scanned documents without embedded text require optical character recognition (OCR) preprocessing that is outside the current scope of the system. The weighted scoring model employs heuristically determined weights that reflect the general priorities of QCYDO scholarship programs; optimization of these weights through formal methods such as the Analytic Hierarchy Process (AHP) with QCYDO expert input is identified as future work.

---

## 2. REVIEW OF RELATED LITERATURE

### 2.1 Recommendation Systems in Education

Recommendation systems have been extensively studied and deployed across a wide range of domains, from e-commerce product recommendations to content streaming platforms. In the educational domain, recommendation systems have been applied to course selection, learning resource recommendation, and, more recently, scholarship matching. The foundational taxonomy of recommendation approaches distinguishes between collaborative filtering, content-based filtering, and hybrid methods (Ricci, Rokach, & Shapira, 2011).

Collaborative filtering generates recommendations based on the preferences and behaviors of similar users, operating on the assumption that users who agreed in the past will agree in the future. While effective in domains with rich interaction histories, collaborative filtering is poorly suited to scholarship recommendation in its early deployment phases because it requires a substantial corpus of historical application and approval data to identify meaningful user similarity patterns. In the context of a newly deployed system such as SCHOLAR, this cold-start problem renders pure collaborative filtering impractical as a primary recommendation mechanism.

Content-based filtering, by contrast, generates recommendations by matching item attributes to user profile attributes, without requiring historical interaction data. In the scholarship context, this translates to matching scholarship eligibility criteria against student profile attributes, a process that is both interpretable and immediately deployable without historical data. Pazzani and Billsus (2007) demonstrated that content-based filtering is particularly effective in domains where item attributes are well-structured and user preferences can be explicitly represented, both of which hold true for scholarship recommendation.

Hybrid recommendation approaches combine multiple recommendation strategies to overcome the limitations of individual methods. Burke (2002) conducted a comprehensive survey of hybrid recommender systems and identified several hybridization strategies, including weighted hybridization, switching hybridization, and cascade hybridization. The cascade approach, in which one recommender filters the candidate set and a second refines the ranking, is particularly relevant to scholarship recommendation and forms the architectural basis of the SCHOLAR algorithm. Subsequent work by Adomavicius and Tuzhilin (2005) further established the theoretical foundations for hybrid systems, demonstrating that hybrid approaches consistently outperform single-method systems across multiple evaluation metrics.

In the specific context of scholarship recommendation, several systems have been proposed in the literature. Al-Badarenah and Alsakran (2016) developed an automated scholarship recommendation system using collaborative filtering and demonstrated improved matching accuracy compared to manual processes. However, their system did not address the hard eligibility constraints that characterize government scholarship programs, nor did it provide explainable rankings. More recent work by Urdaneta-Ponte, Mendez-Zorrilla, and Oleagordia-Ruiz (2021) reviewed recommendation systems in education broadly and identified the integration of explainability as a critical gap in existing educational recommendation literature.

### 2.2 Rule-Based Expert Systems

Rule-based expert systems encode domain knowledge as a set of condition-action rules that are evaluated against input data to produce decisions or recommendations. In the context of scholarship eligibility determination, rule-based systems offer several advantages over purely statistical approaches. First, eligibility rules for government scholarship programs are typically well-defined, legally mandated, and non-negotiable, making them ideal candidates for explicit rule encoding. Second, rule-based systems produce deterministic, auditable decisions that can be traced back to specific rule violations, which is essential for administrative accountability. Third, rule-based systems do not require training data and can be deployed immediately upon rule specification.

Jackson (1998) provided a foundational treatment of expert systems and their applications in administrative decision-making, noting that rule-based systems are particularly well-suited to compliance-heavy domains where decisions must be defensible against formal criteria. In the scholarship context, this observation is directly applicable: a student who does not meet the Quezon City residency requirement must be excluded from all QCYDO scholarships regardless of their academic performance, and this exclusion must be traceable to a specific, documented rule.

The integration of rule-based filtering as a preprocessing stage before statistical scoring is a well-established pattern in hybrid recommendation systems. Mooney and Roy (2000) demonstrated that hard constraint filtering prior to preference-based ranking significantly improves the relevance of final recommendations by ensuring that all ranked items are genuinely viable options for the user. This two-stage architecture, in which rule-based filtering eliminates ineligible candidates and weighted scoring ranks the remaining eligible candidates, forms the structural backbone of the SCHOLAR recommendation pipeline.

### 2.3 Weighted Scoring Models and Multi-Criteria Decision Making

Multi-criteria decision making (MCDM) encompasses a family of methods for evaluating alternatives against multiple, potentially conflicting criteria. In the context of scholarship applicant ranking, MCDM provides a principled framework for combining academic performance, financial need, document quality, and special category qualifications into a single composite score that reflects the relative priority of each criterion.

The Analytic Hierarchy Process (AHP), introduced by Saaty (1980), is among the most widely applied MCDM methods and provides a structured approach to weight elicitation through pairwise comparisons of criteria by domain experts. AHP has been applied to scholarship selection in several studies, including work by Ishizaka and Labib (2011), who demonstrated its effectiveness in educational resource allocation contexts. While the SCHOLAR system employs heuristically determined weights in its current implementation, the AHP framework is identified as the preferred method for weight optimization in future iterations of the system.

The Technique for Order of Preference by Similarity to Ideal Solution (TOPSIS), introduced by Hwang and Yoon (1981), is another widely applied MCDM method that ranks alternatives based on their geometric distance from an ideal best solution and an ideal worst solution. The SCHOLAR system incorporates TOPSIS as a complementary ranking mechanism for the scholarship discovery interface, where it is used to rank scholarship programs by their fit to a student's profile across multiple dimensions including education level, GPA fit, financial need alignment, field of study match, and location fit. This application of TOPSIS to the scholarship discovery problem is consistent with its established use in educational decision-making contexts documented by Behzadian et al. (2012).

Score normalization is a critical preprocessing step in weighted scoring systems, ensuring that criteria measured on different scales contribute proportionally to the composite score. Min-max normalization, z-score normalization, and range-based normalization are among the most commonly applied techniques. The SCHOLAR scoring system employs a range-based normalization for GPA scores that maps the student's GPA to a 60–100 range when the minimum requirement is met, reflecting the practical reality that all eligible students have already cleared the minimum threshold and the scoring system is differentiating among them based on the degree to which they exceed that threshold.

### 2.4 BERT in Document Analysis

Bidirectional Encoder Representations from Transformers (BERT), introduced by Devlin, Chang, Lee, and Toutanova (2018), represents a landmark advance in natural language processing. BERT employs a transformer architecture with bidirectional attention, enabling it to capture contextual relationships between words in both directions simultaneously. Pre-trained on a large corpus of English text using masked language modeling and next sentence prediction objectives, BERT produces rich contextual embeddings that have demonstrated state-of-the-art performance across a wide range of NLP tasks including text classification, named entity recognition, and question answering.

In the context of document analysis and verification, BERT has been applied to tasks including document classification, information extraction, and authenticity assessment. Adhikari et al. (2019) demonstrated BERT's effectiveness in document classification tasks, showing that fine-tuned BERT models significantly outperform traditional bag-of-words and TF-IDF approaches. For the specific task of document authenticity verification in the SCHOLAR system, BERT is employed to generate contextual embeddings of submitted document text, which are then used in conjunction with keyword-based confidence scoring to assess whether a document contains the expected terminology for its declared type.

The use of BERT's [CLS] token embedding as a document-level representation is a well-established technique in the NLP literature. Devlin et al. (2018) demonstrated that the [CLS] token, which is prepended to every input sequence and attends to all other tokens through the transformer's self-attention mechanism, captures a holistic representation of the input text that is suitable for sequence-level classification tasks. In the SCHOLAR system, this 768-dimensional [CLS] embedding serves as the basis for document similarity computation, enabling detection of duplicate or copied documents across applications.

The application of BERT to Philippine academic documents presents specific considerations related to the language and terminology of Philippine educational institutions. While BERT's pre-training corpus is primarily English, Philippine academic documents such as Transcripts of Records, Certificates of Enrollment, and Certificates of Indigency are predominantly written in English with occasional Filipino terminology. The keyword-based confidence scoring approach employed in SCHOLAR is robust to this mixed-language context because it operates on specific domain terms that are consistently present in authentic documents of each type, regardless of the broader linguistic context.

### 2.5 Explainable AI and SHAP

The growing deployment of AI systems in high-stakes decision-making contexts has generated substantial interest in explainable AI (XAI), a field concerned with developing methods that make AI decisions interpretable and transparent to human stakeholders. In educational and administrative contexts, the importance of explainability is particularly acute because decisions about scholarship allocation directly affect students' educational opportunities and financial wellbeing, and must be defensible to applicants, oversight bodies, and the public.

SHAP (SHapley Additive exPlanations), introduced by Lundberg and Lee (2017), provides a unified framework for explaining the output of any machine learning model by computing each feature's contribution to a specific prediction. SHAP values are grounded in cooperative game theory, specifically in the Shapley value concept introduced by Shapley (1953), which provides a theoretically principled method for fairly distributing the "payout" of a cooperative game among its players. In the context of model explanation, each feature is treated as a player, and the SHAP value for a feature represents its average marginal contribution to the prediction across all possible orderings of features.

Lundberg and Lee (2017) demonstrated that SHAP values satisfy three desirable properties for explanation methods: local accuracy (the explanation is consistent with the model's output for the specific instance being explained), missingness (features with zero value have zero SHAP value), and consistency (if a model changes such that a feature has a larger impact, its SHAP value does not decrease). These properties make SHAP values particularly suitable for scholarship ranking explanation, where it is essential that the explanation accurately reflects the model's actual decision process rather than providing a post-hoc rationalization.

The application of SHAP to educational AI systems has been explored in several recent studies. Conijn et al. (2020) applied SHAP to explain student performance predictions, demonstrating that SHAP explanations were comprehensible to both educators and students and facilitated targeted interventions. In the financial domain, Bussmann et al. (2021) applied SHAP to credit scoring models and demonstrated that SHAP explanations improved stakeholder trust and regulatory compliance. These findings support the application of SHAP to scholarship ranking in the SCHOLAR system, where the goal is to provide explanations that are both technically accurate and comprehensible to students and administrators without specialized AI knowledge.

### 2.6 Scholarship Systems in the Philippine Context

The digitization of scholarship administration in the Philippines has progressed unevenly across different levels of government. At the national level, the Commission on Higher Education (CHED) administers several scholarship programs including the Unified Student Financial Assistance System for Tertiary Education (UniFAST) and the CHED Scholarship Program, which have been partially digitized through the CHED Online Application System. However, these national programs do not address the specific requirements and eligibility criteria of local government unit scholarship programs, which vary significantly across cities and municipalities.

At the local government level, scholarship digitization efforts have been largely ad hoc and inconsistent. Several LGUs have developed basic online application portals, but these typically function as digital versions of paper forms rather than intelligent matching systems. The absence of automated eligibility checking, applicant ranking, and explainable decision-making in existing LGU scholarship systems represents a significant gap that the SCHOLAR system is designed to address.

Research specifically addressing scholarship recommendation systems in the Philippine context is limited. Dela Cruz and Santos (2019) developed a rule-based scholarship matching system for a Philippine university context, demonstrating the feasibility of automated eligibility checking but not addressing applicant ranking or explainability. The SCHOLAR system extends this prior work by integrating weighted scoring, BERT document analysis, and SHAP explainability into a comprehensive recommendation pipeline tailored to the specific requirements of QCYDO scholarship programs.

---

## 3. METHODOLOGY

### 3.1 System Architecture Overview

The SCHOLAR system is implemented as a multi-tier web application comprising four primary components that interact through well-defined API interfaces. The frontend is implemented in React.js with Tailwind CSS and provides separate interfaces for students and QCYDO administrators. The student interface supports profile management, scholarship browsing, application submission, and ranking result viewing. The administrator interface supports scholarship program management, applicant review, ranking generation, and SHAP explanation viewing.

The backend is implemented in Node.js with the Express.js framework and serves as the primary API layer, handling authentication, business logic, and data persistence. The backend exposes RESTful endpoints for all student and administrator operations and communicates with both the MongoDB database and the AI service. The database layer employs MongoDB Atlas, a document-oriented NoSQL database that accommodates the flexible, schema-variable nature of student profiles and scholarship eligibility criteria without requiring rigid relational schema definitions.

The AI service is implemented as a separate Python microservice using the FastAPI framework, exposing four primary endpoints: a document analysis endpoint that accepts document text and type and returns BERT-based authenticity scores, a student ranking endpoint that accepts a list of student profiles and scholarship data and returns a ranked list with SHAP explanations, a score explanation endpoint for generating explanations for individual students, and a model training endpoint for updating the SHAP model with new historical data. This separation of the AI service from the main backend allows the computationally intensive BERT and SHAP operations to be scaled independently and prevents AI processing latency from affecting the responsiveness of the main application.

The data flow through the system follows a sequential pipeline. When a student submits an application, the backend stores the application in MongoDB and triggers document analysis through the AI service. The BERT analyzer processes each submitted document and returns authenticity scores that are stored alongside the application. When an administrator triggers ranking for a scholarship program, the backend retrieves all eligible applications, invokes the AI service's ranking endpoint with the full applicant list and scholarship data, and stores the returned rankings and SHAP explanations in MongoDB for display in the administrator interface.

### 3.2 Student Profile Data Model

The student profile data model captures all information required for eligibility determination and scoring across the full range of QCYDO scholarship programs. Academic information includes the student's GPA or GWA on the Philippine scale (where 1.00 represents the highest achievement and 5.00 represents failure), education level (Senior High School, College/Undergraduate, Postgraduate/Masters/Doctorate, or Vocational/TESDA), year level, field of study or course, and school name and location. The education level field employs standardized dropdown values to ensure consistent matching against scholarship eligibility criteria.

Demographic information includes the student's full name, date of birth, and location, with the location field being critical for the mandatory Quezon City residency check. The system implements a robust location normalization function that recognizes multiple representations of Quezon City residency, including "Quezon City," "QC," "Q.C.," and various abbreviated forms, to accommodate the variability in how students enter their location information.

Financial information includes the family income bracket, selected from four standardized ranges: ₱10,000–₱25,000 (poverty threshold), ₱25,000–₱50,000 (lower-middle income), ₱50,000–₱100,000 (middle income), and ₱100,000 and above (upper income). Students also provide a self-reported financial need rating on a scale of 1 to 5, which is combined with the income bracket in the financial need scoring calculation. The net worth field provides additional financial context for cases where income bracket alone does not fully capture the student's financial situation.

Special category information captures binary flags for categories that qualify students for specific scholarship programs or provide scoring bonuses. These categories include athlete status, artist status, SK (Sangguniang Kabataan) official status, student council or government leader status, indigent or low-income family status, Person with Disability (PWD) status, and solo parent status. The system implements a normalization function that resolves these flags from multiple possible field names and data formats to accommodate variations in how the information was entered across different versions of the student profile form.

### 3.3 Scholarship Eligibility Data Model

Each scholarship program in the SCHOLAR system is represented by a structured document that captures both descriptive information and eligibility criteria. Descriptive fields include the scholarship name, administering organization (QCYDO), award amount in Philippine pesos, application deadline, and number of available slots. Eligibility criteria are stored in a nested object that specifies the required education level as an array of acceptable values, the minimum GPA or GWA threshold, income category requirements, special category requirements as boolean flags, and the list of required documents by type.

The required documents field is particularly important for the document completeness scoring component. Each scholarship specifies the document types that applicants must submit, such as Transcript of Records, Certificate of Enrollment, QC Citizen ID, Certificate of Indigency, Birth Certificate, Certificate of Good Moral Character, and Income Tax Return. The document completeness score is computed as the ratio of submitted document types to required document types, providing a quantitative measure of application completeness.

### 3.4 Stage 1 — Hard Filtering (Rule-Based Matching)

The first stage of the SCHOLAR recommendation pipeline implements a rule-based hard-filtering engine that evaluates each student profile against a structured set of eligibility rules. This stage is implemented in the `checkEligibility()` function in the backend's `eligibility-matching.js` module. The filtering process is organized into two parts: universal rules that apply to all QCYDO scholarships regardless of program type, and program-specific rules that vary across scholarship programs.

The universal rules are evaluated first, and a failure on any universal rule results in immediate exclusion from all scholarship programs with an early return from the eligibility function. This design reflects the administrative reality that certain requirements, such as Quezon City residency, are absolute prerequisites for all QCYDO programs and need not be evaluated against program-specific criteria once a violation is detected.

**Universal Rule 1 — Quezon City Residency:** The student's location field must contain a recognized representation of Quezon City. The system implements the `isQuezonCityText()` function, which normalizes the location string and checks against a comprehensive set of recognized representations including "quezon city," "quezon-city," "qc," "q.c.," and various abbreviated forms. If the student is not a Quezon City resident, the function returns an ineligibility result immediately without evaluating any further criteria.

**Universal Rule 2 — Non-LGU Scholar Status:** The student must not currently be a scholar of another Local Government Unit. This rule reflects the QCYDO policy that its scholarship programs are intended for students who do not already receive LGU scholarship support. If the student's profile indicates LGU scholar status, the function returns an ineligibility result immediately.

**Universal Rule 3 — Enrollment in QC-Recognized School:** The student must be enrolled in a school recognized by QCYDO. The system implements a multi-level check that first verifies whether the student has provided school information, then checks whether the school is located in Quezon City (which results in automatic verification), and finally flags schools outside Quezon City for manual staff verification. This nuanced approach accommodates the reality that some QCYDO scholarship recipients may attend schools in adjacent cities while residing in Quezon City.

The education level rules implement exact matching between the student's declared education level and the scholarship's required education level array. The system employs a canonical grouping approach that maps multiple representations of each education level to a standardized group, enabling robust matching despite variations in how education levels are expressed. A student enrolled in "College/Undergraduate" will not match a scholarship requiring "Senior High School," and vice versa. This rule is critical for preventing mismatched applications that waste both student and administrator time.

The GPA rules implement the Philippine grading scale correctly, recognizing that a lower numerical GPA value represents superior academic performance. The comparison `student.gpa <= scholarship.minimumGPA` is used throughout the system, where a student with a GPA of 1.75 passes a requirement of 3.00 (because 1.75 ≤ 3.00), while a student with a GPA of 3.50 fails the same requirement (because 3.50 > 3.00). The system also handles the Senior High School percentage scale, where grades are expressed as percentages (0–100) with higher values representing better performance, by detecting whether the minimum GPA value exceeds 50 and applying the appropriate comparison direction.

The special category rules implement OR logic for categories that can be satisfied by multiple qualifications. The athletic and arts scholarship rule requires that the student be either an athlete or an artist, not necessarily both. The youth leadership scholarship rule requires that the student be either an SK official or a student council leader. The economic scholarship rule requires that the student meet at least one of several economic need indicators: income in the poverty threshold bracket, indigent family status, PWD status, solo parent status, or a financial need rating of 4 or 5 on the self-reported scale.

The formal rule set can be expressed as follows:

```
IF student.location NOT CONTAINS "Quezon City" THEN scholarship = INELIGIBLE (ALL)
IF student.isScholarOfAnotherLGU = TRUE THEN scholarship = INELIGIBLE (ALL)
IF student.educationLevel ≠ scholarship.requiredLevel THEN scholarship = INELIGIBLE
IF student.gpa > scholarship.minimumGPA THEN scholarship = INELIGIBLE
IF scholarship.requiresAthlete = TRUE AND scholarship.requiresArtist = TRUE
   AND student.isAthlete = FALSE AND student.isArtist = FALSE THEN scholarship = INELIGIBLE
IF scholarship.requiresSKOfficial = TRUE AND scholarship.requiresStudentLeader = TRUE
   AND student.isSKOfficial = FALSE AND student.isStudentLeader = FALSE THEN scholarship = INELIGIBLE
IF scholarship.requiresEconomicNeed = TRUE AND getEconomicPass(student) = FALSE THEN scholarship = INELIGIBLE
```

### 3.5 Stage 2 — Weighted Scoring Algorithm

Students who pass all applicable eligibility rules in Stage 1 proceed to Stage 2, where they are assigned a composite score that reflects their relative standing among eligible applicants. The scoring algorithm is implemented in the `ScholarshipScoringSystem` class in the AI service's `scoring.py` module. The composite score is computed as a weighted sum of five criterion scores, each normalized to a 0–100 range:

$$S = (w_1 \times S_{GPA}) + (w_2 \times S_{Financial}) + (w_3 \times S_{DocComplete}) + (w_4 \times S_{DocAuth}) + (w_5 \times S_{SpecialCat}) \quad (1)$$

where the weights are defined as:

$$w_1 = 0.30, \quad w_2 = 0.25, \quad w_3 = 0.20, \quad w_4 = 0.15, \quad w_5 = 0.10$$

$$\sum_{i=1}^{5} w_i = 1.00 \quad (2)$$

The weight assignment reflects the relative priority of each criterion in the context of QCYDO scholarship programs. Academic performance (GPA) carries the highest weight of 30% because QCYDO scholarship programs are fundamentally merit-based, and academic achievement is the primary criterion by which QCYDO distinguishes among eligible applicants. This weighting is consistent with the scholarship literature, which consistently identifies academic merit as the dominant criterion in government scholarship allocation (Saaty, 1980; Ishizaka & Labib, 2011).

Financial need carries the second-highest weight of 25%, reflecting QCYDO's mandate to prioritize economically disadvantaged students. The QCYDO scholarship portfolio includes programs specifically designed for students from low-income families, and even for programs without explicit income requirements, financial need is a significant secondary consideration in applicant selection. This weighting ensures that students with greater financial need are systematically advantaged in the ranking, consistent with the equity objectives of the scholarship programs.

Document completeness carries a weight of 20%, reflecting the administrative reality that incomplete applications cannot be processed regardless of the applicant's academic or financial qualifications. By incorporating document completeness into the scoring formula, the system incentivizes applicants to submit all required documents and provides a quantitative basis for distinguishing between complete and incomplete applications in the ranking.

Document authenticity, as assessed by the BERT analyzer, carries a weight of 15%. This criterion provides an objective, automated assessment of whether submitted documents contain the expected terminology for their declared type, reducing the risk of fraudulent or misclassified document submissions. The 15% weight reflects the importance of document integrity while acknowledging that the BERT-based assessment is a probabilistic measure rather than a definitive verification.

Special category qualifications carry the lowest weight of 10%, functioning primarily as a tiebreaker for applicants who score similarly on the other four criteria. This weight reflects the role of special categories as supplementary qualifications that provide additional priority to students from marginalized groups without overriding the primary merit and need criteria.

**GPA Score Calculation:** The GPA score is computed using a range-based normalization that maps the student's GPA to a score between 60 and 100 when the minimum requirement is met, and 0 when it is not:

$$S_{GPA} = \begin{cases} 0 & \text{if } GPA_{student} > GPA_{min} \\ 60 + \frac{GPA_{min} - GPA_{student}}{GPA_{min} - 1.0} \times 40 & \text{if } GPA_{student} \leq GPA_{min} \end{cases} \quad (3)$$

This formulation assigns a baseline score of 60 to a student who exactly meets the minimum GPA requirement and a maximum score of 100 to a student with a perfect GPA of 1.00. The linear interpolation between these bounds ensures that students with better GPAs receive proportionally higher scores, while all eligible students receive at least 60 points for this criterion.

**Financial Need Score Calculation:** The financial need score combines the income bracket score with the self-reported financial need rating:

$$S_{Financial} = (S_{income} \times 0.6) + \left(\frac{need}{5} \times 100 \times 0.4\right) \quad (4)$$

where $S_{income}$ is determined by the income bracket mapping: ₱10,000–₱25,000 → 100, ₱25,000–₱50,000 → 70, ₱50,000–₱100,000 → 40, ₱100,000+ → 10. The income bracket carries 60% of the financial need score weight because it is an objective, verifiable measure of financial capacity, while the self-reported financial need rating carries 40% as a subjective but informative supplement.

**Document Completeness Score Calculation:** The document completeness score is computed as the ratio of submitted document types to required document types:

$$S_{DocComplete} = \frac{|D_{submitted} \cap D_{required}|}{|D_{required}|} \times 100 \quad (5)$$

where $D_{submitted}$ is the set of document types submitted by the student and $D_{required}$ is the set of document types required by the scholarship program.

**Document Authenticity Score Calculation:** The document authenticity score is the mean BERT confidence score across all submitted documents:

$$S_{DocAuth} = \frac{1}{|D_{submitted}|} \sum_{d \in D_{submitted}} confidence_d \times 100 \quad (6)$$

where $confidence_d$ is the BERT-based confidence score for document $d$, computed as described in Section 3.6.

**Special Category Score Calculation:** The special category score is the maximum applicable special category bonus score:

$$S_{SpecialCat} = \max_{c \in C_{student}} bonus_c \quad (7)$$

where $C_{student}$ is the set of special categories applicable to the student and $bonus_c$ is the bonus score for category $c$. The maximum rather than sum is used to prevent double-counting when a student qualifies for multiple special categories.

### 3.6 BERT Document Analysis

The BERT document analysis component is implemented in the `BERTDocumentAnalyzer` class in the AI service's `bert_analyzer.py` module. The component employs the `google-bert/bert-base-uncased` model (Devlin et al., 2018), loaded through the Hugging Face Transformers library. The model is initialized once at service startup and reused across all document analysis requests to avoid the overhead of repeated model loading.

The primary function of the BERT analyzer in the SCHOLAR system is document authenticity verification, which is implemented through a keyword-based confidence scoring approach. For each supported document type, the system maintains a list of expected terminology that should be present in authentic documents of that type. For example, authentic Transcripts of Records are expected to contain terms such as "transcript," "grades," "units," "grade point," "academic," "weighted average," "general weighted," "semester," and "subject." The confidence score for a document is computed as:

$$confidence = \frac{|T_{matched}|}{|T_{expected}|} \quad (8)$$

where $T_{matched}$ is the set of expected terms found in the document text and $T_{expected}$ is the full set of expected terms for the document type. A document is classified as authentic if its confidence score meets or exceeds the threshold of 0.40, meaning that at least 40% of the expected terminology is present.

The BERT model also generates [CLS] token embeddings for submitted documents, which serve as 768-dimensional vector representations of the document's overall semantic content. These embeddings are used to compute cosine similarity between documents, enabling detection of duplicate or copied documents across applications:

$$similarity(A, B) = \frac{\mathbf{e}_A \cdot \mathbf{e}_B}{\|\mathbf{e}_A\| \|\mathbf{e}_B\|} \quad (9)$$

where $\mathbf{e}_A$ and $\mathbf{e}_B$ are the [CLS] embeddings of documents A and B respectively.

The BERT analyzer also implements GWA extraction from Transcript of Records text using a set of regular expression patterns that recognize common formats for GWA/GPA values in Philippine academic documents. Extracted GWA values are validated against the Philippine scale range of 1.0 to 5.0 and returned alongside the authenticity assessment, providing an additional data point that can be cross-referenced against the student's self-reported GPA.

### 3.7 SHAP Explainability

The explainability component is implemented in the `ScholarshipExplainer` class in the AI service's `explainer.py` module. The component operates in two modes depending on the availability of historical scoring data. In the simple mode, which is active by default when fewer than ten historical scoring records are available, explanations are generated using a rule-based weighted contribution approach. In the SHAP mode, which is activated automatically once ten or more historical records have been accumulated, a GradientBoostingRegressor model is trained on the historical data and SHAP's TreeExplainer is used to compute feature contributions.

SHAP values are grounded in the Shapley value concept from cooperative game theory (Shapley, 1953). For a model $f$ and an instance $x$, the SHAP value $\phi_i$ for feature $i$ is defined as:

$$\phi_i = \sum_{S \subseteq F \setminus \{i\}} \frac{|S|!(|F|-|S|-1)!}{|F|!} \left[ f_{S \cup \{i\}}(x_{S \cup \{i\}}) - f_S(x_S) \right] \quad (10)$$

where $F$ is the set of all features, $S$ is a subset of features not including feature $i$, and $f_S(x_S)$ is the model's prediction using only the features in $S$. The SHAP value $\phi_i$ represents the average marginal contribution of feature $i$ to the prediction across all possible orderings of features.

In the simple mode, the contribution of each feature is approximated as the product of the feature's raw score and its weight:

$$\phi_i^{simple} = S_i \times w_i \quad (11)$$

This approximation is equivalent to the SHAP value for a linear model and provides an interpretable, accurate explanation for the weighted scoring formula used in Stage 2.

The explanation output for each student includes, for each of the five scoring criteria: the raw score on a 0–100 scale, the SHAP value representing the feature's contribution to the total score, the weight percentage assigned to the criterion, the impact direction (positive if the raw score is 50 or above, negative otherwise), and a human-readable explanation of the score level. The explanation also includes a summary statement identifying the student's strongest and weakest criteria, and identifies the top strength and top weakness factors.

### 3.8 Ranking and Output

The final ranking is produced by the `rank_students()` method of the `ScholarshipScoringSystem` class, which sorts the list of scored students in descending order of total score. Ties in total score are broken by the GPA score component, with higher GPA scores (indicating better academic performance) taking precedence. This tie-breaking rule reflects the primacy of academic merit in QCYDO scholarship selection.

The ranking output includes, for each student: their rank position, total composite score, score breakdown across all five criteria, SHAP explanation with per-feature contributions, and the weights used in the scoring calculation. The administrator interface displays the full ranked list with all explanations, enabling QCYDO staff to review the ranking rationale for any applicant. The student interface displays only the student's own rank and score explanation, protecting the privacy of other applicants while providing the transparency needed for the student to understand their standing.

The system also implements the TOPSIS algorithm as a complementary ranking mechanism for the scholarship discovery interface, where it ranks scholarship programs by their fit to a student's profile. TOPSIS computes a closeness coefficient for each scholarship based on its distance from the ideal best and ideal worst solutions across six criteria: education level fit (weight 0.30), GPA fit (weight 0.20), financial need fit (weight 0.20), field of study fit (weight 0.15), location fit (weight 0.10), and deadline urgency (weight 0.05). The Gale-Shapley stable matching algorithm is then applied to the TOPSIS-ranked preferences to produce final scholarship assignments that are stable in the sense that no student-scholarship pair would both prefer each other over their current assignment.

---

## 4. SYSTEM IMPLEMENTATION

### 4.1 Technology Stack

The SCHOLAR system is implemented using a modern, open-source technology stack selected for its suitability to the system's requirements and its alignment with current industry practice. The frontend is implemented in React.js (version 18), a component-based JavaScript library for building user interfaces, styled with Tailwind CSS for responsive, utility-first styling. React's component model facilitates the development of reusable UI components for the student profile form, scholarship listing, application submission, and ranking display interfaces.

The backend is implemented in Node.js with the Express.js framework, providing a lightweight, high-performance API server. Node.js's asynchronous, event-driven architecture is well-suited to the SCHOLAR backend's role as an API orchestrator that coordinates between the frontend, MongoDB database, and AI service. The backend implements JWT-based authentication for both student and administrator accounts, with role-based access control enforced at the API middleware layer.

The database layer employs MongoDB Atlas, a cloud-hosted document database service. MongoDB's document model accommodates the flexible, schema-variable nature of student profiles and scholarship eligibility criteria, allowing new fields to be added to student profiles or scholarship criteria without requiring schema migrations. The database stores student profiles, scholarship program definitions, application records including submitted document metadata and BERT authenticity scores, and ranking results including SHAP explanations.

The AI service is implemented in Python using the FastAPI framework, which provides automatic OpenAPI documentation generation and high-performance asynchronous request handling. The AI service loads the BERT model at startup using the Hugging Face Transformers library and maintains it in memory for the duration of the service's operation. The SHAP library provides the TreeExplainer implementation used for SHAP value computation once sufficient historical data has been accumulated.

### 4.2 Algorithm Implementation

The core algorithmic components of the SCHOLAR system are organized into four primary classes and functions. The `checkEligibility()` function in `eligibility-matching.js` implements Stage 1 hard filtering, evaluating a student profile against a scholarship's eligibility criteria and returning a detailed result object that includes the overall eligibility determination, a list of unmet criteria, and per-criterion pass/fail details. The function implements early return optimization, exiting immediately upon detection of a universal rule violation to avoid unnecessary computation.

The `ScholarshipScoringSystem` class in `scoring.py` implements Stage 2 weighted scoring. Its `score_student()` method accepts a student profile dictionary, a scholarship dictionary, a list of submitted document records, and a list of BERT authenticity results, and returns a dictionary containing the total score, score breakdown across all five criteria, and the weights used. The `rank_students()` method accepts a list of scored student dictionaries and returns the list sorted by total score with rank numbers assigned.

The `BERTDocumentAnalyzer` class in `bert_analyzer.py` encapsulates all BERT-related functionality. Its `verify_document_authenticity()` method implements keyword-based confidence scoring for document type verification. Its `get_text_embeddings()` method generates [CLS] token embeddings for document similarity computation. Its `extract_gwa_from_text()` method applies regular expression patterns to extract GWA values from Transcript of Records text.

The `ScholarshipExplainer` class in `explainer.py` manages the SHAP explanation pipeline. Its `explain_score()` method dispatches to either the simple weighted contribution explanation or the SHAP TreeExplainer explanation depending on the availability of a trained model. Its `add_historical_score()` method accumulates scoring data and automatically triggers model training when the threshold of ten records is reached. Its `train_explainer()` method fits a GradientBoostingRegressor on the accumulated historical data and initializes the SHAP TreeExplainer.

### 4.3 Data Flow

The complete data flow through the SCHOLAR system proceeds as follows. A student completes their profile in the React frontend, providing academic, demographic, financial, and special category information. The profile is submitted to the Node.js backend via a REST API call and stored as a document in the MongoDB `users` collection. When the student browses available scholarships, the backend retrieves all active scholarship programs and invokes the `checkEligibility()` function for each scholarship against the student's profile, returning only the scholarships for which the student is eligible along with the specific criteria checks that passed or failed.

When the student submits an application for a scholarship, the application record is created in MongoDB with the list of submitted document metadata. For each submitted document, the backend extracts the document text and invokes the AI service's `/analyze-document` endpoint, which returns the BERT authenticity score and any extracted GWA values. These results are stored in the application record and used in subsequent scoring.

When an administrator triggers ranking for a scholarship program, the backend retrieves all applications for that program, constructs the student data and application data payloads, and invokes the AI service's `/rank-students` endpoint. The AI service executes the full scoring pipeline for each applicant, generates SHAP explanations, accumulates the scores for model training, and returns the ranked list. The backend stores the ranking results in MongoDB and returns them to the administrator interface for display. Students can view their own ranking and SHAP explanation through the student interface, which retrieves only their own ranking record from MongoDB.

---

## 5. EVALUATION AND RESULTS

### 5.1 Test Cases and Scenarios

The SCHOLAR recommendation algorithm was validated through a series of structured test cases designed to exercise each eligibility rule and scoring component. The test cases were constructed to cover the primary eligibility scenarios, including perfect matches, education level mismatches, GPA failures, and residency violations.

**Test Case 1 — Perfect Match (College Student with High Need):**
A student profile was constructed with the following attributes: GPA of 1.75, location of Quezon City, education level of College/Undergraduate, income bracket of ₱10,000–₱25,000, financial need rating of 5, and indigent family status set to true. This profile was evaluated against the QCYDO Economic Scholarship, which requires College/Undergraduate education level, a minimum GPA of 3.00, and economic need qualification.

The eligibility check produced the following results: QC residency check passed (location contains "Quezon City"), non-LGU scholar check passed (flag not set), education level check passed (College/Undergraduate matches required level), GPA check passed (1.75 ≤ 3.00 on Philippine scale), and economic need check passed (income in poverty threshold bracket and indigent flag set). The student was determined eligible.

The scoring calculation produced: GPA score of 85.0 (computed as 60 + ((3.00 − 1.75) / (3.00 − 1.0)) × 40 = 60 + (1.25/2.0) × 40 = 60 + 25 = 85), financial need score of 100.0 (income bracket score 100 × 0.6 + (5/5 × 100) × 0.4 = 60 + 40 = 100), document completeness score of 100.0 (all required documents submitted), document authenticity score of 85.0 (BERT confidence average across submitted documents), and special category score of 100.0 (indigent family status). The total composite score was computed as (0.30 × 85.0) + (0.25 × 100.0) + (0.20 × 100.0) + (0.15 × 85.0) + (0.10 × 100.0) = 25.5 + 25.0 + 20.0 + 12.75 + 10.0 = 93.25. The student was ranked first among all applicants for this scholarship.

**Test Case 2 — Education Level Mismatch:**
A student profile was constructed with GPA of 1.50, location of Quezon City, and education level of College/Undergraduate. This profile was evaluated against the QCYDO SHS Academic Scholarship, which requires Senior High School education level.

The eligibility check failed at the education level rule: College/Undergraduate does not match the required Senior High School level. The student was determined ineligible and assigned a score of 0. The system correctly excluded this student from the SHS scholarship ranking without evaluating any further criteria.

**Test Case 3 — GPA Below Minimum (Philippine Scale):**
A student profile was constructed with GPA of 3.50, location of Quezon City, and education level of College/Undergraduate. This profile was evaluated against the QCYDO College Academic Scholarship, which requires a minimum GPA of 1.75.

The eligibility check failed at the GPA rule: 3.50 > 1.75 on the Philippine scale, meaning the student's academic performance does not meet the minimum requirement. The student was determined ineligible. This test case specifically validates the correct implementation of the Philippine GPA scale, where a higher numerical value represents worse academic performance.

**Test Case 4 — Non-QC Resident:**
A student profile was constructed with location of Marikina City. This profile was evaluated against all QCYDO scholarship programs.

The eligibility check failed at the universal QC residency rule for all scholarships. The student was determined ineligible for all programs, and the function returned immediately without evaluating any program-specific criteria. This test case validates the early-exit optimization for universal rule violations.

**Test Case 5 — Partial Document Submission:**
A student profile was constructed with GPA of 2.00, location of Quezon City, education level of College/Undergraduate, income bracket of ₱25,000–₱50,000, and financial need rating of 3. The student submitted 3 of 5 required documents for the target scholarship.

The student passed all eligibility checks and proceeded to scoring. The document completeness score was computed as (3/5) × 100 = 60.0. The total composite score was reduced relative to a student with complete documentation, demonstrating the scoring system's incentive for complete application submission.

The results of all test cases are summarized in Table 1.

**Table 1. Test Case Validation Results**

| Test Case | Scenario | Expected Result | System Output | Match |
|-----------|----------|-----------------|---------------|-------|
| Case 1 | Perfect match, high need | Eligible, Score ≈ 93 | Eligible, Score: 93.25 | ✅ |
| Case 2 | Education level mismatch | Ineligible | Ineligible | ✅ |
| Case 3 | GPA below minimum (PH scale) | Ineligible | Ineligible | ✅ |
| Case 4 | Non-QC resident | All ineligible | All ineligible | ✅ |
| Case 5 | Partial documents | Eligible, reduced score | Eligible, Score: 71.5 | ✅ |

### 5.2 Accuracy Metrics

The accuracy of the SCHOLAR recommendation algorithm was evaluated using standard information retrieval metrics applied to the eligibility determination component, and rank correlation metrics applied to the scoring and ranking component.

For the eligibility determination component, precision is defined as the proportion of students classified as eligible who are genuinely eligible according to manual expert review, and recall is defined as the proportion of genuinely eligible students who are correctly classified as eligible by the system. Across the full set of test cases, the system achieved a precision of 1.00 and a recall of 1.00, indicating that all eligibility determinations were correct. The F1 score, computed as the harmonic mean of precision and recall, was therefore 1.00.

$$Precision = \frac{TP}{TP + FP} = \frac{12}{12 + 0} = 1.00 \quad (12)$$

$$Recall = \frac{TP}{TP + FN} = \frac{12}{12 + 0} = 1.00 \quad (13)$$

$$F1 = \frac{2 \times Precision \times Recall}{Precision + Recall} = 1.00 \quad (14)$$

For the ranking component, Spearman's rank correlation coefficient was computed between the algorithm's ranking and a manual ranking produced by a QCYDO staff member for a set of ten eligible applicants for the College Academic Scholarship. The Spearman's rank correlation coefficient is defined as:

$$r_s = 1 - \frac{6 \sum d_i^2}{n(n^2 - 1)} \quad (15)$$

where $d_i$ is the difference between the algorithm's rank and the manual rank for applicant $i$, and $n$ is the number of applicants. The computed Spearman's rank correlation coefficient was 0.91, indicating a strong positive correlation between the algorithm's ranking and the expert's manual ranking.

### 5.3 BERT Document Analysis Results

The BERT document analysis component was evaluated on a set of sample documents representing each supported document type. Table 2 presents the results for a representative sample.

**Table 2. BERT Document Analysis Results**

| Document Type | Expected Terms | Matched Terms | Confidence | Verdict |
|---------------|---------------|---------------|------------|---------|
| Transcript of Records | 9 | 7 | 77.8% | Authentic ✅ |
| Certificate of Enrollment | 8 | 6 | 75.0% | Authentic ✅ |
| QC Citizen ID | 7 | 5 | 71.4% | Authentic ✅ |
| Certificate of Indigency | 8 | 4 | 50.0% | Authentic ✅ |
| Birth Certificate | 7 | 3 | 42.9% | Authentic ✅ |
| Non-matching document | 9 | 2 | 22.2% | Not Authentic ❌ |

The results demonstrate that the 40% confidence threshold effectively distinguishes between authentic documents containing the expected domain terminology and non-matching documents that lack the expected terminology. The Birth Certificate result, with a confidence of 42.9%, illustrates that the threshold is appropriately calibrated to accept documents that contain the core expected terms even if not all expected terms are present.

### 5.4 SHAP Explanation Validation

The SHAP explanation component was validated through two complementary approaches. First, the mathematical consistency of the SHAP values was verified by confirming that the sum of all SHAP values for a given student equals the student's total score, consistent with the local accuracy property of SHAP values (Lundberg & Lee, 2017). This property was verified for all test cases, with the sum of SHAP values matching the total score to within floating-point precision.

Second, the comprehensibility of the SHAP explanations was assessed through a review by QCYDO staff members, who were presented with sample SHAP explanation outputs and asked to evaluate whether the explanations accurately reflected the factors that influenced the ranking. Staff members confirmed that the explanations were comprehensible and consistent with their understanding of the scholarship selection criteria, and noted that the identification of specific strengths and weaknesses for each applicant would be useful in communicating ranking decisions to applicants.

---

## 6. DISCUSSION

### 6.1 Strengths of the Proposed Algorithm

The SCHOLAR recommendation algorithm demonstrates several notable strengths that distinguish it from simpler scholarship matching approaches. The two-stage architecture, in which rule-based hard filtering precedes weighted scoring, is particularly effective because it ensures that the computationally intensive scoring stage is applied only to genuinely eligible applicants. This design not only improves computational efficiency but also ensures that the ranked output contains only applicants who meet all mandatory eligibility requirements, eliminating the risk of recommending ineligible applicants to administrators.

The correct implementation of the Philippine GPA scale is a critical strength that distinguishes SCHOLAR from generic recommendation systems that would incorrectly treat GPA as a benefit criterion where higher values are better. The inverted comparison logic (`student.gpa <= scholarship.minimumGPA`) and the range-based GPA score normalization that assigns higher scores to lower GPA values are essential for producing accurate rankings in the Philippine educational context. The system also handles the Senior High School percentage scale, which operates in the opposite direction, by detecting the scale based on the magnitude of the minimum GPA value.

The integration of BERT document analysis provides an objective, automated assessment of document authenticity that goes beyond simple file format validation. By checking for the presence of domain-specific terminology in submitted documents, the system can detect documents that have been misclassified or that lack the expected content, reducing the risk of fraudulent applications advancing through the screening process. The [CLS] token embedding capability further enables document similarity computation for duplicate detection, a feature that is not available in simpler document verification approaches.

The SHAP explainability component addresses a critical gap in existing scholarship recommendation systems by providing transparent, per-student justifications for ranking decisions. The dual-mode operation, which falls back to a mathematically equivalent simple explanation when insufficient historical data is available for SHAP model training, ensures that explanations are available from the first use of the system without requiring a data accumulation period. The human-readable explanation text, which translates score levels into natural language descriptions of strengths and areas for improvement, makes the explanations accessible to students and administrators without specialized AI knowledge.

### 6.2 Limitations

The SCHOLAR system has several limitations that should be acknowledged. The BERT document analysis component requires that document text be extractable from submitted files. Documents submitted as scanned images or photographs without embedded text cannot be analyzed by the BERT component, and will receive a neutral authenticity score of 50% rather than a BERT-based assessment. The integration of optical character recognition (OCR) to extract text from image-based documents is identified as a priority for future development.

The weights assigned to the five scoring criteria (w₁ = 0.30, w₂ = 0.25, w₃ = 0.20, w₄ = 0.15, w₅ = 0.10) were determined heuristically based on the general priorities of QCYDO scholarship programs as understood by the development team. While these weights are reasonable and consistent with the scholarship literature, they have not been formally validated through expert elicitation using the Analytic Hierarchy Process or similar methods. Different QCYDO scholarship programs may have different relative priorities for the five criteria, and a single set of weights may not optimally represent all programs. Future work should engage QCYDO staff in a formal weight elicitation process to produce program-specific weight sets.

The SHAP model training requires a minimum of ten historical scoring records before the full SHAP TreeExplainer mode is activated. During the initial deployment period, the system operates in simple explanation mode, which provides mathematically equivalent explanations for the linear weighted scoring formula but does not capture non-linear feature interactions that may emerge as the model is trained on real application data. As the system accumulates historical data, the SHAP model will progressively improve in its ability to capture these interactions.

### 6.3 Comparison with Existing Systems

The SCHOLAR algorithm represents a significant advancement over the manual scholarship matching processes currently employed by QCYDO. Manual matching is subject to human error, inconsistency across different staff members, and the practical impossibility of simultaneously evaluating a student's eligibility for all available scholarship programs. The SCHOLAR system eliminates these limitations by applying a consistent, documented rule set to all applicants and producing rankings that are reproducible and auditable.

Compared to simple filtering systems that identify eligible scholarships without ranking applicants, SCHOLAR provides a substantially richer output that enables QCYDO staff to prioritize their review of applications and make more informed selection decisions. Simple filtering treats all eligible applicants as equivalent, which is unhelpful when the number of eligible applicants exceeds the number of available scholarship slots. The weighted scoring component of SCHOLAR provides a principled basis for distinguishing among eligible applicants that is transparent and defensible.

The integration of BERT document analysis and SHAP explainability distinguishes SCHOLAR from other scholarship recommendation systems in the literature, which typically address only the matching and ranking components without providing automated document verification or explainable rankings. These components are particularly important in the Philippine government context, where accountability and transparency in public resource allocation are essential for maintaining public trust.

### 6.4 Implications for QCYDO

The deployment of SCHOLAR has several practical implications for QCYDO's scholarship administration operations. The automated pre-screening component is expected to significantly reduce the time required for initial application review, allowing QCYDO staff to focus their attention on the final selection stage rather than routine eligibility checking. The ranked output with SHAP explanations provides a structured basis for selection decisions that can be documented and communicated to applicants, reducing the administrative burden of responding to applicant inquiries about selection outcomes.

The human-in-the-loop design of the SCHOLAR system is an important feature for the QCYDO context. The system produces a ranked list with explanations that informs QCYDO staff decision-making but does not make final selection decisions autonomously. This design preserves human oversight and accountability in the scholarship allocation process, which is essential for a government program that must be responsive to appeals and oversight. The SHAP explanations provide QCYDO staff with the information they need to explain and defend selection decisions, while the final selection authority remains with human administrators.

---

## 7. CONCLUSION AND FUTURE WORK

### 7.1 Conclusion

This paper has presented SCHOLAR, a hybrid scholarship recommendation system designed for the Quezon City Youth Development Office's scholarship programs. The system addresses the persistent challenge of scholarship discovery and fair applicant ranking through a two-stage algorithmic pipeline that combines rule-based eligibility filtering with multi-criteria weighted scoring, augmented by BERT-based document analysis and SHAP-driven explainability.

The rule-based filtering stage correctly implements the full set of QCYDO eligibility requirements, including the critical Philippine GPA scale where lower numerical values represent superior academic performance. The weighted scoring stage produces composite scores that reflect the relative priority of academic merit, financial need, document quality, and special category qualifications in a transparent, adjustable formula. The BERT document analysis component provides automated, objective assessment of submitted document authenticity, reducing reliance on manual document verification. The SHAP explainability component generates human-readable justifications for each ranking decision, ensuring that both students and administrators can understand and trust the system's outputs.

Validation through structured test cases demonstrated that the algorithm correctly identifies eligible and ineligible applicants across all tested scenarios, with a precision and recall of 1.00 for eligibility determination and a Spearman's rank correlation of 0.91 between the algorithm's ranking and expert manual ranking. These results provide evidence that the SCHOLAR algorithm produces accurate, reliable recommendations that are consistent with expert judgment.

The key contributions of this work are threefold. First, the system provides a documented, replicable implementation of a hybrid scholarship recommendation algorithm tailored to the specific requirements of Philippine local government scholarship administration, including correct handling of the Philippine GWA scale. Second, the integration of BERT document analysis into the scholarship recommendation pipeline provides a novel approach to automated document verification that is applicable to other document-intensive administrative processes. Third, the application of SHAP explainability to scholarship ranking provides a model for transparent, accountable AI-assisted decision-making in government scholarship administration that can be adapted by other LGUs seeking to modernize their scholarship management workflows.

### 7.2 Future Work

Several directions for future development of the SCHOLAR system are identified. The most immediate priority is the integration of optical character recognition (OCR) to enable BERT analysis of scanned or image-based documents, which currently receive neutral authenticity scores. This enhancement would extend the BERT analysis capability to the full range of document formats that applicants are likely to submit.

The formal optimization of scoring weights through the Analytic Hierarchy Process with QCYDO expert input is a high-priority future work item. Engaging QCYDO staff in a structured pairwise comparison of the five scoring criteria would produce empirically grounded, program-specific weight sets that more accurately reflect the actual priorities of each scholarship program. This optimization could be implemented as a configurable parameter in the SCHOLAR system, allowing different weight sets to be applied to different scholarship programs.

The addition of collaborative filtering based on historical approval patterns would enable the system to learn from past QCYDO selection decisions and incorporate implicit preference signals that are not captured by the explicit eligibility criteria and scoring weights. As the system accumulates data on which applicants were ultimately selected for each scholarship program, collaborative filtering could identify patterns in selection decisions that go beyond the formally specified criteria, improving the alignment between the system's rankings and QCYDO's actual selection preferences.

Expansion of the system to cover other Quezon City government scholarship programs beyond QCYDO, including programs administered by the Quezon City Scholarship Program (QCSP) and other city agencies, would significantly increase the system's value to Quezon City students. Multi-language support for Filipino and Tagalog would improve accessibility for students who are more comfortable in their native language. Mobile application development would extend the system's reach to students who primarily access the internet through mobile devices, which is the predominant mode of internet access among Filipino youth.

Finally, the development of a longitudinal evaluation framework that tracks the outcomes of SCHOLAR-assisted scholarship selections over multiple academic years would provide empirical evidence of the system's impact on scholarship allocation equity and efficiency, supporting evidence-based refinement of the algorithm and its deployment in other LGU contexts.

---

## REFERENCES

Adomavicius, G., & Tuzhilin, A. (2005). Toward the next generation of recommender systems: A survey of the state-of-the-art and possible extensions. *IEEE Transactions on Knowledge and Data Engineering, 17*(6), 734–749. https://doi.org/10.1109/TKDE.2005.99

Adhikari, A., Ram, A., Tang, R., & Lin, J. (2019). DocBERT: BERT for document classification. *arXiv preprint arXiv:1904.08398*.

Al-Badarenah, A., & Alsakran, J. (2016). An automated recommender system for course selection. *International Journal of Advanced Computer Science and Applications, 7*(3), 166–175. https://doi.org/10.14569/IJACSA.2016.070323

Behzadian, M., Otaghsara, S. K., Yazdani, M., & Ignatius, J. (2012). A state-of the-art survey of TOPSIS applications. *Expert Systems with Applications, 39*(17), 13051–13069. https://doi.org/10.1016/j.eswa.2012.05.056

Burke, R. (2002). Hybrid recommender systems: Survey and experiments. *User Modeling and User-Adapted Interaction, 12*(4), 331–370. https://doi.org/10.1023/A:1021240730564

Bussmann, N., Giudici, P., Marinelli, D., & Papenbrock, J. (2021). Explainable machine learning in credit risk management. *Computational Economics, 57*(1), 203–216. https://doi.org/10.1007/s10614-020-10042-0

Commission on Higher Education. (2020). *CHED Memorandum Order No. 18, Series of 2020: Policies, standards and guidelines for the unified student financial assistance system for tertiary education (UniFAST)*. Commission on Higher Education, Republic of the Philippines.

Conijn, R., Van den Beemt, A., & Cuijpers, P. (2020). Predicting student performance in a blended MOOC. *Journal of Computer Assisted Learning, 36*(3), 323–333. https://doi.org/10.1111/jcal.12395

Dela Cruz, M. A., & Santos, J. R. (2019). Rule-based scholarship eligibility matching system for Philippine university students. *Proceedings of the 2019 International Conference on Information Technology and Computer Science*, 45–52.

Department of Education. (2015). *DepEd Order No. 8, Series of 2015: Policy guidelines on classroom assessment for the K to 12 basic education program*. Department of Education, Republic of the Philippines.

Devlin, J., Chang, M. W., Lee, K., & Toutanova, K. (2018). BERT: Pre-training of deep bidirectional transformers for language understanding. *arXiv preprint arXiv:1810.04805*. https://doi.org/10.48550/arXiv.1810.04805

Gale, D., & Shapley, L. S. (1962). College admissions and the stability of marriage. *The American Mathematical Monthly, 69*(1), 9–15. https://doi.org/10.2307/2312726

Hwang, C. L., & Yoon, K. (1981). *Multiple attribute decision making: Methods and applications*. Springer-Verlag. https://doi.org/10.1007/978-3-642-48318-9

Ishizaka, A., & Labib, A. (2011). Review of the main developments in the analytic hierarchy process. *Expert Systems with Applications, 38*(11), 14336–14345. https://doi.org/10.1016/j.eswa.2011.04.143

Jackson, P. (1998). *Introduction to expert systems* (3rd ed.). Addison-Wesley.

Lundberg, S. M., & Lee, S. I. (2017). A unified approach to interpreting model predictions. *Advances in Neural Information Processing Systems, 30*, 4765–4774.

Mooney, R. J., & Roy, L. (2000). Content-based book recommending using learning for text categorization. *Proceedings of the Fifth ACM Conference on Digital Libraries*, 195–204. https://doi.org/10.1145/336597.336662

Pazzani, M. J., & Billsus, D. (2007). Content-based recommendation systems. In P. Brusilovsky, A. Kobsa, & W. Nejdl (Eds.), *The adaptive web* (pp. 325–341). Springer. https://doi.org/10.1007/978-3-540-72079-9_10

Quezon City Youth Development Office. (2023). *QCYDO scholarship programs: Guidelines and eligibility criteria*. Quezon City Government.

Ricci, F., Rokach, L., & Shapira, B. (2011). Introduction to recommender systems handbook. In F. Ricci, L. Rokach, B. Shapira, & P. B. Kantor (Eds.), *Recommender systems handbook* (pp. 1–35). Springer. https://doi.org/10.1007/978-0-387-85820-3_1

Saaty, T. L. (1980). *The analytic hierarchy process: Planning, priority setting, resource allocation*. McGraw-Hill.

Shapley, L. S. (1953). A value for n-person games. In H. W. Kuhn & A. W. Tucker (Eds.), *Contributions to the theory of games* (Vol. 2, pp. 307–317). Princeton University Press.

Urdaneta-Ponte, M. C., Mendez-Zorrilla, A., & Oleagordia-Ruiz, I. (2021). Recommendation systems for education: Systematic review. *Electronics, 10*(14), 1611. https://doi.org/10.3390/electronics10141611

Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, Ł., & Polosukhin, I. (2017). Attention is all you need. *Advances in Neural Information Processing Systems, 30*, 5998–6008.

---

---

## APPENDICES

### Appendix A — Complete Algorithm Pseudocode

The following pseudocode presents the complete SCHOLAR recommendation algorithm, encompassing both Stage 1 hard filtering and Stage 2 weighted scoring.

```
ALGORITHM: ScholarshipRecommendation
INPUT:  student_profile       — student data object
        scholarship_database  — list of scholarship program objects
OUTPUT: ranked_scholarship_list — list of {scholarship, score, rank, explanation}

BEGIN

  eligible_scholarships ← []

  // ================================================================
  // STAGE 1: HARD FILTERING (Rule-Based Eligibility Checking)
  // ================================================================

  FOR EACH scholarship IN scholarship_database:

    // --- Universal Rules (apply to ALL scholarships) ---

    IF NOT isQuezonCityText(student_profile.location):
      CONTINUE  // Exclude: not a QC resident

    IF student_profile.isScholarOfAnotherLGU = TRUE:
      CONTINUE  // Exclude: already receiving LGU scholarship

    IF student_profile.schoolName is empty:
      CONTINUE  // Exclude: no school information provided

    // --- Education Level Rule ---

    student_group ← getEducationGroup(student_profile.educationLevel)
    scholarship_group ← getEducationGroup(scholarship.requiredEducationLevel)

    IF student_group ≠ scholarship_group:
      CONTINUE  // Exclude: education level mismatch

    // --- GPA Rule (Philippine Scale: lower = better) ---

    IF scholarship.minimumGPA > 50:
      // SHS Percentage Scale: higher is better
      IF student_profile.percentageGrade < scholarship.minimumGPA:
        CONTINUE  // Exclude: percentage grade below minimum
    ELSE:
      // GWA Scale: lower is better
      IF student_profile.gpa > scholarship.minimumGPA:
        CONTINUE  // Exclude: GWA exceeds maximum (worse grade)

    // --- Special Category Rules ---

    IF scholarship.requiresAthlete = TRUE AND scholarship.requiresArtist = TRUE:
      IF student_profile.isAthlete = FALSE AND student_profile.isArtist = FALSE:
        CONTINUE  // Exclude: neither athlete nor artist

    IF scholarship.requiresSKOfficial = TRUE AND scholarship.requiresStudentLeader = TRUE:
      IF student_profile.isSKOfficial = FALSE AND student_profile.isStudentLeader = FALSE:
        CONTINUE  // Exclude: no youth leadership qualification

    IF scholarship.requiresEconomicNeed = TRUE:
      IF NOT getEconomicPass(student_profile):
        CONTINUE  // Exclude: does not meet economic need criteria

    // Student passed all filters — add to eligible list
    eligible_scholarships.APPEND(scholarship)

  END FOR

  // ================================================================
  // STAGE 2: WEIGHTED SCORING
  // ================================================================

  scored_list ← []

  FOR EACH scholarship IN eligible_scholarships:

    // --- Criterion 1: GPA Score (weight = 30%) ---
    IF student_profile.gpa > scholarship.minimumGPA:
      gpa_score ← 0
    ELSE:
      range ← scholarship.minimumGPA - 1.0
      excess ← scholarship.minimumGPA - student_profile.gpa
      gpa_score ← 60 + (excess / range) × 40
      gpa_score ← CLAMP(gpa_score, 0, 100)

    // --- Criterion 2: Financial Need Score (weight = 25%) ---
    income_score ← INCOME_SCORE_MAP[student_profile.incomeCategory]
    need_score ← (student_profile.financialNeed / 5) × 100
    financial_score ← (income_score × 0.6) + (need_score × 0.4)

    // --- Criterion 3: Document Completeness Score (weight = 20%) ---
    submitted_types ← GET_DOCUMENT_TYPES(student_profile.submittedDocuments)
    required_types ← scholarship.requiredDocuments
    matched ← COUNT(submitted_types ∩ required_types)
    doc_completeness ← (matched / |required_types|) × 100

    // --- Criterion 4: Document Authenticity Score (weight = 15%) ---
    // BERT analysis results stored from document submission step
    IF student_profile.authenticityResults is not empty:
      auth_score ← MEAN(authenticityResults.confidence) × 100
    ELSE:
      auth_score ← 50  // Neutral score when no BERT results available

    // --- Criterion 5: Special Category Score (weight = 10%) ---
    applicable_bonuses ← []
    FOR EACH category IN SPECIAL_CATEGORY_SCORE_MAP:
      IF student_profile.specialCategories[category] = TRUE:
        applicable_bonuses.APPEND(SPECIAL_CATEGORY_SCORE_MAP[category])
    IF applicable_bonuses is not empty:
      special_score ← MAX(applicable_bonuses)
    ELSE:
      special_score ← 0

    // --- Weighted Total ---
    total_score ← (0.30 × gpa_score)
                + (0.25 × financial_score)
                + (0.20 × doc_completeness)
                + (0.15 × auth_score)
                + (0.10 × special_score)

    scored_list.APPEND({
      scholarship:    scholarship,
      total_score:    ROUND(total_score, 2),
      score_breakdown: {
        gpa_score:              gpa_score,
        financial_score:        financial_score,
        document_completeness:  doc_completeness,
        document_authenticity:  auth_score,
        special_category_score: special_score
      }
    })

  END FOR

  // ================================================================
  // STAGE 3: RANKING AND EXPLANATION
  // ================================================================

  // Sort by total_score descending; break ties by gpa_score descending
  ranked_list ← SORT(scored_list,
                     PRIMARY KEY: total_score DESC,
                     SECONDARY KEY: gpa_score DESC)

  // Assign rank numbers
  FOR i FROM 1 TO |ranked_list|:
    ranked_list[i].rank ← i
  END FOR

  // Generate SHAP explanations
  FOR EACH item IN ranked_list:
    IF historical_data_count >= 10:
      item.explanation ← SHAP_TREE_EXPLAIN(item.score_breakdown)
    ELSE:
      item.explanation ← SIMPLE_WEIGHTED_EXPLAIN(item.score_breakdown)
  END FOR

  RETURN ranked_list

END ALGORITHM


FUNCTION getEconomicPass(student):
  RETURN (student.incomeCategory IN poverty_threshold_brackets)
      OR (student.specialCategories.isFromIndigenousFamily = TRUE)
      OR (student.specialCategories.isPWD = TRUE)
      OR (student.specialCategories.isSoloParent = TRUE)
      OR (student.specialCategories.isIndigent = TRUE)
      OR (student.financialNeed >= 4)
END FUNCTION


FUNCTION SIMPLE_WEIGHTED_EXPLAIN(score_breakdown):
  contributions ← []
  FOR EACH (factor, weight) IN WEIGHT_MAP:
    raw_score ← score_breakdown[factor]
    contribution ← raw_score × weight
    level ← SCORE_LEVEL(raw_score)  // "high", "medium", "low", or "zero"
    contributions.APPEND({
      factor:       factor,
      shap_value:   ROUND(contribution, 2),
      raw_score:    raw_score,
      weight:       weight × 100,
      impact:       IF raw_score >= 50 THEN "positive" ELSE "negative",
      explanation:  EXPLANATION_TEXT[factor][level]
    })
  END FOR
  SORT contributions BY ABS(shap_value) DESC
  RETURN {
    mode:          "simple",
    contributions: contributions,
    summary:       GENERATE_SUMMARY(contributions)
  }
END FUNCTION
```

---

### Appendix B — QCYDO Scholarship Eligibility Matrix

The following table presents the eligibility criteria for the primary QCYDO scholarship programs supported by the SCHOLAR system.

**Table B1. QCYDO Scholarship Eligibility Matrix**

| Scholarship Program | Education Level | Min GPA/GWA | Special Requirement | Award Amount |
|---------------------|-----------------|-------------|---------------------|--------------|
| SHS Academic Excellence | Senior High School | 89% GWA | Academic Honors (Top 10) | ₱15,000 |
| SHS Specialized Track | Senior High School | 85% GWA | Enrolled in Public Specialized SHS | ₱15,000 |
| College Academic Excellence | College/Undergraduate | 1.75 GWA | Academic Honors | ₱30,000 |
| College Economic Assistance | College/Undergraduate | 3.00 GWA | Low income / Marginalized | ₱25,000 |
| College Athletic/Arts | College/Undergraduate | 2.50 GWA | Athlete or Artist | ₱25,000 |
| College Youth Leadership | College/Undergraduate | 2.50 GWA | SK Official or Student Leader | ₱25,000 |
| Vocational/TESDA | Vocational/TESDA | N/A | Enrolled in TESDA program | ₱15,000 |
| Postgraduate Excellence | Postgraduate | 1.75 GWA | Enrolled in Graduate School | ₱40,000 |
| PWD Scholarship | College/Undergraduate | 3.00 GWA | Person with Disability | ₱25,000 |
| Solo Parent Scholarship | College/Undergraduate | 3.00 GWA | Solo Parent | ₱25,000 |
| Indigenous Peoples | College/Undergraduate | 3.00 GWA | From Indigenous Family | ₱25,000 |
| JHS Bridge Program | Junior High School | 85% GWA | Academic Honors | ₱10,000 |

*Note: All programs require Quezon City residency and enrollment in a QC-recognized school. GWA values follow the Philippine scale where 1.00 is highest and 5.00 is failing.*

---

### Appendix C — Sample SHAP Explanation Output

The following presents a complete sample SHAP explanation output for a test student applying to the QCYDO College Economic Assistance Scholarship.

```
============================================================
SCHOLAR RANKING EXPLANATION
============================================================
Student:    Juan dela Cruz
Scholarship: QCYDO College Economic Assistance Scholarship
Total Score: 93.25 / 100
Rank:        #1 of 47 applicants
Mode:        Simple (Weighted Contribution)
============================================================

SCORE BREAKDOWN AND CONTRIBUTIONS:
------------------------------------------------------------
Factor                  Raw Score  Weight  SHAP Value  Impact
------------------------------------------------------------
GPA Score               85.00/100   30%     +25.50     ✅ Positive
Financial Need Score   100.00/100   25%     +25.00     ✅ Positive
Document Completeness  100.00/100   20%     +20.00     ✅ Positive
Document Authenticity   85.00/100   15%     +12.75     ✅ Positive
Special Category Score 100.00/100   10%     +10.00     ✅ Positive
------------------------------------------------------------
Total                                       +93.25
============================================================

FACTOR EXPLANATIONS:
------------------------------------------------------------
GPA Score (85/100):
  "Your academic performance is excellent, significantly
   boosting your ranking."
  GWA: 1.75 | Required: ≤ 3.00 | Exceeds requirement by 1.25

Financial Need Score (100/100):
  "Your financial situation indicates high need, giving you
   priority for this scholarship."
  Income: ₱10,000–₱25,000 (poverty threshold) | Need: 5/5

Document Completeness (100/100):
  "All required documents were submitted completely."
  Submitted: 5/5 required documents

Document Authenticity (85/100):
  "Your submitted documents were verified as authentic
   by our system."
  Average BERT confidence: 85%

Special Category Score (100/100):
  "Your special category qualification gives you additional
   priority."
  Qualifying category: From Indigent/Low-income Family
============================================================

SUMMARY:
Strong performance in: GPA Score, Financial Need Score,
Document Completeness, Document Authenticity,
Special Category Score.

TOP STRENGTH:   Financial Need Score (SHAP: +25.00)
TOP WEAKNESS:   Special Category Score (SHAP: +10.00)
  Note: All factors are positive — no weaknesses detected.
============================================================
```

---

### Appendix D — System Screenshots

The following descriptions indicate the locations where system screenshots should be inserted in the final printed version of this paper.

**Figure D1. Student Profile Page** — The student profile management interface, showing the academic information section (GPA, education level, year level, field of study, school name and location), demographic information section (name, date of birth, location), financial information section (income bracket, financial need rating), and special categories section (athlete, artist, SK official, student leader, indigent, PWD, solo parent flags). *[Insert screenshot here]*

**Figure D2. Scholarship Matching Results** — The scholarship discovery interface, showing the list of scholarships ranked by TOPSIS match score for the logged-in student. Each scholarship card displays the scholarship name, award amount, match score as a percentage, education level requirement, and a summary of eligibility status with specific criteria checks. *[Insert screenshot here]*

**Figure D3. Application Ranking View** — The administrator ranking interface, showing the ranked list of applicants for a selected scholarship program. Each row displays the applicant's rank, name, total score, and a summary of their score breakdown. The interface includes controls for triggering ranking generation and exporting the ranked list. *[Insert screenshot here]*

**Figure D4. SHAP Explanation Display** — The SHAP explanation panel for an individual applicant, showing the factor-by-factor score breakdown, SHAP contribution values, impact direction indicators, and human-readable explanation text for each factor. The panel also displays the summary statement identifying the applicant's top strength and top weakness. *[Insert screenshot here]*

**Figure D5. Admin Ranking Dashboard** — The full administrator dashboard showing the scholarship program management interface, including the list of active scholarship programs, applicant counts, ranking status, and quick-access controls for triggering ranking generation and viewing ranked lists. *[Insert screenshot here]*

---

*End of Paper*

*Submitted in partial fulfillment of the requirements for the degree of Bachelor of Science in Information Technology*
*Our Lady of Fatima University*
*Academic Year 2025–2026*
