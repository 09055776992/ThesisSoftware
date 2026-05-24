# Scope and Delimitation of the System

## System Overview

The Explainable AI-driven Scholarship Matching Dashboard is an intelligent web-based decision support system designed to streamline the scholarship allocation process by leveraging advanced algorithmic matching and interpretable machine learning techniques. The system serves as a centralized platform that bridges the gap between scholarship applicants and scholarship providers, particularly targeting government-sponsored educational assistance programs such as those administered by the Quezon City Youth Development Office.

The primary purpose of this system is to automate the complex task of matching qualified students with appropriate scholarship opportunities while providing transparent, human-readable explanations for the matching decisions. By integrating student academic profiles, financial need assessments, and scholarship eligibility criteria into a unified framework, the system aims to enhance efficiency, reduce administrative burden, and ensure equitable access to educational financial aid. The platform operates on the principle of transparency-driven artificial intelligence, where every recommendation is accompanied by a clear rationale that can be understood by students, administrators, and institutional stakeholders alike.

## Scope of the System (Functional Features)

The scope of this research encompasses the design, development, and implementation of a comprehensive scholarship matching ecosystem with the following core functional capabilities:

### 1. Comprehensive User Profile Management Module

The system implements a robust user profile management framework that captures and maintains detailed student demographic, academic, and socioeconomic information. This module specifically collects and processes:

- **Academic Performance Metrics**: Student Grade Point Average (GPA) or General Weighted Average (GWA) as primary academic qualification indicators.
- **Financial Status Profiling**: Detailed household income documentation, sources of financial support (e.g., parental employment, existing scholarships, family contributions), and economic dependency indicators including the number of household dependents.
- **Educational Background**: Current enrollment status, program of study, year level, and institutional affiliation.
- **Categorical Eligibility Flags**: Special qualification categories such as athletic participation, artistic talent, student leadership roles, Person with Disability (PWD) status, solo parent status, indigent classification, and government employee dependents.

The profile management system ensures data integrity, supports document upload capabilities for verification purposes, and maintains secure storage of sensitive personal and financial information in compliance with data privacy standards.

### 2. Dynamic Ranking and Optimization Engine

At the core of the system lies a sophisticated matching algorithm built upon the **Gale-Shapley (Deferred Acceptance) stable matching algorithm**, a Nobel Prize-winning mechanism that guarantees stable, optimal pairings between students and scholarship programs. This engine provides:

- **Stable Matching Computation**: Ensures that no student-scholarship pair would prefer each other over their assigned matches, preventing mutually beneficial deflections.
- **Multi-Criteria Evaluation**: Considers both student preferences (ranked scholarship choices) and scholarship provider priorities (eligibility requirements, quota constraints, and selection criteria).
- **Financial Need Optimization**: When a student qualifies for multiple scholarship opportunities, the system applies an intelligent optimization layer that recommends the single best option based on maximizing financial relief. The algorithm calculates this by analyzing the student's household income level, number of economic dependents, and the comparative monetary value of each scholarship award.
- **Priority-Based Allocation**: Handles complex scenarios including limited scholarship slots, waiting list management, and fair distribution across different demographic segments.

### 3. Explainable AI Component Using SHAP Values

The system integrates **SHAP (SHapley Additive exPlanations)** methodology, a game-theoretic approach to machine learning interpretability, to provide transparent and mathematically grounded explanations for matching decisions. This component delivers:

- **Visual Attribution Breakdowns**: Interactive visualizations that decompose the student's match percentage into individual contributing factors, clearly illustrating how each academic and financial attribute influenced the outcome.
- **Feature Importance Analysis**: Quantitative assessment of which variables (e.g., GPA magnitude, household income bracket, number of dependents, special category status) most significantly impacted the matching score.
- **Counterfactual Insights**: Explanations that demonstrate how changes in specific attributes would affect matching outcomes, enabling students to understand potential areas for improvement.
- **Multi-Stakeholder Transparency**: Explanations tailored for different audiences—students receive personalized insights about their own profiles, while administrators gain aggregate understanding of algorithmic decision patterns across the applicant pool.

### 4. Administrative Control and Scholarship Management Interface

The system provides comprehensive administrative capabilities designed for scholarship providers and institutional administrators, including:

- **Criteria Configuration**: Flexible tools for defining and modifying scholarship eligibility parameters, including academic thresholds, financial need brackets, categorical requirements, and demographic quotas.
- **Scholarship Lifecycle Management**: Full CRUD (Create, Read, Update, Delete) operations for scholarship program definitions, including budget allocation, slot availability, application deadlines, and status transitions (Active/Closed/Suspended).
- **Applicant Review and Verification Workflow**: Structured interfaces for reviewing student submissions, tracking verification statuses, and managing approval workflows.
- **Real-Time Synchronization**: Seamless data synchronization between administrative operations and student-facing displays, ensuring that updates to scholarship criteria or availability are immediately reflected across the platform.
- **Reporting and Analytics**: Dashboard visualizations and exportable reports on application statistics, matching outcomes, fund utilization, and demographic distribution of award recipients.

