import SwiftUI

// MARK: - Compliance View

struct ComplianceView: View {
    @StateObject private var viewModel = ComplianceViewModel()

    var body: some View {
        List {
            Section {
                ComplianceScoreCard(score: viewModel.overallScore)
                    .listRowBackground(Color.clear)
                    .listRowInsets(.init())
            }

            Section("PIR Sections") {
                ForEach(viewModel.pirSections) { section in
                    NavigationLink(destination: PIRSectionDetailView(section: section, viewModel: viewModel)) {
                        PIRSectionRow(section: section)
                    }
                }
            }

            Section("Monitoring Checklist") {
                ForEach($viewModel.checklistItems) { $item in
                    ChecklistItemRow(item: $item)
                }
            }
        }
        .navigationTitle("Compliance")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    Task { await viewModel.load() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
            }
        }
        .task { await viewModel.load() }
        .overlay {
            if viewModel.isLoading { ProgressView() }
        }
    }
}

// MARK: - Score Card

struct ComplianceScoreCard: View {
    let score: Int

    var color: Color {
        score >= 90 ? .cfAttendance : score >= 70 ? .orange : .cfHealth
    }

    var body: some View {
        VStack(spacing: 10) {
            HStack(alignment: .lastTextBaseline, spacing: 4) {
                Text("\(score)")
                    .font(.system(size: 52, weight: .bold))
                    .foregroundColor(color)
                Text("%")
                    .font(.title2.weight(.semibold))
                    .foregroundColor(color)
            }
            Text("Overall Compliance Score")
                .font(.cfSubheadline)
                .foregroundColor(.cfTextSecondary)
            ProgressView(value: Double(score), total: 100)
                .tint(color)
                .padding(.horizontal)

            HStack(spacing: 20) {
                ComplianceMiniStat(label: "PIR Ready", value: score >= 85 ? "Yes" : "No", color: score >= 85 ? .cfAttendance : .cfHealth)
                ComplianceMiniStat(label: "Monitoring", value: "Current", color: .cfAttendance)
                ComplianceMiniStat(label: "Fiscal Year", value: "2025–26", color: .cfPrimary)
            }
            .padding(.top, 4)
        }
        .padding(20)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .padding(4)
    }
}

struct ComplianceMiniStat: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.cfCaption.weight(.semibold))
                .foregroundColor(color)
            Text(label)
                .font(.cfCaption2)
                .foregroundColor(.cfTextSecondary)
        }
    }
}

// MARK: - PIR Section Row

struct PIRSectionRow: View {
    let section: PIRSection

    var color: Color { section.completionRate >= 90 ? .cfAttendance : section.completionRate >= 70 ? .orange : .cfHealth }

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(section.name)
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(.cfTextPrimary)
                Text(section.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text("\(section.completionRate)%")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(color)
                ProgressView(value: Double(section.completionRate), total: 100)
                    .frame(width: 60)
                    .tint(color)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - PIR Section Detail

struct PIRSectionDetailView: View {
    let section: PIRSection
    @ObservedObject var viewModel: ComplianceViewModel
    @State private var showNotes = false
    @State private var notes = ""

    var color: Color { section.completionRate >= 90 ? .cfAttendance : section.completionRate >= 70 ? .orange : .cfHealth }

    // Get live section
    var live: PIRSection { viewModel.pirSections.first(where: { $0.id == section.id }) ?? section }

    var body: some View {
        List {
            Section {
                VStack(spacing: 12) {
                    HStack(alignment: .lastTextBaseline, spacing: 4) {
                        Text("\(live.completionRate)")
                            .font(.system(size: 44, weight: .bold))
                            .foregroundColor(color)
                        Text("% complete")
                            .font(.cfSubheadline)
                            .foregroundColor(.secondary)
                    }
                    ProgressView(value: Double(live.completionRate), total: 100)
                        .tint(color)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .listRowBackground(Color.clear)
            }

            Section("About This Section") {
                Text(live.description)
                    .font(.cfBody)
                    .foregroundColor(.cfTextPrimary)
                    .padding(.vertical, 2)
            }

            Section("Required Items") {
                ForEach(live.requirementItems, id: \.self) { item in
                    HStack(spacing: 10) {
                        Image(systemName: live.completionRate >= 90 ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(live.completionRate >= 90 ? .cfAttendance : .secondary)
                            .font(.system(size: 16))
                        Text(item)
                            .font(.cfSubheadline)
                            .foregroundColor(.cfTextPrimary)
                    }
                    .padding(.vertical, 2)
                }
            }

            Section("Actions") {
                Button {
                    viewModel.incrementSection(live)
                } label: {
                    Label("Mark Progress (+5%)", systemImage: "arrow.up.circle.fill")
                        .foregroundColor(.cfPrimary)
                }
                .disabled(live.completionRate >= 100)

                Button { showNotes = true } label: {
                    Label("Add Note", systemImage: "square.and.pencil")
                        .foregroundColor(.cfChildren)
                }
            }
        }
        .navigationTitle(live.name)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showNotes) {
            NavigationStack {
                Form {
                    Section("Compliance Note") {
                        TextEditor(text: $notes)
                            .frame(minHeight: 100)
                    }
                    Section {
                        Button("Save Note") { showNotes = false }
                            .frame(maxWidth: .infinity, alignment: .center)
                            .foregroundColor(.cfPrimary)
                            .fontWeight(.semibold)
                    }
                }
                .navigationTitle("Add Note")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { showNotes = false } }
                }
            }
        }
    }
}

// MARK: - Checklist Item Row

struct ChecklistItemRow: View {
    @Binding var item: ComplianceChecklistItem

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: item.isCompliant ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                .foregroundColor(item.isCompliant ? .cfAttendance : .cfHealth)
                .font(.system(size: 18))
                .onTapGesture { item.isCompliant.toggle() }

            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.subheadline)
                    .foregroundColor(.cfTextPrimary)
                if let note = item.note {
                    Text(note)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            Spacer()
            Toggle("", isOn: $item.isCompliant)
                .labelsHidden()
                .tint(.cfPrimary)
        }
        .padding(.vertical, 2)
    }
}

