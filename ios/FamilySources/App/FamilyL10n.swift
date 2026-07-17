import SwiftUI

// MARK: - #50 Multilingual Family App
// In-app localization engine for the SproutFamily target.
// Head Start Program Performance Standards (§1302.30–34) require family
// communication in the family's preferred language. This engine covers the
// six most common home languages in Head Start programs and switches live —
// no app restart — including right-to-left layout for Arabic.

enum FamilyLanguage: String, CaseIterable, Identifiable {
    case english = "en"
    case spanish = "es"
    case haitianCreole = "ht"
    case chinese = "zh-Hans"
    case vietnamese = "vi"
    case arabic = "ar"

    var id: String { rawValue }

    /// The language's name in that language — what a family member scans for.
    var nativeName: String {
        switch self {
        case .english: return "English"
        case .spanish: return "Español"
        case .haitianCreole: return "Kreyòl Ayisyen"
        case .chinese: return "简体中文"
        case .vietnamese: return "Tiếng Việt"
        case .arabic: return "العربية"
        }
    }

    var englishName: String {
        switch self {
        case .english: return "English"
        case .spanish: return "Spanish"
        case .haitianCreole: return "Haitian Creole"
        case .chinese: return "Chinese (Simplified)"
        case .vietnamese: return "Vietnamese"
        case .arabic: return "Arabic"
        }
    }

    var isRTL: Bool { self == .arabic }

    var locale: Locale { Locale(identifier: rawValue) }

    /// Best match for the device's preferred language on first launch.
    static func deviceDefault() -> FamilyLanguage {
        let preferred = Locale.preferredLanguages.first ?? "en"
        if preferred.hasPrefix("es") { return .spanish }
        if preferred.hasPrefix("ht") { return .haitianCreole }
        if preferred.hasPrefix("zh") { return .chinese }
        if preferred.hasPrefix("vi") { return .vietnamese }
        if preferred.hasPrefix("ar") { return .arabic }
        return .english
    }
}

// MARK: - Keys

enum L10nKey: String {
    // Welcome / onboarding
    case appTagline, getStarted, haveAccount, inviteNeeded
    case enterInviteTitle, enterInviteSubtitle, uniqueCode, continueBtn, whereFind, whereFindHelp
    case signUpTitle, invalidCode, codeVerified, programLabel, childLabel
    case createAccountTitle, createAccountSubtitle, emailAddress, dateOfBirth
    case createPassword, confirmPassword, passwordsDontMatch, createAccountBtn, registrationFailed
    case welcomeBack, email, password, signIn, noAccountSignUp, incorrectCredentials
    case chooseLanguage, languageFooter
    // Tabs
    case tabToday, tabHome, tabMessages, tabProgress, tabProfile
    // Today feed
    case noUpdatesToday, teachersWillShare, today, yesterday
    case meal, nap, diaper, noteWord, photo, activity, couldntLoadUpdates
    // Home
    case helloFmt, childUpdateSubtitle, childNotComing, reportAbsenceSubtitle
    case absenceReports, notifications, upcoming
    case approved, seeAdvocate, pendingReview
    case whoStayingHome, whenAndWhy, dateLabel, reasonLabel, addNoteOptional
    case sendToAdvocate, absenceFooter, reportAbsence, cancel
    case reasonIllness, reasonAppointment, reasonEmergency, reasonTransportation, reasonTravel, reasonOther
    case checkedInFmt, checkOut, checkInFmt, pickedUpFmt, droppedOffFmt
    case attendance, health, statusWord, teacherFmt, nextFmt, nextClosureFmt
    // Messages
    case noMessagesYet, teachersReachOut, reFmt, messagePlaceholder
    // Progress
    case noProgressData, progressWillAppear, attendanceChartFmt, thisWeekFmt
    case noAttendanceRecorded, dashedLine85, familyGoals, done
    case somethingWentWrong, pullToRefreshRetry, loadingChildren
    // Profile
    case myChildren, support, contactSupport, aboutSprout
    case signOut, signOutConfirm, about, appWord, forWord, versionWord, headStartFamilies
}

// MARK: - Engine

final class FamilyL10n: ObservableObject {
    static let shared = FamilyL10n()
    private static let storageKey = "family_app_language"

    @Published var language: FamilyLanguage {
        didSet {
            UserDefaults.standard.set(language.rawValue, forKey: Self.storageKey)
            // Sync to the server so incoming messages arrive auto-translated
            // into this language. Fire-and-forget: a miss just means the next
            // change (or app launch) re-syncs.
            let code = language.rawValue
            Task { try? await APIClient.shared.setPreferredLanguage(code) }
        }
    }

    private init() {
        if let saved = UserDefaults.standard.string(forKey: Self.storageKey),
           let lang = FamilyLanguage(rawValue: saved) {
            language = lang
        } else {
            language = FamilyLanguage.deviceDefault()
        }
    }

    func t(_ key: L10nKey) -> String {
        FamilyL10n.tables[language]?[key]
            ?? FamilyL10n.tables[.english]?[key]
            ?? key.rawValue
    }

    func t(_ key: L10nKey, _ args: CVarArg...) -> String {
        String(format: t(key), arguments: args)
    }

    var layoutDirection: LayoutDirection { language.isRTL ? .rightToLeft : .leftToRight }
    var locale: Locale { language.locale }
}