### 5. Integration Architecture

The system is architected as a full-stack web application with:
- **Backend Services**: RESTful API architecture handling business logic, database operations, and algorithmic computations.
- **Frontend Interface**: Responsive web interfaces optimized for both student applicants and administrative users.
- **Database Layer**: Persistent storage for user profiles, scholarship definitions, matching results, and audit trails.
- **Security Framework**: Authentication, authorization, and data protection mechanisms ensuring authorized access and privacy compliance.

## Delimitations of the System

To establish clear research boundaries and manage expectations regarding system capabilities, the following delimitations define what the system explicitly does not encompass:

### 1. Financial Disbursement and Budgetary Authority

The Explainable AI-driven Scholarship Matching Dashboard operates strictly as a **matching and recommendation platform** and does not possess legal or operational authority to disburse funds, execute monetary banking transactions, or automatically approve government or institutional budgets. Specifically:

- **No Financial Transaction Processing**: The system does not handle actual money transfers, bank account debits/credits, payment gateway integrations, or electronic fund transfers to student recipients.
- **No Budgetary Approval Authority**: Recommendations generated by the system serve as decision support inputs for human administrators and institutional finance officers; final budget allocation and fiscal approval remain under the exclusive authority of designated governmental or organizational entities.
- **No Legal Contract Generation**: While the system facilitates matching, it does not generate legally binding scholarship contracts, award letters with fiscal commitments, or official disbursement authorizations. These remain the purview of the sponsoring institutions' administrative and legal departments.

### 2. Document Authenticity and Background Verification

The system processes student-provided data based on the information submitted through the platform but explicitly excludes comprehensive background verification and document authenticity validation:

- **Input-Based Processing**: The matching algorithm operates on the assumption that submitted documents (transcripts, income certificates, identification papers, and supporting evidence) are accurate and authentic as provided by the applicant.
- **External Verification Responsibility**: Background verification of submitted documents—including authenticity checks, fraud detection, cross-referencing with issuing institutions, and field validation of financial claims—is handled externally or manually by designated scholarship handlers, verification officers, or third-party audit services.
- **No Document Forensics**: The system does not implement advanced forensic document analysis, digital signature validation, or anti-fraud detection mechanisms beyond basic format and completeness checks.

### 3. External Data Integration and Real-Time Web Scraping

The algorithmic optimization and matching capabilities of the system are localized to the internal database and do not extend to live external data sources:

- **Closed Database Architecture**: The system relies exclusively on scholarship criteria, provider profiles, and student data that have been manually entered, imported, or pre-loaded into the system database. It does not fetch, aggregate, or integrate data from un-integrated third-party sources.
- **No Real-Time Web Integration**: The platform does not perform live web scraping, API calls to external scholarship databases, real-time job market lookups, or dynamic retrieval of opportunities from national scholarship portals, educational websites, or employment platforms.
- **Manual Data Maintenance**: Addition of new scholarship programs, updates to external institutional criteria, or synchronization with third-party scholarship listings require manual administrative input or batch import processes rather than automated synchronization pipelines.

### 4. Geographic and Institutional Scope

While the system is designed with flexibility to accommodate various scholarship providers, the research implementation and validation are focused on:
- **Localized Deployment Context**: Initial deployment and testing target specific institutional environments, particularly Quezon City government scholarship programs, with adaptation to other contexts requiring configuration adjustments.
- **Single-Platform Architecture**: The system operates as a standalone platform and does not integrate with legacy student information systems, national ID databases, or government financial aid infrastructures unless explicitly configured through custom integration modules.

### 5. Non-Academic Factors and Holistic Assessment

The matching algorithm focuses on quantifiable academic and financial metrics and does not evaluate:
- **Subjective Qualitative Factors**: Personal essays, recommendation letters, interview performance, extracurricular involvement quality, or other non-quantifiable assessment criteria are not processed by the algorithmic matching engine.
- **Psychosocial or Behavioral Analytics**: The system does not incorporate personality assessments, behavioral predictions, or psychometric profiling in its matching computations.

---

These scope boundaries ensure that the research remains focused on the core contributions of explainable algorithmic matching while establishing realistic expectations regarding operational autonomy, verification responsibilities, and data integration capabilities. The system is positioned as an intelligent decision-support tool that augments human administrative judgment rather than replacing institutional oversight, fiscal governance, or verification protocols.
