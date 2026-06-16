# Sprout Privacy Policy

**Effective Date:** June 10, 2026

> **Note:** This document is a starting template. Security claims below describe
> safeguards actually implemented in the application as of the effective date.
> Before publishing, have your program's Privacy Officer and legal counsel
> review it, and confirm that the infrastructure-level and organizational
> controls referenced (at-rest database encryption, business-associate
> agreements, staff training, retention procedures) are in place for your
> deployment.

Sprout is committed to protecting the privacy and security of the children,
families, and staff we serve. This Privacy Policy describes how we collect, use,
and safeguard personal information in support of HIPAA, FERPA, and Head Start
Program Performance Standards.

## 1. Information We Collect

- **Child Records:** name, date of birth, gender, language, and enrollment status.
- **Health Information (PHI):** immunization records, health screenings (physical, dental, vision, hearing), and allergies.
- **Family Information:** parent names, contact information, and home-visit logs.
- **Staff Information:** name, role, contact information, and training hours.
- **Usage Data:** information about how the app is used, for audit and security purposes.

## 2. How We Use Your Information

- Manage child enrollment and attendance.
- Track and report on child health and development.
- Facilitate communication between staff and families.
- Support compliance with federal and state regulations (e.g., PIR reporting).
- Improve program quality and outcomes.

## 3. Data Protection & Security

We implement technical and administrative safeguards, including:

- **Encryption in transit:** all network communication uses HTTPS/TLS. App
  Transport Security is enforced on mobile clients so connections to program
  servers must be encrypted.
- **Access control:** every request is authenticated. Access is governed by
  role-based controls, and administrative actions (managing staff, bulk record
  changes) are restricted to administrator accounts.
- **Audit logging:** access to, and changes of, child and health records — along
  with sign-in attempts and denied-access attempts — are recorded with the
  acting user, the action, the affected record, a timestamp, and source IP.
- **Secure credential storage:** on mobile devices, the session token is stored
  in the hardware-protected iOS Keychain (device-only, excluded from backups),
  with optional Face ID / Touch ID to unlock an existing session.
- **Session timeouts:** browser sessions expire after 30 minutes of inactivity.
  Mobile sign-ins expire after 12 hours, and the app locks itself after
  15 minutes in the background, requiring biometric or password re-entry.
- **Data at rest:** records are held in access-controlled databases. At-rest
  encryption is configured at the infrastructure level for each deployment and
  is the responsibility of the hosting program.

> These technical safeguards *support* HIPAA and FERPA requirements but do not by
> themselves constitute compliance. Compliance also depends on business-associate
> agreements, written policies, staff training, and infrastructure controls
> configured by your program.

## 4. Disclosure of Information

We do not sell personal information. Information is disclosed only:

- With written parental consent.
- To authorized program officials and contractors who require access to perform their duties.
- To federal and state agencies for compliance audits and evaluations.
- In emergencies, to protect the health or safety of children or staff.

## 5. Parental Rights

Under FERPA and Head Start standards, parents have the right to:

- Inspect and review their child's education and health records.
- Request amendments to inaccurate or misleading information.
- Provide or revoke consent for data disclosure, except where disclosure is required by law or to protect health and safety.

## 6. Contact Us

If you have questions about this Privacy Policy or our data practices, please
contact our Privacy Officer:

- **Email:** privacy@childflow.org
- **Address:** Sprout, 47 Lovell Ave, Windsor, CT 06096