/// Global shorthands. Views that call these should also hold
/// `@ObservedObject private var l10n = FamilyL10n.shared` so they re-render on change.
func L(_ key: L10nKey) -> String { FamilyL10n.shared.t(key) }
func L(_ key: L10nKey, _ args: CVarArg...) -> String {
    String(format: FamilyL10n.shared.t(key), arguments: args)
}

// MARK: - Language picker UI

/// Compact globe menu for the welcome screen (pre-auth).
struct LanguageMenuButton: View {
    @ObservedObject private var l10n = FamilyL10n.shared

    var body: some View {
        Menu {
            ForEach(FamilyLanguage.allCases) { lang in
                Button {
                    withAnimation { l10n.language = lang }
                } label: {
                    if lang == l10n.language {
                        Label(lang.nativeName, systemImage: "checkmark")
                    } else {
                        Text(lang.nativeName)
                    }
                }
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "globe")
                Text(l10n.language.nativeName)
            }
            .font(.subheadline.weight(.medium))
            .foregroundColor(.accentColor)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(Color.accentColor.opacity(0.1))
            .clipShape(Capsule())
        }
    }
}

/// Full list-style picker section for the profile screen.
struct LanguagePickerSection: View {
    @ObservedObject private var l10n = FamilyL10n.shared

    var body: some View {
        Section {
            ForEach(FamilyLanguage.allCases) { lang in
                Button {
                    withAnimation { l10n.language = lang }
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(lang.nativeName)
                                .font(.subheadline.weight(.medium))
                                .foregroundColor(.primary)
                            if lang != .english {
                                Text(lang.englishName)
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                        Spacer()
                        if lang == l10n.language {
                            Image(systemName: "checkmark")
                                .foregroundColor(.accentColor)
                                .fontWeight(.semibold)
                        }
                    }
                }
            }
        } header: {
            Label(L(.chooseLanguage), systemImage: "globe")
        } footer: {
            Text(L(.languageFooter))
        }
    }
}

// MARK: - Translation tables

extension FamilyL10n {
    static let tables: [FamilyLanguage: [L10nKey: String]] = [
        .english: en, .spanish: es, .haitianCreole: ht,
        .chinese: zh, .vietnamese: vi, .arabic: ar,
    ]

    // ───────────────────────── English ─────────────────────────
    static let en: [L10nKey: String] = [
        .appTagline: "Stay connected with\nyour child's program",
        .getStarted: "Get Started",
        .haveAccount: "I already have an account",
        .inviteNeeded: "You need an invitation from your program to sign up.",
        .enterInviteTitle: "Enter Your Invitation Code",
        .enterInviteSubtitle: "Check the email sent to you by your child's program. It contains a unique code.",
        .uniqueCode: "Unique Code",
        .continueBtn: "Continue",
        .whereFind: "Where do I find this?",
        .whereFindHelp: "Your invitation code is on the welcome letter or email from your program. If you can't find it, ask your child's teacher or family advocate for a new one.",
        .signUpTitle: "Sign Up",
        .invalidCode: "Invalid code. Please check and try again.",
        .codeVerified: "Code verified!",
        .programLabel: "Program",
        .childLabel: "Child",
        .createAccountTitle: "Create Your Account",
        .createAccountSubtitle: "Use the email your invitation was sent to and your date of birth.",
        .emailAddress: "Email address",
        .dateOfBirth: "Date of Birth",
        .createPassword: "Create password",
        .confirmPassword: "Confirm password",
        .passwordsDontMatch: "Passwords don't match",
        .createAccountBtn: "Create Account",
        .registrationFailed: "Registration failed. Check your email and date of birth match your records.",
        .welcomeBack: "Welcome Back",
        .email: "Email",
        .password: "Password",
        .signIn: "Sign In",
        .noAccountSignUp: "Don't have an account? Sign up",
        .incorrectCredentials: "Incorrect email or password.",
        .chooseLanguage: "Language",
        .languageFooter: "Sprout will use this language everywhere in the app.",
        .tabToday: "Today", .tabHome: "Home", .tabMessages: "Messages",
        .tabProgress: "Progress", .tabProfile: "My Profile",
        .noUpdatesToday: "No updates yet today",
        .teachersWillShare: "Your child's teachers will share meals, naps, and moments here.",
        .today: "Today", .yesterday: "Yesterday",
        .meal: "Meal", .nap: "Nap", .diaper: "Diaper", .noteWord: "Note",
        .photo: "Photo", .activity: "Activity",
        .couldntLoadUpdates: "Couldn't load today's updates.",
        .helloFmt: "Hello, %@ 👋",
        .childUpdateSubtitle: "Here's an update on your child.",
        .childNotComing: "My child isn't coming",
        .reportAbsenceSubtitle: "Report an absence — your family advocate will confirm",
        .absenceReports: "Absence Reports",
        .notifications: "Notifications",
        .upcoming: "Upcoming",
        .approved: "Approved", .seeAdvocate: "See advocate", .pendingReview: "Pending review",
        .whoStayingHome: "Who is staying home?",
        .whenAndWhy: "When and why",
        .dateLabel: "Date", .reasonLabel: "Reason",
        .addNoteOptional: "Add a note (optional)",
        .sendToAdvocate: "Send to Family Advocate",
        .absenceFooter: "Your family advocate will review this. Once approved, the day is marked as an excused absence.",
        .reportAbsence: "Report Absence", .cancel: "Cancel",
        .reasonIllness: "Illness", .reasonAppointment: "Appointment",
        .reasonEmergency: "Family emergency", .reasonTransportation: "Transportation",
        .reasonTravel: "Travel", .reasonOther: "Other",
        .checkedInFmt: "Checked in %@", .checkOut: "Check out", .checkInFmt: "Check in %@",
        .pickedUpFmt: "Picked up %@", .droppedOffFmt: "Dropped off %@",
        .attendance: "Attendance", .health: "Health", .statusWord: "Status",
        .teacherFmt: "Teacher: %@", .nextFmt: "Next: %@", .nextClosureFmt: "Next closure: %@",
        .noMessagesYet: "No Messages Yet",
        .teachersReachOut: "Your child's teachers will reach out here.",
        .reFmt: "Re: %@", .messagePlaceholder: "Message",
        .noProgressData: "No progress data yet",
        .progressWillAppear: "Attendance and goal progress will appear here.",
        .somethingWentWrong: "Couldn't load this right now",
        .loadingChildren: "Loading your children…",
        .pullToRefreshRetry: "Pull down to try again.",
        .attendanceChartFmt: "%@ — Attendance", .thisWeekFmt: "%d%% this week",
        .noAttendanceRecorded: "No attendance recorded yet.",
        .dashedLine85: "Dashed line: the 85% attendance goal",
        .familyGoals: "Family Goals", .done: "Done",
        .myChildren: "My Children", .support: "Support",
        .contactSupport: "Contact Support", .aboutSprout: "About Sprout",
        .signOut: "Sign Out", .signOutConfirm: "Sign out?",
        .about: "About", .appWord: "App", .forWord: "For",
        .versionWord: "Version", .headStartFamilies: "Head Start Families",
    ]

