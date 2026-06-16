# ChildFlow Security & Compliance Requirements

This document outlines the necessary security and privacy protocols to comply with HIPAA, FERPA, and Head Start Program Performance Standards (45 CFR 1303 Subpart C).

## 1. Regulatory Frameworks

- **HIPAA (Health Insurance Portability and Accountability Act)**: Applies to Protected Health Information (PHI) in the Health module.
- **FERPA (Family Educational Rights and Privacy Act)**: Applies to student education records. Programs receiving Department of Education funds must comply with FERPA.
- **Head Start Program Performance Standards (45 CFR 1303 Subpart C)**: Protects Personally Identifiable Information (PII) in child records.
- **COPPA (Children's Online Privacy Protection Act)**: Applies to data collection from children under 13.

## 2. Technical Safeguards

### Authentication & Access Control
- **Multi-Factor Authentication (MFA)**: Highly recommended for staff and admin accounts.
- **Role-Based Access Control (RBAC)**: Enforce strict access based on roles (Admin, Teacher, Assistant, Coordinator, Parent).
- **Session Management**: Implement automatic session timeouts (e.g., 15-30 minutes of inactivity).
- **Secure Token Storage**:
    - **iOS**: Use **Keychain** instead of `UserDefaults`.
    - **Web**: Use **HttpOnly, Secure, SameSite=Strict** cookies.

### Data Protection
- **Encryption in Transit**: Enforce TLS 1.2+ for all API communications.
- **Encryption at Rest**: Sensitive data (PHI/PII) should be encrypted in the database.
- **Audit Logging**: Maintain a record of all access, modifications, and deletions of PII/PHI.

## 3. Administrative Safeguards
- **Parental Consent**: Obtain written, signed, and dated consent before disclosing PII (electronic signatures are acceptable if authenticated).
- **Annual Notice**: Programs must annually notify parents of their rights regarding child records.
- **Data Retention**: Retain records only as long as necessary and dispose of them securely.

## 4. Identified Gaps in ChildFlow
1. **iOS**: Authentication gate is currently disabled in `ChildFlowApp.swift`.
2. **iOS**: `authToken` is stored in `UserDefaults` instead of `Keychain`.
3. **Backend**: Missing a dedicated audit logging system for PII access.
4. **Backend**: RBAC is partially implemented but needs stricter enforcement across all routers.
5. **Database**: No explicit encryption at rest for sensitive fields (notes, health records).