// MARK: - ViewModel

@MainActor
class ComplianceViewModel: ObservableObject {
    @Published var overallScore: Int = 0
    @Published var pirSections: [PIRSection] = []
    @Published var checklistItems: [ComplianceChecklistItem] = []
    @Published var isLoading = false

    var computedScore: Int {
        let checkScore = checklistItems.isEmpty ? 100 :
            Int(Double(checklistItems.filter(\.isCompliant).count) / Double(checklistItems.count) * 100)
        let pirScore = pirSections.isEmpty ? 100 :
            pirSections.map(\.completionRate).reduce(0, +) / pirSections.count
        return (checkScore + pirScore) / 2
    }

    func incrementSection(_ section: PIRSection) {
        guard let i = pirSections.firstIndex(where: { $0.id == section.id }) else { return }
        let newRate = min(section.completionRate + 5, 100)
        pirSections[i] = PIRSection(id: section.id, name: section.name,
                                    description: section.description, completionRate: newRate)
        overallScore = computedScore
    }

    func load() async {
        isLoading = true
        do {
            let data = try await APIClient.shared.getComplianceData()
            overallScore = data.overallScore
            pirSections  = data.pirSections
            checklistItems = data.checklistItems
        } catch {
            #if DEBUG
            pirSections = [
                PIRSection(id:"p1", name:"Child Development & Education",  description:"Developmental screenings, IEP support, school readiness goals",          completionRate:92),
                PIRSection(id:"p2", name:"Family & Community Engagement",   description:"Home visits, family goal plans, parent meetings, community referrals",    completionRate:78),
                PIRSection(id:"p3", name:"Health & Disabilities",           description:"Medical, dental, vision, hearing screenings; disability services plan",   completionRate:65),
                PIRSection(id:"p4", name:"Program Design & Management",     description:"Staff credentials, ratios, training hours, facilities safety review",    completionRate:88),
                PIRSection(id:"p5", name:"Fiscal & Governance",             description:"Budget tracking, OMB compliance, board meeting minutes, grant reporting", completionRate:95),
            ]
            checklistItems = [
                ComplianceChecklistItem(id:"c1",  title:"All staff TB tests current",                   isCompliant:true,  note:nil),
                ComplianceChecklistItem(id:"c2",  title:"CPR/First Aid certifications up to date",      isCompliant:true,  note:nil),
                ComplianceChecklistItem(id:"c3",  title:"Child-to-staff ratios maintained",             isCompliant:true,  note:"1:8 for 3-year-olds"),
                ComplianceChecklistItem(id:"c4",  title:"Developmental screenings completed by 45 days",isCompliant:false, note:"3 children pending ASQ-3"),
                ComplianceChecklistItem(id:"c5",  title:"Health & safety checklists completed",         isCompliant:true,  note:"Monthly"),
                ComplianceChecklistItem(id:"c6",  title:"Family goal plans updated this quarter",       isCompliant:false, note:"5 families need updated plans"),
                ComplianceChecklistItem(id:"c7",  title:"Transportation safety certifications current",  isCompliant:true,  note:nil),
                ComplianceChecklistItem(id:"c8",  title:"Emergency evacuation drill conducted",         isCompliant:true,  note:"Completed October 2025"),
            ]
            overallScore = computedScore
            #endif
        }
        isLoading = false
    }
}

// MARK: - PIRSection extension

extension PIRSection {
    var requirementItems: [String] {
        switch id {
        case "p1": return ["Developmental screenings (ASQ-3/ASQ:SE)", "IEP/IFSP participation", "School readiness assessments", "Transition plans to kindergarten"]
        case "p2": return ["2 home visits per family per year", "Family partnership agreements", "Parent committee meetings", "Community referrals tracked"]
        case "p3": return ["Physical exams within 90 days", "Dental exams annually", "Vision & hearing screenings", "Disabilities services coordination"]
        case "p4": return ["Staff credential verification", "Training hours ≥ 15/year per staff", "Classroom ratios documented", "Facility safety inspections"]
        case "p5": return ["Monthly budget reconciliation", "Board meeting minutes filed", "Grant reporting on schedule", "Audit findings resolved"]
        default:   return ["Review program records", "Complete required documentation"]
        }
    }
}