    // ───────────────────────── Spanish ─────────────────────────
    static let es: [L10nKey: String] = [
        .appTagline: "Manténgase conectado con\nel programa de su hijo",
        .getStarted: "Comenzar",
        .haveAccount: "Ya tengo una cuenta",
        .inviteNeeded: "Necesita una invitación de su programa para registrarse.",
        .enterInviteTitle: "Ingrese su código de invitación",
        .enterInviteSubtitle: "Revise el correo que le envió el programa de su hijo. Contiene un código único.",
        .uniqueCode: "Código único",
        .continueBtn: "Continuar",
        .whereFind: "¿Dónde encuentro esto?",
        .whereFindHelp: "Su código de invitación está en la carta de bienvenida o el correo electrónico de su programa. Si no lo encuentra, pídale uno nuevo al maestro o al defensor familiar de su hijo.",
        .signUpTitle: "Registrarse",
        .invalidCode: "Código inválido. Verifíquelo e intente de nuevo.",
        .codeVerified: "¡Código verificado!",
        .programLabel: "Programa",
        .childLabel: "Niño/a",
        .createAccountTitle: "Cree su cuenta",
        .createAccountSubtitle: "Use el correo al que se envió su invitación y su fecha de nacimiento.",
        .emailAddress: "Correo electrónico",
        .dateOfBirth: "Fecha de nacimiento",
        .createPassword: "Crear contraseña",
        .confirmPassword: "Confirmar contraseña",
        .passwordsDontMatch: "Las contraseñas no coinciden",
        .createAccountBtn: "Crear cuenta",
        .registrationFailed: "Error al registrarse. Verifique que su correo y fecha de nacimiento coincidan con sus registros.",
        .welcomeBack: "Bienvenido de nuevo",
        .email: "Correo electrónico",
        .password: "Contraseña",
        .signIn: "Iniciar sesión",
        .noAccountSignUp: "¿No tiene cuenta? Regístrese",
        .incorrectCredentials: "Correo o contraseña incorrectos.",
        .chooseLanguage: "Idioma",
        .languageFooter: "Sprout usará este idioma en toda la aplicación.",
        .tabToday: "Hoy", .tabHome: "Inicio", .tabMessages: "Mensajes",
        .tabProgress: "Progreso", .tabProfile: "Mi perfil",
        .noUpdatesToday: "Aún no hay novedades hoy",
        .teachersWillShare: "Los maestros de su hijo compartirán comidas, siestas y momentos aquí.",
        .today: "Hoy", .yesterday: "Ayer",
        .meal: "Comida", .nap: "Siesta", .diaper: "Pañal", .noteWord: "Nota",
        .photo: "Foto", .activity: "Actividad",
        .couldntLoadUpdates: "No se pudieron cargar las novedades de hoy.",
        .helloFmt: "Hola, %@ 👋",
        .childUpdateSubtitle: "Aquí tiene novedades sobre su hijo.",
        .childNotComing: "Mi hijo no asistirá",
        .reportAbsenceSubtitle: "Reporte una ausencia — su trabajador familiar la confirmará",
        .absenceReports: "Reportes de ausencia",
        .notifications: "Notificaciones",
        .upcoming: "Próximamente",
        .approved: "Aprobada", .seeAdvocate: "Consulte a su trabajador", .pendingReview: "Pendiente de revisión",
        .whoStayingHome: "¿Quién se queda en casa?",
        .whenAndWhy: "Cuándo y por qué",
        .dateLabel: "Fecha", .reasonLabel: "Motivo",
        .addNoteOptional: "Agregar una nota (opcional)",
        .sendToAdvocate: "Enviar al trabajador familiar",
        .absenceFooter: "Su trabajador familiar lo revisará. Una vez aprobado, el día se marca como ausencia justificada.",
        .reportAbsence: "Reportar ausencia", .cancel: "Cancelar",
        .reasonIllness: "Enfermedad", .reasonAppointment: "Cita",
        .reasonEmergency: "Emergencia familiar", .reasonTransportation: "Transporte",
        .reasonTravel: "Viaje", .reasonOther: "Otro",
        .checkedInFmt: "Registrado a las %@", .checkOut: "Registrar salida", .checkInFmt: "Registrar a %@",
        .pickedUpFmt: "Recogido a las %@", .droppedOffFmt: "Dejado a las %@",
        .attendance: "Asistencia", .health: "Salud", .statusWord: "Estado",
        .teacherFmt: "Maestro/a: %@", .nextFmt: "Próximo: %@", .nextClosureFmt: "Próximo cierre: %@",
        .noMessagesYet: "Aún no hay mensajes",
        .teachersReachOut: "Los maestros de su hijo se comunicarán aquí.",
        .reFmt: "Sobre: %@", .messagePlaceholder: "Mensaje",
        .noProgressData: "Aún no hay datos de progreso",
        .progressWillAppear: "La asistencia y el progreso de metas aparecerán aquí.",
        .somethingWentWrong: "No se pudo cargar esto ahora",
        .loadingChildren: "Cargando a tus hijos…",
        .pullToRefreshRetry: "Desliza hacia abajo para volver a intentarlo.",
        .attendanceChartFmt: "%@ — Asistencia", .thisWeekFmt: "%d%% esta semana",
        .noAttendanceRecorded: "Aún no hay asistencia registrada.",
        .dashedLine85: "Línea punteada: la meta de asistencia del 85%",
        .familyGoals: "Metas familiares", .done: "Completada",
        .myChildren: "Mis hijos", .support: "Ayuda",
        .contactSupport: "Contactar soporte", .aboutSprout: "Acerca de Sprout",
        .signOut: "Cerrar sesión", .signOutConfirm: "¿Cerrar sesión?",
        .about: "Acerca de", .appWord: "Aplicación", .forWord: "Para",
        .versionWord: "Versión", .headStartFamilies: "Familias de Head Start",
    ]

