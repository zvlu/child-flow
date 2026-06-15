import SwiftUI

// MARK: - Sprout Design System
// Primary:   Teal   #006D77  — trust, growth, professional edtech
// Accent:    Coral  #FF6B5E  — energy, warmth, CTAs
// Semantic module colors follow the 60-30-10 rule:
//   60% neutral backgrounds, 30% primary teal, 10% accent/semantic pops

// MARK: - Hex Color Init
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:  (a, r, g, b) = (255, (int >> 8)*17, (int >> 4 & 0xF)*17, (int & 0xF)*17)
        case 6:  (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:  (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default: (a, r, g, b) = (255, 0, 109, 119)
        }
        self.init(.sRGB,
                  red:     Double(r) / 255,
                  green:   Double(g) / 255,
                  blue:    Double(b) / 255,
                  opacity: Double(a) / 255)
    }
}

// MARK: - Brand Colors
extension Color {
    // Primary — Sage green: calm, natural growth
    static let cfPrimary      = Color(hex: "4F7C5D")
    static let cfPrimaryLight = Color(hex: "E7F0E9")  // soft sage tint for backgrounds
    static let cfPrimaryDark  = Color(hex: "3C5E47")  // deeper sage for pressed states

    // Accent — Soft peach: warmth, CTAs (deep enough for white text)
    static let cfAccent       = Color(hex: "C96E47")
    static let cfAccentLight  = Color(hex: "FCEDE6")  // soft peach tint

    // Semantic module colors — kept distinct for wayfinding, warmed for cream
    static let cfChildren     = Color(hex: "3F7CB8")  // Blue — people, children
    static let cfChildrenBg   = Color(hex: "E8F1FA")

    static let cfAttendance   = Color(hex: "4E9E6A")  // Green — success, growth
    static let cfAttendanceBg = Color(hex: "E9F4EC")

    static let cfHealth       = Color(hex: "D65745")  // Warm red — health, urgency
    static let cfHealthBg     = Color(hex: "FBEAE7")

    static let cfCompliance   = Color(hex: "8A6BC4")  // Purple — compliance
    static let cfComplianceBg = Color(hex: "F1ECFA")

    static let cfFamily       = Color(hex: "D98A2B")  // Amber — family warmth
    static let cfFamilyBg     = Color(hex: "FBF0DD")

    static let cfGoals        = Color(hex: "2F8F8F")  // Teal — progress, goals
    static let cfGoalsBg      = Color(hex: "E3F2F1")

    // Neutrals — warm cream
    static let cfBackground   = Color(hex: "FBF6EE")  // App background (cream)
    static let cfSurface      = Color.white            // Card surface
    static let cfBorder       = Color(hex: "EAE0D2")  // Warm dividers

    // Text — warm charcoal
    static let cfTextPrimary  = Color(hex: "2E2A26")  // Warm charcoal — high contrast
    static let cfTextSecondary = Color(hex: "6E6358") // Warm taupe — labels

    // Status
    static let cfSuccess      = Color(hex: "4E9E6A")
    static let cfWarning      = Color(hex: "D98A2B")
    static let cfError        = Color(hex: "D65745")
    static let cfInfo         = Color(hex: "3F7CB8")

    // Color-coded child flags — allergy / dietary / disability / special need
    static let cfFlagAllergy      = Color(hex: "C0392B")
    static let cfFlagAllergyBg    = Color(hex: "FBEAEA")
    static let cfFlagDietary      = Color(hex: "B5740F")
    static let cfFlagDietaryBg    = Color(hex: "FBF0DD")
    static let cfFlagDisability   = Color(hex: "4A4F9E")
    static let cfFlagDisabilityBg = Color(hex: "ECECF8")
    static let cfFlagSpecial      = Color(hex: "1F6FB2")
    static let cfFlagSpecialBg    = Color(hex: "E8F1FA")
}