    // ───────────────────── Haitian Creole ─────────────────────
    static let ht: [L10nKey: String] = [
        .appTagline: "Rete konekte ak\npwogram pitit ou a",
        .getStarted: "Kòmanse",
        .haveAccount: "Mwen deja gen yon kont",
        .inviteNeeded: "Ou bezwen yon envitasyon nan men pwogram ou an pou enskri.",
        .enterInviteTitle: "Antre kòd envitasyon ou a",
        .enterInviteSubtitle: "Tcheke imèl pwogram pitit ou a voye ba ou. Li gen yon kòd inik ladan.",
        .uniqueCode: "Kòd inik",
        .continueBtn: "Kontinye",
        .whereFind: "Ki kote mwen jwenn sa?",
        .whereFindHelp: "Kòd envitasyon ou a sou lèt oswa imèl byenveni pwogram ou an voye ba ou. Si ou pa jwenn li, mande pwofesè pitit ou a oswa defansè fanmi an yon nouvo kòd.",
        .signUpTitle: "Enskri",
        .invalidCode: "Kòd la pa bon. Tanpri verifye epi eseye ankò.",
        .codeVerified: "Kòd verifye!",
        .programLabel: "Pwogram",
        .childLabel: "Timoun",
        .createAccountTitle: "Kreye kont ou",
        .createAccountSubtitle: "Sèvi ak imèl kote envitasyon an te voye a ak dat nesans ou.",
        .emailAddress: "Adrès imèl",
        .dateOfBirth: "Dat nesans",
        .createPassword: "Kreye modpas",
        .confirmPassword: "Konfime modpas",
        .passwordsDontMatch: "Modpas yo pa menm",
        .createAccountBtn: "Kreye kont",
        .registrationFailed: "Enskripsyon an echwe. Verifye imèl ou ak dat nesans ou matche ak dosye ou yo.",
        .welcomeBack: "Byenveni ankò",
        .email: "Imèl",
        .password: "Modpas",
        .signIn: "Konekte",
        .noAccountSignUp: "Ou pa gen kont? Enskri",
        .incorrectCredentials: "Imèl oswa modpas pa kòrèk.",
        .chooseLanguage: "Lang",
        .languageFooter: "Sprout ap sèvi ak lang sa a toupatou nan aplikasyon an.",
        .tabToday: "Jodi a", .tabHome: "Akèy", .tabMessages: "Mesaj",
        .tabProgress: "Pwogrè", .tabProfile: "Pwofil mwen",
        .noUpdatesToday: "Poko gen nouvèl jodi a",
        .teachersWillShare: "Pwofesè pitit ou a ap pataje manje, dòmi, ak bèl moman isit la.",
        .today: "Jodi a", .yesterday: "Yè",
        .meal: "Manje", .nap: "Dòmi", .diaper: "Kouchèt", .noteWord: "Nòt",
        .photo: "Foto", .activity: "Aktivite",
        .couldntLoadUpdates: "Nou pa t ka chaje nouvèl jodi a.",
        .helloFmt: "Bonjou, %@ 👋",
        .childUpdateSubtitle: "Men dènye nouvèl sou pitit ou a.",
        .childNotComing: "Pitit mwen pap vini",
        .reportAbsenceSubtitle: "Rapòte yon absans — defansè fanmi ou ap konfime li",
        .absenceReports: "Rapò absans",
        .notifications: "Notifikasyon",
        .upcoming: "Sa k ap vini",
        .approved: "Apwouve", .seeAdvocate: "Wè defansè a", .pendingReview: "Ap tann revizyon",
        .whoStayingHome: "Ki moun k ap rete lakay?",
        .whenAndWhy: "Kilè ak poukisa",
        .dateLabel: "Dat", .reasonLabel: "Rezon",
        .addNoteOptional: "Ajoute yon nòt (si ou vle)",
        .sendToAdvocate: "Voye bay defansè fanmi an",
        .absenceFooter: "Defansè fanmi ou ap revize sa. Yon fwa li apwouve, jou a make kòm yon absans eskize.",
        .reportAbsence: "Rapòte absans", .cancel: "Anile",
        .reasonIllness: "Maladi", .reasonAppointment: "Randevou",
        .reasonEmergency: "Ijans fanmi", .reasonTransportation: "Transpò",
        .reasonTravel: "Vwayaj", .reasonOther: "Lòt",
        .checkedInFmt: "Antre a %@", .checkOut: "Soti", .checkInFmt: "Antre %@",
        .pickedUpFmt: "Ranmase a %@", .droppedOffFmt: "Depoze a %@",
        .attendance: "Prezans", .health: "Sante", .statusWord: "Estati",
        .teacherFmt: "Pwofesè: %@", .nextFmt: "Pwochen: %@", .nextClosureFmt: "Pwochen fèmti: %@",
        .noMessagesYet: "Poko gen mesaj",
        .teachersReachOut: "Pwofesè pitit ou a ap kontakte ou isit la.",
        .reFmt: "Konsènan: %@", .messagePlaceholder: "Mesaj",
        .noProgressData: "Poko gen done pwogrè",
        .progressWillAppear: "Prezans ak pwogrè objektif yo ap parèt isit la.",
        .somethingWentWrong: "Pa t kapab chaje sa a kounye a",
        .loadingChildren: "N ap chaje pitit ou yo…",
        .pullToRefreshRetry: "Rale desann pou eseye ankò.",
        .attendanceChartFmt: "%@ — Prezans", .thisWeekFmt: "%d%% semèn sa a",
        .noAttendanceRecorded: "Poko gen prezans anrejistre.",
        .dashedLine85: "Liy pwentiye a: objektif prezans 85% la",
        .familyGoals: "Objektif fanmi", .done: "Fini",
        .myChildren: "Pitit mwen yo", .support: "Sipò",
        .contactSupport: "Kontakte sipò", .aboutSprout: "Konsènan Sprout",
        .signOut: "Dekonekte", .signOutConfirm: "Dekonekte?",
        .about: "Konsènan", .appWord: "Aplikasyon", .forWord: "Pou",
        .versionWord: "Vèsyon", .headStartFamilies: "Fanmi Head Start yo",
    ]

    // ──────────────── Chinese (Simplified) ────────────────
    static let zh: [L10nKey: String] = [
        .appTagline: "与孩子的项目\n保持联系",
        .getStarted: "开始使用",
        .haveAccount: "我已有账户",
        .inviteNeeded: "您需要项目发出的邀请才能注册。",
        .enterInviteTitle: "输入您的邀请码",
        .enterInviteSubtitle: "请查看孩子所在项目发给您的电子邮件，其中包含一个专属邀请码。",
        .uniqueCode: "专属邀请码",
        .continueBtn: "继续",
        .whereFind: "在哪里能找到？",
        .whereFindHelp: "您的邀请码在项目发送的欢迎信或邮件中。如果找不到，请向孩子的老师或家庭顾问索取新的邀请码。",
        .signUpTitle: "注册",
        .invalidCode: "邀请码无效。请检查后重试。",
        .codeVerified: "验证成功！",
        .programLabel: "项目",
        .childLabel: "孩子",
        .createAccountTitle: "创建您的账户",
        .createAccountSubtitle: "请使用收到邀请的电子邮箱和您的出生日期。",
        .emailAddress: "电子邮箱",
        .dateOfBirth: "出生日期",
        .createPassword: "创建密码",
        .confirmPassword: "确认密码",
        .passwordsDontMatch: "两次输入的密码不一致",
        .createAccountBtn: "创建账户",
        .registrationFailed: "注册失败。请确认您的邮箱和出生日期与记录一致。",
        .welcomeBack: "欢迎回来",
        .email: "电子邮箱",
        .password: "密码",
        .signIn: "登录",
        .noAccountSignUp: "没有账户？注册",
        .incorrectCredentials: "邮箱或密码不正确。",
        .chooseLanguage: "语言",
        .languageFooter: "Sprout 将在整个应用中使用此语言。",
        .tabToday: "今天", .tabHome: "首页", .tabMessages: "消息",
        .tabProgress: "进展", .tabProfile: "我的资料",
        .noUpdatesToday: "今天还没有动态",
        .teachersWillShare: "孩子的老师会在这里分享用餐、午睡和精彩时刻。",
        .today: "今天", .yesterday: "昨天",
        .meal: "用餐", .nap: "午睡", .diaper: "换尿布", .noteWord: "备注",
        .photo: "照片", .activity: "活动",
        .couldntLoadUpdates: "无法加载今天的动态。",
        .helloFmt: "您好，%@ 👋",
        .childUpdateSubtitle: "这是您孩子的最新情况。",
        .childNotComing: "我的孩子今天不来",
        .reportAbsenceSubtitle: "报告缺勤 — 您的家庭专员将进行确认",
        .absenceReports: "缺勤报告",
        .notifications: "通知",
        .upcoming: "即将到来",
        .approved: "已批准", .seeAdvocate: "请联系专员", .pendingReview: "待审核",
        .whoStayingHome: "谁要待在家里？",
        .whenAndWhy: "时间和原因",
        .dateLabel: "日期", .reasonLabel: "原因",
        .addNoteOptional: "添加备注（可选）",
        .sendToAdvocate: "发送给家庭专员",
        .absenceFooter: "您的家庭专员将审核此报告。批准后，当天将记为准假缺勤。",
        .reportAbsence: "报告缺勤", .cancel: "取消",
        .reasonIllness: "生病", .reasonAppointment: "预约就诊",
        .reasonEmergency: "家庭紧急情况", .reasonTransportation: "交通问题",
        .reasonTravel: "出行", .reasonOther: "其他",
        .checkedInFmt: "已签到 %@", .checkOut: "签退", .checkInFmt: "为%@签到",
        .pickedUpFmt: "已接走 %@", .droppedOffFmt: "已送到 %@",
        .attendance: "出勤", .health: "健康", .statusWord: "状态",
        .teacherFmt: "老师：%@", .nextFmt: "下一项：%@", .nextClosureFmt: "下次停课：%@",
        .noMessagesYet: "暂无消息",
        .teachersReachOut: "孩子的老师会在这里与您联系。",
        .reFmt: "关于：%@", .messagePlaceholder: "消息",
        .noProgressData: "暂无进展数据",
        .progressWillAppear: "出勤和目标进展将显示在这里。",
        .somethingWentWrong: "暂时无法加载",
        .loadingChildren: "正在加载您的孩子信息…",
        .pullToRefreshRetry: "下拉以重试。",
        .attendanceChartFmt: "%@ — 出勤", .thisWeekFmt: "本周 %d%%",
        .noAttendanceRecorded: "尚无出勤记录。",
        .dashedLine85: "虚线：85% 出勤目标",
        .familyGoals: "家庭目标", .done: "已完成",
        .myChildren: "我的孩子", .support: "支持",
        .contactSupport: "联系客服", .aboutSprout: "关于 Sprout",
        .signOut: "退出登录", .signOutConfirm: "退出登录？",
        .about: "关于", .appWord: "应用", .forWord: "适用于",
        .versionWord: "版本", .headStartFamilies: "Head Start 家庭",
    ]