// MARK: - Typography Scale
extension Font {
    static let cfLargeTitle  = Font.system(size: 28, weight: .bold,   design: .rounded)
    static let cfTitle       = Font.system(size: 22, weight: .bold,   design: .rounded)
    static let cfTitle2      = Font.system(size: 18, weight: .semibold, design: .rounded)
    static let cfHeadline    = Font.system(size: 16, weight: .semibold, design: .default)
    static let cfBody        = Font.system(size: 15, weight: .regular, design: .default)
    static let cfSubheadline = Font.system(size: 14, weight: .medium,  design: .default)
    static let cfCaption     = Font.system(size: 12, weight: .regular, design: .default)
    static let cfCaption2    = Font.system(size: 11, weight: .medium,  design: .default)
}

// MARK: - Shadow Styles
extension View {
    func cfCardShadow() -> some View {
        self.shadow(color: Color.black.opacity(0.06), radius: 8, x: 0, y: 2)
    }
    func cfSubtleShadow() -> some View {
        self.shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 1)
    }
}

// MARK: - Reusable Components

/// Pill-shaped status badge — replaces HealthStatusBadge, use everywhere
struct CFBadge: View {
    let label: String
    let color: Color

    var body: some View {
        Text(label)
            .font(.cfCaption2)
            .fontWeight(.semibold)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(color.opacity(0.12))
            .foregroundColor(color)
            .clipShape(Capsule())
    }
}

/// Top-accent stat card used on Dashboard
struct CFStatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    let backgroundColor: Color
    var trend: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Colored top strip
            Rectangle()
                .fill(color)
                .frame(height: 3)
                .clipShape(UnevenRoundedRectangle(
                    topLeadingRadius: 14, bottomLeadingRadius: 0,
                    bottomTrailingRadius: 0, topTrailingRadius: 14
                ))

            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top) {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(backgroundColor)
                        .frame(width: 36, height: 36)
                        .overlay {
                            Image(systemName: icon)
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundColor(color)
                        }
                    Spacer()
                    if let trend {
                        Text(trend)
                            .font(.cfCaption2)
                            .foregroundColor(.cfTextSecondary)
                    }
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(value)
                        .font(.cfTitle)
                        .foregroundColor(.cfTextPrimary)
                    Text(title)
                        .font(.cfCaption)
                        .foregroundColor(.cfTextSecondary)
                }
            }
            .padding(14)
        }
        .background(Color.cfSurface)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .cfCardShadow()
    }
}

/// Primary CTA button in coral
struct CFPrimaryButton: View {
    let label: String
    let icon: String?
    let action: () -> Void

    init(_ label: String, icon: String? = nil, action: @escaping () -> Void) {
        self.label = label
        self.icon = icon
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .semibold))
                }
                Text(label)
                    .font(.cfSubheadline)
                    .fontWeight(.semibold)
            }
            .foregroundColor(.white)
            .padding(.horizontal, 18)
            .padding(.vertical, 11)
            .background(Color.cfAccent)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .cfSubtleShadow()
        }
    }
}

/// Secondary / outlined button in teal
struct CFSecondaryButton: View {
    let label: String
    let icon: String?
    let action: () -> Void

    init(_ label: String, icon: String? = nil, action: @escaping () -> Void) {
        self.label = label
        self.icon = icon
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 13, weight: .semibold))
                }
                Text(label)
                    .font(.cfSubheadline)
            }
            .foregroundColor(.cfPrimary)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color.cfPrimaryLight)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay {
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(Color.cfPrimary.opacity(0.3), lineWidth: 1)
            }
        }
    }
}

/// Alert / info banner row used on Dashboard
struct CFAlertRow: View {
    let alert: ProgramAlert
    /// Show a trailing chevron when the row is wrapped in a NavigationLink.
    var showsChevron: Bool = false

    private var accentColor: Color {
        switch alert.type {
        case "health":      return .cfHealth
        case "attendance":  return .cfAttendance
        case "compliance":  return .cfCompliance
        case "message":     return .cfChildren
        case "document":    return .cfFamily
        case "absence":     return .cfAttendance
        default:            return .cfPrimary
        }
    }

    private var bgColor: Color {
        switch alert.type {
        case "health":      return .cfHealthBg
        case "attendance":  return .cfAttendanceBg
        case "compliance":  return .cfComplianceBg
        case "message":     return .cfChildrenBg
        case "document":    return .cfFamilyBg
        case "absence":     return .cfAttendanceBg
        default:            return .cfPrimaryLight
        }
    }