    // ───────────────────── Vietnamese ─────────────────────
    static let vi: [L10nKey: String] = [
        .appTagline: "Luôn kết nối với\nchương trình của con bạn",
        .getStarted: "Bắt đầu",
        .haveAccount: "Tôi đã có tài khoản",
        .inviteNeeded: "Bạn cần thư mời từ chương trình để đăng ký.",
        .enterInviteTitle: "Nhập mã mời của bạn",
        .enterInviteSubtitle: "Kiểm tra email do chương trình của con bạn gửi. Trong đó có một mã riêng.",
        .uniqueCode: "Mã riêng",
        .continueBtn: "Tiếp tục",
        .whereFind: "Tôi tìm mã này ở đâu?",
        .whereFindHelp: "Mã mời của bạn có trên thư hoặc email chào mừng từ chương trình. Nếu không tìm thấy, hãy hỏi giáo viên hoặc người ủng hộ gia đình của con bạn để lấy mã mới.",
        .signUpTitle: "Đăng ký",
        .invalidCode: "Mã không hợp lệ. Vui lòng kiểm tra và thử lại.",
        .codeVerified: "Đã xác minh mã!",
        .programLabel: "Chương trình",
        .childLabel: "Trẻ",
        .createAccountTitle: "Tạo tài khoản của bạn",
        .createAccountSubtitle: "Dùng email nhận thư mời và ngày sinh của bạn.",
        .emailAddress: "Địa chỉ email",
        .dateOfBirth: "Ngày sinh",
        .createPassword: "Tạo mật khẩu",
        .confirmPassword: "Xác nhận mật khẩu",
        .passwordsDontMatch: "Mật khẩu không khớp",
        .createAccountBtn: "Tạo tài khoản",
        .registrationFailed: "Đăng ký thất bại. Kiểm tra email và ngày sinh của bạn khớp với hồ sơ.",
        .welcomeBack: "Chào mừng trở lại",
        .email: "Email",
        .password: "Mật khẩu",
        .signIn: "Đăng nhập",
        .noAccountSignUp: "Chưa có tài khoản? Đăng ký",
        .incorrectCredentials: "Email hoặc mật khẩu không đúng.",
        .chooseLanguage: "Ngôn ngữ",
        .languageFooter: "Sprout sẽ dùng ngôn ngữ này trong toàn bộ ứng dụng.",
        .tabToday: "Hôm nay", .tabHome: "Trang chủ", .tabMessages: "Tin nhắn",
        .tabProgress: "Tiến độ", .tabProfile: "Hồ sơ",
        .noUpdatesToday: "Hôm nay chưa có cập nhật",
        .teachersWillShare: "Giáo viên của con bạn sẽ chia sẻ bữa ăn, giấc ngủ và khoảnh khắc tại đây.",
        .today: "Hôm nay", .yesterday: "Hôm qua",
        .meal: "Bữa ăn", .nap: "Ngủ trưa", .diaper: "Thay tã", .noteWord: "Ghi chú",
        .photo: "Ảnh", .activity: "Hoạt động",
        .couldntLoadUpdates: "Không tải được cập nhật hôm nay.",
        .helloFmt: "Xin chào, %@ 👋",
        .childUpdateSubtitle: "Đây là thông tin mới về con bạn.",
        .childNotComing: "Con tôi không đến lớp",
        .reportAbsenceSubtitle: "Báo vắng mặt — nhân viên hỗ trợ gia đình sẽ xác nhận",
        .absenceReports: "Báo cáo vắng mặt",
        .notifications: "Thông báo",
        .upcoming: "Sắp tới",
        .approved: "Đã duyệt", .seeAdvocate: "Gặp nhân viên hỗ trợ", .pendingReview: "Chờ duyệt",
        .whoStayingHome: "Ai sẽ ở nhà?",
        .whenAndWhy: "Khi nào và vì sao",
        .dateLabel: "Ngày", .reasonLabel: "Lý do",
        .addNoteOptional: "Thêm ghi chú (không bắt buộc)",
        .sendToAdvocate: "Gửi cho nhân viên hỗ trợ gia đình",
        .absenceFooter: "Nhân viên hỗ trợ gia đình sẽ xem xét. Sau khi duyệt, ngày đó được tính là vắng có phép.",
        .reportAbsence: "Báo vắng mặt", .cancel: "Hủy",
        .reasonIllness: "Ốm đau", .reasonAppointment: "Hẹn khám",
        .reasonEmergency: "Việc khẩn gia đình", .reasonTransportation: "Đi lại",
        .reasonTravel: "Đi xa", .reasonOther: "Khác",
        .checkedInFmt: "Đã vào lớp lúc %@", .checkOut: "Đón về", .checkInFmt: "Cho %@ vào lớp",
        .pickedUpFmt: "Đón lúc %@", .droppedOffFmt: "Đưa đến lúc %@",
        .attendance: "Chuyên cần", .health: "Sức khỏe", .statusWord: "Trạng thái",
        .teacherFmt: "Giáo viên: %@", .nextFmt: "Tiếp theo: %@", .nextClosureFmt: "Ngày nghỉ tới: %@",
        .noMessagesYet: "Chưa có tin nhắn",
        .teachersReachOut: "Giáo viên của con bạn sẽ liên hệ tại đây.",
        .reFmt: "Về: %@", .messagePlaceholder: "Tin nhắn",
        .noProgressData: "Chưa có dữ liệu tiến độ",
        .progressWillAppear: "Chuyên cần và tiến độ mục tiêu sẽ hiển thị tại đây.",
        .somethingWentWrong: "Không thể tải lúc này",
        .loadingChildren: "Đang tải thông tin con của bạn…",
        .pullToRefreshRetry: "Kéo xuống để thử lại.",
        .attendanceChartFmt: "%@ — Chuyên cần", .thisWeekFmt: "%d%% tuần này",
        .noAttendanceRecorded: "Chưa có dữ liệu chuyên cần.",
        .dashedLine85: "Đường đứt nét: mục tiêu chuyên cần 85%",
        .familyGoals: "Mục tiêu gia đình", .done: "Hoàn thành",
        .myChildren: "Các con của tôi", .support: "Hỗ trợ",
        .contactSupport: "Liên hệ hỗ trợ", .aboutSprout: "Về Sprout",
        .signOut: "Đăng xuất", .signOutConfirm: "Đăng xuất?",
        .about: "Giới thiệu", .appWord: "Ứng dụng", .forWord: "Dành cho",
        .versionWord: "Phiên bản", .headStartFamilies: "Gia đình Head Start",
    ]

    // ───────────────────────── Arabic ─────────────────────────
    static let ar: [L10nKey: String] = [
        .appTagline: "ابقَ على تواصل مع\nبرنامج طفلك",
        .getStarted: "ابدأ الآن",
        .haveAccount: "لديّ حساب بالفعل",
        .inviteNeeded: "تحتاج إلى دعوة من برنامجك للتسجيل.",
        .enterInviteTitle: "أدخل رمز الدعوة",
        .enterInviteSubtitle: "تحقق من البريد الإلكتروني الذي أرسله لك برنامج طفلك. يحتوي على رمز خاص.",
        .uniqueCode: "الرمز الخاص",
        .continueBtn: "متابعة",
        .whereFind: "أين أجد هذا الرمز؟",
        .whereFindHelp: "رمز الدعوة موجود في رسالة الترحيب أو البريد الإلكتروني من برنامجك. إذا لم تجده، اطلب رمزًا جديدًا من معلم طفلك أو أخصائي شؤون الأسرة.",
        .signUpTitle: "التسجيل",
        .invalidCode: "الرمز غير صحيح. يرجى التحقق والمحاولة مرة أخرى.",
        .codeVerified: "تم التحقق من الرمز!",
        .programLabel: "البرنامج",
        .childLabel: "الطفل",
        .createAccountTitle: "أنشئ حسابك",
        .createAccountSubtitle: "استخدم البريد الإلكتروني الذي أُرسلت إليه الدعوة وتاريخ ميلادك.",
        .emailAddress: "البريد الإلكتروني",
        .dateOfBirth: "تاريخ الميلاد",
        .createPassword: "إنشاء كلمة المرور",
        .confirmPassword: "تأكيد كلمة المرور",
        .passwordsDontMatch: "كلمتا المرور غير متطابقتين",
        .createAccountBtn: "إنشاء حساب",
        .registrationFailed: "فشل التسجيل. تأكد من تطابق بريدك الإلكتروني وتاريخ ميلادك مع السجلات.",
        .welcomeBack: "مرحبًا بعودتك",
        .email: "البريد الإلكتروني",
        .password: "كلمة المرور",
        .signIn: "تسجيل الدخول",
        .noAccountSignUp: "ليس لديك حساب؟ سجّل الآن",
        .incorrectCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
        .chooseLanguage: "اللغة",
        .languageFooter: "سيستخدم سبراوت هذه اللغة في جميع أنحاء التطبيق.",
        .tabToday: "اليوم", .tabHome: "الرئيسية", .tabMessages: "الرسائل",
        .tabProgress: "التقدّم", .tabProfile: "ملفي",
        .noUpdatesToday: "لا توجد تحديثات اليوم بعد",
        .teachersWillShare: "سيشارك معلمو طفلك الوجبات والقيلولة واللحظات هنا.",
        .today: "اليوم", .yesterday: "أمس",
        .meal: "وجبة", .nap: "قيلولة", .diaper: "حفاض", .noteWord: "ملاحظة",
        .photo: "صورة", .activity: "نشاط",
        .couldntLoadUpdates: "تعذّر تحميل تحديثات اليوم.",
        .helloFmt: "مرحبًا، %@ 👋",
        .childUpdateSubtitle: "إليك آخر المستجدات عن طفلك.",
        .childNotComing: "طفلي لن يحضر",
        .reportAbsenceSubtitle: "أبلغ عن غياب — سيؤكده مرشد الأسرة",
        .absenceReports: "تقارير الغياب",
        .notifications: "الإشعارات",
        .upcoming: "القادم",
        .approved: "مقبول", .seeAdvocate: "راجع مرشد الأسرة", .pendingReview: "قيد المراجعة",
        .whoStayingHome: "من سيبقى في المنزل؟",
        .whenAndWhy: "متى ولماذا",
        .dateLabel: "التاريخ", .reasonLabel: "السبب",
        .addNoteOptional: "أضف ملاحظة (اختياري)",
        .sendToAdvocate: "إرسال إلى مرشد الأسرة",
        .absenceFooter: "سيراجع مرشد الأسرة هذا الطلب. بعد الموافقة، يُسجَّل اليوم كغياب بعذر.",
        .reportAbsence: "الإبلاغ عن غياب", .cancel: "إلغاء",
        .reasonIllness: "مرض", .reasonAppointment: "موعد",
        .reasonEmergency: "طارئ عائلي", .reasonTransportation: "مواصلات",
        .reasonTravel: "سفر", .reasonOther: "أخرى",
        .checkedInFmt: "تم الحضور %@", .checkOut: "تسجيل الانصراف", .checkInFmt: "تسجيل حضور %@",
        .pickedUpFmt: "تم الاصطحاب %@", .droppedOffFmt: "تم التوصيل %@",
        .attendance: "الحضور", .health: "الصحة", .statusWord: "الحالة",
        .teacherFmt: "المعلم: %@", .nextFmt: "التالي: %@", .nextClosureFmt: "الإغلاق القادم: %@",
        .noMessagesYet: "لا توجد رسائل بعد",
        .teachersReachOut: "سيتواصل معلمو طفلك معك هنا.",
        .reFmt: "بخصوص: %@", .messagePlaceholder: "رسالة",
        .noProgressData: "لا توجد بيانات تقدّم بعد",
        .progressWillAppear: "سيظهر الحضور وتقدّم الأهداف هنا.",
        .somethingWentWrong: "تعذّر تحميل هذا الآن",
        .loadingChildren: "جارٍ تحميل بيانات أطفالك…",
        .pullToRefreshRetry: "اسحب للأسفل للمحاولة مرة أخرى.",
        .attendanceChartFmt: "%@ — الحضور", .thisWeekFmt: "%d%% هذا الأسبوع",
        .noAttendanceRecorded: "لم يُسجَّل حضور بعد.",
        .dashedLine85: "الخط المتقطع: هدف الحضور 85%",
        .familyGoals: "أهداف الأسرة", .done: "منجز",
        .myChildren: "أطفالي", .support: "الدعم",
        .contactSupport: "التواصل مع الدعم", .aboutSprout: "حول سبراوت",
        .signOut: "تسجيل الخروج", .signOutConfirm: "تسجيل الخروج؟",
        .about: "حول", .appWord: "التطبيق", .forWord: "مخصص لـ",
        .versionWord: "الإصدار", .headStartFamilies: "أسر هيد ستارت",
    ]
}