    var body: some View {
        HStack(spacing: 0) {
            // Left accent bar
            Rectangle()
                .fill(accentColor)
                .frame(width: 4)
                .clipShape(UnevenRoundedRectangle(
                    topLeadingRadius: 10, bottomLeadingRadius: 10,
                    bottomTrailingRadius: 0, topTrailingRadius: 0
                ))

            HStack(spacing: 12) {
                Image(systemName: alert.icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(accentColor)
                    .frame(width: 28)

                VStack(alignment: .leading, spacing: 3) {
                    Text(alert.title)
                        .font(.cfSubheadline)
                        .foregroundColor(.cfTextPrimary)
                    Text(alert.description)
                        .font(.cfCaption)
                        .foregroundColor(.cfTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
                if showsChevron {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(accentColor.opacity(0.6))
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
        }
        .background(bgColor)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .cfSubtleShadow()
    }
}

/// Section header used throughout the app
struct CFSectionHeader: View {
    let title: String
    var action: (label: String, handler: () -> Void)? = nil

    var body: some View {
        HStack {
            Text(title.uppercased())
                .font(.cfCaption2)
                .fontWeight(.semibold)
                .foregroundColor(.cfTextSecondary)
                .kerning(0.5)
            Spacer()
            if let action {
                Button(action: action.handler) {
                    Text(action.label)
                        .font(.cfCaption)
                        .foregroundColor(.cfPrimary)
                }
            }
        }
    }
}

/// Consistent empty state view
struct CFEmptyState: View {
    let icon: String
    let title: String
    let message: String
    var buttonLabel: String? = nil
    var buttonAction: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(Color.cfPrimaryLight)
                    .frame(width: 72, height: 72)
                Image(systemName: icon)
                    .font(.system(size: 30, weight: .medium))
                    .foregroundColor(.cfPrimary)
            }
            VStack(spacing: 6) {
                Text(title)
                    .font(.cfHeadline)
                    .foregroundColor(.cfTextPrimary)
                Text(message)
                    .font(.cfBody)
                    .foregroundColor(.cfTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }
            if let label = buttonLabel, let action = buttonAction {
                CFPrimaryButton(label, action: action)
            }
        }
        .padding(.vertical, 32)
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Module color lookup (for consistent icon colors across app)
enum CFModule {
    case children, attendance, health, compliance, family, messages, enrollment, reports, settings, nutrition, events, goals

    var color: Color {
        switch self {
        case .children:   return .cfChildren
        case .attendance: return .cfAttendance
        case .health:     return .cfHealth
        case .compliance: return .cfCompliance
        case .family:     return .cfPrimary
        case .messages:   return .cfPrimary
        case .enrollment: return .cfFamily
        case .reports:    return .cfCompliance
        case .settings:   return .cfTextSecondary
        case .nutrition:  return .cfAccent
        case .events:     return .cfGoals
        case .goals:      return .cfGoals
        }
    }

    var backgroundColor: Color {
        switch self {
        case .children:   return .cfChildrenBg
        case .attendance: return .cfAttendanceBg
        case .health:     return .cfHealthBg
        case .compliance: return .cfComplianceBg
        case .family:     return .cfPrimaryLight
        case .messages:   return .cfPrimaryLight
        case .enrollment: return .cfFamilyBg
        case .reports:    return .cfComplianceBg
        case .settings:   return Color(.systemGray6)
        case .nutrition:  return .cfAccentLight
        case .events:     return .cfGoalsBg
        case .goals:      return .cfGoalsBg
        }
    }

    var icon: String {
        switch self {
        case .children:   return "person.2.fill"
        case .attendance: return "checkmark.circle.fill"
        case .health:     return "heart.fill"
        case .compliance: return "checkmark.seal.fill"
        case .family:     return "house.fill"
        case .messages:   return "bubble.left.and.bubble.right.fill"
        case .enrollment: return "doc.badge.plus"
        case .reports:    return "chart.pie.fill"
        case .settings:   return "gear"
        case .nutrition:  return "fork.knife"
        case .events:     return "person.3.fill"
        case .goals:      return "target"
        }
    }
}
